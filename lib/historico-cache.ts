/**
 * Caché en memoria de proceso del histórico completo de posiciones no
 * descartadas del intento activo (DT-021, fix post-revisión de Seguridad).
 *
 * Antes de DT-021, una visita a `/` en modo guiado ("durante"/"llegada")
 * solo pagaba `calcularProgresoDelIntento` — protegido por la caché de
 * `lib/progreso-cache.ts` (TTL 20 s, S2 de DT-018). DT-021 añadió una
 * segunda consulta independiente (el histórico de puntos GPS para pintar el
 * recorrido real en el mapa, `obtenerHistoricoPosiciones`) que no pasaba por
 * ninguna caché — con `/` sin rate limiting (DT-011 solo cubre
 * `/api/progreso`), cada visita volvía a pagar un fetch paginado completo
 * (hasta 50 páginas × 1.000 filas, `lib/supabase/paginacion.ts`), reabriendo
 * para modo guiado el mismo vector de coste que S2 ya había cerrado.
 *
 * Mismo patrón exacto que `lib/progreso-cache.ts` (una entrada por reto,
 * mismo TTL; FP2.5, DT-028): hay como mucho un intento activo por reto
 * (índice `intentos_abierto_por_reto`, migración 0009), así que la clave
 * `retoId` identifica sin ambigüedad el histórico cacheado.
 *
 * Invalidación: `app/[slug]/admin/actions.ts` limpia esta caché junto con la
 * de progreso en las acciones que cambian el histórico o el intento activo
 * (descartar posición, reiniciar).
 */

import type { Posicion } from "@/lib/types";
import { CACHE_TTL_MS } from "@/lib/progreso-cache";

export { CACHE_TTL_MS };

export interface EntradaCacheHistorico {
  timestamp: number;
  valor: Posicion[];
}

const cachePorReto = new Map<number, EntradaCacheHistorico>();

export function obtenerCacheHistorico(retoId: number): EntradaCacheHistorico | null {
  return cachePorReto.get(retoId) ?? null;
}

export function guardarCacheHistorico(retoId: number, valor: Posicion[]): void {
  cachePorReto.set(retoId, { timestamp: Date.now(), valor });
}

/**
 * Fuerza la lectura en fresco siguiente del reto indicado. Sin argumento
 * vacía la caché de todos los retos (uso en tests).
 */
export function limpiarCacheHistorico(retoId?: number): void {
  if (retoId === undefined) {
    cachePorReto.clear();
    return;
  }
  cachePorReto.delete(retoId);
}
