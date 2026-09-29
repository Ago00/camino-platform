/**
 * GET /[slug]/api/comentarios — muro de comentarios públicos, paginado por offset.
 * POST /[slug]/api/comentarios — nuevo comentario de un seguidor.
 *
 * El slug se resuelve a un reto_id mediante obtenerRetoPorSlug (DT-026, FP1).
 * GET filtra por reto_id y oculto = false (defensa en profundidad: los comentarios
 * moderados como ocultos no se exponen aunque la RLS no lo impida directamente).
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumir, obtenerIpCliente } from "@/lib/rate-limit";
import { getSupabasePublic } from "@/lib/supabase/public";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";

export const runtime = "nodejs";

const TAMANO_PAGINA_POR_DEFECTO = 20;
const VENTANA_MS = 60_000;
const LIMITE_GET_POR_MINUTO = 60;
const LIMITE_POST_POR_MINUTO = 10;

const queryPaginacion = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(TAMANO_PAGINA_POR_DEFECTO),
});

const nuevoComentario = z.object({
  nombre: z.string().trim().min(1).max(80),
  texto: z.string().trim().min(1).max(1000),
  visibilidad: z.enum(["publico", "privado"]),
});

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

  const { offset, limit } = paginacion.data;
  const supabase = getSupabasePublic();

  const { data, error } = await supabase
    .from("comentarios")
    .select("id, nombre, texto, created_at")
    .eq("reto_id", reto.id)
    .eq("oculto", false)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "no se pudieron cargar los comentarios" }, { status: 500 });
  }

  const comentarios = data ?? [];

  return NextResponse.json({
    comentarios,
    siguienteOffset: comentarios.length === limit ? offset + limit : null,
  });
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

  const { nombre, texto, visibilidad } = parsed.data;
  const { slug } = await params;

  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) {
    return NextResponse.json({ error: "reto no encontrado" }, { status: 404 });
  }

  const supabase = getSupabasePublic();

  const { error } = await supabase.from("comentarios").insert({
    reto_id: reto.id,
    nombre,
    texto,
    visibilidad,
  });

  if (error) {
    return NextResponse.json({ error: "no se pudo guardar el comentario" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
