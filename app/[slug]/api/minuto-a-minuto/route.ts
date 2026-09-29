/**
 * GET /[slug]/api/minuto-a-minuto — feed público del "minuto a minuto".
 *
 * Carga paginada (offset/limit) + poll incremental (despuesDeId).
 * Comportamiento idéntico al anterior app/api/minuto-a-minuto/route.ts:
 * la RLS de `minuto_a_minuto` ya filtra por el intento activo, no hace
 * falta filtrar por slug en el código (DT-026, FP1).
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumir, obtenerIpCliente } from "@/lib/rate-limit";
import { getSupabasePublic } from "@/lib/supabase/public";

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
  request: NextRequest
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

  const { offset, limit, despuesDeId } = parsed.data;
  const supabase = getSupabasePublic();

  if (despuesDeId !== undefined) {
    const { data, error } = await supabase
      .from("minuto_a_minuto")
      .select(CAMPOS_PUBLICOS)
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
