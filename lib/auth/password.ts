/**
 * Hash y verificación de contraseñas de admin por reto (FP2.6, DT-029).
 *
 * scrypt de `node:crypto` (sin dependencia nueva). Formato autodescriptivo
 * `scrypt$N$r$p$salt$hash` (salt y hash en base64url), para poder subir el
 * coste en el futuro sin invalidar los hashes ya guardados: la verificación
 * lee los parámetros del propio hash.
 *
 * Solo servidor. Nunca se guarda ni se registra la contraseña en claro.
 */

import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const PREFIJO = "scrypt";
const COSTE_N = 16384;
const BLOQUE_R = 8;
const PARALELISMO_P = 1;
const BYTES_SALT = 16;
const BYTES_CLAVE = 64;

/**
 * Límites de los parámetros aceptados al verificar. Un hash guardado con
 * parámetros desorbitados (BD manipulada o corrupta) no debe poder disparar
 * un cálculo de minutos ni agotar memoria: se trata como formato inválido.
 */
const N_MAXIMO = 1 << 17;
const R_MAXIMO = 16;
const P_MAXIMO = 4;
/** scrypt lanza si necesita más (~128·N·r bytes): se traduce en `false`. */
const MEMORIA_MAXIMA_BYTES = 64 * 1024 * 1024;

/**
 * Hash válido de una cadena aleatoria descartada. Se verifica contra él
 * cuando el reto no existe o no tiene contraseña configurada, para que el
 * login tarde lo mismo en todos los casos y no revele qué retos existen.
 */
export const HASH_SENTINELA =
  "scrypt$16384$8$1$3IwoX8GU9AErJm8Y19cTmw$q3WX5XQ9PuKHQtkPVsbayBz1KJSc91TPc7wJe-qQn-EeWbvWRGM3r-HZMyx8Jyrj4ST98NE76kw6GX3Jj995WQ";

function derivarClave(password: string, salt: Buffer, longitud: number, opciones: ScryptOptions): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(password, salt, longitud, opciones, (error, clave) => {
      if (error) rechazar(error);
      else resolver(clave);
    });
  });
}

export async function hashearPassword(password: string): Promise<string> {
  const salt = randomBytes(BYTES_SALT);
  const clave = await derivarClave(password, salt, BYTES_CLAVE, { N: COSTE_N, r: BLOQUE_R, p: PARALELISMO_P });
  return [PREFIJO, COSTE_N, BLOQUE_R, PARALELISMO_P, salt.toString("base64url"), clave.toString("base64url")].join("$");
}

interface HashDescompuesto {
  opciones: { N: number; r: number; p: number };
  salt: Buffer;
  clave: Buffer;
}

function esEnteroEnRango(valor: number, maximo: number): boolean {
  return Number.isInteger(valor) && valor >= 1 && valor <= maximo;
}

function descomponerHash(guardado: string): HashDescompuesto | null {
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== PREFIJO) return null;

  const [, textoN, textoR, textoP, textoSalt, textoClave] = partes;
  const N = Number(textoN);
  const r = Number(textoR);
  const p = Number(textoP);
  if (!esEnteroEnRango(N, N_MAXIMO) || (N & (N - 1)) !== 0 || N < 2) return null;
  if (!esEnteroEnRango(r, R_MAXIMO) || !esEnteroEnRango(p, P_MAXIMO)) return null;

  const salt = Buffer.from(textoSalt, "base64url");
  const clave = Buffer.from(textoClave, "base64url");
  if (salt.length === 0 || clave.length !== BYTES_CLAVE) return null;

  return { opciones: { N, r, p }, salt, clave };
}

/**
 * Compara la contraseña con el hash guardado en tiempo constante. Nunca
 * lanza: un hash con formato corrupto o parámetros fuera de rango devuelve
 * false igual que una contraseña errónea.
 */
export async function verificarPassword(password: string, guardado: string): Promise<boolean> {
  const hash = descomponerHash(guardado);
  if (!hash) return false;
  try {
    const clave = await derivarClave(password, hash.salt, hash.clave.length, {
      ...hash.opciones,
      maxmem: MEMORIA_MAXIMA_BYTES,
    });
    return timingSafeEqual(clave, hash.clave);
  } catch {
    return false;
  }
}

/**
 * Huella corta del hash guardado que viaja firmada en la cookie de sesión.
 * Cada `hashearPassword` usa un salt nuevo, así que cambiar la contraseña
 * cambia la huella e invalida las sesiones abiertas con la anterior. No
 * revela nada útil del hash (SHA-256 truncado de un valor ya derivado).
 */
export function huellaCredencial(hash: string): string {
  return createHash("sha256").update(hash).digest("base64url").slice(0, 16);
}
