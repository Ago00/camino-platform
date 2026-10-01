/**
 * GET /[slug]/api/fase — fase actual del intento activo del reto, para
 * detectar cambios desde el cliente (DT-012).
 *
 * El slug se resuelve a un reto (404 si no existe) y la fase es la del
 * intento activo de ESE reto (FP2.5, DT-028): con varios retos, cada uno
 * tiene su propio intento abierto. Consulta mínima, sin caché.
 */

import { type NextRequest, NextResponse } from "next/server";
import { obtenerFaseActual } from "@/lib/fase-actual";
import { consumir, obtenerIpCliente } from "@/lib/rate-limit";
import { configDelReto, fotoQuienCaminaDelReto, monigoteDelReto } from "@/lib/retos/config";
import { huellaContenidoPublico } from "@/lib/retos/huella-publica";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";
import { obtenerTextos } from "@/lib/textos/obtener-textos";

export const runtime = "nodejs";

const LIMITE_POR_MINUTO = 60;
const VENTANA_MS = 60_000;

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

  const [fase, textos] = await Promise.all([obtenerFaseActual(reto.id), obtenerTextos(reto.id)]);
  const huella = huellaContenidoPublico({
    config: configDelReto(reto),
    monigote: monigoteDelReto(reto),
    fotoQuienCamina: fotoQuienCaminaDelReto(reto),
    textos,
  });

  return NextResponse.json({ fase, huella });
}
