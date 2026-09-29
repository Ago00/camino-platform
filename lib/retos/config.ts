/**
 * Configuración de la web pública de un reto (FP3c, DT-032): qué secciones se
 * muestran y si los visitantes pueden responder comentarios.
 *
 * Dominio puro. Toda lectura de la configuración pasa por `configDelReto`, que
 * trata un campo ausente como encendido: si el código se despliega antes de
 * aplicar la migración 0012, `select *` no trae las columnas y la web debe
 * seguir comportándose como antes (todo visible), no apagarse entera.
 */

import type { Reto } from "@/lib/types";

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

/**
 * Foto de "quién camina" del reto, o null (silueta). Mismo criterio de
 * compatibilidad: sin la columna, null.
 */
export function fotoQuienCaminaDelReto(reto: Partial<Pick<Reto, "quien_camina_foto_url">>): string | null {
  return reto.quien_camina_foto_url ?? null;
}

/**
 * URL de Instagram que debe pintarse, o null: hace falta el interruptor
 * encendido y una URL no vacía en el texto editable.
 */
export function urlInstagramVisible(config: ConfigReto, url: string): string | null {
  return config.seccion_instagram && url.trim() !== "" ? url : null;
}
