/**
 * Tests de obtenerFaseActual(retoId) (FP2.5, DT-028) con el cliente Supabase
 * público mockado: la fase es la del intento activo DEL RETO pedido, y sin
 * intento activo en ese reto es "antes".
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Fase } from "@/lib/types";

const eqSpy = vi.fn();
let fasesPorReto: Record<number, Fase> = {};

vi.mock("@/lib/supabase/public", () => ({
  getSupabasePublic: () => ({
    from: () => ({
      select: () => {
        let retoFiltrado: number | null = null;
        const consulta = {
          eq: (columna: string, valor: unknown) => {
            eqSpy(columna, valor);
            if (columna === "reto_id" && typeof valor === "number") retoFiltrado = valor;
            return consulta;
          },
          maybeSingle: () => {
            const fase = retoFiltrado === null ? undefined : fasesPorReto[retoFiltrado];
            return Promise.resolve({ data: fase ? { fase } : null, error: null });
          },
        };
        return consulta;
      },
    }),
  }),
}));

const { obtenerFaseActual } = await import("@/lib/fase-actual");

beforeEach(() => {
  eqSpy.mockClear();
  fasesPorReto = {};
});

describe("obtenerFaseActual", () => {
  it("filtra el intento activo por el reto pedido y por cerrado = false", async () => {
    await obtenerFaseActual(4);

    expect(eqSpy).toHaveBeenCalledWith("reto_id", 4);
    expect(eqSpy).toHaveBeenCalledWith("cerrado", false);
  });

  it("devuelve la fase del intento activo del reto pedido, no la de otro reto", async () => {
    fasesPorReto = { 1: "durante", 2: "llegada" };

    expect(await obtenerFaseActual(1)).toBe("durante");
    expect(await obtenerFaseActual(2)).toBe("llegada");
  });

  it("devuelve 'antes' si el reto no tiene intento activo aunque otro reto sí lo tenga", async () => {
    fasesPorReto = { 1: "durante" };

    expect(await obtenerFaseActual(2)).toBe("antes");
  });
});
