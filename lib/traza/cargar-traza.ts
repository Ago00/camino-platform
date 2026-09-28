/**
 * Carga y prepara la traza de CÁLCULO desde disco.
 *
 * La traza de cada ruta vive en `lib/rutas/<ruta_id>/traza.geojson` (DT-025).
 * Único punto del proyecto que lee ese fichero del filesystem. Tanto
 * `proyeccion.ts` (dominio puro, sin I/O) como `/api/track` necesitan la
 * misma `TrazaPreparada`; centralizarlo aquí evita que cada consumidor
 * reimplemente su propia lectura+parseo del fichero.
 *
 * Cachea el resultado en memoria de proceso por ruta_id: `prepararTraza`
 * recorre ~7.951 vértices (DT-015) y no tiene sentido repetirlo en cada
 * request (ver DT-003).
 */

import { readFileSync } from "fs";
import { join } from "path";
import { prepararTraza } from "@/lib/traza/proyeccion";
import type { TrazaPreparada } from "@/lib/types";

const trazaCache = new Map<string, TrazaPreparada>();

/**
 * Devuelve la traza de cálculo para la ruta indicada, preparada y cacheada.
 *
 * @param rutaId - Identificador de la ruta (p. ej. `'portuguesa-110'`). Mapea
 *   a `lib/rutas/<rutaId>/traza.geojson` dentro del repositorio.
 */
export function cargarTrazaDeCalculo(rutaId: string): TrazaPreparada {
  const cacheada = trazaCache.get(rutaId);
  if (cacheada) return cacheada;

  const rutaFichero = join(process.cwd(), "lib", "rutas", rutaId, "traza.geojson");
  const geojsonRaw = readFileSync(rutaFichero, "utf-8");
  const geojson = JSON.parse(geojsonRaw);

  const preparada = prepararTraza(geojson);
  trazaCache.set(rutaId, preparada);
  return preparada;
}
