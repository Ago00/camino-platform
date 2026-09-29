/**
 * GET /[slug]/api/progreso — progreso público del intento activo del reto.
 *
 * El slug se resuelve a un reto (404 si no existe). El progreso es el del
 * intento activo de ESE reto, calculado sobre la traza de su `ruta_id`, y la
 * caché en memoria va por reto (FP2.5, DT-028). El rate limiting y el TTL
 * por fase son idénticos a la versión anterior (DT-007, DT-014).
 *
 * Se mantiene la re-exportación de `limpiarCacheProgreso` para que los
 * tests que la importaban sigan funcionando.
 */

import { type NextRequest, NextResponse } from "next/server";
import { obtenerFaseActual } from "@/lib/fase-actual";
import {
  CACHE_TTL_LLEGADA_MS,
  CACHE_TTL_MS,
  guardarCacheProgreso,
  limpiarCacheProgreso,
  obtenerCacheProgreso,
} from "@/lib/progreso-cache";
import { consumir, obtenerIpCliente } from "@/lib/rate-limit";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";
import { calcularProgresoActual } from "@/lib/traza/progreso-actual";

export const runtime = "nodejs";

const LIMITE_POR_MINUTO = 60;
const VENTANA_MS = 60_000;

export { limpiarCacheProgreso };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  if (!consumir(obtenerIpCliente(request), LIMITE_POR_MINUTO, VENTANA_MS)) {
    return new NextResponse(null, { status: 429 });
  }

  const { slug } = await params;
  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) {
    return NextResponse.json({ error: "reto no encontrado" }, { status: 404 });
  }

  const fase = await obtenerFaseActual(reto.id);
  const ttl = fase === "llegada" ? CACHE_TTL_LLEGADA_MS : CACHE_TTL_MS;

  const cache = obtenerCacheProgreso(reto.id);
  if (cache && Date.now() - cache.timestamp < ttl) {
    return NextResponse.json(cache.valor);
  }

  const progresoPublico = await calcularProgresoActual(reto);

  guardarCacheProgreso(reto.id, progresoPublico);

  return NextResponse.json(progresoPublico);
}
