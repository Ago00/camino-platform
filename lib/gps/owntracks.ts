/**
 * Configuración remota de OwnTracks (DT-035): el JSON `_type: "configuration"`
 * que la app importa, y el enlace `owntracks:///config?inline=` que lo lleva
 * dentro (el que se pinta como QR en el panel). Dominio puro.
 *
 * Claves y valores verificados en la documentación oficial
 * (https://owntracks.org/booklet/tech/json/, "_type=configuration"). Ojo:
 * la clave de los datos extra es `extendedData`, no `pubExtendedData`.
 *
 * La app solo acepta la configuración si en Ajustes → Remote Control está
 * activado "Allow external configuration" (lo explican las instrucciones del
 * panel).
 */

/** Modo de conexión HTTP (0 sería MQTT). */
const MODO_HTTP = 3;
/** Monitorización "significant": puntos por desplazamiento/intervalo sin gastar la batería de "move" (2). */
const MONITORIZACION_SIGNIFICATIVA = 1;
/** Segundos mínimos entre puntos en modo significant. */
const INTERVALO_LOCALIZACION_S = 180;
/** Metros mínimos de desplazamiento entre puntos en modo significant. */
const DESPLAZAMIENTO_LOCALIZACION_M = 100;
/** Precisión peor que esto (m) se descarta en el propio móvil. */
const PRECISION_MAXIMA_M = 100;

const ESQUEMA_ENLACE_CONFIG = "owntracks:///config?inline=";

export interface ConfigOwnTracks {
  _type: "configuration";
  mode: typeof MODO_HTTP;
  url: string;
  tid: string;
  deviceId: string;
  auth: false;
  extendedData: true;
  monitoring: typeof MONITORIZACION_SIGNIFICATIVA;
  locatorInterval: typeof INTERVALO_LOCALIZACION_S;
  locatorDisplacement: typeof DESPLAZAMIENTO_LOCALIZACION_M;
  ignoreInaccurateLocations: typeof PRECISION_MAXIMA_M;
}

export interface DatosConfigOwnTracks {
  /** URL completa de `/api/track` con `reto` y `t` (lib/gps/url-tracker.ts). */
  url: string;
  /** Iniciales de 2 caracteres que OwnTracks muestra en el mapa (`tidDesdeSlug`). */
  tid: string;
  deviceId: string;
}

/**
 * `auth: false` porque el token va en la query de `url` (así lo lee
 * `/api/track`), no en Basic Auth.
 */
export function construirConfigOwnTracks({ url, tid, deviceId }: DatosConfigOwnTracks): ConfigOwnTracks {
  return {
    _type: "configuration",
    mode: MODO_HTTP,
    url,
    tid,
    deviceId,
    auth: false,
    extendedData: true,
    monitoring: MONITORIZACION_SIGNIFICATIVA,
    locatorInterval: INTERVALO_LOCALIZACION_S,
    locatorDisplacement: DESPLAZAMIENTO_LOCALIZACION_M,
    ignoreInaccurateLocations: PRECISION_MAXIMA_M,
  };
}

/**
 * Enlace que abre OwnTracks con la configuración: el JSON en UTF-8, en
 * base64 y codificado para URL (el base64 puede llevar `+`, `/` y `=`).
 */
export function enlaceOwnTracks(config: ConfigOwnTracks): string {
  const base64 = Buffer.from(JSON.stringify(config), "utf8").toString("base64");
  return `${ESQUEMA_ENLACE_CONFIG}${encodeURIComponent(base64)}`;
}

/**
 * "Tracker ID" de 2 caracteres en mayúsculas a partir del slug: iniciales de
 * las dos primeras palabras (`santi-ago` → `SA`) o, con una sola palabra,
 * sus dos primeros caracteres (`camino` → `CA`). Si el slug no da para dos,
 * se completa con `0`.
 */
export function tidDesdeSlug(slug: string): string {
  const palabras = slug
    .toUpperCase()
    .split("-")
    .map((palabra) => palabra.replace(/[^A-Z0-9]/g, ""))
    .filter((palabra) => palabra.length > 0);
  const iniciales = palabras.length >= 2 ? `${palabras[0][0]}${palabras[1][0]}` : (palabras[0] ?? "").slice(0, 2);
  return iniciales.padEnd(2, "0");
}
