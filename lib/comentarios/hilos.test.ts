import { describe, expect, it } from "vitest";
import {
  agruparHilos,
  agruparHilosAdmin,
  contarComentariosAdmin,
  listarPrivadosAdmin,
  motivoRechazoPadre,
  puedeResponder,
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
  const privadoViejo = fila({ id: 20, created_at: "2026-09-29T06:00:00Z", visibilidad: "privado" });
  const privadoNuevo = fila({ id: 21, created_at: "2026-09-29T10:00:00Z", visibilidad: "privado" });
  const privadoOculto = fila({ id: 22, created_at: "2026-09-29T09:30:00Z", visibilidad: "privado", oculto: true });
  const filas = [
    respuestaVisible,
    privadoViejo,
    raizVieja,
    respuestaOculta,
    privadoOculto,
    raizNueva,
    raizOculta,
    respuestaDeOculta,
    privadoNuevo,
  ];
  const idsPrivados = [20, 21, 22];

  function idsDe(hilos: ReturnType<typeof agruparHilosAdmin>): number[] {
    return hilos.flatMap((h) => [h.raiz.id, ...h.respuestas.map((r) => r.id)]);
  }

  it.each(["publicos", "ocultos"] as const)("los privados nunca aparecen en '%s' (ni ocultos)", (filtro) => {
    const ids = idsDe(agruparHilosAdmin(filas, filtro));
    expect(ids.some((id) => idsPrivados.includes(id))).toBe(false);
  });

  it("'publicos': raíces no ocultas de más nueva a más vieja, solo respuestas no ocultas y cronológicas", () => {
    const hilos = agruparHilosAdmin(filas, "publicos");

    expect(hilos.map((h) => h.raiz.id)).toEqual([2, 1]);
    expect(hilos[1].respuestas.map((r) => r.id)).toEqual([10]);
    expect(hilos.every((h) => !h.raizEsContexto)).toBe(true);
  });

  it("'publicos': un hilo con la raíz oculta no aparece, aunque sus respuestas no estén ocultas", () => {
    const hilos = agruparHilosAdmin(filas, "publicos");
    expect(idsDe(hilos)).not.toContain(3);
    expect(idsDe(hilos)).not.toContain(12);
  });

  it("totalRespuestas cuenta todas las respuestas aunque el filtro oculte alguna", () => {
    const hilo = agruparHilosAdmin(filas, "publicos").find((h) => h.raiz.id === 1);
    expect(hilo?.totalRespuestas).toBe(2);
  });

  it("'ocultos': una respuesta oculta aparece con su raíz visible como contexto", () => {
    const hilo = agruparHilosAdmin(filas, "ocultos").find((h) => h.raiz.id === 1);
    expect(hilo).toMatchObject({ raizEsContexto: true, respuestas: [respuestaOculta], totalRespuestas: 2 });
  });

  it("'ocultos': una raíz oculta aparece con todas sus respuestas", () => {
    const hilos = agruparHilosAdmin(filas, "ocultos");

    expect(hilos.map((h) => h.raiz.id)).toEqual([1, 3]);
    expect(hilos[1]).toMatchObject({ raizEsContexto: false, respuestas: [respuestaDeOculta] });
  });

  it("'ocultos': una raíz visible sin respuestas ocultas no aparece", () => {
    expect(agruparHilosAdmin(filas, "ocultos").map((h) => h.raiz.id)).not.toContain(2);
  });

  it("descarta respuestas huérfanas", () => {
    const huerfana = fila({ id: 50, parent_id: 999, created_at: "2026-09-29T10:00:00Z", oculto: true });
    expect(idsDe(agruparHilosAdmin([raizNueva, huerfana], "publicos"))).toEqual([2]);
    expect(agruparHilosAdmin([raizNueva, huerfana], "ocultos")).toEqual([]);
  });

  describe("listarPrivadosAdmin", () => {
    it("devuelve solo los privados (también los ocultados antes), de más nuevo a más viejo", () => {
      expect(listarPrivadosAdmin(filas).map((c) => c.id)).toEqual([21, 22, 20]);
    });

    it("ninguno se puede responder", () => {
      expect(listarPrivadosAdmin(filas).some(puedeResponder)).toBe(false);
    });

    it("sin privados devuelve lista vacía", () => {
      expect(listarPrivadosAdmin([raizNueva, respuestaVisible])).toEqual([]);
    });
  });

  describe("contarComentariosAdmin", () => {
    it("cuenta lo que lista cada sub-pestaña, sin las raíces de contexto", () => {
      expect(contarComentariosAdmin(filas)).toEqual({ publicos: 3, privados: 3, ocultos: 3 });
    });

    it("todo a cero sin comentarios", () => {
      expect(contarComentariosAdmin([])).toEqual({ publicos: 0, privados: 0, ocultos: 0 });
    });
  });
});

describe("puedeResponder", () => {
  const raiz = fila({ id: 1, created_at: "2026-09-29T08:00:00Z" });

  it("permite responder a una raíz pública no oculta", () => {
    expect(puedeResponder(raiz)).toBe(true);
  });

  it("nunca permite responder a un privado", () => {
    expect(puedeResponder({ ...raiz, visibilidad: "privado" })).toBe(false);
  });

  it("no permite responder a una raíz oculta", () => {
    expect(puedeResponder({ ...raiz, oculto: true })).toBe(false);
  });

  it("no permite responder a una respuesta", () => {
    expect(puedeResponder({ ...raiz, id: 2, parent_id: 1 })).toBe(false);
  });
});
