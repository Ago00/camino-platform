/**
 * Generación de UUID v4 para la `clave_envio` del minuto a minuto (DT-033).
 *
 * `crypto.randomUUID` solo existe en contextos seguros (HTTPS o localhost):
 * con el panel abierto por HTTP en la LAN (pruebas desde el móvil con
 * `pnpm dev`) no está y el envío lanzaba. `crypto.getRandomValues` sí existe
 * en cualquier contexto, así que con él se construye un v4 equivalente.
 */

/** Lo mínimo de `Crypto` que hace falta; `randomUUID` puede faltar en tiempo de ejecución. */
export interface FuenteAleatoria {
  randomUUID?: () => string;
  getRandomValues(array: Uint8Array): Uint8Array;
}

const BYTES_UUID = 16;

/** UUID v4 (RFC 9562) a partir de 16 bytes aleatorios; fija los bits de versión y variante. */
export function uuidV4DesdeBytes(bytes: Uint8Array): string {
  if (bytes.length !== BYTES_UUID) {
    throw new Error(`Un UUID necesita ${BYTES_UUID} bytes, llegaron ${bytes.length}.`);
  }
  const b = Uint8Array.from(bytes);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** `randomUUID` si el navegador lo ofrece; si no, v4 con `getRandomValues`. */
export function generarUuidV4(fuente: FuenteAleatoria = globalThis.crypto): string {
  if (typeof fuente.randomUUID === "function") return fuente.randomUUID();
  return uuidV4DesdeBytes(fuente.getRandomValues(new Uint8Array(BYTES_UUID)));
}
