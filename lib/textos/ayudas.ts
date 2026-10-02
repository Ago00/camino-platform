/**
 * Ayuda breve que la pestaña Textos del admin enseña bajo el nombre de ciertas
 * claves. Solo presentación.
 */

import type { ClaveTexto } from "@/lib/textos/defaults";

export const AYUDAS_TEXTO: Partial<Record<ClaveTexto, string>> = {
  portada_lema: "Frase bajo el título de la portada. Pon entre *asteriscos* la palabra que quieras destacar (sale en negrita y verde).",
};
