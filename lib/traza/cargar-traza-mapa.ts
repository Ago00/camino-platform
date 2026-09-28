/**
 * Carga la traza de PINTADO desde disco.
 *
 * La traza de pintado de cada ruta vive en `lib/rutas/<ruta_id>/traza-mapa.geojson`
 * (DT-025). Análogo a cargar-traza.ts (que carga la traza de CÁLCULO) pero
 * para el fichero simplificado que se envía al cliente para dibujar el mapa
 * (ver AGENTS.md — regla no negociable de las dos trazas).
 *
 * Solo servidor: los Server Components la cargan aquí y la pasan como prop a
 * components/mapa/Mapa.tsx (client component), en vez de importarla
 * directamente en el bundle del cliente — evita depender de que el bundler
 * reconozca `.geojson` como módulo importable.
 *
 * Cachea el resultado en memoria de proceso por ruta_id: no tiene sentido
 * releer y parsear ~42 KB en cada request.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { Feature, LineString } from "geojson";

const trazaMapaCache = new Map<string, [number, number][]>();

/**
 * Devuelve las coordenadas [lon, lat] de la traza de pintado, cacheadas.
 *
 * @param rutaId - Identificador de la ruta (p. ej. `'portuguesa-110'`). Mapea
 *   a `lib/rutas/<rutaId>/traza-mapa.geojson` dentro del repositorio.
 */
export function cargarTrazaDeMapa(rutaId: string): [number, number][] {
  const cacheada = trazaMapaCache.get(rutaId);
  if (cacheada) return cacheada;

  const rutaFichero = join(process.cwd(), "lib", "rutas", rutaId, "traza-mapa.geojson");
  const geojsonRaw = readFileSync(rutaFichero, "utf-8");
  const geojson = JSON.parse(geojsonRaw) as {
    type: "FeatureCollection";
    features: Feature<LineString>[];
  };

  const linea = geojson.features.find((f) => f.geometry.type === "LineString");
  if (!linea) {
    throw new Error(
      `traza-mapa.geojson de la ruta '${rutaId}' no contiene ninguna Feature de tipo LineString`
    );
  }

  const coordenadas = linea.geometry.coordinates as [number, number][];
  trazaMapaCache.set(rutaId, coordenadas);
  return coordenadas;
}
