/**
 * Tests de GET/POST /[slug]/api/comentarios con hilos (FP3a, DT-030), con el
 * cliente Supabase anon mockado.
 *
 * Cada `from()` crea una consulta falsa que registra la cadena de métodos
 * (`select`, `eq`, `is`, `in`, `insert`...) y, al resolverse, pregunta a
 * `resolverConsulta` qué devolver según esa cadena. Así se comprueba qué
 * filtros se aplican (reto_id, oculto, ids de raíces) sin BD real. Las reglas
 * equivalentes en BD (trigger y RLS de la migración 0011) se verifican con el
 * checklist SQL de docs/tareas/CURRENT.md.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { reiniciarRateLimit } from "@/lib/rate-limit";
import type { Reto } from "@/lib/types";

const RETO: Reto = {
  id: 3,
  slug: "reto-de-prueba",
  nombre: "Reto de prueba",
  descripcion: null,
  ruta_tipo: "predefinida",
  ruta_id: "portuguesa-110",
  activo: true,
  created_at: "2026-09-01T00:00:00.000Z",
};

interface Operacion {
  metodo: string;
  args: unknown[];
}

interface ConsultaRegistrada {
  tabla: string;
  ops: Operacion[];
}

interface Resultado {
  data: unknown;
  error: { code?: string; message: string } | null;
}

let consultas: ConsultaRegistrada[] = [];
let resolverConsulta: (consulta: ConsultaRegistrada) => Resultado;

function tiene(consulta: ConsultaRegistrada, metodo: string, ...args: unknown[]): boolean {
  return consulta.ops.some(
    (op) => op.metodo === metodo && args.every((arg, i) => JSON.stringify(op.args[i]) === JSON.stringify(arg))
  );
}

function crearConsulta(tabla: string) {
  const registrada: ConsultaRegistrada = { tabla, ops: [] };
  consultas.push(registrada);
  const consulta: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "is", "in", "order", "range", "insert"]) {
    consulta[metodo] = (...args: unknown[]) => {
      registrada.ops.push({ metodo, args });
      return consulta;
    };
  }
  for (const metodo of ["maybeSingle", "single"]) {
    consulta[metodo] = () => {
      registrada.ops.push({ metodo, args: [] });
      return Promise.resolve(resolverConsulta(registrada));
    };
  }
  consulta.then = (resolver: (valor: Resultado) => void) => resolver(resolverConsulta(registrada));
  return consulta;
}

vi.mock("@/lib/supabase/public", () => ({
  getSupabasePublic: () => ({ from: (tabla: string) => crearConsulta(tabla) }),
}));

vi.mock("@/lib/supabase/retos", () => ({
  obtenerRetoPorSlug: async (slug: string) => (slug === RETO.slug ? RETO : null),
}));

const { GET, POST } = await import("@/app/[slug]/api/comentarios/route");

const PARAMS = { params: Promise.resolve({ slug: RETO.slug }) };

function peticionGet(query = ""): NextRequest {
  return new NextRequest(`http://localhost/${RETO.slug}/api/comentarios${query}`);
}

function peticionPost(cuerpo: unknown): NextRequest {
  return new NextRequest(`http://localhost/${RETO.slug}/api/comentarios`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

const PADRE_VALIDO = { reto_id: RETO.id, parent_id: null, visibilidad: "publico", oculto: false };

function inserciones(): ConsultaRegistrada[] {
  return consultas.filter((c) => c.ops.some((op) => op.metodo === "insert"));
}

beforeEach(() => {
  reiniciarRateLimit();
  consultas = [];
  resolverConsulta = () => ({ data: null, error: null });
});

describe("GET — página de hilos", () => {
  it("pagina solo raíces del reto y pide las respuestas solo de esas raíces", async () => {
    resolverConsulta = (consulta) => {
      if (tiene(consulta, "is", "parent_id", null)) {
        return {
          data: [
            { id: 20, nombre: "Ana", texto: "¡Ánimo!", created_at: "2026-09-29T12:00:00Z", es_autor: false },
            { id: 10, nombre: "Luis", texto: "Vamos", created_at: "2026-09-29T10:00:00Z", es_autor: false },
          ],
          error: null,
        };
      }
      return {
        data: [
          { id: 31, parent_id: 10, nombre: "Santi", texto: "¡Gracias!", created_at: "2026-09-29T11:00:00Z", es_autor: true },
        ],
        error: null,
      };
    };

    const respuesta = await GET(peticionGet(), PARAMS);
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);
    const [raices, respuestas] = consultas;
    expect(tiene(raices, "eq", "reto_id", RETO.id)).toBe(true);
    expect(tiene(raices, "eq", "oculto", false)).toBe(true);
    expect(tiene(raices, "range", 0, 19)).toBe(true);
    expect(tiene(respuestas, "in", "parent_id", [20, 10])).toBe(true);
    expect(tiene(respuestas, "eq", "reto_id", RETO.id)).toBe(true);
    expect(tiene(respuestas, "eq", "oculto", false)).toBe(true);

    expect(cuerpo).toEqual({
      comentarios: [
        { id: 20, nombre: "Ana", texto: "¡Ánimo!", created_at: "2026-09-29T12:00:00Z", es_autor: false, respuestas: [] },
        {
          id: 10,
          nombre: "Luis",
          texto: "Vamos",
          created_at: "2026-09-29T10:00:00Z",
          es_autor: false,
          respuestas: [{ id: 31, nombre: "Santi", texto: "¡Gracias!", created_at: "2026-09-29T11:00:00Z", es_autor: true }],
        },
      ],
      siguienteOffset: null,
    });
  });

  it("no consulta respuestas si la página no tiene raíces", async () => {
    resolverConsulta = () => ({ data: [], error: null });

    const cuerpo = await (await GET(peticionGet(), PARAMS)).json();

    expect(consultas).toHaveLength(1);
    expect(cuerpo).toEqual({ comentarios: [], siguienteOffset: null });
  });

  it("devuelve siguienteOffset cuando la página de raíces viene llena", async () => {
    resolverConsulta = (consulta) =>
      tiene(consulta, "is", "parent_id", null)
        ? { data: [{ id: 1, nombre: "a", texto: "b", created_at: "2026-09-29T10:00:00Z", es_autor: false }], error: null }
        : { data: [], error: null };

    const cuerpo = await (await GET(peticionGet("?offset=4&limit=1"), PARAMS)).json();

    expect(cuerpo.siguienteOffset).toBe(5);
  });

  it("responde 500 si falla la consulta de respuestas", async () => {
    resolverConsulta = (consulta) =>
      tiene(consulta, "is", "parent_id", null)
        ? { data: [{ id: 1, nombre: "a", texto: "b", created_at: "2026-09-29T10:00:00Z", es_autor: false }], error: null }
        : { data: null, error: { message: "fallo" } };

    expect((await GET(peticionGet(), PARAMS)).status).toBe(500);
  });
});

describe("POST — comentario raíz", () => {
  it("inserta la raíz con la visibilidad elegida y sin parent_id", async () => {
    const respuesta = await POST(peticionPost({ nombre: "Ana", texto: "Hola", visibilidad: "privado" }), PARAMS);

    expect(respuesta.status).toBe(201);
    const [insercion] = inserciones();
    expect(insercion.ops.find((op) => op.metodo === "insert")?.args[0]).toEqual({
      reto_id: RETO.id,
      nombre: "Ana",
      texto: "Hola",
      visibilidad: "privado",
    });
  });
});

describe("POST — respuesta", () => {
  it("inserta la respuesta como pública con el parent_id y devuelve el comentario creado", async () => {
    const creado = { id: 40, nombre: "Ana", texto: "Yo también", created_at: "2026-09-29T12:00:00Z", es_autor: false };
    resolverConsulta = (consulta) =>
      tiene(consulta, "insert") ? { data: creado, error: null } : { data: PADRE_VALIDO, error: null };

    const respuesta = await POST(peticionPost({ nombre: "Ana", texto: "Yo también", parent_id: 10 }), PARAMS);

    expect(respuesta.status).toBe(201);
    expect(await respuesta.json()).toEqual({ ok: true, comentario: creado });
    const lecturaPadre = consultas[0];
    expect(tiene(lecturaPadre, "eq", "id", 10)).toBe(true);
    expect(tiene(lecturaPadre, "eq", "reto_id", RETO.id)).toBe(true);
    expect(inserciones()[0].ops.find((op) => op.metodo === "insert")?.args[0]).toEqual({
      reto_id: RETO.id,
      parent_id: 10,
      nombre: "Ana",
      texto: "Yo también",
      visibilidad: "publico",
    });
  });

  it("rechaza con 422 responder a una respuesta, sin insertar", async () => {
    resolverConsulta = () => ({ data: { ...PADRE_VALIDO, parent_id: 7 }, error: null });

    const respuesta = await POST(peticionPost({ nombre: "Ana", texto: "x", parent_id: 10 }), PARAMS);

    expect(respuesta.status).toBe(422);
    expect(inserciones()).toHaveLength(0);
  });

  it("rechaza con 422 un padre de otro reto, sin insertar", async () => {
    resolverConsulta = () => ({ data: { ...PADRE_VALIDO, reto_id: 99 }, error: null });

    const respuesta = await POST(peticionPost({ nombre: "Ana", texto: "x", parent_id: 10 }), PARAMS);

    expect(respuesta.status).toBe(422);
    expect(inserciones()).toHaveLength(0);
  });

  it("rechaza con 422 un padre invisible para anon (privado, oculto o inexistente) con el mismo mensaje", async () => {
    resolverConsulta = () => ({ data: null, error: null });
    const invisible = await POST(peticionPost({ nombre: "Ana", texto: "x", parent_id: 10 }), PARAMS);

    resolverConsulta = () => ({ data: { ...PADRE_VALIDO, parent_id: 7 }, error: null });
    const esRespuesta = await POST(peticionPost({ nombre: "Ana", texto: "x", parent_id: 10 }), PARAMS);

    expect(invisible.status).toBe(422);
    expect(await invisible.json()).toEqual(await esRespuesta.json());
  });

  it("traduce a 422 el rechazo del trigger de BD (check_violation) si el padre cambia entre lectura e insert", async () => {
    resolverConsulta = (consulta) =>
      tiene(consulta, "insert")
        ? { data: null, error: { code: "23514", message: "respuesta_no_permitida" } }
        : { data: PADRE_VALIDO, error: null };

    const respuesta = await POST(peticionPost({ nombre: "Ana", texto: "x", parent_id: 10 }), PARAMS);

    expect(respuesta.status).toBe(422);
  });

  it("rechaza con 400 un cuerpo con es_autor, sin tocar la BD", async () => {
    const respuesta = await POST(
      peticionPost({ nombre: "Ana", texto: "x", parent_id: 10, es_autor: true }),
      PARAMS
    );

    expect(respuesta.status).toBe(400);
    expect(consultas).toHaveLength(0);
  });

  it("rechaza con 400 una raíz con es_autor", async () => {
    const respuesta = await POST(
      peticionPost({ nombre: "Ana", texto: "x", visibilidad: "publico", es_autor: true }),
      PARAMS
    );

    expect(respuesta.status).toBe(400);
    expect(consultas).toHaveLength(0);
  });

  it("rechaza con 400 una respuesta que indica visibilidad", async () => {
    const respuesta = await POST(
      peticionPost({ nombre: "Ana", texto: "x", parent_id: 10, visibilidad: "privado" }),
      PARAMS
    );

    expect(respuesta.status).toBe(400);
    expect(consultas).toHaveLength(0);
  });

  it("rechaza con 400 un parent_id no entero positivo", async () => {
    const respuesta = await POST(peticionPost({ nombre: "Ana", texto: "x", parent_id: "10" }), PARAMS);

    expect(respuesta.status).toBe(400);
  });

  it("comparte el límite de 10 POST por minuto e IP entre raíces y respuestas", async () => {
    resolverConsulta = () => ({ data: null, error: null });
    for (let i = 0; i < 10; i++) {
      const cuerpo = i % 2 === 0 ? { nombre: "a", texto: "b", visibilidad: "publico" } : { nombre: "a", texto: "b", parent_id: 1 };
      await POST(peticionPost(cuerpo), PARAMS);
    }

    const respuesta = await POST(peticionPost({ nombre: "a", texto: "b", parent_id: 1 }), PARAMS);

    expect(respuesta.status).toBe(429);
  });
});
