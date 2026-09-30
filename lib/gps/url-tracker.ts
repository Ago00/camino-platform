/**
 * URL que hay que configurar en OwnTracks para un reto (FP2.5 DT-028; token
 * por reto desde DT-035). `/api/track` lee el reto de `?reto=` y el token de
 * `?t=` (app/api/track/route.ts). Dominio puro: el servidor le pasa el entorno
 * y las cabeceras (lib/gps/config-gps-servidor.ts).
 */

export function urlTrackerDelReto(origen: string | null, slug: string): string {
  return `${origen ?? ""}/api/track?reto=${encodeURIComponent(slug)}`;
}

/** Igual, con el token del reto ya puesto: lista para OwnTracks. */
export function urlTrackerConToken(origen: string | null, slug: string, token: string): string {
  return `${urlTrackerDelReto(origen, slug)}&t=${encodeURIComponent(token)}`;
}

/**
 * Origen (`https://host`) de la petición a partir de sus cabeceras, o null si
 * el host no es fiable (falta o trae caracteres raros). Solo se usa para
 * mostrar la URL del GPS en un panel autenticado, nunca para redirigir.
 */
export function origenDesdeCabeceras(host: string | null, protocoloReenviado: string | null): string | null {
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const protocolo = protocoloReenviado === "http" ? "http" : "https";
  return `${protocolo}://${host}`;
}

export interface OrigenTracker {
  origen: string | null;
  /**
   * True si no se conoce el dominio de producción y se usa el de la petición
   * (una preview o localhost): el panel avisa de que esa URL puede dejar de
   * existir y el móvil dejaría de enviar.
   */
  provisional: boolean;
}

/**
 * El dominio de producción (`VERCEL_PROJECT_PRODUCTION_URL`, sin esquema) si
 * existe: así el QR sirve igual abierto desde una preview. Si no, el origen
 * de la petición actual.
 */
export function origenDelTracker(hostProduccion: string | undefined, origenPeticion: string | null): OrigenTracker {
  const host = hostProduccion?.trim();
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    return { origen: `https://${host}`, provisional: false };
  }
  return { origen: origenPeticion, provisional: true };
}
