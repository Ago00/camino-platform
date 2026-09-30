/**
 * GET /[slug]/api/minuto-a-minuto — feed público del "minuto a minuto".
 *
 * Carga paginada (offset/limit) + poll incremental (despuesDeId).
 *
 * El slug se resuelve a un reto (404 si no existe) y el feed se limita a las
 * entradas del intento activo de ESE reto (FP2.5, DT-028). Antes se confiaba
 * en que la RLS de `minuto_a_minuto` filtrara por "el" intento activo, lo que
 * con varios retos con intento abierto mezclaba los feeds de todos. Sin
 * intento activo en el reto, el feed está vacío.
 *
 * Con la sección apagada en la configuración del reto (FP3c, DT-032) responde
 * 403; la web no monta el componente y, si se apaga con la página abierta, el
 * poll ve el 403, se para y refresca la página (useRefrescoSiSeccionApagada).
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumir, obtenerIpCliente } from "@/lib/rate-limit";
import { configDelReto } from "@/lib/retos/config";
import { soloIntentoActivoDelReto } from "@/lib/supabase/intentos";
import { getSupabasePublic } from "@/lib/supabase/public";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";

export const runtime = "nodejs";

const TAMANO_PAGINA_POR_DEFECTO = 20;
const LIMITE_POLL = 50;
const VENTANA_MS = 60_000;
const LIMITE_GET_POR_MINUTO = 60;

const CAMPOS_PUBLICOS = "id, texto, foto_url, lat, lon, created_at";

const queryFeed = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(TAMANO_PAGINA_POR_DEFECTO),
  despuesDeId: z.coerce.number().int().min(0).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  if (!consumir(obtenerIpCliente(request), LIMITE_GET_POR_MINUTO, VENTANA_MS)) {
    return new NextResponse(null, { status: 429 });
  }

  const parsed = queryFeed.safeParse({
    offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    despuesDeId: request.nextUrl.searchParams.get("despuesDeId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "parámetros inválidos" }, { status: 400 });
  }

  const { slug } = await params;
  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) {
    return NextResponse.json({ error: "reto no encontrado" }, { status: 404 });
  }
  if (!configDelReto(reto).seccion_minuto_a_minuto) {
    return NextResponse.json({ error: "no disponible" }, { status: 403 });
  }

  const { offset, limit, despuesDeId } = parsed.data;
  const supabase = getSupabasePublic();

  const { data: intentoActivo, error: errorIntento } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id"),
    reto.id
  ).maybeSingle();

  if (errorIntento) {
    return NextResponse.json({ error: "no se pudo consultar el feed" }, { status: 500 });
  }

  if (!intentoActivo) {
    return NextResponse.json({ entradas: [], siguienteOffset: null });
  }

  if (despuesDeId !== undefined) {
    const { data, error } = await supabase
      .from("minuto_a_minuto")
      .select(CAMPOS_PUBLICOS)
      .eq("intento_id", intentoActivo.id)
      .gt("id", despuesDeId)
      .order("created_at", { ascending: false })
      .limit(LIMITE_POLL);

    if (error) {
      return NextResponse.json({ error: "no se pudo consultar el feed" }, { status: 500 });
    }

    return NextResponse.json({ entradas: data ?? [], siguienteOffset: null });
  }

  const { data, error } = await supabase
    .from("minuto_a_minuto")
    .select(CAMPOS_PUBLICOS)
    .eq("intento_id", intentoActivo.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "no se pudo cargar el feed" }, { status: 500 });
  }

  const entradas = data ?? [];

  return NextResponse.json({
    entradas,
    siguienteOffset: entradas.length === limit ? offset + limit : null,
  });
}
