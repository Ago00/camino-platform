import { describe, expect, it } from "vitest";
import { BLOQUES_TEXTOS } from "@/lib/textos/bloques";
import { CLAVES_TEXTOS } from "@/lib/textos/defaults";

describe("BLOQUES_TEXTOS", () => {
  it("cada clave de texto está en exactamente un bloque", () => {
    const apariciones = new Map<string, number>();
    for (const bloque of BLOQUES_TEXTOS) {
      for (const clave of bloque.claves) apariciones.set(clave, (apariciones.get(clave) ?? 0) + 1);
    }

    for (const clave of CLAVES_TEXTOS) {
      expect({ clave, veces: apariciones.get(clave) ?? 0 }).toEqual({ clave, veces: 1 });
    }
    expect(apariciones.size).toBe(CLAVES_TEXTOS.length);
  });

  it("los ids de bloque son únicos (se usan como anclas)", () => {
    const ids = BLOQUES_TEXTOS.map((bloque) => bloque.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ningún bloque está vacío", () => {
    for (const bloque of BLOQUES_TEXTOS) expect(bloque.claves.length).toBeGreaterThan(0);
  });
});
