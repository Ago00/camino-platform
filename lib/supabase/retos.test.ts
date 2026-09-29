/**
 * Tests de obtenerRetoPorSlug, listarRetosActivos y listarTodosLosRetos.
 *
 * React.cache se reemplaza por un pass-through en este entorno: en Vitest
 * (Node.js sin contexto React Fiber) el memoizado entre llamadas no aplica,
 * pero la función devuelta funciona igual para tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// React.cache en Node.js/Vitest actúa como pass-through; se reemplaza
// explícitamente para no depender de su implementación interna.
vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  return { ...original, cache: (fn: <T>(...args: unknown[]) => T) => fn };
});

// Mocks para getSupabaseAdmin (obtenerRetoPorSlug, listarTodosLosRetos)
const maybeSingleSpy = vi.fn();
const eqSpy = vi.fn(() => ({ maybeSingle: maybeSingleSpy }));
const orderAdminSpy = vi.fn();
const selectAdminSpy = vi.fn(() => ({ eq: eqSpy, order: orderAdminSpy }));
const fromAdminSpy = vi.fn(() => ({ select: selectAdminSpy }));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({ from: fromAdminSpy })),
}));

// Mocks para getSupabasePublic (listarRetosActivos)
const orderPublicSpy = vi.fn();
const eqPublicSpy = vi.fn(() => ({ order: orderPublicSpy }));
const selectPublicSpy = vi.fn(() => ({ eq: eqPublicSpy }));
const fromPublicSpy = vi.fn(() => ({ select: selectPublicSpy }));

vi.mock("@/lib/supabase/public", () => ({
  getSupabasePublic: vi.fn(() => ({ from: fromPublicSpy })),
}));

const { obtenerRetoPorSlug, listarRetosActivos, listarTodosLosRetos } = await import("@/lib/supabase/retos");

const retoFijo = {
  id: 1,
  slug: "portuguesa-110",
  nombre: "Camino Portugués 110 km",
  descripcion: "Los últimos 110 km del Camino Portugués Central.",
  ruta_tipo: "predefinida" as const,
  ruta_id: "portuguesa-110",
  activo: true,
  created_at: "2026-09-28T00:00:00Z",
};

beforeEach(() => {
  maybeSingleSpy.mockClear();
  eqSpy.mockClear();
  orderAdminSpy.mockClear();
  selectAdminSpy.mockClear();
  fromAdminSpy.mockClear();
  orderPublicSpy.mockClear();
  eqPublicSpy.mockClear();
  selectPublicSpy.mockClear();
  fromPublicSpy.mockClear();
});

describe("obtenerRetoPorSlug", () => {
  it("devuelve el reto cuando el slug existe en BD", async () => {
    maybeSingleSpy.mockResolvedValue({ data: retoFijo, error: null });

    const result = await obtenerRetoPorSlug("portuguesa-110");

    expect(result).toEqual(retoFijo);
    expect(fromAdminSpy).toHaveBeenCalledWith("retos");
    expect(eqSpy).toHaveBeenCalledWith("slug", "portuguesa-110");
  });

  it("devuelve null cuando el slug no existe en BD", async () => {
    maybeSingleSpy.mockResolvedValue({ data: null, error: null });

    const result = await obtenerRetoPorSlug("slug-inexistente");

    expect(result).toBeNull();
  });

  it("devuelve null cuando Supabase devuelve un error", async () => {
    maybeSingleSpy.mockResolvedValue({ data: null, error: new Error("fallo de BD") });

    const result = await obtenerRetoPorSlug("portuguesa-110");

    expect(result).toBeNull();
  });

  it("devuelve null si getSupabaseAdmin lanza (env vars ausentes)", async () => {
    fromAdminSpy.mockImplementationOnce(() => {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
    });

    const result = await obtenerRetoPorSlug("portuguesa-110");

    expect(result).toBeNull();
  });
});

describe("listarRetosActivos", () => {
  it("devuelve los retos activos usando el cliente público", async () => {
    orderPublicSpy.mockResolvedValue({ data: [retoFijo], error: null });

    const result = await listarRetosActivos();

    expect(result).toEqual([retoFijo]);
    expect(fromPublicSpy).toHaveBeenCalledWith("retos");
    expect(eqPublicSpy).toHaveBeenCalledWith("activo", true);
    expect(orderPublicSpy).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("devuelve array vacío si Supabase devuelve error", async () => {
    orderPublicSpy.mockResolvedValue({ data: null, error: new Error("fallo de BD") });

    const result = await listarRetosActivos();

    expect(result).toEqual([]);
  });

  it("devuelve array vacío si getSupabasePublic lanza", async () => {
    fromPublicSpy.mockImplementationOnce(() => {
      throw new Error("env var ausente");
    });

    const result = await listarRetosActivos();

    expect(result).toEqual([]);
  });
});

describe("listarTodosLosRetos", () => {
  it("devuelve todos los retos (activos e inactivos) usando el cliente admin", async () => {
    const retoInactivo = { ...retoFijo, id: 2, activo: false, slug: "otro-reto" };
    orderAdminSpy.mockResolvedValue({ data: [retoFijo, retoInactivo], error: null });

    const result = await listarTodosLosRetos();

    expect(result).toEqual([retoFijo, retoInactivo]);
    expect(fromAdminSpy).toHaveBeenCalledWith("retos");
    expect(orderAdminSpy).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("devuelve array vacío si Supabase devuelve error", async () => {
    orderAdminSpy.mockResolvedValue({ data: null, error: new Error("fallo de BD") });

    const result = await listarTodosLosRetos();

    expect(result).toEqual([]);
  });

  it("devuelve array vacío si getSupabaseAdmin lanza", async () => {
    fromAdminSpy.mockImplementationOnce(() => {
      throw new Error("env var ausente");
    });

    const result = await listarTodosLosRetos();

    expect(result).toEqual([]);
  });
});
