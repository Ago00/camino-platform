/**
 * Caché en memoria de proceso del último `ProgresoPublico` calculado por
 * `GET /api/progreso` (DT-007). Extraída a módulo propio (DT-014) para que
 * `crearMinutoAMinuto` (`app/admin/actions.ts`) pueda leer el snapshot de
 * posición que la web pública está sirviendo realmente, en vez de una
 * lectura fresca de `posiciones` que podría ir "por delante" de lo que el
 * mapa está pintando en ese momento.
 *
 * Vive únicamente mientras el proceso de Next.js esté vivo — no se persiste
 * en BD ni se comparte entre instancias serverless (mismo riesgo aceptado
 * que DT-007/DT-011). El TTL solo determina si `/api/progreso` recalcula en
 * la siguiente petición; no invalida retroactivamente un valor ya guardado
 * aquí, así que los lectores de esta caché (como `crearMinutoAMinuto`) no
 * comprueban el TTL, solo si hay algo escrito.
 *
 * Una entrada por reto (FP2.5, DT-028): cada reto tiene su propio intento
 * activo y su propio progreso. Con un único hueco global, dos retos en marcha
 * a la vez se pisarían y la web de uno serviría el progreso del otro.
 */

import type { ProgresoPublico } from "@/lib/types";

export const CACHE_TTL_MS = 20_000;

/**
 * TTL usado en fase "llegada": el histórico ya no cambia (nadie sigue
 * mandando GPS), así que no tiene sentido recalcular sobre el histórico
 * completo de `posiciones` cada 20 s indefinidamente. Las acciones de admin
 * que sí pueden invalidar ese resultado (retomar el reto, reiniciar,
 * descartar una posición) llaman a `limpiarCacheProgreso(retoId)` explícitamente
 * (app/[slug]/admin/actions.ts), así que este TTL puede ser generoso sin arriesgar
 * mostrar un dato desactualizado tras esas acciones.
 */
export const CACHE_TTL_LLEGADA_MS = 6 * 60 * 60 * 1000;

export interface EntradaCacheProgreso {
  timestamp: number;
  valor: ProgresoPublico;
}

const cachePorReto = new Map<number, EntradaCacheProgreso>();

export function obtenerCacheProgreso(retoId: number): EntradaCacheProgreso | null {
  return cachePorReto.get(retoId) ?? null;
}

export function guardarCacheProgreso(retoId: number, valor: ProgresoPublico): void {
  cachePorReto.set(retoId, { timestamp: Date.now(), valor });
}

/**
 * Fuerza el recálculo/lectura en fresco siguiente del reto indicado. Sin
 * argumento vacía la caché de todos los retos (uso en tests).
 */
export function limpiarCacheProgreso(retoId?: number): void {
  if (retoId === undefined) {
    cachePorReto.clear();
    return;
  }
  cachePorReto.delete(retoId);
}
