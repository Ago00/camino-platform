/**
 * GET /[slug]/api/comentarios — muro de comentarios públicos en hilos
 * (FP3a, DT-030), paginado por offset sobre los comentarios raíz.
 * POST /[slug]/api/comentarios — nuevo comentario raíz o respuesta a una raíz.
 *
 * El slug se resuelve a un reto_id mediante obtenerRetoPorSlug (DT-026, FP1) y
 * toda consulta filtra por él (DT-028). GET filtra además `oculto = false`
 * (defensa en profundidad: la RLS de anon ya lo impone, y desde 0011 oculta
 * también las respuestas de una raíz oculta).
 *
 * Las reglas del hilo (un solo nivel, padre raíz pública visible del mismo
 * reto, respuestas siempre públicas, `es_autor` solo desde el admin) están en
 * BD (migración 0011); aquí se validan antes para responder 400/422 claros.
 *
 * Configuración del reto (FP3c, DT-032): con la sección de comentarios apagada
 * GET y POST responden 403; con las respuestas de visitantes apagadas, un POST
 * con `parent_id` responde 403 sin leer el padre. La política RLS de INSERT
 * (0012) aplica las mismas reglas a un POST directo a PostgREST; si el admin
 * cambia la configuración entre esta comprobación y el insert, el rechazo de
 * RLS (42501) también se traduce a 403.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { agruparHilos, motivoRechazoPadre, type RespuestaPublicaConPadre } from "@/lib/comentarios/hilos";
import { consumir, obtenerIpCliente } from "@/lib/rate-limit";
import { configDelReto } from "@/lib/retos/config";
import { getSupabasePublic } from "@/lib/supabase/public";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";
import type { RespuestaMuro } from "@/lib/types";

export const runtime = "nodejs";

const TAMANO_PAGINA_POR_DEFECTO = 20;
const VENTANA_MS = 60_000;
const LIMITE_GET_POR_MINUTO = 60;
const LIMITE_POST_POR_MINUTO = 10;

const COLUMNAS_PUBLICAS = "id, nombre, texto, created_at, es_autor";

/** Postgres `check_violation`: lo lanza el trigger si el padre deja de ser
 * válido entre la comprobación y el insert. */
const CODIGO_CHECK_VIOLATION = "23514";

/** Postgres `insufficient_privilege`: la política RLS de INSERT rechazó la fila. */
const CODIGO_RLS_RECHAZO = "42501";

function respuestaNoDisponible(): NextResponse {
  return NextResponse.json({ error: "no disponible" }, { status: 403 });
}

const MENSAJE_RESPUESTA_NO_PERMITIDA = "no se puede responder a este comentario";

const queryPaginacion = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(TAMANO_PAGINA_POR_DEFECTO),
});

const nombre = z.string().trim().min(1).max(80);
const texto = z.string().trim().min(1).max(1000);

// `.strict()` en ambos: un cuerpo con `es_autor`, o una respuesta con
// `visibilidad`, no encaja en ninguna rama y se rechaza con 400.
const nuevaRaiz = z.object({ nombre, texto, visibilidad: z.enum(["publico", "privado"]) }).strict();
const nuevaRespuesta = z.object({ nombre, texto, parent_id: z.number().int().positive() }).strict();
const nuevoComentario = z.union([nuevaRaiz, nuevaRespuesta]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  if (!consumir(obtenerIpCliente(request), LIMITE_GET_POR_MINUTO, VENTANA_MS)) {
    return new NextResponse(null, { status: 429 });
  }

  const paginacion = queryPaginacion.safeParse({
    offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!paginacion.success) {
    return NextResponse.json({ error: "parámetros de paginación inválidos" }, { status: 400 });
  }

  const { slug } = await params;
  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) {
    return NextResponse.json({ error: "reto no encontrado" }, { status: 404 });
  }
  if (!configDelReto(reto).seccion_comentarios) return respuestaNoDisponible();

  const { offset, limit } = paginacion.data;
  const supabase = getSupabasePublic();

  const { data: raices, error: errorRaices } = await supabase
    .from("comentarios")
    .select(COLUMNAS_PUBLICAS)
    .eq("reto_id", reto.id)
    .eq("oculto", false)
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (errorRaices) {
    return NextResponse.json({ error: "no se pudieron cargar los comentarios" }, { status: 500 });
  }

  const paginaRaices = raices ?? [];
  const idsRaices = paginaRaices.map((raiz) => raiz.id);
  let respuestas: RespuestaPublicaConPadre[] = [];

  if (idsRaices.length > 0) {
    const { data, error } = await supabase
      .from("comentarios")
      .select(`${COLUMNAS_PUBLICAS}, parent_id`)
      .eq("reto_id", reto.id)
      .eq("oculto", false)
      .in("parent_id", idsRaices)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "no se pudieron cargar los comentarios" }, { status: 500 });
    }
    // `.in("parent_id", ...)` ya excluye los null; el flatMap solo estrecha el tipo.
    respuestas = (data ?? []).flatMap(({ parent_id, ...resto }) =>
      parent_id === null ? [] : [{ ...resto, parent_id }]
    );
  }

  const cuerpo: RespuestaMuro = {
    comentarios: agruparHilos(paginaRaices, respuestas),
    siguienteOffset: paginaRaices.length === limit ? offset + limit : null,
  };

  return NextResponse.json(cuerpo);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  if (!consumir(obtenerIpCliente(request), LIMITE_POST_POR_MINUTO, VENTANA_MS)) {
    return new NextResponse(null, { status: 429 });
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "cuerpo de la petición inválido" }, { status: 400 });
  }

  const parsed = nuevoComentario.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "datos de comentario inválidos" }, { status: 400 });
  }

  const { slug } = await params;
  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) {
    return NextResponse.json({ error: "reto no encontrado" }, { status: 404 });
  }
  const config = configDelReto(reto);
  if (!config.seccion_comentarios) return respuestaNoDisponible();

  const supabase = getSupabasePublic();

  if ("visibilidad" in parsed.data) {
    const { nombre, texto, visibilidad } = parsed.data;
    const { error } = await supabase.from("comentarios").insert({ reto_id: reto.id, nombre, texto, visibilidad });
    if (error) {
      if (error.code === CODIGO_RLS_RECHAZO) return respuestaNoDisponible();
      return NextResponse.json({ error: "no se pudo guardar el comentario" }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (!config.respuestas_visitantes) return respuestaNoDisponible();

  const { nombre, texto, parent_id } = parsed.data;

  // Con el cliente anon la RLS solo devuelve raíces públicas no ocultas: un
  // padre privado, oculto o inexistente llega como null. Todos los rechazos
  // comparten mensaje para no revelar que existe un comentario privado.
  const { data: padre, error: errorPadre } = await supabase
    .from("comentarios")
    .select("reto_id, parent_id, visibilidad, oculto")
    .eq("id", parent_id)
    .eq("reto_id", reto.id)
    .maybeSingle();

  if (errorPadre) {
    return NextResponse.json({ error: "no se pudo guardar el comentario" }, { status: 500 });
  }
  if (motivoRechazoPadre(padre, reto.id) !== null) {
    return NextResponse.json({ error: MENSAJE_RESPUESTA_NO_PERMITIDA }, { status: 422 });
  }

  const { data: comentario, error } = await supabase
    .from("comentarios")
    .insert({ reto_id: reto.id, parent_id, nombre, texto, visibilidad: "publico" })
    .select(COLUMNAS_PUBLICAS)
    .single();

  if (error) {
    if (error.code === CODIGO_CHECK_VIOLATION) {
      return NextResponse.json({ error: MENSAJE_RESPUESTA_NO_PERMITIDA }, { status: 422 });
    }
    if (error.code === CODIGO_RLS_RECHAZO) return respuestaNoDisponible();
    return NextResponse.json({ error: "no se pudo guardar el comentario" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, comentario }, { status: 201 });
}
