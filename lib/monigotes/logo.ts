/**
 * Figura del monigote elegido para el logo del mojón (cabecera de la web y
 * recuadro de llegada). Es el mismo dibujo del catálogo, pequeño y estático:
 * el CSS del logo (`components/publico/logo-mojon.css`) apaga los gestos y
 * efectos, así que a ese tamaño queda como un esquema del personaje.
 *
 * Puro. Devuelve SVG construido solo con el código de `lib/monigotes/figuras.ts`
 * (nunca con datos del usuario), como el resto del motor.
 */

import { svgFigura } from "@/lib/monigotes/figuras";
import type { IdMonigote } from "@/lib/monigotes/catalogo";

/** Lado (en unidades del logo, 54×96) del cuadro donde cabe la figura dentro del mojón. */
export const TAMANO_FIGURA_LOGO = 28;

/** Prefijo de los ids internos del SVG (patrones): solo hay un logo por pantalla. */
const UID_LOGO = "logo";

/** SVG de la figura para el logo, o null si el reto no tiene monigote (el logo es solo el mojón). */
export function figuraParaLogo(id: IdMonigote | null): string | null {
  return id === null ? null : svgFigura(id, UID_LOGO, TAMANO_FIGURA_LOGO);
}
