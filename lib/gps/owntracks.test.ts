import { describe, expect, it } from "vitest";
import { construirConfigOwnTracks, enlaceOwnTracks, tidDesdeSlug } from "@/lib/gps/owntracks";

const URL_TRACKER = "https://camino.example/api/track?reto=santi-ago&t=abc-DEF_123";

function decodificarEnlace(enlace: string): unknown {
  const prefijo = "owntracks:///config?inline=";
  expect(enlace.startsWith(prefijo)).toBe(true);
  const base64 = decodeURIComponent(enlace.slice(prefijo.length));
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
}

describe("construirConfigOwnTracks", () => {
  it("usa las claves documentadas por OwnTracks para HTTP en modo significant", () => {
    expect(construirConfigOwnTracks({ url: URL_TRACKER, tid: "SA", deviceId: "santi-ago" })).toEqual({
      _type: "configuration",
      mode: 3,
      url: URL_TRACKER,
      tid: "SA",
      deviceId: "santi-ago",
      auth: false,
      extendedData: true,
      monitoring: 1,
      locatorInterval: 180,
      locatorDisplacement: 100,
      ignoreInaccurateLocations: 100,
    });
  });

  it("no usa la clave inexistente pubExtendedData", () => {
    const config = construirConfigOwnTracks({ url: URL_TRACKER, tid: "SA", deviceId: "santi-ago" });

    expect(Object.keys(config)).not.toContain("pubExtendedData");
  });
});

describe("enlaceOwnTracks", () => {
  it("lleva el JSON en base64 decodificable a un objeto idéntico", () => {
    const config = construirConfigOwnTracks({ url: URL_TRACKER, tid: "SA", deviceId: "santi-ago" });

    expect(decodificarEnlace(enlaceOwnTracks(config))).toEqual(config);
  });

  it("codifica en UTF-8 los caracteres no ASCII (tildes, eñe) sin perderlos", () => {
    const config = construirConfigOwnTracks({ url: URL_TRACKER, tid: "PÁ", deviceId: "peñas-ágil-camiño" });

    expect(decodificarEnlace(enlaceOwnTracks(config))).toEqual(config);
  });

  it("no deja caracteres del base64 que rompan la query (+, /, =)", () => {
    // Una URL con '?' y '>' fuerza '+' y '/' en el base64; su longitud, relleno '='.
    const config = construirConfigOwnTracks({ url: `${URL_TRACKER}&x=>>>???`, tid: "SA", deviceId: "a" });
    const parametro = enlaceOwnTracks(config).slice("owntracks:///config?inline=".length);

    expect(parametro).not.toMatch(/[+/=]/);
  });
});

describe("tidDesdeSlug", () => {
  it.each([
    ["santi-ago", "SA"],
    ["otro-reto-largo", "OR"],
    ["camino", "CA"],
    ["a", "A0"],
    ["2026-portugues", "2P"],
    ["-raro--", "RA"],
  ])("%s → %s", (slug, tid) => {
    expect(tidDesdeSlug(slug)).toBe(tid);
  });

  it("siempre devuelve 2 caracteres en mayúsculas", () => {
    for (const slug of ["x", "abc", "a-b-c", "zz-9"]) {
      expect(tidDesdeSlug(slug)).toMatch(/^[A-Z0-9]{2}$/);
    }
  });
});
