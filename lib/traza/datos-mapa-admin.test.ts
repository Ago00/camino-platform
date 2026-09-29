/**
 * Tests de obtenerDatosMapaAdmin() (DT-021). Mismo patrón de mocks que
 * lib/traza/progreso-actual.test.ts (traza sintética de 3 puntos, cliente
 * Supabase mockado) — aquí se mockea getSupabaseAdmin en vez de
 * getSupabasePublic, ya que este módulo es exclusivo del panel admin.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Posicion, TrazaPreparada } from "@/lib/types";

interface IntentoActivoMock {
  id: number;
  modo?: "guiado" | "libre";
}

let intentoActivoMock: IntentoActivoMock | null = null;
let errorIntentoMock: { message: string } | null = null;
let intentoActivoMinimoMock: { id: number } | null = null;
let posicionesMock: Posicion[] = [];
const eqIntentosSpy = vi.fn();
const cargarTrazaSpy = vi.fn();
const cargarTrazaMapaSpy = vi.fn();

const rangeMock = vi.fn(() => Promise.resolve({ data: posicionesMock, error: null }));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn((tabla: string) => {
      if (tabla === "intentos") {
        return {
          select: vi.fn((columnas: string) => {
            const consulta = {
              eq: vi.fn((columna: string, valor: unknown) => {
                eqIntentosSpy(columna, valor);
                return consulta;
              }),
              maybeSingle: vi.fn().mockResolvedValue(
                columnas.includes("modo")
                  ? { data: intentoActivoMock, error: errorIntentoMock }
                  : { data: intentoActivoMinimoMock, error: null }
              ),
            };
            return consulta;
          }),
        };
      }
      if (tabla === "posiciones") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: rangeMock,
        };
      }
      throw new Error(`Tabla no mockada: ${tabla}`);
    }),
  })),
}));

const TRAZA_SINTETICA: TrazaPreparada = {
  coordenadas: [
    [0, 0],
    [0, 0.45049],
    [0, 0.90099],
  ],
  kmAcumulados: [0, 50, 100],
  longitudTotalKm: 100,
};

const TRAZA_MAPA_SINTETICA: [number, number][] = [
  [0, 0],
  [0, 0.90099],
];

vi.mock("@/lib/traza/cargar-traza", () => ({
  cargarTrazaDeCalculo: vi.fn((rutaId: string) => {
    cargarTrazaSpy(rutaId);
    return TRAZA_SINTETICA;
  }),
}));

vi.mock("@/lib/traza/cargar-traza-mapa", () => ({
  cargarTrazaDeMapa: vi.fn((rutaId: string) => {
    cargarTrazaMapaSpy(rutaId);
    return TRAZA_MAPA_SINTETICA;
  }),
}));

const RETO_GUIADO = { id: 7, ruta_id: "ruta-del-reto-7" };
const RETO_SIN_RUTA = { id: 8, ruta_id: null };

function posicion(overrides: Partial<Posicion>): Posicion {
  return {
    id: 1,
    intento_id: 1,
    lat: 0,
    lon: 0,
    ts: "2026-09-12T10:00:00.000Z",
    batt: 90,
    acc: 5,
    fuente: "app",
    descartado: false,
    created_at: "2026-09-12T10:00:01.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  intentoActivoMock = null;
  errorIntentoMock = null;
  intentoActivoMinimoMock = null;
  posicionesMock = [];
  rangeMock.mockClear();
  eqIntentosSpy.mockClear();
  cargarTrazaSpy.mockClear();
  cargarTrazaMapaSpy.mockClear();
});

describe("obtenerDatosMapaAdmin", () => {
  it("devuelve modo 'sin-intento' cuando no hay ningún intento activo", async () => {
    const { obtenerDatosMapaAdmin } = await import("@/lib/traza/datos-mapa-admin");
    const datos = await obtenerDatosMapaAdmin(RETO_GUIADO);

    expect(datos.modo).toBe("sin-intento");
  });

  it("modo guiado: expone trazaOficial, trazaReal y puntoReferencia (Progreso.puntoProyectado)", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };
    posicionesMock = [
      posicion({ id: 1, lat: 0, lon: 0, ts: "2026-09-12T08:00:00.000Z" }),
      posicion({ id: 2, lat: 0.45049, lon: 0, ts: "2026-09-12T13:00:00.000Z" }),
    ];

    const { obtenerDatosMapaAdmin } = await import("@/lib/traza/datos-mapa-admin");
    const datos = await obtenerDatosMapaAdmin(RETO_GUIADO);

    expect(datos.modo).toBe("guiado");
    if (datos.modo !== "guiado") return;

    expect(datos.trazaOficial).toEqual(TRAZA_MAPA_SINTETICA);
    expect(datos.trazaReal).toEqual([
      { lat: 0, lon: 0 },
      { lat: 0.45049, lon: 0 },
    ]);
    expect(datos.posicionActual).toEqual({ lat: 0.45049, lon: 0 });
    // El punto proyectado real de la traza oficial, no la posición GPS bruta
    // (aunque en esta traza sintética recta ambos coinciden en lon).
    expect(datos.puntoReferencia).not.toBeNull();
    expect(datos.puntoReferencia!.lat).toBeCloseTo(0.45049, 2);
  });

  it("modo libre: expone solo trazaReal y posicionActual, sin trazaOficial ni puntoReferencia", async () => {
    intentoActivoMock = { id: 9, modo: "libre" };
    posicionesMock = [
      posicion({ id: 1, lat: 42.0, lon: -8.0, ts: "2026-09-12T09:00:00.000Z" }),
      posicion({ id: 2, lat: 42.01, lon: -8.01, ts: "2026-09-12T10:00:00.000Z" }),
    ];

    const { obtenerDatosMapaAdmin } = await import("@/lib/traza/datos-mapa-admin");
    const datos = await obtenerDatosMapaAdmin(RETO_GUIADO);

    expect(datos.modo).toBe("libre");
    if (datos.modo !== "libre") return;

    expect(datos.trazaReal).toHaveLength(2);
    expect(datos.posicionActual).toEqual({ lat: 42.01, lon: -8.01 });
    expect("trazaOficial" in datos).toBe(false);
    expect("puntoReferencia" in datos).toBe(false);
  });

  it("reintenta con el select mínimo y trata el intento como guiado cuando la columna `modo` no existe todavía (migración 0003 sin aplicar)", async () => {
    errorIntentoMock = { message: "column intentos.modo does not exist" };
    intentoActivoMinimoMock = { id: 3 };
    posicionesMock = [
      posicion({ id: 1, lat: 0, lon: 0, ts: "2026-09-12T08:00:00.000Z" }),
    ];

    const { obtenerDatosMapaAdmin } = await import("@/lib/traza/datos-mapa-admin");
    const datos = await obtenerDatosMapaAdmin(RETO_GUIADO);

    expect(datos.modo).toBe("guiado");
  });

  it("modo guiado sin histórico: posicionActual y puntoReferencia son null, sin reventar", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };
    posicionesMock = [];

    const { obtenerDatosMapaAdmin } = await import("@/lib/traza/datos-mapa-admin");
    const datos = await obtenerDatosMapaAdmin(RETO_GUIADO);

    expect(datos.modo).toBe("guiado");
    if (datos.modo !== "guiado") return;

    expect(datos.trazaReal).toEqual([]);
    expect(datos.posicionActual).toBeNull();
    expect(datos.puntoReferencia).toBeNull();
  });
});

describe("obtenerDatosMapaAdmin — aislamiento por reto (FP2.5, DT-028)", () => {
  it("busca el intento activo filtrando por el id del reto y por cerrado = false", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };

    const { obtenerDatosMapaAdmin } = await import("@/lib/traza/datos-mapa-admin");
    await obtenerDatosMapaAdmin(RETO_GUIADO);

    expect(eqIntentosSpy).toHaveBeenCalledWith("reto_id", RETO_GUIADO.id);
    expect(eqIntentosSpy).toHaveBeenCalledWith("cerrado", false);
  });

  it("modo guiado: usa las trazas de cálculo y de pintado de la ruta del reto", async () => {
    intentoActivoMock = { id: 1, modo: "guiado" };

    const { obtenerDatosMapaAdmin } = await import("@/lib/traza/datos-mapa-admin");
    await obtenerDatosMapaAdmin(RETO_GUIADO);

    expect(cargarTrazaSpy).toHaveBeenCalledWith("ruta-del-reto-7");
    expect(cargarTrazaMapaSpy).toHaveBeenCalledWith("ruta-del-reto-7");
  });

  it("reto sin ruta con intento en modo guiado: se muestra como libre, sin cargar ninguna traza", async () => {
    intentoActivoMock = { id: 4, modo: "guiado" };
    posicionesMock = [posicion({ id: 1, lat: 42.0, lon: -8.0 })];

    const { obtenerDatosMapaAdmin } = await import("@/lib/traza/datos-mapa-admin");
    const datos = await obtenerDatosMapaAdmin(RETO_SIN_RUTA);

    expect(datos.modo).toBe("libre");
    expect(cargarTrazaSpy).not.toHaveBeenCalled();
    expect(cargarTrazaMapaSpy).not.toHaveBeenCalled();
  });
});
