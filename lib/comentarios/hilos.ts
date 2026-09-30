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

/**
 * true si el admin puede responder a `comentario` desde el panel: la misma
 * regla que la BD y la action (raíz pública no oculta). Nunca un privado.
 */
export function puedeResponder(comentario: Comentario): boolean {
  return motivoRechazoPadre(comentario, comentario.reto_id) === null;
}

/** Un hilo tal como lo pinta la pestaña Comentarios del panel admin. */
export interface HiloAdmin {
  raiz: Comentario;
  /**
   * true si la raíz no cumple el filtro y solo se muestra como contexto de
   * alguna respuesta que sí lo cumple (se pinta atenuada).
   */
  raizEsContexto: boolean;
  /** Respuestas que se muestran con el hilo, en orden cronológico. */
  respuestas: Comentario[];
  /** Todas las respuestas de la raíz, se muestren o no: son las que borra en
   * cascada eliminar la raíz. */
  totalRespuestas: number;
}

/** Sub-pestañas que se pintan como hilos (los privados son una lista plana). */
export type FiltroHilosAdmin = Exclude<FiltroComentario, "privados">;

function separarRaicesYRespuestas(filas: Comentario[]): {
  raices: Comentario[];
  respuestasPorRaiz: Map<number, Comentario[]>;
} {
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
  return { raices, respuestasPorRaiz };
}

/**
 * Agrupa los comentarios públicos de un reto en hilos para el admin. Los
 * privados nunca entran (tienen su propia sub-pestaña). Raíces de más
 * reciente a más antigua; respuestas en orden cronológico; las huérfanas
 * (raíz ausente de `filas`) se descartan.
 *
 * - "publicos": raíces no ocultas con sus respuestas no ocultas. Un hilo con
 *   la raíz oculta no aparece: en la web se oculta entero.
 * - "ocultos": raíces ocultas con todas sus respuestas (se ocultan con ella),
 *   y respuestas ocultas una a una con su raíz visible como contexto.
 */
export function agruparHilosAdmin(filas: Comentario[], filtro: FiltroHilosAdmin): HiloAdmin[] {
  const { raices, respuestasPorRaiz } = separarRaicesYRespuestas(
    filas.filter((fila) => fila.visibilidad === "publico")
  );

  const hilos: HiloAdmin[] = [];
  for (const raiz of [...raices].sort((a, b) => compararCronologico(b, a))) {
    const todas = (respuestasPorRaiz.get(raiz.id) ?? []).sort(compararCronologico);
    const totalRespuestas = todas.length;

    if (filtro === "publicos") {
      if (raiz.oculto) continue;
      hilos.push({ raiz, raizEsContexto: false, respuestas: todas.filter((r) => !r.oculto), totalRespuestas });
      continue;
    }

    if (raiz.oculto) {
      hilos.push({ raiz, raizEsContexto: false, respuestas: todas, totalRespuestas });
      continue;
    }
    const respuestasOcultas = todas.filter((r) => r.oculto);
    if (respuestasOcultas.length > 0) {
      hilos.push({ raiz, raizEsContexto: true, respuestas: respuestasOcultas, totalRespuestas });
    }
  }
  return hilos;
}

/**
 * Mensajes privados (solo para quien camina), de más reciente a más antiguo.
 * Son siempre raíces: la BD exige que las respuestas sean públicas.
 */
export function listarPrivadosAdmin(filas: Comentario[]): Comentario[] {
  return filas.filter((fila) => fila.visibilidad === "privado").sort((a, b) => compararCronologico(b, a));
}

export type ContadoresComentariosAdmin = Record<FiltroComentario, number>;

/**
 * Nº de comentarios que lista cada sub-pestaña, sin contar las raíces que
 * solo aparecen como contexto.
 */
export function contarComentariosAdmin(filas: Comentario[]): ContadoresComentariosAdmin {
  const contar = (hilos: HiloAdmin[]) =>
    hilos.reduce((total, hilo) => total + (hilo.raizEsContexto ? 0 : 1) + hilo.respuestas.length, 0);
  return {
    publicos: contar(agruparHilosAdmin(filas, "publicos")),
    privados: listarPrivadosAdmin(filas).length,
    ocultos: contar(agruparHilosAdmin(filas, "ocultos")),
  };
}
