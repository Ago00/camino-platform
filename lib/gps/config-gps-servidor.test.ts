/**
 * Preparación en el servidor de la configuración del GPS (DT-035): la URL
 * para pegar en OwnTracks lleva el token del reto.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

let cabecerasMock = new Headers();
vi.mock("next/headers", () => ({ headers: async () => cabecerasMock }));

const { obtenerOrigenTracker, prepararDatosConfigGps } = await import("@/lib/gps/config-gps-servidor");

const CREDENCIAL = { token: "abcDEF_123-token-de-prueba-0123456", actualizadoEn: "2026-09-30T10:00:00.000Z" };

beforeEach(() => {
  vi.unstubAllEnvs();
  cabecerasMock = new Headers({ host: "preview-1.vercel.app", "x-forwarded-proto": "https" });
});

describe("obtenerOrigenTracker", () => {
  it("usa VERCEL_PROJECT_PRODUCTION_URL si está definida", async () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "camino.vercel.app");

    await expect(obtenerOrigenTracker()).resolves.toEqual({ origen: "https://camino.vercel.app", provisional: false });
  });

  it("sin ella usa el host de la petición (x-forwarded-host primero) y lo marca provisional", async () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    cabecerasMock = new Headers({ host: "interno:3000", "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "http" });

    await expect(obtenerOrigenTracker()).resolves.toEqual({ origen: "http://localhost:3000", provisional: true });
  });
});

describe("prepararDatosConfigGps", () => {
  it("construye la URL con el token y la versión sin token para enmascararla", async () => {
    const datos = await prepararDatosConfigGps("santi-ago", CREDENCIAL, {
      origen: "https://camino.vercel.app",
      provisional: false,
    });

    expect(datos).toEqual({
      urlTracker: `https://camino.vercel.app/api/track?reto=santi-ago&t=${CREDENCIAL.token}`,
      urlSinToken: "https://camino.vercel.app/api/track?reto=santi-ago",
      fechaActualizacion: CREDENCIAL.actualizadoEn,
      origenProvisional: false,
    });
  });
});
