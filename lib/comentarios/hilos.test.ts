import { describe, expect, it } from "vitest";
import {
  agruparHilos,
  agruparHilosAdmin,
  motivoRechazoPadre,
  type DatosPadre,
  type RespuestaPublicaConPadre,
} from "@/lib/comentarios/hilos";
import type { Comentario, ComentarioPublico } from "@/lib/types";

const RETO_ID = 3;

const PADRE_VALIDO: DatosPadre = { reto_id: RETO_ID, parent_id: null, visibilidad: "publico", oculto: false };

describe("motivoRechazoPadre", () => {
  it("acepta una raíz pública, visible y del mismo reto", () => {
    expect(motivoRechazoPadre(PADRE_VALIDO, RETO_ID)).toBeNull();
  });

  it("rechaza un padre inexistente (o invisible por RLS)", () => {
    expect(motivoRechazoPadre(null, RETO_ID)).toBe("no_existe");
  });

  it("rechaza un padre de otro reto", () => {
    expect(motivoRechazoPadre({ ...PADRE_VALIDO, reto_id: 99 }, RETO_ID)).toBe("otro_reto");
  });

  it("rechaza responder a una respuesta (un solo nivel)", () => {
    expect(motivoRechazoPadre({ ...PADRE_VALIDO, parent_id: 10 }, RETO_ID)).toBe("es_respuesta");
  });

  it("rechaza un padre privado", () => {
    expect(motivoRechazoPadre({ ...PADRE_VALIDO, visibilidad: "privado" }, RETO_ID)).toBe("privado");
  });

  it("rechaza un padre oculto", () => {
    expect(motivoRechazoPadre({ ...PADRE_VALIDO, oculto: true }, RETO_ID)).toBe("oculto");
  });
});

function publico(id: number, created_at: string, es_autor = false): ComentarioPublico {
  return { id, nombre: `n${id}`, texto: `t${id}`, created_at, es_autor };
}

function respuestaPublica(id: number, parent_id: number, created_at: string): RespuestaPublicaConPadre {
  return { ...publico(id, created_at), parent_id };
}

describe("agruparHilos", () => {
  it("conserva el orden de las raíces y ordena las respuestas cronológicamente", () => {
    const raices = [publico(2, "2026-09-29T12:00:00Z"), publico(1, "2026-09-29T10:00:00Z")];
    const respuestas = [
      respuestaPublica(12, 1, "2026-09-29T11:30:00Z"),
      respuestaPublica(11, 1, "2026-09-29T11:00:00Z"),
      respuestaPublica(21, 2, "2026-09-29T12:05:00Z"),
    ];

    const hilos = agruparHilos(raices, respuestas);

    expect(hilos.map((h) => h.id)).toEqual([2, 1]);
    expect(hilos[0].respuestas.map((r) => r.id)).toEqual([21]);
    expect(hilos[1].respuestas.map((r) => r.id)).toEqual([11, 12]);
  });

  it("desempata por id cuando dos respuestas tienen el mismo instante", () => {
    const hilos = agruparHilos(
      [publico(1, "2026-09-29T10:00:00Z")],
      [respuestaPublica(8, 1, "2026-09-29T11:00:00Z"), respuestaPublica(7, 1, "2026-09-29T11:00:00Z")]
    );
    expect(hilos[0].respuestas.map((r) => r.id)).toEqual([7, 8]);
  });

  it("no expone parent_id en las respuestas públicas", () => {
    const hilos = agruparHilos([publico(1, "2026-09-29T10:00:00Z")], [respuestaPublica(5, 1, "2026-09-29T11:00:00Z")]);
    expect(hilos[0].respuestas[0]).not.toHaveProperty("parent_id");
  });

  it("descarta respuestas cuya raíz no está en la página", () => {
    const hilos = agruparHilos([publico(1, "2026-09-29T10:00:00Z")], [respuestaPublica(5, 999, "2026-09-29T11:00:00Z")]);
    expect(hilos[0].respuestas).toEqual([]);
  });

  it("una raíz sin respuestas lleva lista vacía", () => {
    expect(agruparHilos([publico(1, "2026-09-29T10:00:00Z")], [])).toEqual([
      { ...publico(1, "2026-09-29T10:00:00Z"), respuestas: [] },
    ]);
  });
});

function fila(parcial: Partial<Comentario> & Pick<Comentario, "id" | "created_at">): Comentario {
  return {
    reto_id: RETO_ID,
    parent_id: null,
    nombre: "n",
    texto: "t",
    visibilidad: "publico",
    oculto: false,
    es_autor: false,
    ...parcial,
  };
}

describe("agruparHilosAdmin", () => {
  const raizVieja = fila({ id: 1, created_at: "2026-09-29T08:00:00Z" });
  const raizNueva = fila({ id: 2, created_at: "2026-09-29T09:00:00Z" });
  const raizOculta = fila({ id: 3, created_at: "2026-09-29T07:00:00Z", oculto: true });
  const respuestaVisible = fila({ id: 10, parent_id: 1, created_at: "2026-09-29T08:30:00Z" });
  const respuestaOculta = fila({ id: 11, parent_id: 1, created_at: "2026-09-29T08:10:00Z", oculto: true });
  const respuestaDeOculta = fila({ id: 12, parent_id: 3, created_at: "2026-09-29T07:30:00Z" });
  const filas = [respuestaVisible, raizVieja, respuestaOculta, raizNueva, raizOculta, respuestaDeOculta];

  it("con filtro 'todos' agrupa todo: raíces de más nueva a más vieja, respuestas cronológicas", () => {
    const hilos = agruparHilosAdmin(filas, "todos");

    expect(hilos.map((h) => h.raiz.id)).toEqual([2, 1, 3]);
    expect(hilos[1].respuestas.map((r) => r.id)).toEqual([11, 10]);
    expect(hilos.every((h) => !h.raizEsContexto)).toBe(true);
  });

  it("totalRespuestas cuenta todas las respuestas aunque el filtro oculte alguna", () => {
    const hilo = agruparHilosAdmin(filas, "publicos").find((h) => h.raiz.id === 1);
    expect(hilo?.respuestas.map((r) => r.id)).toEqual([10]);
    expect(hilo?.totalRespuestas).toBe(2);
  });

  it("con filtro 'publicos', una raíz oculta con respuestas visibles aparece como contexto", () => {
    const hilo = agruparHilosAdmin(filas, "publicos").find((h) => h.raiz.id === 3);
    expect(hilo).toMatchObject({ raizEsContexto: true, respuestas: [respuestaDeOculta] });
  });

  it("con filtro 'ocultos', una raíz visible solo aparece si tiene respuestas ocultas, como contexto", () => {
    const hilos = agruparHilosAdmin(filas, "ocultos");

    expect(hilos.map((h) => h.raiz.id)).toEqual([1, 3]);
    expect(hilos[0]).toMatchObject({ raizEsContexto: true, respuestas: [respuestaOculta] });
    expect(hilos[1]).toMatchObject({ raizEsContexto: false, respuestas: [] });
  });

  it("descarta respuestas huérfanas", () => {
    const huerfana = fila({ id: 50, parent_id: 999, created_at: "2026-09-29T10:00:00Z" });
    const hilos = agruparHilosAdmin([raizNueva, huerfana], "todos");
    expect(hilos).toHaveLength(1);
    expect(hilos[0].respuestas).toEqual([]);
  });
});
