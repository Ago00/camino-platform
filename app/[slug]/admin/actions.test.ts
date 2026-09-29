/**
 * Tests del aislamiento por reto de las server actions del panel admin
 * (FP2.5, DT-028), con el cliente Supabase mockado.
 *
 * El builder falso registra cada llamada encadenada (tabla, método,
 * argumentos) para poder comprobar que las escrituras quedan acotadas al
 * reto del slug: filas con `reto_id` propio se filtran por él además de por
 * `id`, y las que cuelgan de un intento se filtran por el intento activo del
 * reto. Sesión, reto y `revalidatePath` se mockean: aquí solo interesa qué
 * consulta llega a Supabase.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
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

interface LlamadaBuilder {
  tabla: string;
  metodo: string;
  args: unknown[];
}

let llamadas: LlamadaBuilder[] = [];
let intentoActivoMock: { id: number } | null = null;
let retoMock: Reto | null = RETO;

/**
 * Builder encadenable que registra todas las llamadas. `maybeSingle()` sobre
 * `intentos` devuelve el intento activo simulado; cualquier otra consulta,
 * al hacer `await`, resuelve sin error.
 */
function crearConsulta(tabla: string) {
  const consulta = {
    select: (...args: unknown[]) => registrar("select", args),
    update: (...args: unknown[]) => registrar("update", args),
    delete: (...args: unknown[]) => registrar("delete", args),
    upsert: (...args: unknown[]) => registrar("upsert", args),
    insert: (...args: unknown[]) => registrar("insert", args),
    eq: (...args: unknown[]) => registrar("eq", args),
    maybeSingle: () => {
      llamadas.push({ tabla, metodo: "maybeSingle", args: [] });
      return Promise.resolve({ data: tabla === "intentos" ? intentoActivoMock : null, error: null });
    },
    then: (resolver: (valor: { data: null; error: null }) => void) => resolver({ data: null, error: null }),
  };
  function registrar(metodo: string, args: unknown[]) {
    llamadas.push({ tabla, metodo, args });
    return consulta;
  }
  return consulta;
}

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: (tabla: string) => crearConsulta(tabla) }),
}));

vi.mock("@/lib/supabase/retos", () => ({
  obtenerRetoPorSlug: async () => retoMock,
}));

vi.mock("@/lib/auth/admin-session", () => ({
  NOMBRE_COOKIE_SESION: "admin_session",
  verificarSesion: () => true,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "cookie-valida" }), delete: () => undefined }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

const {
  descartarPosicion,
  eliminarComentario,
  eliminarIntencion,
  eliminarMinutoAMinuto,
  ocultarComentario,
  resetearContadorTrafico,
} = await import("@/app/[slug]/admin/actions");

function llamadasA(tabla: string, metodo: string): unknown[][] {
  return llamadas.filter((l) => l.tabla === tabla && l.metodo === metodo).map((l) => l.args);
}

beforeEach(() => {
  llamadas = [];
  intentoActivoMock = null;
  retoMock = RETO;
});

describe("acciones de comentarios e intenciones — filtran por reto_id", () => {
  it("eliminarComentario borra filtrando por id y por el reto del slug", async () => {
    await eliminarComentario(RETO.slug, 55);

    expect(llamadasA("comentarios", "delete")).toHaveLength(1);
    expect(llamadasA("comentarios", "eq")).toEqual([
      ["id", 55],
      ["reto_id", RETO.id],
    ]);
  });

  it("ocultarComentario actualiza filtrando por id y por el reto del slug", async () => {
    await ocultarComentario(RETO.slug, 55);

    expect(llamadasA("comentarios", "update")).toEqual([[{ oculto: true }]]);
    expect(llamadasA("comentarios", "eq")).toContainEqual(["reto_id", RETO.id]);
  });

  it("eliminarIntencion borra filtrando por id y por el reto del slug", async () => {
    await eliminarIntencion(RETO.slug, 8);

    expect(llamadasA("intenciones", "eq")).toEqual([
      ["id", 8],
      ["reto_id", RETO.id],
    ]);
  });

  it("no toca la BD si el reto del slug no existe", async () => {
    retoMock = null;

    await expect(eliminarComentario("reto-inexistente", 55)).rejects.toThrow();
    expect(llamadasA("comentarios", "delete")).toHaveLength(0);
  });
});

describe("acciones sobre filas hijas de intento — acotadas al intento activo del reto", () => {
  it("descartarPosicion busca el intento activo del reto y filtra la posición por ese intento", async () => {
    intentoActivoMock = { id: 21 };

    await descartarPosicion(RETO.slug, 400);

    expect(llamadasA("intentos", "eq")).toEqual([
      ["reto_id", RETO.id],
      ["cerrado", false],
    ]);
    expect(llamadasA("posiciones", "eq")).toEqual([
      ["id", 400],
      ["intento_id", 21],
    ]);
  });

  it("descartarPosicion falla sin tocar posiciones si el reto no tiene intento activo", async () => {
    intentoActivoMock = null;

    await expect(descartarPosicion(RETO.slug, 400)).rejects.toThrow();
    expect(llamadasA("posiciones", "update")).toHaveLength(0);
  });

  it("eliminarMinutoAMinuto filtra la entrada por el intento activo del reto", async () => {
    intentoActivoMock = { id: 21 };

    await eliminarMinutoAMinuto(RETO.slug, 9);

    expect(llamadasA("minuto_a_minuto", "eq")).toEqual([
      ["id", 9],
      ["intento_id", 21],
    ]);
  });
});

describe("resetearContadorTrafico — upsert por reto_id", () => {
  it("hace upsert de cuenta_desde con el reto del slug y onConflict reto_id", async () => {
    await resetearContadorTrafico(RETO.slug);

    const upserts = llamadasA("config_trafico", "upsert");
    expect(upserts).toHaveLength(1);
    const [fila, opciones] = upserts[0];
    expect(fila).toEqual({ reto_id: RETO.id, cuenta_desde: expect.any(String) });
    expect(opciones).toEqual({ onConflict: "reto_id" });
    expect(llamadasA("config_trafico", "eq")).toHaveLength(0);
  });
});
