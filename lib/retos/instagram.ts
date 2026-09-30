/**
 * Perfil de Instagram del reto (DT-034). Dominio puro.
 *
 * El admin lo escribe en la pestaña "Configuración" como le resulte cómodo
 * (`@usuario`, `usuario`, `instagram.com/usuario` o el enlace copiado de la
 * app) y se guarda siempre normalizado a `https://instagram.com/usuario` en el
 * texto `cierre_antes_instagram_url`. La web solo pinta el enlace si pasa
 * `esUrlPerfilInstagram`: así un valor antiguo o manipulado (otro dominio,
 * `javascript:`) nunca llega a un `href`.
 */

/** Formato de usuario que admite Instagram: letras, números, punto y guion bajo. */
const PATRON_USUARIO = /^[A-Za-z0-9._]{1,30}$/;

/**
 * Enlace a un perfil: esquema opcional (solo http/https), `www.` opcional, un
 * único segmento de ruta con el usuario, barra final opcional y, como mucho,
 * query o fragmento (los enlaces compartidos desde la app llevan `?igsh=…`).
 */
const PATRON_URL_PERFIL = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#][^\s]*)?$/i;

/** Igual que el anterior pero con esquema obligatorio: es lo que puede ir a un `href`. */
const PATRON_URL_PERFIL_ABSOLUTA = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#][^\s]*)?$/i;

/** Primeros segmentos de instagram.com que no son perfiles (publicaciones, explorar…). */
const RUTAS_QUE_NO_SON_PERFIL: ReadonlySet<string> = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "explore",
  "stories",
  "accounts",
  "direct",
]);

/** Más que suficiente para cualquier enlace de perfil; corta entradas absurdas antes de analizarlas. */
const LONGITUD_MAXIMA_ENTRADA = 300;

export const MENSAJE_PERFIL_INSTAGRAM_NO_VALIDO =
  "Escribe tu usuario de Instagram (@usuario) o el enlace a tu perfil (instagram.com/usuario).";

export type ResultadoPerfilInstagram = { ok: true; url: string } | { ok: false; mensaje: string };

function esUsuarioValido(usuario: string): boolean {
  return PATRON_USUARIO.test(usuario) && !RUTAS_QUE_NO_SON_PERFIL.has(usuario.toLowerCase());
}

/**
 * Convierte lo que escribe el admin en la URL canónica del perfil. Vacío (o
 * solo espacios) es válido y significa "sin enlace" (`url: ""`).
 */
export function normalizarPerfilInstagram(entrada: string): ResultadoPerfilInstagram {
  const limpia = entrada.trim();
  if (limpia === "") return { ok: true, url: "" };
  if (limpia.length > LONGITUD_MAXIMA_ENTRADA) return { ok: false, mensaje: MENSAJE_PERFIL_INSTAGRAM_NO_VALIDO };

  const usuario = limpia.startsWith("@")
    ? limpia.slice(1)
    : (PATRON_URL_PERFIL.exec(limpia)?.[1] ?? limpia);

  if (!esUsuarioValido(usuario)) return { ok: false, mensaje: MENSAJE_PERFIL_INSTAGRAM_NO_VALIDO };
  return { ok: true, url: `https://instagram.com/${usuario}` };
}

/** ¿Se puede pintar esta URL como enlace al perfil de Instagram? */
export function esUrlPerfilInstagram(url: string): boolean {
  const usuario = PATRON_URL_PERFIL_ABSOLUTA.exec(url.trim())?.[1];
  return usuario !== undefined && esUsuarioValido(usuario);
}
