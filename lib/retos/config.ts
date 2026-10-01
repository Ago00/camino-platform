/**
 * Configuración de la web pública de un reto (FP3c, DT-032): qué secciones se
 * muestran y si los visitantes pueden responder comentarios. El monigote que
 * pasea por la web (DT-036) se lee aparte, con `monigoteDelReto`.
 *
 * Dominio puro. Toda lectura de la configuración pasa por `configDelReto`, que
 * trata un campo ausente como encendido: si el código se despliega antes de
 * aplicar la migración 0012, `select *` no trae las columnas y la web debe
 * seguir comportándose como antes (todo visible), no apagarse entera.
 */

import type { Reto } from "@/lib/types";
import { esUrlPerfilInstagram } from "@/lib/retos/instagram";
import { esIdMonigote, MONIGOTES, type IdMonigote } from "@/lib/monigotes/catalogo";
import { normalizarGritoMonigote } from "@/lib/monigotes/grito";

export const CAMPOS_CONFIG_RETO = [
  "seccion_intenciones",
  "seccion_comentarios",
  "seccion_minuto_a_minuto",
  "seccion_instagram",
  "respuestas_visitantes",
] as const;

export type CampoConfigReto = (typeof CAMPOS_CONFIG_RETO)[number];

export type ConfigReto = Record<CampoConfigReto, boolean>;

export function configDelReto(reto: Partial<Pick<Reto, CampoConfigReto>>): ConfigReto {
  return {
    seccion_intenciones: reto.seccion_intenciones ?? true,
    seccion_comentarios: reto.seccion_comentarios ?? true,
    seccion_minuto_a_minuto: reto.seccion_minuto_a_minuto ?? true,
    seccion_instagram: reto.seccion_instagram ?? true,
    respuestas_visitantes: reto.respuestas_visitantes ?? true,
  };
}

/** Lo que guarda la pestaña Configuración de una vez (`guardarConfiguracion`). */
export type ConfiguracionWebReto = ConfigReto & {
  monigote: IdMonigote | null;
  monigote_grito: string | null;
  monigote_sonido: boolean;
};

export interface MonigoteDelReto {
  id: IdMonigote | null;
  /** Grito personalizado ya normalizado; null = el del catálogo. */
  grito: string | null;
  sonido: boolean;
}

type CampoMonigoteReto = "monigote" | "monigote_grito" | "monigote_sonido" | "peregrino_animado";

/**
 * Monigote del reto (DT-036). Red de compatibilidad: si la columna `monigote`
 * no llega (código desplegado antes de la migración 0017), se respeta el
 * interruptor anterior `peregrino_animado` (ausente ⇒ encendido, como hacía
 * `configDelReto` con la 0015): encendido ⇒ "atleti", el monigote de siempre.
 * Un id que no está en el catálogo (p. ej. uno retirado) ⇒ ninguno.
 */
export function monigoteDelReto(reto: Partial<Pick<Reto, CampoMonigoteReto>>): MonigoteDelReto {
  const sonido = reto.monigote_sonido ?? true;
  if (reto.monigote === undefined) {
    return { id: (reto.peregrino_animado ?? true) ? "atleti" : null, grito: null, sonido };
  }
  if (!esIdMonigote(reto.monigote)) return { id: null, grito: null, sonido };
  const id = reto.monigote;
  const grito = reto.monigote_grito ? normalizarGritoMonigote(reto.monigote_grito, MONIGOTES[id].grito) : null;
  return { id, grito, sonido };
}

/**
 * Las APIs públicas de una sección (comentarios, minuto a minuto) responden 403
 * cuando el admin la apaga. Para la web abierta es la señal de dejar de
 * sondear y refrescar la página, que ya no pintará la sección.
 */
export function esRespuestaDeSeccionApagada(estadoHttp: number): boolean {
  return estadoHttp === 403;
}

/**
 * Foto de "quién camina" del reto, o null (silueta). Mismo criterio de
 * compatibilidad: sin la columna, null.
 */
export function fotoQuienCaminaDelReto(reto: Partial<Pick<Reto, "quien_camina_foto_url">>): string | null {
  return reto.quien_camina_foto_url ?? null;
}

/**
 * URL de Instagram que debe pintarse, o null: hace falta el interruptor
 * encendido y una URL de perfil de Instagram válida (DT-034; un valor antiguo
 * que no lo sea no se pinta).
 */
export function urlInstagramVisible(config: ConfigReto, url: string): string | null {
  return config.seccion_instagram && esUrlPerfilInstagram(url) ? url.trim() : null;
}
