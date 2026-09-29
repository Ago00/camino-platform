/**
 * Sesión de admin de un reto: cookie HttpOnly con payload
 * `{ r: retoId, s: slug, v: huella, exp }` firmado HMAC-SHA256 y verificado
 * con `timingSafeEqual` (DT-010, ligada a reto desde FP2.6 / DT-029).
 *
 * - `r` y `s` atan la sesión a UN reto: una cookie obtenida en `/a/admin` no
 *   sirve en `/b/admin`.
 * - `v` es la huella de la credencial vigente del reto
 *   (`huellaCredencial(password_hash)`): al cambiar la contraseña cambia la
 *   huella y las sesiones anteriores dejan de valer en la verificación
 *   completa.
 *
 * Dos niveles de verificación:
 * - `verificarSesionEnProxy`: firma + caducidad + slug de la URL. Sin BD
 *   (el proxy corre en cada navegación del panel). No detecta un cambio de
 *   contraseña.
 * - `verificarSesion`: además comprueba `r` y `v` contra el reto y la huella
 *   actuales de BD. La usan la página del panel y cada Server Action
 *   (`lib/auth/sesion-admin-servidor.ts`): nunca asumir que otra capa ya lo
 *   hizo (las Server Actions se sirven como POST a su propia ruta).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const NOMBRE_COOKIE_SESION = "admin_session";

/** 7 días — TTL largo para no molestar en pleno reto (24-30 h). */
const TTL_SESION_MS = 7 * 24 * 60 * 60 * 1000;

const esquemaPayloadSesion = z
  .object({
    r: z.number().int().positive(),
    s: z.string().min(1),
    v: z.string().min(1),
    exp: z.number(),
  })
  .strict();

export type PayloadSesion = z.infer<typeof esquemaPayloadSesion>;

export interface RetoDeSesion {
  id: number;
  slug: string;
}

function obtenerSecreto(): string {
  const secreto = process.env.ADMIN_SESSION_SECRET;
  if (!secreto) {
    throw new Error("Falta la env var ADMIN_SESSION_SECRET.");
  }
  return secreto;
}

// Etiqueta de propósito: superadmin-session.ts firma con el mismo secreto, y sin
// ella una cookie de admin sería una firma válida de superadmin.
const PROPOSITO_FIRMA = "admin.v2.";

function firmar(payloadBase64Url: string, secreto: string): string {
  return createHmac("sha256", secreto).update(PROPOSITO_FIRMA + payloadBase64Url).digest("base64url");
}

/**
 * Compara dos firmas en tiempo constante. Ambas son HMAC-SHA256 de longitud
 * fija, así que una longitud distinta solo aparece con una firma corrupta —
 * tratarla como inválida es el comportamiento correcto.
 */
function firmasCoinciden(firmaRecibida: string, firmaEsperada: string): boolean {
  const bufferRecibido = Buffer.from(firmaRecibida);
  const bufferEsperado = Buffer.from(firmaEsperada);
  if (bufferRecibido.length !== bufferEsperado.length) return false;
  return timingSafeEqual(bufferRecibido, bufferEsperado);
}

function serializar(payload: PayloadSesion): string {
  const secreto = obtenerSecreto();
  const payloadBase64Url = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadBase64Url}.${firmar(payloadBase64Url, secreto)}`;
}

/**
 * Valor de la cookie de sesión para el reto: `{payload}.{firma}` en
 * base64url, con TTL de `TTL_SESION_MS` desde `ahora`. Lanza si falta
 * `ADMIN_SESSION_SECRET`.
 */
export function crearSesion(reto: RetoDeSesion, huella: string, ahora: Date = new Date()): string {
  return serializar({ r: reto.id, s: reto.slug, v: huella, exp: ahora.getTime() + TTL_SESION_MS });
}

/** Misma sesión (r/s/v) con la caducidad reiniciada desde `ahora` (TTL rolling). */
export function renovarSesion(payload: PayloadSesion, ahora: Date = new Date()): string {
  return serializar({ r: payload.r, s: payload.s, v: payload.v, exp: ahora.getTime() + TTL_SESION_MS });
}

/** Payload de una cookie con firma válida y no caducada; null en cualquier otro caso. */
function leerPayloadValido(valorCookie: string | undefined | null, ahora: Date): PayloadSesion | null {
  if (!valorCookie) return null;

  const partes = valorCookie.split(".");
  if (partes.length !== 2) return null;
  const [payloadBase64Url, firmaRecibida] = partes;

  let secreto: string;
  try {
    secreto = obtenerSecreto();
  } catch {
    return null;
  }

  if (!firmasCoinciden(firmaRecibida, firmar(payloadBase64Url, secreto))) return null;

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(payloadBase64Url, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const payload = esquemaPayloadSesion.safeParse(json);
  if (!payload.success) return null;
  if (ahora.getTime() >= payload.data.exp) return null;
  return payload.data;
}

/**
 * Verificación ligera para `proxy.ts`: firma, caducidad y que la sesión es
 * del slug de la URL. Devuelve el payload (para renovarlo) o null. Nunca
 * lanza.
 */
export function verificarSesionEnProxy(
  valorCookie: string | undefined | null,
  slug: string,
  ahora: Date = new Date()
): PayloadSesion | null {
  const payload = leerPayloadValido(valorCookie, ahora);
  if (!payload || payload.s !== slug) return null;
  return payload;
}

/**
 * Verificación completa: firma, caducidad, reto (id y slug) y huella de la
 * credencial vigente. `huellaActual` null (reto sin contraseña configurada)
 * siempre rechaza. Nunca lanza.
 */
export function verificarSesion(
  valorCookie: string | undefined | null,
  reto: RetoDeSesion,
  huellaActual: string | null,
  ahora: Date = new Date()
): boolean {
  if (huellaActual === null) return false;
  const payload = leerPayloadValido(valorCookie, ahora);
  if (!payload) return false;
  return payload.r === reto.id && payload.s === reto.slug && payload.v === huellaActual;
}
