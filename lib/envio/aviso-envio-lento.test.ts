import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avisarSiTarda } from "@/lib/envio/aviso-envio-lento";

function promesaControlada<T>() {
  let resolver: (valor: T) => void = () => undefined;
  let rechazar: (error: unknown) => void = () => undefined;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

describe("avisarSiTarda", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("no avisa antes del umbral y avisa una sola vez al superarlo, sin abortar el envío", async () => {
    const { promesa, resolver } = promesaControlada<string>();
    const avisar = vi.fn();
    const resultado = avisarSiTarda(promesa, 15_000, avisar);

    await vi.advanceTimersByTimeAsync(14_999);
    expect(avisar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(avisar).toHaveBeenCalledTimes(1);

    resolver("publicado");
    await expect(resultado).resolves.toBe("publicado");
  });

  it("no avisa si el envío termina antes del umbral, ni después (temporizador limpio)", async () => {
    const { promesa, resolver } = promesaControlada<number>();
    const avisar = vi.fn();
    const resultado = avisarSiTarda(promesa, 15_000, avisar);

    await vi.advanceTimersByTimeAsync(5_000);
    resolver(42);
    await expect(resultado).resolves.toBe(42);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(avisar).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("propaga el rechazo del envío y limpia el temporizador", async () => {
    const { promesa, rechazar } = promesaControlada<never>();
    const avisar = vi.fn();
    const resultado = avisarSiTarda(promesa, 15_000, avisar);

    const error = new TypeError("Load failed");
    rechazar(error);
    await expect(resultado).rejects.toBe(error);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(avisar).not.toHaveBeenCalled();
  });
});
