/**
 * URL que hay que configurar en OwnTracks para un reto (FP2.5 DT-028; token
 * visible en el superadmin desde DT-034). `/api/track` lee el reto de `?reto=`
 * y el token de `?t=` (app/api/track/route.ts). Dominio puro.
 *
 * `origen` es null si la petición no trae un Host fiable: entonces la URL
 * queda relativa (solo se muestra como texto en un panel autenticado).
 */

export function urlTrackerDelReto(origen: string | null, slug: string): string {
  return `${origen ?? ""}/api/track?reto=${encodeURIComponent(slug)}`;
}

/** Igual, con el token global ya puesto: lista para pegar en el móvil. */
export function urlTrackerConToken(origen: string | null, slug: string, token: string): string {
  return `${urlTrackerDelReto(origen, slug)}&t=${encodeURIComponent(token)}`;
}
