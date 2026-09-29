/**
 * Piezas puras del polling del feed público "minuto a minuto" (DT-013, fix de
 * FP3b / DT-031).
 */

/**
 * URL del poll incremental. Con el feed vacío no hay entrada de referencia:
 * se pide `despuesDeId=0` (los ids empiezan en 1), que devuelve las más
 * recientes del intento activo. Antes el poll no preguntaba nada con el feed
 * vacío y la primera entrada del reto no aparecía hasta recargar.
 */
export function construirUrlPolling(slug: string, masRecienteId: number | null): string {
  return `/${slug}/api/minuto-a-minuto?despuesDeId=${masRecienteId ?? 0}`;
}

/**
 * Concatena `primero` y `despues` descartando de `despues` las entradas cuyo
 * id ya está. Evita claves duplicadas cuando el poll y la carga inicial se
 * solapan, o cuando "Cargar más" pagina por offset después de que el poll haya
 * añadido entradas arriba (el offset se desplaza y la página repite filas).
 */
export function fusionarSinDuplicados<T extends { id: number }>(primero: readonly T[], despues: readonly T[]): T[] {
  const idsPrimero = new Set(primero.map((entrada) => entrada.id));
  return [...primero, ...despues.filter((entrada) => !idsPrimero.has(entrada.id))];
}
