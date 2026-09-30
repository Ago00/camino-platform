/**
 * Preparación en el servidor de la configuración del GPS (DT-035), con el
 * generador de QR real: la URL lleva el token, el enlace de OwnTracks lleva
 * esa misma URL y el QR es un SVG válido en data URL.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

let cabecerasMock = new Headers();
vi.mock("next/headers", () => ({ headers: async () => cabecerasMock }));

const { obtenerOrigenTracker, prepararDatosConfigGps } = await import("@/lib/gps/config-gps-servidor");

const CREDENCIAL = { token: "abcDEF_123-token-de-prueba-0123456", actualizadoEn: "2026-09-30T10:00:00.000Z" };

function configDelEnlace(enlace: string): Record<string, unknown> {
  const base64 = decodeURIComponent(enlace.replace("owntracks:///config?inline=", ""));
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
}

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
  it("construye URL, enlace de OwnTracks y QR coherentes entre sí", async () => {
    const datos = await prepararDatosConfigGps("santi-ago", CREDENCIAL, {
      origen: "https://camino.vercel.app",
      provisional: false,
    });

    expect(datos.urlTracker).toBe(`https://camino.vercel.app/api/track?reto=santi-ago&t=${CREDENCIAL.token}`);
    expect(datos.urlSinToken).toBe("https://camino.vercel.app/api/track?reto=santi-ago");
    expect(configDelEnlace(datos.enlaceOwnTracks)).toMatchObject({
      _type: "configuration",
      url: datos.urlTracker,
      tid: "SA",
      deviceId: "santi-ago",
    });
    expect(datos.fechaActualizacion).toBe(CREDENCIAL.actualizadoEn);
    expect(datos.origenProvisional).toBe(false);

    const svg = Buffer.from(datos.qrDataUrl?.replace("data:image/svg+xml;base64,", "") ?? "", "base64").toString("utf8");
    expect(datos.qrDataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>\s*$/);
  });
});
