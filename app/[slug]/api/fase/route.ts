/**
 * GET /[slug]/api/fase — fase actual del intento activo, para detectar cambios
 * desde el cliente (DT-012). El slug no cambia el comportamiento: la fase
 * del único intento activo (cerrado = false) es la misma independientemente
 * de cómo se llegue al endpoint.
 *
 * Consulta mínima, sin caché — idéntico al anterior app/api/fase/route.ts.
 */

import { type NextRequest, NextResponse } from "next/server";
import { obtenerFaseActual } from "@/lib/fase-actual";
import { consumir, obtenerIpCliente } from "@/lib/rate-limit";

export const runtime = "nodejs";

const LIMITE_POR_MINUTO = 60;
const VENTANA_MS = 60_000;

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  if (!consumir(obtenerIpCliente(request), LIMITE_POR_MINUTO, VENTANA_MS)) {
    return new NextResponse(null, { status: 429 });
  }

  const fase = await obtenerFaseActual();

  return NextResponse.json({ fase });
}
