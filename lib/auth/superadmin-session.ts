/**
 * Sesión de superadmin: cookie HttpOnly con payload `{ exp }` firmado
 * HMAC-SHA256, verificado con `timingSafeEqual`.
 *
 * Espeja exactamente el patrón de `lib/auth/admin-session.ts` (ver
 * comentarios de ese módulo para la justificación técnica completa) con dos
 * diferencias: nombre de cookie distinto (`superadmin_session`) y la
 * credencial de acceso es `SUPERADMIN_PASSWORD` (env var propia). La firma
 * comparte el mismo secreto `ADMIN_SESSION_SECRET` — mismo dominio, mismo
 * nivel de confianza, sin necesidad de una segunda variable de entorno.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const NOMBRE_COOKIE_SUPERADMIN_SESION = "superadmin_session";

/** 7 días — mismo TTL que la sesión de admin normal. */
const TTL_SESION_MS = 7 * 24 * 60 * 60 * 1000;

interface PayloadSesion {
  exp: number; // epoch ms
}

function obtenerSecreto(): string {
  const secreto = process.env.ADMIN_SESSION_SECRET;
  if (!secreto) {
    throw new Error("Falta la env var ADMIN_SESSION_SECRET.");
  }
  return secreto;
}

function firmar(payloadBase64Url: string, secreto: string): string {
  return createHmac("sha256", secreto).update(payloadBase64Url).digest("base64url");
}

/**
 * Compara dos firmas en tiempo constante (mismo patrón que admin-session.ts).
 */
function firmasCoinciden(firmaRecibida: string, firmaEsperada: string): boolean {
  const bufferRecibido = Buffer.from(firmaRecibida);
  const bufferEsperado = Buffer.from(firmaEsperada);
  if (bufferRecibido.length !== bufferEsperado.length) return false;
  return timingSafeEqual(bufferRecibido, bufferEsperado);
}

/**
 * Crea el valor de la cookie de sesión del superadmin: `{payload}.{firma}`,
 * ambos en base64url. TTL fijo de `TTL_SESION_MS` desde el momento de la llamada.
 */
export function crearSesionSuperadmin(ahora: Date = new Date()): string {
  const secreto = obtenerSecreto();
  const payload: PayloadSesion = { exp: ahora.getTime() + TTL_SESION_MS };
  const payloadBase64Url = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const firma = firmar(payloadBase64Url, secreto);
  return `${payloadBase64Url}.${firma}`;
}

/**
 * Verifica el valor de la cookie de sesión del superadmin: firma válida y no
 * expirada. Nunca lanza — cualquier fallo se trata como "sesión inválida".
 */
export function verificarSesionSuperadmin(
  valorCookie: string | undefined | null,
  ahora: Date = new Date(),
): boolean {
  if (!valorCookie) return false;

  const partes = valorCookie.split(".");
  if (partes.length !== 2) return false;
  const [payloadBase64Url, firmaRecibida] = partes;

  let secreto: string;
  try {
    secreto = obtenerSecreto();
  } catch {
    return false;
  }

  const firmaEsperada = firmar(payloadBase64Url, secreto);
  if (!firmasCoinciden(firmaRecibida, firmaEsperada)) return false;

  let payload: PayloadSesion;
  try {
    payload = JSON.parse(Buffer.from(payloadBase64Url, "base64url").toString("utf8"));
  } catch {
    return false;
  }

  if (typeof payload.exp !== "number") return false;
  return ahora.getTime() < payload.exp;
}
