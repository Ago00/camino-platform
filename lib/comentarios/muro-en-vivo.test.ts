import { describe, expect, it } from "vitest";
import {
  aplicarPaginaCero,
  aplicarPaginaSiguiente,
  aplicarRespuestaPropia,
  ESTADO_MURO_INICIAL,
  fusionarHilos,
  type EstadoMuro,
} from "@/lib/comentarios/muro-en-vivo";
import type { ComentarioPublico, HiloPublico } from "@/lib/types";

/** Comentario con `created_at` derivado del id: a mayor id, más reciente. */
function comentario(id: number): ComentarioPublico {
  const minuto = String(id).padStart(2, "0");
  return { id, nombre: `n${id}`, texto: `t${id}`, created_at: `2026-10-01T10:${minuto}:00.000Z`, es_autor: false };
}

function hilo(id: number, idsRespuestas: number[] = []): HiloPublico {
  return { ...comentario(id), respuestas: idsRespuestas.map(comentario) };
}

function ids(hilos: readonly HiloPublico[]): number[] {
  return hilos.map((h) => h.id);
}

function idsRespuestas(hilos: readonly HiloPublico[], idHilo: number): number[] {
  return hilos.find((h) => h.id === idHilo)?.respuestas.map((r) => r.id) ?? [];
}

describe("fusionarHilos", () => {
  it("pone arriba las raíces nuevas de la página 0 y conserva las de páginas siguientes", () => {
    const cargados = [hilo(30), hilo(20), hilo(10), hilo(5)]; // 10 y 5 vinieron de "Cargar más"
    const paginaCero = [hilo(45), hilo(40), hilo(30), hilo(20)];

    expect(ids(fusionarHilos(cargados, paginaCero))).toEqual([45, 40, 30, 20, 10, 5]);
  });

  it("no duplica raíces que llegan por dos caminos", () => {
    const resultado = fusionarHilos([hilo(3), hilo(2)], [hilo(3), hilo(2), hilo(1)]);
    expect(ids(resultado)).toEqual([3, 2, 1]);
  });

  it("añade las respuestas nuevas dentro de su hilo, en orden cronológico y sin duplicar", () => {
    const resultado = fusionarHilos([hilo(10, [11, 13])], [hilo(10, [11, 12, 13, 14])]);
    expect(idsRespuestas(resultado, 10)).toEqual([11, 12, 13, 14]);
  });

  it("no pierde una respuesta añadida en local que la página recibida aún no trae", () => {
    const resultado = fusionarHilos([hilo(10, [11, 15])], [hilo(10, [11, 12])]);
    expect(idsRespuestas(resultado, 10)).toEqual([11, 12, 15]);
  });

  it("devuelve la misma lista (y los mismos hilos) si no hay nada nuevo", () => {
    const cargados = [hilo(3, [4]), hilo(2)];
    expect(fusionarHilos(cargados, [hilo(3, [4]), hilo(2)])).toBe(cargados);
    expect(fusionarHilos(cargados, [])).toBe(cargados);
  });

  it("conserva la identidad de los hilos que no cambian aunque cambie otro", () => {
    const intacto = hilo(2);
    const resultado = fusionarHilos([hilo(3), intacto], [hilo(3, [4]), hilo(2)]);
    expect(resultado[1]).toBe(intacto);
  });

  it("no quita una raíz que ya no viene en la página 0 (p. ej. ocultada entre polls)", () => {
    expect(ids(fusionarHilos([hilo(3), hilo(2)], [hilo(2)]))).toEqual([3, 2]);
  });

  it("desempata por id cuando dos raíces tienen el mismo created_at, como la API", () => {
    const a = { ...hilo(7), created_at: "2026-10-01T10:00:00.000Z" };
    const b = { ...hilo(8), created_at: "2026-10-01T10:00:00.000Z" };
    expect(ids(fusionarHilos([a], [b]))).toEqual([8, 7]);
  });
});

describe("aplicarPaginaCero", () => {
  it("la carga inicial fija la paginación según la respuesta", () => {
    expect(aplicarPaginaCero(ESTADO_MURO_INICIAL, { comentarios: [hilo(2)], siguienteOffset: 20 }).paginacion).toEqual({
      estado: "mas",
      siguienteOffset: 20,
    });
    expect(aplicarPaginaCero(ESTADO_MURO_INICIAL, { comentarios: [], siguienteOffset: null }).paginacion).toEqual({
      estado: "fin",
    });
  });

  it("un poll conserva el offset de 'Cargar más' ya avanzado", () => {
    const estado: EstadoMuro = { hilos: [hilo(3), hilo(2), hilo(1)], paginacion: { estado: "mas", siguienteOffset: 40 } };
    const resultado = aplicarPaginaCero(estado, { comentarios: [hilo(4), hilo(3)], siguienteOffset: 20 });

    expect(resultado.paginacion).toEqual({ estado: "mas", siguienteOffset: 40 });
    expect(ids(resultado.hilos)).toEqual([4, 3, 2, 1]);
  });

  it("con todo cargado, un poll con raíces conocidas no vuelve a ofrecer 'Cargar más'", () => {
    const estado: EstadoMuro = { hilos: [hilo(3), hilo(2)], paginacion: { estado: "fin" } };
    const resultado = aplicarPaginaCero(estado, { comentarios: [hilo(4), hilo(3)], siguienteOffset: 2 });

    expect(resultado.paginacion).toEqual({ estado: "fin" });
  });

  it("con todo cargado, una página 0 llena sin ninguna raíz conocida reabre 'Cargar más' para el hueco", () => {
    const estado: EstadoMuro = { hilos: [hilo(3), hilo(2)], paginacion: { estado: "fin" } };
    const resultado = aplicarPaginaCero(estado, { comentarios: [hilo(9), hilo(8)], siguienteOffset: 2 });

    expect(resultado.paginacion).toEqual({ estado: "mas", siguienteOffset: 2 });
  });

  it("devuelve el mismo estado si el poll no trae nada nuevo (no provoca render)", () => {
    const estado: EstadoMuro = { hilos: [hilo(3, [4])], paginacion: { estado: "fin" } };
    expect(aplicarPaginaCero(estado, { comentarios: [hilo(3, [4])], siguienteOffset: null })).toBe(estado);
  });
});

describe("aplicarPaginaSiguiente", () => {
  it("añade la página al final, descarta las raíces repetidas por el desplazamiento del offset y avanza", () => {
    const estado: EstadoMuro = { hilos: [hilo(5), hilo(4), hilo(3)], paginacion: { estado: "mas", siguienteOffset: 2 } };
    const resultado = aplicarPaginaSiguiente(estado, { comentarios: [hilo(3, [6]), hilo(2)], siguienteOffset: null });

    expect(ids(resultado.hilos)).toEqual([5, 4, 3, 2]);
    expect(idsRespuestas(resultado.hilos, 3)).toEqual([6]);
    expect(resultado.paginacion).toEqual({ estado: "fin" });
  });
});

describe("aplicarRespuestaPropia", () => {
  it("añade la respuesta publicada a su hilo y solo a ese", () => {
    const otro = hilo(2);
    const estado: EstadoMuro = { hilos: [hilo(3), otro], paginacion: { estado: "fin" } };
    const resultado = aplicarRespuestaPropia(estado, 3, comentario(9));

    expect(idsRespuestas(resultado.hilos, 3)).toEqual([9]);
    expect(resultado.hilos[1]).toBe(otro);
  });

  it("no la duplica si el poll ya la había traído", () => {
    const estado: EstadoMuro = { hilos: [hilo(3, [9])], paginacion: { estado: "fin" } };
    expect(aplicarRespuestaPropia(estado, 3, comentario(9))).toBe(estado);
  });

  it("un poll posterior que ya la trae no la duplica", () => {
    const conPropia = aplicarRespuestaPropia({ hilos: [hilo(3)], paginacion: { estado: "fin" } }, 3, comentario(9));
    const trasPoll = aplicarPaginaCero(conPropia, { comentarios: [hilo(3, [9])], siguienteOffset: null });

    expect(idsRespuestas(trasPoll.hilos, 3)).toEqual([9]);
    expect(trasPoll).toBe(conPropia);
  });

  it("ignora un hilo que no está cargado", () => {
    const estado: EstadoMuro = { hilos: [hilo(3)], paginacion: { estado: "fin" } };
    expect(aplicarRespuestaPropia(estado, 99, comentario(9))).toBe(estado);
  });
});
