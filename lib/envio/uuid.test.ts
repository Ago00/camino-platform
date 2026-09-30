import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generarUuidV4, uuidV4DesdeBytes, type FuenteAleatoria } from "@/lib/envio/uuid";

const FORMATO_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Sin `randomUUID`, como en un contexto no seguro (HTTP en la LAN). */
function fuenteSinRandomUuid(): FuenteAleatoria {
  return { getRandomValues: (array) => globalThis.crypto.getRandomValues(array) };
}

describe("uuidV4DesdeBytes", () => {
  it.each([
    ["todo ceros", 0x00, "00000000-0000-4000-8000-000000000000"],
    ["todo unos", 0xff, "ffffffff-ffff-4fff-bfff-ffffffffffff"],
  ])("fija versión 4 y variante RFC con bytes %s", (_caso, relleno, esperado) => {
    expect(uuidV4DesdeBytes(new Uint8Array(16).fill(relleno))).toBe(esperado);
  });

  it("no modifica el array de entrada", () => {
    const bytes = new Uint8Array(16).fill(0xff);
    uuidV4DesdeBytes(bytes);
    expect(Array.from(bytes)).toEqual(new Array(16).fill(0xff));
  });

  it("rechaza un número de bytes distinto de 16", () => {
    expect(() => uuidV4DesdeBytes(new Uint8Array(15))).toThrow(/16 bytes/);
  });
});

describe("generarUuidV4", () => {
  it("usa randomUUID cuando existe", () => {
    const randomUUID = vi.fn(() => "5d3c1c2e-8a4b-4f6e-9d7a-0b1c2d3e4f5a");
    const getRandomValues = vi.fn((array: Uint8Array) => array);

    expect(generarUuidV4({ randomUUID, getRandomValues })).toBe("5d3c1c2e-8a4b-4f6e-9d7a-0b1c2d3e4f5a");
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it("sin randomUUID genera un v4 válido con getRandomValues, distinto en cada llamada", () => {
    const fuente = fuenteSinRandomUuid();
    const generados = Array.from({ length: 200 }, () => generarUuidV4(fuente));

    for (const uuid of generados) expect(uuid).toMatch(FORMATO_UUID_V4);
    expect(new Set(generados).size).toBe(generados.length);
  });

  it("el fallback pasa la validación de clave_envio del servidor (z.uuid)", () => {
    expect(z.uuid().safeParse(generarUuidV4(fuenteSinRandomUuid())).success).toBe(true);
  });
});
