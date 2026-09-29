/**
 * Consulta mínima (solo columna `fase`) del intento activo de un reto — sin
 * cálculo de progreso, sin caché propia. Compartida entre `GET /api/fase`
 * (DT-012) y `GET /api/progreso`, que la usa para decidir cuánto confiar en
 * su propia caché (`lib/progreso-cache.ts`): en fase "llegada" el histórico
 * ya no cambia nunca (nadie sigue mandando GPS), así que no tiene sentido
 * recalcular sobre el histórico completo en cada expiración de esa caché.
 *
 * Filtra por reto (FP2.5, DT-028): cada reto tiene su propio intento activo.
 * Sin intento activo en ese reto, "antes" (mismo criterio que
 * app/[slug]/page.tsx, `const fase = intentoActivo?.fase ?? "antes"`).
 */

import { getSupabasePublic } from "@/lib/supabase/public";
import { soloIntentoActivoDelReto } from "@/lib/supabase/intentos";
import type { Fase } from "@/lib/types";

export async function obtenerFaseActual(retoId: number): Promise<Fase> {
  const supabase = getSupabasePublic();
  const { data: intentoActivo } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("fase"),
    retoId
  ).maybeSingle();

  return intentoActivo?.fase ?? "antes";
}
