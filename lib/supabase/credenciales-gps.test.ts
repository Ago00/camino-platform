/**
 * Acceso a `retos_gps` (DT-035) con el cliente Supabase mockado: formato del
 * token generado, upsert por reto, reintento único ante colisión de unicidad
 * y lectura en una sola consulta del reto del slug con su token.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface LlamadaBuilder {
  metodo: string;
  args: unknown[];
}

let llamadas: LlamadaBuilder[] = [];
let respuestasUpsert: { error: { code?: string; message: string } | null }[] = [];
let respuestaMaybeSingle: { data: unknown; error: { message: string } | null } = { data: null, error: null };

function crearConsulta() {
  const consulta = {
    select: (...args: unknown[]) => registrar("select", args),
    eq: (...args: unknown[]) => registrar("eq", args),
    upsert: (...args: unknown[]) => {
      llamadas.push({ metodo: "upsert", args });
      return Promise.resolve(respuestasUpsert.shift() ?? { error: null });
    },
    maybeSingle: () => Promise.resolve(respuestaMaybeSingle),
  };
  function registrar(metodo: string, args: unknown[]) {
    llamadas.push({ metodo, args });
    return consulta;
  }
  return consulta;
}

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: () => crearConsulta() }),
}));

const { asignarTokenGpsNuevo, generarTokenGps, guardarTokenGps, obtenerTokenGpsPorSlug } = await import(
  "@/lib/supabase/credenciales-gps"
);

function tokensGuardados(): string[] {
  return llamadas
    .filter((l) => l.metodo === "upsert")
    .map((l) => (l.args[0] as { track_token: string }).track_token);
}

beforeEach(() => {
  llamadas = [];
  respuestasUpsert = [];
  respuestaMaybeSingle = { data: null, error: null };
});

describe("generarTokenGps", () => {
  it("genera al menos 32 caracteres base64url, válidos en una query sin codificar", () => {
    const token = generarTokenGps();

    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(token)).toBe(token);
  });

  it("no repite token entre llamadas", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generarTokenGps()));

    expect(tokens.size).toBe(50);
  });
});

describe("guardarTokenGps", () => {
  it("hace upsert por reto_id con el token y la fecha de actualización", async () => {
    await expect(guardarTokenGps(3, "token-de-prueba-de-32-caracteres!")).resolves.toBe("guardado");

    const [fila, opciones] = llamadas.find((l) => l.metodo === "upsert")?.args ?? [];
    expect(fila).toMatchObject({ reto_id: 3, track_token: "token-de-prueba-de-32-caracteres!" });
    expect(typeof (fila as { updated_at: string }).updated_at).toBe("string");
    expect(opciones).toEqual({ onConflict: "reto_id" });
  });

  it("distingue la colisión de unicidad (23505) de otros errores", async () => {
    respuestasUpsert = [{ error: { code: "23505", message: "duplicate" } }, { error: { message: "fallo" } }];

    await expect(guardarTokenGps(3, "a")).resolves.toBe("token-repetido");
    await expect(guardarTokenGps(3, "b")).resolves.toBe("error");
  });
});

describe("asignarTokenGpsNuevo", () => {
  it("guarda un token recién generado", async () => {
    await expect(asignarTokenGpsNuevo(3)).resolves.toBe(true);

    expect(tokensGuardados()).toHaveLength(1);
    expect(tokensGuardados()[0]).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  });

  it("ante una colisión reintenta una vez con otro token distinto", async () => {
    respuestasUpsert = [{ error: { code: "23505", message: "duplicate" } }, { error: null }];

    await expect(asignarTokenGpsNuevo(3)).resolves.toBe(true);

    const [primero, segundo] = tokensGuardados();
    expect(tokensGuardados()).toHaveLength(2);
    expect(segundo).not.toBe(primero);
  });

  it("solo reintenta una vez: dos colisiones seguidas dan false", async () => {
    respuestasUpsert = [
      { error: { code: "23505", message: "duplicate" } },
      { error: { code: "23505", message: "duplicate" } },
    ];

    await expect(asignarTokenGpsNuevo(3)).resolves.toBe(false);
    expect(tokensGuardados()).toHaveLength(2);
  });

  it("no reintenta ante otro error", async () => {
    respuestasUpsert = [{ error: { message: "fallo de conexión" } }];

    await expect(asignarTokenGpsNuevo(3)).resolves.toBe(false);
    expect(tokensGuardados()).toHaveLength(1);
  });
});

describe("obtenerTokenGpsPorSlug", () => {
  it("filtra por el slug del reto embebido y devuelve reto, ruta y token", async () => {
    respuestaMaybeSingle = {
      data: { track_token: "token-del-reto", retos: { id: 3, ruta_id: "portuguesa-110" } },
      error: null,
    };

    await expect(obtenerTokenGpsPorSlug("santi-ago")).resolves.toEqual({
      retoId: 3,
      rutaId: "portuguesa-110",
      token: "token-del-reto",
    });
    expect(llamadas).toContainEqual({ metodo: "eq", args: ["retos.slug", "santi-ago"] });
  });

  it("null si el reto no existe o no tiene token (sin fila)", async () => {
    await expect(obtenerTokenGpsPorSlug("no-existe")).resolves.toBeNull();
  });

  it("null si la consulta falla o la fila no tiene la forma esperada", async () => {
    respuestaMaybeSingle = { data: null, error: { message: "fallo" } };
    await expect(obtenerTokenGpsPorSlug("santi-ago")).resolves.toBeNull();

    respuestaMaybeSingle = { data: { track_token: "", retos: null }, error: null };
    await expect(obtenerTokenGpsPorSlug("santi-ago")).resolves.toBeNull();
  });
});
