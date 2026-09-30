/**
 * Tests de `preparar-foto.ts` (DT-017): la decisión pura de con qué fichero
 * se va la subida, y el límite de tiempo de la decodificación con un `<img>`
 * falso y temporizadores simulados.
 *
 * El dibujo en `<canvas>` y `toBlob` son API de navegador que no existe en el
 * entorno `node` de Vitest; importar el módulo sí es seguro porque nada toca
 * el DOM en su carga.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIMITE_DECODIFICACION_MS,
  elegirFotoAEnviar,
  prepararFotoParaSubida,
} from "@/lib/imagen/preparar-foto";

function ficheroDe(bytes: number, tipo: string, nombre = "foto"): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

/**
 * `<img>` falso: asignar `src` no dispara nada salvo que el test lo pida con
 * `dispararAlAsignarSrc`. Así se simula el navegador que, bajo presión de
 * memoria, nunca llama a `onload` ni a `onerror`.
 */
class ImagenFalsa {
  static dispararAlAsignarSrc: "nada" | "error" = "nada";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_url: string) {
    if (ImagenFalsa.dispararAlAsignarSrc === "error") queueMicrotask(() => this.onerror?.());
  }
}

describe("prepararFotoParaSubida — límite de tiempo de la decodificación", () => {
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    ImagenFalsa.dispararAlAsignarSrc = "nada";
    vi.stubGlobal("Image", ImagenFalsa);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:foto-de-prueba");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeObjectURL);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    revokeObjectURL.mockReset();
  });

  it("si el navegador nunca termina de decodificar, a los 10 s envía el original en vez de quedarse colgada", async () => {
    const original = ficheroDe(200_000, "image/jpeg");
    let resultado: Awaited<ReturnType<typeof prepararFotoParaSubida>> | null = null;
    void prepararFotoParaSubida(original).then((r) => {
      resultado = r;
    });

    await vi.advanceTimersByTimeAsync(LIMITE_DECODIFICACION_MS - 1);
    expect(resultado).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(resultado).toEqual({ estado: "lista", foto: original });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:foto-de-prueba");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("el límite es de 10 s", () => {
    expect(LIMITE_DECODIFICACION_MS).toBe(10_000);
  });

  it("si la decodificación falla antes del límite, degrada al original sin esperar y limpia el temporizador", async () => {
    ImagenFalsa.dispararAlAsignarSrc = "error";
    const original = ficheroDe(200_000, "image/png");

    await expect(prepararFotoParaSubida(original)).resolves.toEqual({ estado: "lista", foto: original });
    expect(vi.getTimerCount()).toBe(0);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:foto-de-prueba");
  });
});

describe("elegirFotoAEnviar", () => {
  it("envía el original cuando el navegador no pudo recodificar", () => {
    const original = ficheroDe(1_000, "image/png");
    expect(elegirFotoAEnviar(original, null)).toBe(original);
  });

  it("envía la versión recodificada cuando pesa menos que el original", () => {
    const original = ficheroDe(4_000_000, "image/jpeg");
    const recodificada = ficheroDe(2_000_000, "image/jpeg");
    expect(elegirFotoAEnviar(original, recodificada)).toBe(recodificada);
  });

  it("conserva el original si recodificarlo lo ha engordado", () => {
    const original = ficheroDe(150_000, "image/jpeg");
    const recodificada = ficheroDe(900_000, "image/jpeg");
    expect(elegirFotoAEnviar(original, recodificada)).toBe(original);
  });

  it("envía la recodificada aunque sea mayor si el formato del original no se acepta en Storage", () => {
    const heicDeIphone = ficheroDe(1_500_000, "image/heic");
    const recodificada = ficheroDe(2_500_000, "image/jpeg");
    expect(elegirFotoAEnviar(heicDeIphone, recodificada)).toBe(recodificada);
  });

  it("envía la recodificada cuando el original llega sin tipo MIME", () => {
    const sinTipo = ficheroDe(100, "");
    const recodificada = ficheroDe(900, "image/jpeg");
    expect(elegirFotoAEnviar(sinTipo, recodificada)).toBe(recodificada);
  });

  it("prefiere el original ante un empate exacto de tamaño, para no recomprimir sin ganancia", () => {
    const original = ficheroDe(500_000, "image/webp");
    const recodificada = ficheroDe(500_000, "image/jpeg");
    expect(elegirFotoAEnviar(original, recodificada)).toBe(original);
  });
});
