/**
 * Agrupación de las claves de texto en bloques para la pestaña "Textos" del
 * panel admin (FP3c, DT-032). Solo presentación: el orden y el título de cada
 * bloque siguen el recorrido de la web pública.
 *
 * Invariante: cada clave de `CLAVES_TEXTOS` está en exactamente un bloque. Que
 * esté en alguno lo comprueba el compilador (`ClavesTextoSinBloque`); que no
 * esté en dos, `bloques.test.ts`. Al añadir una clave nueva a `defaults.ts`,
 * hay que colocarla aquí o no compila.
 */

import type { ClaveTexto } from "@/lib/textos/defaults";
import type { CampoConfigReto } from "@/lib/retos/config";

/** Interruptor de sección de la configuración del reto del que depende un bloque. */
export type SeccionConfigurable = Exclude<CampoConfigReto, "respuestas_visitantes">;

interface BloqueTextos {
  id: string;
  titulo: string;
  claves: readonly ClaveTexto[];
  /** Si el bloque pertenece a una sección que se puede apagar, su interruptor. */
  seccion?: SeccionConfigurable;
}

export const BLOQUES_TEXTOS = [
  {
    id: "cabecera",
    titulo: "Cabecera y el reto",
    claves: ["ruta_badge", "hito_salida_kicker", "reto_titulo", "reto_descripcion"],
  },
  {
    id: "recorrido",
    titulo: "Recorrido y perfil",
    claves: [
      "recorrido_kicker",
      "recorrido_titulo",
      "recorrido_descripcion",
      "perfil_label_distancia",
      "perfil_label_ascenso",
      "perfil_label_descenso",
      "perfil_origen_nombre",
      "perfil_destino_nombre",
    ],
  },
  {
    id: "quien-camina",
    titulo: "Quién camina",
    claves: ["quien_camina_kicker", "quien_camina_nombre", "quien_camina_subtitulo", "quien_camina"],
  },
  {
    id: "intenciones",
    titulo: "Intenciones",
    seccion: "seccion_intenciones",
    claves: [
      "por_intenciones_kicker",
      "por_intenciones_titulo",
      "por_intenciones",
      "intencion_form_titulo",
      "intencion_form_subtitulo",
      "intencion_form_placeholder_texto",
      "intencion_form_placeholder_nombre",
      "intencion_form_label_anonimo",
      "intencion_form_boton_enviar",
      "intencion_form_mensaje_exito",
    ],
  },
  {
    id: "comentarios",
    titulo: "Comentarios",
    seccion: "seccion_comentarios",
    claves: [
      "comentarios_seccion_kicker",
      "comentarios_seccion_titulo",
      "comentarios_seccion_descripcion",
      "comentario_form_titulo",
      "comentario_form_placeholder_nombre",
      "comentario_form_placeholder_texto",
      "comentario_form_label_publico",
      "comentario_form_label_privado",
      "comentario_form_boton_enviar",
      "comentario_form_mensaje_exito",
      "muro_boton_cargar_mas",
      "muro_mensaje_fin",
      "muro_boton_responder",
      "muro_boton_ver_respuestas",
      "muro_boton_ocultar_respuestas",
      "muro_insignia_caminante",
      "respuesta_form_placeholder_texto",
      "respuesta_form_boton_enviar",
    ],
  },
  {
    id: "cierre-antes",
    titulo: "Cierre de «antes»",
    claves: ["cierre_antes_titulo", "cierre_antes"],
  },
  {
    id: "instagram",
    titulo: "Instagram",
    seccion: "seccion_instagram",
    claves: ["cierre_antes_instagram_url"],
  },
  {
    id: "durante",
    titulo: "Durante",
    claves: [
      "durante_en_directo_kicker",
      "durante_en_directo_titulo",
      "mojon_destino_kicker",
      "mojon_subtitulo",
      "mojon_origen_label",
      "distancia_restante_kicker",
      "distancia_restante_subtitulo",
      "stats_label_en_marcha",
      "stats_label_caminados",
      "stats_label_ritmo_medio",
    ],
  },
  {
    id: "minuto-a-minuto",
    titulo: "Minuto a minuto",
    seccion: "seccion_minuto_a_minuto",
    claves: [
      "minuto_a_minuto_kicker",
      "minuto_a_minuto_boton_cargar_mas",
      "minuto_a_minuto_mensaje_vacio",
      "minuto_a_minuto_boton_mostrar",
      "minuto_a_minuto_boton_ocultar",
      "minuto_a_minuto_aviso_nueva",
      "minuto_a_minuto_aviso_nuevas",
    ],
  },
  {
    id: "llegada",
    titulo: "Llegada",
    claves: [
      "mensaje_llegada_default",
      "llegada_kicker",
      "llegada_titulo",
      "llegada_libre_kicker",
      "llegada_libre_titulo",
    ],
  },
  {
    id: "general",
    titulo: "General",
    claves: ["mensaje_error_generico"],
  },
] as const satisfies readonly BloqueTextos[];

type ClaveEnBloque = (typeof BLOQUES_TEXTOS)[number]["claves"][number];

type DebeSerNever<T extends never> = T;

/** No compila si alguna clave de `CLAVES_TEXTOS` no está en ningún bloque. */
export type ClavesTextoSinBloque = DebeSerNever<Exclude<ClaveTexto, ClaveEnBloque>>;
