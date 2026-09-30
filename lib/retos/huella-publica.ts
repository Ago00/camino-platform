/**
 * Huella de todo lo que el admin puede cambiar y afecta a la web pública
 * (configuración, foto de "quién camina" y textos). La calculan igual la
 * página (WebReto) y GET /[slug]/api/fase: si difieren, la web abierta se
 * refresca sola para aplicar el cambio sin que el visitante recargue.
 *
 * Puro y determinista: mismo contenido ⇒ misma huella en servidor y cliente.
 */

import type { ConfigReto } from "@/lib/retos/config";

export interface ContenidoPublicoEditable {
  config: ConfigReto;
  fotoQuienCamina: string | null;
  textos: Readonly<Record<string, string>>;
}

function ordenado(objeto: Readonly<Record<string, unknown>>): [string, unknown][] {
  return Object.keys(objeto)
    .sort()
    .map((clave) => [clave, objeto[clave]]);
}

/** FNV-1a de 32 bits en hexadecimal: basta para detectar cambios, no es criptográfico. */
function fnv1a(texto: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function huellaContenidoPublico({ config, fotoQuienCamina, textos }: ContenidoPublicoEditable): string {
  return fnv1a(JSON.stringify([ordenado(config as unknown as Record<string, unknown>), fotoQuienCamina, ordenado(textos)]));
}
