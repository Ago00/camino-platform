/**
 * Catálogo de rutas predefinidas. Cada `id` debe tener su carpeta
 * `lib/rutas/<id>/` con `traza.geojson` y `traza-mapa.geojson`.
 *
 * Es la lista cerrada de valores válidos para `retos.ruta_id`: el id acaba
 * formando una ruta de fichero en `cargarTrazaDeCalculo`, así que nunca se
 * acepta un valor que no esté aquí.
 */

export interface RutaPredefinida {
  id: string;
  nombre: string;
}

export const RUTAS_PREDEFINIDAS: readonly RutaPredefinida[] = [
  { id: "portuguesa-110", nombre: "Camino Portugués Central (últimos 110 km)" },
];

export function esRutaPredefinida(id: string): boolean {
  return RUTAS_PREDEFINIDAS.some((ruta) => ruta.id === id);
}
