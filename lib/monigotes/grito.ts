/**
 * Reglas puras del grito del monigote (DT-036): cómo se normaliza el grito
 * personalizado que escribe el admin, cuál se lanza al pincharlo y cómo se
 * parte en líneas a pantalla completa. Las usan la acción del servidor, el
 * selector del admin y el motor del navegador.
 */

import type { DefMonigote } from "@/lib/monigotes/catalogo";

/** Longitud máxima del grito personalizado, en caracteres (code points), igual que en BD (0017). */
export const LONGITUD_MAXIMA_GRITO = 48;

/** La placa del mojón arranca en 100 km y baja uno por pinchazo; al llegar a 0 vuelve a 100. */
export const KM_INICIAL_MOJON = 100;

export function bajarKmMojon(km: number): number {
  return km > 0 ? km - 1 : KM_INICIAL_MOJON;
}

/** Caracteres contados como los cuenta Postgres (`char_length`): por code point, un emoji = 1. */
export function longitudGrito(texto: string): number {
  return Array.from(texto).length;
}

// Controles C0/C1 (incluido DEL) y marcas bidi de incrustación/aislamiento:
// no se ven y pueden reordenar visualmente el texto. El ZWJ de los emoji
// compuestos (U+200D) no se toca. También anchura cero (U+200B), marcas LRM/RLM
// (U+200E/F), word joiner (U+2060) y BOM (U+FEFF): un grito solo de esos se veía vacío.
const CARACTERES_INVISIBLES = /[\u0000-\u001F\u007F-\u009F​‎‏⁠﻿‪-‮⁦-⁩]/g;

/**
 * Grito personalizado listo para guardar, o null si no hay personalización:
 * colapsa espacios (también saltos de línea y tabuladores), quita caracteres
 * de control y recorta. Vacío o igual al grito por defecto ⇒ null, para que un
 * cambio futuro del grito por defecto llegue a quien nunca lo personalizó.
 * No recorta a la longitud máxima: eso lo valida quien llama.
 */
export function normalizarGritoMonigote(valor: string, gritoPorDefecto: string): string | null {
  const limpio = valor.replace(/\s+/g, " ").replace(CARACTERES_INVISIBLES, "").replace(/ {2,}/g, " ").trim();
  if (limpio === "" || limpio === gritoPorDefecto) return null;
  return limpio;
}

/**
 * Texto que se lanza al pinchar: el personalizado si lo hay; si no, el del
 * catálogo, salvo el del mojón, que canta los km que marca su placa.
 */
export function gritoEfectivo(def: DefMonigote, gritoPersonalizado: string | null, km: number): string {
  const propio = gritoPersonalizado === null ? null : normalizarGritoMonigote(gritoPersonalizado, def.grito);
  if (propio !== null) return propio;
  if (def.gritoVivo) return `¡Quedan ${km}!`;
  return def.grito;
}

/**
 * Parte el grito en 1–3 líneas equilibradas para pintarlo a pantalla
 * completa (port de `partir` del catálogo). Una sola palabra no se parte.
 */
export function partirGrito(texto: string): string[] {
  const s = texto.trim() || "¡Ánimo!";
  const palabras = s.split(/\s+/);
  if (palabras.length === 1) return [s];
  const numLineas = Math.min(s.length <= 16 ? 2 : 3, palabras.length);
  const objetivo = s.length / numLineas;
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    if (actual && actual.length + 1 + palabra.length > objetivo * 1.15 && lineas.length < numLineas - 1) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = actual ? actual + " " + palabra : palabra;
    }
  }
  lineas.push(actual);
  return lineas;
}
