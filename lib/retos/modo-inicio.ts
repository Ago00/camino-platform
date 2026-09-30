/**
 * Qué modos de intento (DT-016) se pueden elegir al iniciar un reto. Dominio puro.
 *
 * El modo guiado proyecta la posición sobre la traza de una ruta del catálogo:
 * un reto sin ruta (`ruta_id` null) solo puede iniciarse en modo libre, con
 * destino. Lo comprueban tanto la action `iniciarReto` como el selector del panel.
 */

import type { ModoIntento, Reto } from "@/lib/types";

export const MENSAJE_GUIADO_SIN_RUTA =
  "Este reto no tiene ruta: solo se puede iniciar en modo libre, con un destino.";

/** Modos que admite el reto; el primero es el que el panel preselecciona. */
export function modosDeInicioPermitidos(reto: Pick<Reto, "ruta_id">): readonly [ModoIntento, ...ModoIntento[]] {
  return reto.ruta_id === null ? ["libre"] : ["guiado", "libre"];
}
