/**
 * Estado de navegación del panel admin derivado de la query string: pestaña
 * activa (?tab=), filtro de comentarios (?filtroComentarios=), granularidad
 * del gráfico de tráfico (?gran=, DT-022) y fase de tráfico mostrada
 * (?fase=, DT-023), con sus validadores. Vive fuera de components/admin/
 * (esos ficheros tienen "use client") porque Next.js 16 trata TODO lo
 * exportado de un módulo "use client" como límite cliente-servidor —
 * incluidas funciones puras sin ningún hook. `app/admin/page.tsx` (Server
 * Component) necesita llamar a estos validadores directamente, así que deben
 * vivir en un módulo sin directiva.
 */

export const TABS_ADMIN = [
  { valor: "actividad", etiqueta: "Actividad" },
  { valor: "posicion", etiqueta: "Posición" },
  { valor: "mapa", etiqueta: "Mapa" },
  { valor: "intenciones", etiqueta: "Intenciones" },
  { valor: "comentarios", etiqueta: "Comentarios" },
  { valor: "minutoaminuto", etiqueta: "Minuto a minuto" },
  { valor: "trafico", etiqueta: "Tráfico" },
  { valor: "textos", etiqueta: "Textos" },
  { valor: "configuracion", etiqueta: "Configuración" },
] as const;

export type TabAdmin = (typeof TABS_ADMIN)[number]["valor"];

export function esTabValida(valor: string | null): valor is TabAdmin {
  return TABS_ADMIN.some((tab) => tab.valor === valor);
}

/**
 * Sub-pestañas de la pestaña "Comentarios". "Privados" son los mensajes que
 * el visitante escribió solo para quien camina (visibilidad 'privado'): no se
 * publican ni admiten respuesta. "Ocultos" son públicos que el admin ocultó.
 */
export const FILTROS_COMENTARIO = [
  { valor: "publicos", etiqueta: "Públicos" },
  { valor: "privados", etiqueta: "Privados" },
  { valor: "ocultos", etiqueta: "Ocultos" },
] as const;

export type FiltroComentario = (typeof FILTROS_COMENTARIO)[number]["valor"];

export const FILTRO_COMENTARIO_POR_DEFECTO: FiltroComentario = "publicos";

export function esFiltroComentarioValido(valor: string | undefined): valor is FiltroComentario {
  return FILTROS_COMENTARIO.some((filtro) => filtro.valor === valor);
}

/** Filtro de la URL o el default si falta o no es válido (p. ej. el antiguo "todos"). */
export function filtroComentarioDesdeQuery(valor: string | undefined): FiltroComentario {
  return esFiltroComentarioValido(valor) ? valor : FILTRO_COMENTARIO_POR_DEFECTO;
}

/** Granularidad del gráfico de la pestaña "Tráfico" (DT-022). Default "30m". */
export type GranularidadTrafico = "5m" | "30m" | "1h";

export function esGranularidadValida(valor: string | undefined): valor is GranularidadTrafico {
  return valor === "5m" || valor === "30m" || valor === "1h";
}

/**
 * Fase de tráfico mostrada en la pestaña "Tráfico" (DT-023): antes/durante/
 * después del intento relevante. Sin default fijo aquí — depende del estado
 * del intento (`faseTraficoPorDefecto`, `lib/trafico/fases.ts`), así que
 * `app/admin/page.tsx` solo usa este validador para saber si el valor de la
 * URL es utilizable o hay que recurrir a ese default.
 */
export type FaseTraficoTab = "antes" | "durante" | "despues";

export function esFaseTraficoValida(valor: string | undefined): valor is FaseTraficoTab {
  return valor === "antes" || valor === "durante" || valor === "despues";
}
