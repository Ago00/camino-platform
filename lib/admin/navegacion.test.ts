import { describe, expect, it } from "vitest";
import {
  esFiltroComentarioValido,
  esGranularidadValida,
  esTabValida,
  filtroComentarioDesdeQuery,
} from "@/lib/admin/navegacion";

describe("esFiltroComentarioValido", () => {
  it.each(["publicos", "privados", "ocultos"] as const)("acepta '%s'", (valor) => {
    expect(esFiltroComentarioValido(valor)).toBe(true);
  });

  it("rechaza el antiguo filtro 'todos'", () => {
    expect(esFiltroComentarioValido("todos")).toBe(false);
  });
});

describe("filtroComentarioDesdeQuery", () => {
  it("conserva un filtro válido", () => {
    expect(filtroComentarioDesdeQuery("privados")).toBe("privados");
  });

  it.each([undefined, "", "todos", "PUBLICOS", "xyz"])("cae a 'publicos' con %j", (valor) => {
    expect(filtroComentarioDesdeQuery(valor)).toBe("publicos");
  });
});

describe("esGranularidadValida", () => {
  it.each(["5m", "30m", "1h"] as const)("acepta '%s' como granularidad válida", (valor) => {
    expect(esGranularidadValida(valor)).toBe(true);
  });

  it("rechaza un valor no reconocido", () => {
    expect(esGranularidadValida("15m")).toBe(false);
  });

  it("rechaza undefined", () => {
    expect(esGranularidadValida(undefined)).toBe(false);
  });

  it("rechaza cadena vacía", () => {
    expect(esGranularidadValida("")).toBe(false);
  });
});

describe("esTabValida", () => {
  it("acepta 'trafico' como pestaña válida", () => {
    expect(esTabValida("trafico")).toBe(true);
  });

  it("rechaza null", () => {
    expect(esTabValida(null)).toBe(false);
  });

  it("acepta 'configuracion' (FP3c)", () => {
    expect(esTabValida("configuracion")).toBe(true);
  });
});
