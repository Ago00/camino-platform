/**
 * Reglas de la vista previa del admin (DT-034) para elegir entre los datos
 * reales del intento activo y los de ejemplo. Dominio puro.
 */

import type { Fase, ModoIntento } from "@/lib/types";

/**
 * Solo hay datos reales que enseñar si el reto está justo en la fase que se
 * previsualiza. "antes" no necesita datos de intento, así que siempre es real.
 */
export function debeUsarDatosReales(faseElegida: Fase, faseDelIntento: Fase | null): boolean {
  return faseElegida === "antes" || faseElegida === faseDelIntento;
}

/**
 * Modo con el que se pinta la vista previa: el del intento si lo hay, pero
 * siempre libre en un reto sin ruta (no hay traza sobre la que mostrar un
 * progreso guiado) — mismo criterio que la web pública.
 */
export function modoDeVistaPrevia(modoDelIntento: ModoIntento | null, rutaId: string | null): ModoIntento {
  if (rutaId === null) return "libre";
  return modoDelIntento ?? "guiado";
}
