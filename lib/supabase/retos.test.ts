/**
 * Tests de obtenerRetoPorSlug con el cliente Supabase admin mockado.
 * Mismo patrón que lib/supabase/admin.test.ts (vi.resetModules + vi.stubEnv)
 * combinado con el mock de Supabase de los route tests.
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

const maybeSingleSpy = vi.fn();
const eqSpy = vi.fn(() => ({ maybeSingle: maybeSingleSpy }));
const selectSpy = vi.fn(() => ({ eq: eqSpy }));
const fromSpy = vi.fn(() => ({ select: selectSpy }));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({ from: fromSpy })),
}));

const { obtenerRetoPorSlug } = await import("@/lib/supabase/retos");

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
  selectSpy.mockClear();
  fromSpy.mockClear();
});

describe("obtenerRetoPorSlug", () => {
  it("devuelve el reto cuando el slug existe en BD", async () => {
    maybeSingleSpy.mockResolvedValue({ data: retoFijo, error: null });

    const result = await obtenerRetoPorSlug("portuguesa-110");

    expect(result).toEqual(retoFijo);
    expect(fromSpy).toHaveBeenCalledWith("retos");
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
    fromSpy.mockImplementationOnce(() => {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
    });

    const result = await obtenerRetoPorSlug("portuguesa-110");

    expect(result).toBeNull();
  });
});
