/**
 * Tests de obtenerTextos() con el cliente Supabase mockado (mismo patrón que
 * app/api/track/route.test.ts): sustituye getSupabasePublic() por un builder
 * falso, sin tocar red ni depender de un proyecto Supabase real.
 *
 * El builder falso aplica de verdad el filtro `.eq("reto_id", X)` sobre las
 * filas simuladas (FP2.5, DT-028): si `obtenerTextos` dejara de filtrar por
 * reto, el test de colisión entre retos fallaría.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TEXTOS_POR_DEFECTO } from "./defaults";

interface FilaTextoMock {
  reto_id: number;
  clave: string;
  valor: string;
}

const RETO_A = 1;
const RETO_B = 2;

let filasMock: FilaTextoMock[] = [];
let errorMock: Error | null = null;
const eqSpy = vi.fn();

function crearBuilderFalso() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: (columna: "reto_id", valor: number) => {
          eqSpy(columna, valor);
          const filas = filasMock
            .filter((f) => f[columna] === valor)
            .map(({ clave, valor: v }) => ({ clave, valor: v }));
          return Promise.resolve({ data: errorMock ? null : filas, error: errorMock });
        },
      })),
    })),
  };
}

vi.mock("@/lib/supabase/public", () => ({
  getSupabasePublic: vi.fn(() => crearBuilderFalso()),
}));

const { obtenerTextos } = await import("./obtener-textos");

beforeEach(() => {
  filasMock = [];
  errorMock = null;
  eqSpy.mockClear();
});

describe("obtenerTextos", () => {
  it("devuelve todos los valores por defecto cuando la tabla textos está vacía", async () => {
    const textos = await obtenerTextos(RETO_A);

    expect(textos).toEqual(TEXTOS_POR_DEFECTO);
  });

  it("sobreescribe solo la clave presente en BD, dejando el resto en su valor por defecto", async () => {
    filasMock = [{ reto_id: RETO_A, clave: "reto_titulo", valor: "El reto (editado desde admin)" }];

    const textos = await obtenerTextos(RETO_A);

    expect(textos.reto_titulo).toBe("El reto (editado desde admin)");
    expect(textos.reto_descripcion).toBe(TEXTOS_POR_DEFECTO.reto_descripcion);
  });

  it("ignora claves desconocidas que no existan en los defaults", async () => {
    filasMock = [{ reto_id: RETO_A, clave: "clave_inventada_que_no_existe", valor: "algo" }];

    const textos = await obtenerTextos(RETO_A);

    expect(textos).toEqual(TEXTOS_POR_DEFECTO);
  });

  it("ignora un valor vacío en BD y conserva el valor por defecto", async () => {
    filasMock = [{ reto_id: RETO_A, clave: "cierre_antes", valor: "   " }];

    const textos = await obtenerTextos(RETO_A);

    expect(textos.cierre_antes).toBe(TEXTOS_POR_DEFECTO.cierre_antes);
  });

  it("cae a los valores por defecto sin lanzar cuando la consulta devuelve error", async () => {
    errorMock = new Error("fallo de red simulado");

    const textos = await obtenerTextos(RETO_A);

    expect(textos).toEqual(TEXTOS_POR_DEFECTO);
  });
});

describe("obtenerTextos — aislamiento por reto (FP2.5, DT-028)", () => {
  it("filtra la consulta por el reto pedido", async () => {
    await obtenerTextos(RETO_B);

    expect(eqSpy).toHaveBeenCalledWith("reto_id", RETO_B);
  });

  it("con la misma clave en dos retos, devuelve el valor del reto pedido", async () => {
    filasMock = [
      { reto_id: RETO_A, clave: "reto_titulo", valor: "Título del reto A" },
      { reto_id: RETO_B, clave: "reto_titulo", valor: "Título del reto B" },
    ];

    const textosA = await obtenerTextos(RETO_A);
    const textosB = await obtenerTextos(RETO_B);

    expect(textosA.reto_titulo).toBe("Título del reto A");
    expect(textosB.reto_titulo).toBe("Título del reto B");
  });

  it("un reto sin overrides propios recibe los defaults aunque otro reto tenga overrides", async () => {
    filasMock = [{ reto_id: RETO_A, clave: "reto_titulo", valor: "Título del reto A" }];

    const textosB = await obtenerTextos(RETO_B);

    expect(textosB).toEqual(TEXTOS_POR_DEFECTO);
  });
});
