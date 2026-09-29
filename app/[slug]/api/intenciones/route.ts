/**
 * POST /[slug]/api/intenciones — nueva intención dejada por familia o amigos.
 *
 * El slug se resuelve a un reto_id mediante obtenerRetoPorSlug (DT-026, FP1).
 * El comportamiento es idéntico al anterior app/api/intenciones/route.ts,
 * salvo que `reto_id` ya no está hardcodeado.
 *
 * Cliente ADMIN (service role): `intenciones` no tiene ninguna política RLS
 * para `anon`. Rate limiting por IP (DT-011): 10 req/min.
 *
 * Con la sección de intenciones apagada en la configuración del reto (FP3c,
 * DT-032) responde 403. Basta con comprobarlo aquí: sin política RLS para
 * `anon`, esta API es la única vía de escritura.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumir, obtenerIpCliente } from "@/lib/rate-limit";
import { configDelReto } from "@/lib/retos/config";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";

export const runtime = "nodejs";

const LIMITE_POR_MINUTO = 10;
const VENTANA_MS = 60_000;

const nuevaIntencion = z.object({
  texto: z.string().trim().min(1).max(1000),
  nombre: z.string().trim().min(1).max(80).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  if (!consumir(obtenerIpCliente(request), LIMITE_POR_MINUTO, VENTANA_MS)) {
    return new NextResponse(null, { status: 429 });
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "cuerpo de la petición inválido" }, { status: 400 });
  }

  const parsed = nuevaIntencion.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "datos de intención inválidos" }, { status: 400 });
  }

  const { texto, nombre } = parsed.data;
  const { slug } = await params;

  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) {
    return NextResponse.json({ error: "reto no encontrado" }, { status: 404 });
  }
  if (!configDelReto(reto).seccion_intenciones) {
    return NextResponse.json({ error: "no disponible" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("intenciones").insert({
    reto_id: reto.id,
    texto,
    nombre: nombre ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "no se pudo guardar la intención" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
