/**
 * GET /[slug]/api/progreso — progreso público del intento activo.
 *
 * El slug en la URL no cambia el comportamiento: `calcularProgresoActual`
 * opera siempre sobre el único intento activo (cerrado = false), que
 * pertenece al reto del slug (validado por el layout). La caché en memoria,
 * el rate limiting y el TTL por fase son idénticos a la versión anterior
 * (app/api/progreso/route.ts, DT-007, DT-014).
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
import { calcularProgresoActual } from "@/lib/traza/progreso-actual";

export const runtime = "nodejs";

const LIMITE_POR_MINUTO = 60;
const VENTANA_MS = 60_000;

export { limpiarCacheProgreso };

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  if (!consumir(obtenerIpCliente(request), LIMITE_POR_MINUTO, VENTANA_MS)) {
    return new NextResponse(null, { status: 429 });
  }

  const fase = await obtenerFaseActual();
  const ttl = fase === "llegada" ? CACHE_TTL_LLEGADA_MS : CACHE_TTL_MS;

  const cache = obtenerCacheProgreso();
  if (cache && Date.now() - cache.timestamp < ttl) {
    return NextResponse.json(cache.valor);
  }

  const progresoPublico = await calcularProgresoActual();

  guardarCacheProgreso(progresoPublico);

  return NextResponse.json(progresoPublico);
}
