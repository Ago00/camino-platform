/**
 * Tests de la lógica de /api/track con el cliente Supabase mockado.
 *
 * No dependen de una BD real (no existe proyecto Supabase todavía, ver
 * docs/tareas/CURRENT.md). Cubren: validación de token en tiempo constante,
 * parseo/rechazo del payload OwnTracks, filtro de plausibilidad geográfica
 * (DT-006, solo modo guiado tras DT-016) y el flujo de inserción cuando todo
 * es válido.
 *
 * Mock del módulo lib/supabase/admin: se sustituye getSupabaseAdmin() por un
 * builder falso que registra las llamadas encadenadas (.from/.select/.eq/
 * .maybeSingle/.insert) para poder aserta qué se intentó hacer, sin tocar red.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { reiniciarRateLimit } from "@/lib/rate-limit";
import type { Reto } from "@/lib/types";

const TRACK_TOKEN_TEST = "token-secreto-de-prueba-larga-y-aleatoria";

// Punto real de la traza de cálculo (mitad del recorrido, ~42.55°N -8.64°O).
const PUNTO_EN_TRAZA = { lat: 42.552204, lon: -8.638763 };

// Madrid: a varios cientos de km de la traza gallega, claramente fuera de
// los 100 km de margen del filtro geográfico (DT-006).
const PUNTO_MADRID = { lat: 40.4168, lon: -3.7038 };

// ---------------------------------------------------------------------------
// Mock de lib/supabase/admin
// ---------------------------------------------------------------------------

interface IntentoActivoMock {
  id: number;
  modo: "guiado" | "libre";
}

// Dos retos (FP2.5, DT-028): el principal con ruta predefinida (traza real
// de portuguesa-110, la que usa el filtro geográfico) y otro de ruta libre.
const RETO_PRINCIPAL: Reto = {
  id: 1,
  slug: "santi-ago",
  nombre: "Santi·ago",
  descripcion: null,
  ruta_tipo: "predefinida",
  ruta_id: "portuguesa-110",
  activo: true,
  seccion_intenciones: true,
  seccion_comentarios: true,
  seccion_minuto_a_minuto: true,
  seccion_instagram: true,
  respuestas_visitantes: true,
  peregrino_animado: true,
  quien_camina_foto_url: null,
  created_at: "2026-09-01T00:00:00.000Z",
};
const RETO_LIBRE: Reto = {
  id: 2,
  slug: "otro-reto",
  nombre: "Otro reto",
  descripcion: null,
  ruta_tipo: "libre",
  ruta_id: null,
  activo: true,
  seccion_intenciones: true,
  seccion_comentarios: true,
  seccion_minuto_a_minuto: true,
  seccion_instagram: true,
  respuestas_visitantes: true,
  peregrino_animado: true,
  quien_camina_foto_url: null,
  created_at: "2026-09-02T00:00:00.000Z",
};

// Intento activo de RETO_PRINCIPAL (el reto por defecto de las peticiones).
let intentoActivoMock: IntentoActivoMock | null = null;
let erroIntentoMock: Error | null = null;
// Mock del intento activo devuelto por el select mínimo de fallback (solo
// `id`), usado cuando la consulta con `modo` falla (columna inexistente,
// migración 0003_modo_intento.sql sin aplicar — ver DEBT.md).
let intentoActivoMinimoMock: { id: number } | null = null;
// Intento activo de RETO_LIBRE.
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
      if (retoFiltrado === RETO_LIBRE.id) {
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
        return {
          insert: insertSpy,
        };
      }
      throw new Error(`Tabla no mockada: ${tabla}`);
    }),
  };
}

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => crearBuilderFalso()),
}));

const obtenerRetoPorSlugSpy = vi.fn(async (slug: string): Promise<Reto | null> =>
  [RETO_PRINCIPAL, RETO_LIBRE].find((r) => r.slug === slug) ?? null
);

vi.mock("@/lib/supabase/retos", () => ({
  obtenerRetoPorSlug: (slug: string) => obtenerRetoPorSlugSpy(slug),
}));

// Import dinámico posterior al mock (el propio route.ts importa getSupabaseAdmin).
const { POST } = await import("@/app/api/track/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `reto` null omite el parámetro `?reto=` de la URL. */
function urlTrack(token: string, reto: string | null = RETO_PRINCIPAL.slug): string {
  const base = `http://localhost/api/track?t=${encodeURIComponent(token)}`;
  return reto === null ? base : `${base}&reto=${encodeURIComponent(reto)}`;
}

function crearPeticion(
  token: string,
  body: unknown,
  reto: string | null = RETO_PRINCIPAL.slug
): NextRequest {
  return new NextRequest(urlTrack(token, reto), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
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

beforeEach(() => {
  process.env.TRACK_TOKEN = TRACK_TOKEN_TEST;
  intentoActivoMock = null;
  erroIntentoMock = null;
  intentoActivoMinimoMock = null;
  intentoActivoRetoLibreMock = null;
  insertSpy.mockClear();
  obtenerRetoPorSlugSpy.mockClear();
  reiniciarRateLimit();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/track — token", () => {
  it("responde 401 cuando el token no coincide con TRACK_TOKEN", async () => {
    const request = crearPeticion("token-incorrecto", payloadValido());
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("responde 401 sin lanzar cuando el token recibido tiene una longitud distinta al esperado", async () => {
    const request = crearPeticion("x", payloadValido());

    await expect(POST(request)).resolves.toBeDefined();
    const response = await POST(crearPeticion("x", payloadValido()));

    expect(response.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("responde 401 cuando no llega token en la query", async () => {
    const request = crearPeticion("", payloadValido());
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/track — cuerpo vacío o malformado", () => {
  it("responde 200 [] sin insertar cuando el body está vacío", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };
    const url = urlTrack(TRACK_TOKEN_TEST);
    const request = new NextRequest(url, {
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
    const url = urlTrack(TRACK_TOKEN_TEST);
    const request = new NextRequest(url, {
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
  it("responde 200 [] sin insertar cuando _type no es location", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };
    const request = crearPeticion(
      TRACK_TOKEN_TEST,
      payloadValido({ _type: "transition" })
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("responde 200 [] sin insertar cuando lat no es numérico", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };
    const request = crearPeticion(
      TRACK_TOKEN_TEST,
      payloadValido({ lat: "no-es-un-numero" })
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("responde 200 [] sin insertar cuando lon no es numérico", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };
    const request = crearPeticion(
      TRACK_TOKEN_TEST,
      payloadValido({ lon: null })
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/track — filtro geográfico (DT-006, solo modo guiado)", () => {
  it("responde 200 [] sin insertar cuando el punto está a más de 100 km de la traza (Madrid) en modo guiado", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };
    const request = crearPeticion(
      TRACK_TOKEN_TEST,
      payloadValido({ lat: PUNTO_MADRID.lat, lon: PUNTO_MADRID.lon })
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("inserta el punto aunque esté a más de 100 km de la traza cuando el intento activo está en modo libre (DT-016)", async () => {
    intentoActivoMock = { id: 5, modo: "libre" };
    const request = crearPeticion(
      TRACK_TOKEN_TEST,
      payloadValido({ lat: PUNTO_MADRID.lat, lon: PUNTO_MADRID.lon })
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        intento_id: 5,
        lat: PUNTO_MADRID.lat,
        lon: PUNTO_MADRID.lon,
      })
    );
  });
});

describe("POST /api/track — intento activo", () => {
  it("responde 200 [] sin insertar cuando el punto está en rango pero no hay intento activo", async () => {
    intentoActivoMock = null;
    const request = crearPeticion(TRACK_TOKEN_TEST, payloadValido());
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("inserta la posición con los campos correctos cuando el punto está en rango y hay intento activo", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };
    const request = crearPeticion(TRACK_TOKEN_TEST, payloadValido());
    const response = await POST(request);

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
});

describe("POST /api/track — rate limiting por token (DT-011)", () => {
  it("responde 429 sin insertar al superar 40 peticiones en un minuto con el mismo token", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };

    for (let i = 0; i < 40; i++) {
      const response = await POST(crearPeticion(TRACK_TOKEN_TEST, payloadValido()));
      expect(response.status).toBe(200);
    }

    insertSpy.mockClear();
    const response = await POST(crearPeticion(TRACK_TOKEN_TEST, payloadValido()));

    expect(response.status).toBe(429);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("no consume cupo del rate limit cuando el token es incorrecto", async () => {
    for (let i = 0; i < 40; i++) {
      await POST(crearPeticion("token-incorrecto", payloadValido()));
    }

    intentoActivoMock = { id: 1, modo: "guiado" };
    const response = await POST(crearPeticion(TRACK_TOKEN_TEST, payloadValido()));

    expect(response.status).toBe(200);
  });
});

describe("POST /api/track — compatibilidad con la migración 0003_modo_intento.sql sin aplicar (ver DEBT.md)", () => {
  it("reintenta con el select mínimo y trata el intento como modo guiado cuando la columna `modo` no existe todavía", async () => {
    erroIntentoMock = { message: "column intentos.modo does not exist" } as Error;
    intentoActivoMinimoMock = { id: 7 };

    const request = crearPeticion(TRACK_TOKEN_TEST, payloadValido());
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ intento_id: 7, lat: PUNTO_EN_TRAZA.lat, lon: PUNTO_EN_TRAZA.lon })
    );
  });

  it("aplica el filtro geográfico (modo guiado por defecto) en el fallback, descartando un punto a >100 km", async () => {
    erroIntentoMock = { message: "column intentos.modo does not exist" } as Error;
    intentoActivoMinimoMock = { id: 7 };

    const request = crearPeticion(
      TRACK_TOKEN_TEST,
      payloadValido({ lat: PUNTO_MADRID.lat, lon: PUNTO_MADRID.lon })
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("responde 200 [] sin insertar cuando falla también el select de fallback (sin intento activo real)", async () => {
    erroIntentoMock = { message: "column intentos.modo does not exist" } as Error;
    intentoActivoMinimoMock = null;

    const request = crearPeticion(TRACK_TOKEN_TEST, payloadValido());
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/track — reto del tracker (?reto=<slug>, FP2.5/DT-028)", () => {
  it("inserta en el intento del reto indicado aunque otro reto tenga también un intento abierto", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };
    intentoActivoRetoLibreMock = { id: 99, modo: "libre" };

    const response = await POST(crearPeticion(TRACK_TOKEN_TEST, payloadValido(), RETO_LIBRE.slug));

    expect(response.status).toBe(200);
    expect(obtenerRetoPorSlugSpy).toHaveBeenCalledWith(RETO_LIBRE.slug);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ intento_id: 99 }));
  });

  it("con el reto principal, inserta en su intento y no en el del otro reto abierto", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };
    intentoActivoRetoLibreMock = { id: 99, modo: "libre" };

    const response = await POST(crearPeticion(TRACK_TOKEN_TEST, payloadValido(), RETO_PRINCIPAL.slug));

    expect(response.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ intento_id: 42 }));
  });

  it("no aplica el filtro geográfico en un reto sin ruta aunque su intento esté en modo guiado", async () => {
    intentoActivoRetoLibreMock = { id: 99, modo: "guiado" };

    const response = await POST(
      crearPeticion(
        TRACK_TOKEN_TEST,
        payloadValido({ lat: PUNTO_MADRID.lat, lon: PUNTO_MADRID.lon }),
        RETO_LIBRE.slug
      )
    );

    expect(response.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ intento_id: 99 }));
  });

  it("responde 200 [] sin insertar ni consultar retos cuando falta el parámetro reto", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };

    const response = await POST(crearPeticion(TRACK_TOKEN_TEST, payloadValido(), null));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(obtenerRetoPorSlugSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("responde 200 [] sin insertar ni consultar retos cuando el slug tiene un formato inválido", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };

    const response = await POST(crearPeticion(TRACK_TOKEN_TEST, payloadValido(), "Santi_Ago/../x"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(obtenerRetoPorSlugSpy).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("responde 200 [] sin insertar cuando el slug no corresponde a ningún reto", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };

    const response = await POST(crearPeticion(TRACK_TOKEN_TEST, payloadValido(), "reto-inexistente"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(obtenerRetoPorSlugSpy).toHaveBeenCalledWith("reto-inexistente");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("responde 200 [] sin insertar cuando el reto existe pero no tiene intento activo, aunque otro reto sí lo tenga", async () => {
    intentoActivoMock = { id: 42, modo: "guiado" };
    intentoActivoRetoLibreMock = null;

    const response = await POST(crearPeticion(TRACK_TOKEN_TEST, payloadValido(), RETO_LIBRE.slug));

    expect(response.status).toBe(200);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
