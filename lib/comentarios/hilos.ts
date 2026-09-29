/**
 * Dominio puro de los hilos de comentarios (FP3a, DT-030). Sin I/O.
 *
 * Un hilo es un comentario raíz (`parent_id` null) con sus respuestas, de un
 * solo nivel. Las reglas de quién puede ser padre viven también en BD
 * (trigger `comentarios_validar_respuesta`, migración 0011): aquí se repiten
 * para responder con un error claro antes de intentar la escritura.
 */

import type { FiltroComentario } from "@/lib/admin/navegacion";
import type { Comentario, ComentarioPublico, HiloPublico } from "@/lib/types";

export type RespuestaPublicaConPadre = ComentarioPublico & { parent_id: number };

/** Por qué un comentario no puede recibir respuestas. */
export type MotivoRechazoPadre = "no_existe" | "otro_reto" | "es_respuesta" | "privado" | "oculto";

export type DatosPadre = Pick<Comentario, "reto_id" | "parent_id" | "visibilidad" | "oculto">;

/**
 * null si `padre` puede recibir una respuesta en el reto `retoId`: debe
 * existir, ser del mismo reto, ser raíz, pública y no oculta.
 */
export function motivoRechazoPadre(padre: DatosPadre | null, retoId: number): MotivoRechazoPadre | null {
  if (!padre) return "no_existe";
  if (padre.reto_id !== retoId) return "otro_reto";
  if (padre.parent_id !== null) return "es_respuesta";
  if (padre.visibilidad !== "publico") return "privado";
  if (padre.oculto) return "oculto";
  return null;
}

function compararCronologico(a: { created_at: string; id: number }, b: { created_at: string; id: number }): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id - b.id;
}

/**
 * Hilos públicos en el orden de `raices` (el que decide la consulta
 * paginada), cada uno con sus respuestas en orden cronológico. Las
 * respuestas cuya raíz no está en `raices` se descartan: nunca aparece una
 * respuesta suelta.
 */
export function agruparHilos(raices: ComentarioPublico[], respuestas: RespuestaPublicaConPadre[]): HiloPublico[] {
  const respuestasPorRaiz = new Map<number, ComentarioPublico[]>();
  for (const raiz of raices) respuestasPorRaiz.set(raiz.id, []);

  for (const { parent_id, ...respuesta } of [...respuestas].sort(compararCronologico)) {
    respuestasPorRaiz.get(parent_id)?.push(respuesta);
  }

  return raices.map((raiz) => ({ ...raiz, respuestas: respuestasPorRaiz.get(raiz.id) ?? [] }));
}

/** Un hilo tal como lo pinta la pestaña Comentarios del panel admin. */
export interface HiloAdmin {
  raiz: Comentario;
  /**
   * true si la raíz no cumple el filtro y solo se muestra como contexto de
   * alguna respuesta que sí lo cumple (se pinta atenuada).
   */
  raizEsContexto: boolean;
  /** Respuestas que cumplen el filtro, en orden cronológico. */
  respuestas: Comentario[];
  /** Todas las respuestas de la raíz, cumplan o no el filtro: son las que
   * borra en cascada eliminar la raíz. */
  totalRespuestas: number;
}

function cumpleFiltro(comentario: Comentario, filtro: FiltroComentario): boolean {
  if (filtro === "publicos") return !comentario.oculto;
  if (filtro === "ocultos") return comentario.oculto;
  return true;
}

/**
 * Agrupa todos los comentarios de un reto en hilos para el admin. Un hilo
 * aparece si su raíz o alguna de sus respuestas cumple el filtro. Raíces de
 * más reciente a más antigua; respuestas en orden cronológico. Las
 * respuestas huérfanas (raíz ausente de `filas`) se descartan.
 */
export function agruparHilosAdmin(filas: Comentario[], filtro: FiltroComentario): HiloAdmin[] {
  const respuestasPorRaiz = new Map<number, Comentario[]>();
  const raices: Comentario[] = [];

  for (const fila of filas) {
    if (fila.parent_id === null) {
      raices.push(fila);
      continue;
    }
    const lista = respuestasPorRaiz.get(fila.parent_id) ?? [];
    lista.push(fila);
    respuestasPorRaiz.set(fila.parent_id, lista);
  }

  const hilos: HiloAdmin[] = [];
  for (const raiz of [...raices].sort((a, b) => compararCronologico(b, a))) {
    const todas = (respuestasPorRaiz.get(raiz.id) ?? []).sort(compararCronologico);
    const respuestas = todas.filter((respuesta) => cumpleFiltro(respuesta, filtro));
    const raizCumple = cumpleFiltro(raiz, filtro);
    if (!raizCumple && respuestas.length === 0) continue;
    hilos.push({ raiz, raizEsContexto: !raizCumple, respuestas, totalRespuestas: todas.length });
  }
  return hilos;
}
