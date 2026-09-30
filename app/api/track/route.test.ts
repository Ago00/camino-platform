/**
 * Tests de la lógica de /api/track con Supabase mockado.
 *
 * Cubren: token por reto (DT-035) comparado en tiempo constante y con una
 * única respuesta 401 para cualquier fallo de autenticación, rate limit por IP
 * y por reto, parseo/rechazo del payload OwnTracks, filtro de plausibilidad
 * geográfica (DT-006, solo modo guiado con ruta tras DT-016) y la inserción en
 * el intento activo del reto de la URL.
 *
 * `obtenerTokenGpsPorSlug` se sustituye por una tabla en memoria de retos con
 * su token (regenerar = cambiar el token de la tabla). `getSupabaseAdmin()` se
 * sustituye por un builder falso que registra las llamadas encadenadas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { reiniciarRateLimit } from "@/lib/rate-limit";
import type { TokenGpsDelReto } from "@/lib/supabase/credenciales-gps";

const TOKEN_RETO_PRINCIPAL = "token-del-reto-principal-largo-y-aleatorio";
const TOKEN_RETO_LIBRE = "token-del-reto-libre-tambien-largo-y-aleatorio";

// Punto real de la traza de cálculo (mitad del recorrido, ~42.55°N -8.64°O).
const PUNTO_EN_TRAZA = { lat: 42.552204, lon: -8.638763 };

// Madrid: a varios cientos de km de la traza gallega, claramente fuera de
// los 100 km de margen del filtro geográfico (DT-006).
const PUNTO_MADRID = { lat: 40.4168, lon: -3.7038 };

const SLUG_PRINCIPAL = "santi-ago";
const SLUG_LIBRE = "otro-reto";
const SLUG_SIN_TOKEN = "reto-sin-token";
const ID_RETO_PRINCIPAL = 1;
const ID_RETO_LIBRE = 2;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

interface IntentoActivoMock {
  id: number;
  modo: "guiado" | "libre";
}

/** Retos con token: el principal con ruta predefinida y otro de ruta libre. */
let tokensPorSlug: Map<string, TokenGpsDelReto>;

function tablaDeTokensInicial(): Map<string, TokenGpsDelReto> {
  return new Map([
    [SLUG_PRINCIPAL, { retoId: ID_RETO_PRINCIPAL, rutaId: "portuguesa-110", token: TOKEN_RETO_PRINCIPAL }],
    [SLUG_LIBRE, { retoId: ID_RETO_LIBRE, rutaId: null, token: TOKEN_RETO_LIBRE }],
  ]);
}

// Intento activo del reto principal (el reto por defecto de las peticiones).
let intentoActivoMock: IntentoActivoMock | null = null;
let erroIntentoMock: Error | null = null;
// Intento devuelto por el select mínimo de fallback (solo `id`), usado cuando
// la consulta con `modo` falla (migración 0003 sin aplicar, ver DEBT.md).
let intentoActivoMinimoMock: { id: number } | null = null;
// Intento activo del reto libre.
let intentoActivoRetoLibreMock: IntentoActivoMock | null = null;
const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

/**
 * El builder de `intentos` aplica de verdad el filtro por `reto_id`: devuelve
 * el intento del reto filtrado. Si la consulta NO filtra por reto y hay dos
 * retos con intento abierto, responde como PostgREST con `maybeSingle()`
 * sobre varias filas (error) — así un route que olvide el filtro falla.
 */
function crearConsultaIntentos(columnas: string) {
  let retoFiltrado: number | null = null;
  const consulta = {
    eq: vi.fn((columna: string, valor: unknown) => {
      if (columna === "reto_id" && typeof valor === "number") retoFiltrado = valor;
      return consulta;
    }),
    maybeSingle: vi.fn(() => {
      if (retoFiltrado === ID_RETO_LIBRE) {
        return Promise.resolve({ data: intentoActivoRetoLibreMock, error: null });
      }
      if (retoFiltrado === null && intentoActivoMock && intentoActivoRetoLibreMock) {
        return Promise.resolve({ data: null, error: { message: "multiple rows returned" } });
      }
      return Promise.resolve(
        columnas.includes("modo")
          ? { data: intentoActivoMock, error: erroIntentoMock }
          : { data: intentoActivoMinimoMock, error: null }
      );
    }),
  };
  return consulta;
}

function crearBuilderFalso() {
  return {
    from: vi.fn((tabla: string) => {
      if (tabla === "intentos") {
        return { select: vi.fn(crearConsultaIntentos) };
      }
      if (tabla === "posiciones") {
        return { insert: insertSpy };
      }
      throw new Error(`Tabla no mockada: ${tabla}`);
    }),
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => crearBuilderFalso()),
}));

const obtenerTokenGpsPorSlugSpy = vi.fn(
  async (slug: string): Promise<TokenGpsDelReto | null> => tokensPorSlug.get(slug) ?? null
);

vi.mock("@/lib/supabase/credenciales-gps", () => ({
  obtenerTokenGpsPorSlug: (slug: string) => obtenerTokenGpsPorSlugSpy(slug),
}));

const { POST } = await import("@/app/api/track/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `reto` null omite el parámetro `?reto=` de la URL. */
function urlTrack(token: string, reto: string | null = SLUG_PRINCIPAL): string {
  const base = `http://localhost/api/track?t=${encodeURIComponent(token)}`;
  return reto === null ? base : `${base}&reto=${encodeURIComponent(reto)}`;
}

function crearPeticion(
  token: string,
  body: unknown,
  reto: string | null = SLUG_PRINCIPAL,
  ip = "203.0.113.7"
): NextRequest {
  return new NextRequest(urlTrack(token, reto), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });
}

function payloadValido(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _type: "location",
    lat: PUNTO_EN_TRAZA.lat,
    lon: PUNTO_EN_TRAZA.lon,
    tst: 1_725_960_000,
    batt: 87,
    acc: 12,
    ...overrides,
  };
}

async function estadoYCuerpo(response: Response): Promise<{ status: number; cuerpo: string }> {
  return { status: response.status, cuerpo: await response.text() };
}

beforeEach(() => {
  tokensPorSlug = tablaDeTokensInicial();
  intentoActivoMock = null;
  erroIntentoMock = null;
  intentoActivoMinimoMock = null;
  intentoActivoRetoLibreMock = null;
  insertSpy.mockClear();
  obtenerTokenGpsPorSlugSpy.mockClear();
  reiniciarRateLimit();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/track — token por reto (DT-035)", () => {
  it("acepta el token del reto de la URL e inserta en su intento", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };

    const response = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido()));

    expect(response.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ intento_id: 42 }));
  });

  it("rechaza con 401 el token de OTRO reto, aunque sea válido para ese otro", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };

    const response = await POST(crearPeticion(TOKEN_RETO_LIBRE, payloadValido(), SLUG_PRINCIPAL));

    expect(response.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("tras regenerar el token, el anterior da 401 y el nuevo funciona", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };
    tokensPorSlug.set(SLUG_PRINCIPAL, { retoId: ID_RETO_PRINCIPAL, rutaId: "portuguesa-110", token: "token-nuevo-tras-regenerar-0123456789" });

    const conAnterior = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido()));
    const conNuevo = await POST(crearPeticion("token-nuevo-tras-regenerar-0123456789", payloadValido()));

    expect(conAnterior.status).toBe(401);
    expect(conNuevo.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  it("slug mal formado, sin reto, reto inexistente, reto sin token y token incorrecto responden exactamente igual", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };

    const respuestas = await Promise.all([
      POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido(), "Santi_Ago/../x")),
      POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido(), null)),
      POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido(), "reto-inexistente")),
      POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido(), SLUG_SIN_TOKEN)),
      POST(crearPeticion("token-incorrecto", payloadValido())),
      POST(crearPeticion("", payloadValido())),
    ]);
    const resultados = await Promise.all(respuestas.map(estadoYCuerpo));

    for (const resultado of resultados) {
      expect(resultado).toEqual({ status: 401, cuerpo: JSON.stringify({ error: "unauthorized" }) });
    }
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("no consulta la BD con un slug mal formado", async () => {
    await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido(), "Santi_Ago/../x"));

    expect(obtenerTokenGpsPorSlugSpy).not.toHaveBeenCalled();
  });

  it("responde 401 sin lanzar cuando el token recibido tiene una longitud distinta al esperado", async () => {
    const response = await POST(crearPeticion("x", payloadValido()));

    expect(response.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/track — cuerpo vacío o malformado", () => {
  it("responde 200 [] sin insertar cuando el body está vacío", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };
    const request = new NextRequest(urlTrack(TOKEN_RETO_PRINCIPAL), {
      method: "POST",
      body: "",
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("responde 200 [] sin insertar cuando el body es JSON malformado", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };
    const request = new NextRequest(urlTrack(TOKEN_RETO_PRINCIPAL), {
      method: "POST",
      body: "{ esto no es json valido",
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/track — payload", () => {
  it.each([
    ["_type no es location", { _type: "transition" }],
    ["lat no es numérico", { lat: "no-es-un-numero" }],
    ["lon es null", { lon: null }],
  ])("responde 200 [] sin insertar cuando %s", async (_caso, overrides) => {
    intentoActivoMock = { id: 1, modo: "guiado" };

    const response = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido(overrides)));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/track — filtro geográfico (DT-006, solo modo guiado)", () => {
  it("responde 200 [] sin insertar cuando el punto está a más de 100 km de la traza (Madrid) en modo guiado", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };

    const response = await POST(
      crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido({ lat: PUNTO_MADRID.lat, lon: PUNTO_MADRID.lon }))
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("inserta el punto aunque esté a más de 100 km de la traza cuando el intento activo está en modo libre (DT-016)", async () => {
    intentoActivoMock = { id: 5, modo: "libre" };

    const response = await POST(
      crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido({ lat: PUNTO_MADRID.lat, lon: PUNTO_MADRID.lon }))
    );

    expect(response.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ intento_id: 5, lat: PUNTO_MADRID.lat, lon: PUNTO_MADRID.lon })
    );
  });

  it("no aplica el filtro geográfico en un reto sin ruta aunque su intento esté en modo guiado", async () => {
    intentoActivoRetoLibreMock = { id: 99, modo: "guiado" };

    const response = await POST(
      crearPeticion(TOKEN_RETO_LIBRE, payloadValido({ lat: PUNTO_MADRID.lat, lon: PUNTO_MADRID.lon }), SLUG_LIBRE)
    );

    expect(response.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ intento_id: 99 }));
  });
});

describe("POST /api/track — intento activo del reto", () => {
  it("responde 200 [] sin insertar cuando el punto está en rango pero no hay intento activo", async () => {
    const response = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("inserta la posición con los campos correctos cuando el punto está en rango y hay intento activo", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };

    const response = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith({
      intento_id: 42,
      lat: PUNTO_EN_TRAZA.lat,
      lon: PUNTO_EN_TRAZA.lon,
      ts: new Date(1_725_960_000 * 1000).toISOString(),
      batt: 87,
      acc: 12,
      fuente: "app",
    });
  });

  it("inserta en el intento del reto indicado aunque otro reto tenga también un intento abierto", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };
    intentoActivoRetoLibreMock = { id: 99, modo: "libre" };

    const response = await POST(crearPeticion(TOKEN_RETO_LIBRE, payloadValido(), SLUG_LIBRE));

    expect(response.status).toBe(200);
    expect(obtenerTokenGpsPorSlugSpy).toHaveBeenCalledWith(SLUG_LIBRE);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ intento_id: 99 }));
  });

  it("responde 200 [] sin insertar cuando el reto no tiene intento activo, aunque otro reto sí lo tenga", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };

    const response = await POST(crearPeticion(TOKEN_RETO_LIBRE, payloadValido(), SLUG_LIBRE));

    expect(response.status).toBe(200);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/track — rate limiting", () => {
  it("responde 429 sin insertar al superar 40 peticiones en un minuto del mismo reto", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };

    for (let i = 0; i < 40; i++) {
      const response = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido(), SLUG_PRINCIPAL, `198.51.100.${i}`));
      expect(response.status).toBe(200);
    }

    insertSpy.mockClear();
    const response = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido(), SLUG_PRINCIPAL, "198.51.100.200"));

    expect(response.status).toBe(429);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("el cupo de un reto es independiente del de otro reto", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };
    intentoActivoRetoLibreMock = { id: 99, modo: "libre" };

    for (let i = 0; i < 40; i++) {
      await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido(), SLUG_PRINCIPAL, `198.51.100.${i}`));
    }
    const principalAgotado = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido(), SLUG_PRINCIPAL, "198.51.100.250"));
    const otroReto = await POST(crearPeticion(TOKEN_RETO_LIBRE, payloadValido(), SLUG_LIBRE, "198.51.100.251"));

    expect(principalAgotado.status).toBe(429);
    expect(otroReto.status).toBe(200);
  });

  it("los intentos con token incorrecto no gastan el cupo del reto", async () => {
    for (let i = 0; i < 40; i++) {
      await POST(crearPeticion("token-incorrecto", payloadValido(), SLUG_PRINCIPAL, `198.51.100.${i}`));
    }

    intentoActivoMock = { id: 1, modo: "guiado" };
    const response = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido()));

    expect(response.status).toBe(200);
  });

  it("limita por IP a 120 peticiones por minuto antes de consultar la BD", async () => {
    for (let i = 0; i < 120; i++) {
      const response = await POST(crearPeticion("token-incorrecto", payloadValido()));
      expect(response.status).toBe(401);
    }
    obtenerTokenGpsPorSlugSpy.mockClear();

    const response = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido()));

    expect(response.status).toBe(429);
    expect(obtenerTokenGpsPorSlugSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/track — compatibilidad con la migración 0003_modo_intento.sql sin aplicar (ver DEBT.md)", () => {
  it("reintenta con el select mínimo y trata el intento como modo guiado cuando la columna `modo` no existe todavía", async () => {
    erroIntentoMock = { message: "column intentos.modo does not exist" } as Error;
    intentoActivoMinimoMock = { id: 7 };

    const response = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido()));

    expect(response.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ intento_id: 7, lat: PUNTO_EN_TRAZA.lat, lon: PUNTO_EN_TRAZA.lon })
    );
  });

  it("aplica el filtro geográfico (modo guiado por defecto) en el fallback, descartando un punto a >100 km", async () => {
    erroIntentoMock = { message: "column intentos.modo does not exist" } as Error;
    intentoActivoMinimoMock = { id: 7 };

    const response = await POST(
      crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido({ lat: PUNTO_MADRID.lat, lon: PUNTO_MADRID.lon }))
    );

    expect(response.status).toBe(200);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("responde 200 [] sin insertar cuando falla también el select de fallback (sin intento activo real)", async () => {
    erroIntentoMock = { message: "column intentos.modo does not exist" } as Error;

    const response = await POST(crearPeticion(TOKEN_RETO_PRINCIPAL, payloadValido()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
