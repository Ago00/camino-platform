/**
 * Cuántas entradas del "minuto a minuto" han llegado desde la última vez que
 * el visitante vio la lista desplegada (aviso "N nuevas" con la sección
 * plegada, FP3b / DT-031).
 *
 * Se compara por id y no por posición ni por longitud de la lista: los ids
 * crecen con cada entrada, así que las páginas antiguas que se añaden abajo
 * ("Cargar más") nunca cuentan como nuevas.
 *
 * `ultimoVistoId` null = todavía no hay referencia (feed aún sin cargar) ⇒ 0.
 * 0 = se plegó con el feed vacío ⇒ toda entrada cuenta como nueva.
 */
export function contarNuevas(entradas: readonly { id: number }[], ultimoVistoId: number | null): number {
  if (ultimoVistoId === null) return 0;
  return entradas.filter((entrada) => entrada.id > ultimoVistoId).length;
}
