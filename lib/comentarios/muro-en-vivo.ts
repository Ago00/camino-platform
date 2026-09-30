/**
 * Estado del muro público de comentarios en la web (hilos cargados +
 * paginación) y cómo se le incorporan páginas, polls y respuestas propias.
 * Dominio puro, sin I/O.
 *
 * El muro recibe hilos por tres caminos que se solapan: "Cargar más" (páginas
 * por offset sobre las raíces), la página 0 (carga inicial, recarga tras
 * publicar y poll cada 60 s) y la respuesta que acaba de publicar el propio
 * visitante. Todos se fusionan por `id`:
 *
 * - Raíces: unión sin duplicados, siempre en el orden de la API (más reciente
 *   primero, desempate por id). Así las nuevas quedan arriba y las páginas ya
 *   cargadas no se pierden aunque el offset se desplace.
 * - Respuestas de cada hilo: unión sin duplicados en orden cronológico; nunca
 *   se quita una que ya estaba (p. ej. la añadida en local).
 * - Si nada cambia se devuelve el MISMO objeto de estado, para que React no
 *   vuelva a pintar (el poll no debe mover al visitante que está leyendo).
 *
 * Una raíz que el admin oculta o borra no desaparece hasta recargar la página:
 * el poll solo añade. Es deliberado: quitar filas bajo el dedo del visitante
 * (o el hilo al que está respondiendo) es peor que verla un rato más.
 */

import type { ComentarioPublico, HiloPublico, RespuestaMuro } from "@/lib/types";

/**
 * - `sin-cargar`: todavía no ha llegado la página 0.
 * - `mas`: quedan raíces por pedir a partir de `siguienteOffset`.
 * - `fin`: todas las raíces están cargadas.
 */
export type PaginacionMuro =
  | { estado: "sin-cargar" }
  | { estado: "mas"; siguienteOffset: number }
  | { estado: "fin" };

export interface EstadoMuro {
  hilos: HiloPublico[];
  paginacion: PaginacionMuro;
}

export const ESTADO_MURO_INICIAL: EstadoMuro = { hilos: [], paginacion: { estado: "sin-cargar" } };

type Ordenable = Pick<ComentarioPublico, "id" | "created_at">;

function compararCronologico(a: Ordenable, b: Ordenable): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id - b.id;
}

function mismaLista<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((elemento, i) => elemento === b[i]);
}

/** Respuestas de `actuales` más las de `recibidas` que no estaban, en orden cronológico. */
function fusionarRespuestas(
  actuales: ComentarioPublico[],
  recibidas: readonly ComentarioPublico[]
): ComentarioPublico[] {
  const ids = new Set(actuales.map((respuesta) => respuesta.id));
  const nuevas = recibidas.filter((respuesta) => !ids.has(respuesta.id));
  if (nuevas.length === 0) return actuales;
  return [...actuales, ...nuevas].sort(compararCronologico);
}

/** Unión por id de hilos y de sus respuestas; devuelve `actuales` si no cambia nada. */
export function fusionarHilos(actuales: HiloPublico[], recibidos: readonly HiloPublico[]): HiloPublico[] {
  const recibidosPorId = new Map(recibidos.map((hilo) => [hilo.id, hilo]));

  const actualizados = actuales.map((hilo) => {
    const recibido = recibidosPorId.get(hilo.id);
    if (!recibido) return hilo;
    const respuestas = fusionarRespuestas(hilo.respuestas, recibido.respuestas);
    return respuestas === hilo.respuestas ? hilo : { ...hilo, respuestas };
  });

  const idsActuales = new Set(actuales.map((hilo) => hilo.id));
  const nuevos = recibidos.filter((hilo) => !idsActuales.has(hilo.id));

  const resultado = [...actualizados, ...nuevos].sort((a, b) => compararCronologico(b, a));
  return mismaLista(resultado, actuales) ? actuales : resultado;
}

function paginacionDeRespuesta(siguienteOffset: number | null): PaginacionMuro {
  return siguienteOffset === null ? { estado: "fin" } : { estado: "mas", siguienteOffset };
}

/**
 * Página 0 recibida (carga inicial, recarga tras publicar o poll).
 *
 * La paginación solo la fija la carga inicial. Después se conserva el offset
 * de "Cargar más": si han entrado raíces nuevas, la siguiente página repite
 * alguna ya cargada y la fusión la descarta, sin perder ninguna. Con todo
 * cargado (`fin`), solo puede quedar un hueco si la página 0 llega llena y sin
 * ninguna raíz conocida (entraron más de las que caben): entonces vuelve a
 * haber "Cargar más" para recuperarlas.
 */
export function aplicarPaginaCero(estado: EstadoMuro, pagina: RespuestaMuro): EstadoMuro {
  const hilos = fusionarHilos(estado.hilos, pagina.comentarios);

  let paginacion = estado.paginacion;
  if (estado.paginacion.estado === "sin-cargar") {
    paginacion = paginacionDeRespuesta(pagina.siguienteOffset);
  } else if (estado.paginacion.estado === "fin" && pagina.siguienteOffset !== null) {
    const idsCargados = new Set(estado.hilos.map((hilo) => hilo.id));
    const hayHueco = pagina.comentarios.every((hilo) => !idsCargados.has(hilo.id));
    if (hayHueco) paginacion = { estado: "mas", siguienteOffset: pagina.siguienteOffset };
  }

  if (hilos === estado.hilos && paginacion === estado.paginacion) return estado;
  return { hilos, paginacion };
}

/** Página pedida con "Cargar más" (offset > 0): la paginación avanza con la respuesta. */
export function aplicarPaginaSiguiente(estado: EstadoMuro, pagina: RespuestaMuro): EstadoMuro {
  return {
    hilos: fusionarHilos(estado.hilos, pagina.comentarios),
    paginacion: paginacionDeRespuesta(pagina.siguienteOffset),
  };
}

/**
 * Respuesta que acaba de publicar el visitante, añadida a su hilo sin esperar
 * al poll. Si el poll ya la trajo, no se duplica.
 */
export function aplicarRespuestaPropia(
  estado: EstadoMuro,
  hiloId: number,
  respuesta: ComentarioPublico
): EstadoMuro {
  const hilos = estado.hilos.map((hilo) => {
    if (hilo.id !== hiloId) return hilo;
    const respuestas = fusionarRespuestas(hilo.respuestas, [respuesta]);
    return respuestas === hilo.respuestas ? hilo : { ...hilo, respuestas };
  });
  return mismaLista(hilos, estado.hilos) ? estado : { ...estado, hilos };
}
