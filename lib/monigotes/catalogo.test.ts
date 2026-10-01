import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { ENTRADAS_GRITO, IDS_MONIGOTE, MONIGOTES, esIdMonigote } from "@/lib/monigotes/catalogo";
import { FIGURAS, svgFigura, uidSvgSeguro } from "@/lib/monigotes/figuras";
import { MARCAS, particulaSvg } from "@/lib/monigotes/marcas";
import { SINTETIZADORES } from "@/components/monigotes/sonidos";

const CSS = readFileSync(path.resolve(__dirname, "../../components/monigotes/monigotes.css"), "utf8");

describe("catálogo de monigotes (DT-036)", () => {
  it("tiene los 22 ids del catálogo aprobado, sin repetir", () => {
    expect(IDS_MONIGOTE).toHaveLength(22);
    expect(new Set(IDS_MONIGOTE).size).toBe(22);
    expect(Object.keys(MONIGOTES).sort()).toEqual([...IDS_MONIGOTE].sort());
  });

  it("cada id cumple el formato que exige la BD (0017)", () => {
    for (const id of IDS_MONIGOTE) expect(id).toMatch(/^[a-z]{2,24}$/);
  });

  describe.each(IDS_MONIGOTE)("%s", (id) => {
    const def = MONIGOTES[id];

    it("su definición es coherente con su clave", () => {
      expect(def.id).toBe(id);
      expect(def.nombre.trim()).not.toBe("");
      expect(def.grito.trim()).not.toBe("");
      expect(Array.from(def.grito).length).toBeLessThanOrEqual(48);
      expect(def.vel).toBeGreaterThan(0);
      expect(def.mult).toBeGreaterThan(0);
    });

    it("tiene figura, marca de rastro y sonido existentes", () => {
      expect(FIGURAS[id]("u1").trimStart().startsWith("<g")).toBe(true);
      expect(MARCAS[def.rastro.marca](0.5, false)).toMatch(/^<svg /);
      expect(typeof SINTETIZADORES[def.sonido]).toBe("function");
    });

    it("su grito tiene líneas de color, una entrada con CSS y partículas que se pintan", () => {
      expect(def.estilo.lineas.length).toBeGreaterThan(0);
      expect(ENTRADAS_GRITO).toContain(def.estilo.entrada);
      expect(CSS).toContain(`.mng .e-${def.estilo.entrada}{`);
      for (const color of def.estilo.particula?.colores ?? []) {
        expect(particulaSvg(def.estilo.particula?.tipo ?? "estrella", color)).toMatch(/^<svg /);
      }
    });
  });

  it("la figura del atleti usa el uid en su patrón rojiblanco (id único por documento)", () => {
    const svg = FIGURAS.atleti("m-abc");
    expect(svg).toContain('id="ra-m-abc"');
    expect(svg).toContain("url(#ra-m-abc)");
  });

  it("svgFigura envuelve la figura en un <svg> decorativo con la clase del monigote", () => {
    const svg = svgFigura("vaca", "m1", 64);
    expect(svg).toMatch(/^<svg class="mono m-vaca" width="64" height="64" viewBox="0 0 40 48"/);
    expect(svg).toContain('aria-hidden="true"');
  });

  it("esIdMonigote solo acepta ids del catálogo", () => {
    expect(esIdMonigote("pulpo")).toBe(true);
    expect(esIdMonigote("Pulpo")).toBe(false);
    expect(esIdMonigote("dragon")).toBe(false);
    expect(esIdMonigote(null)).toBe(false);
    expect(esIdMonigote(undefined)).toBe(false);
  });
});

describe("monigotes.css aislado bajo .mng", () => {
  it("toda animación usada tiene su @keyframes con prefijo mng-", () => {
    const definidos = new Set(Array.from(CSS.matchAll(/@keyframes (mng-[\w-]+)/g), (m) => m[1]));
    const usados = Array.from(CSS.matchAll(/animation(?:-name)?:\s*([\w-]+)/g), (m) => m[1]).filter(
      (nombre) => nombre !== "none"
    );
    expect(usados.length).toBeGreaterThan(0);
    for (const nombre of usados) expect(definidos, nombre).toContain(nombre);
  });

  it("ninguna regla queda fuera de .mng", () => {
    const selectores = Array.from(CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(^|})\s*([^@{}][^{}]*)\{/g), (m) =>
      m[2].trim()
    ).filter((s) => !s.startsWith("@") && !/^(\d+%|from|to)/.test(s));
    expect(selectores.length).toBeGreaterThan(100);
    for (const lista of selectores) {
      for (const selector of lista.split(",")) expect(selector.trim(), selector).toMatch(/^\.mng /);
    }
  });
});

describe("uidSvgSeguro", () => {
  it("solo deja [a-z0-9-] y empieza por letra", () => {
    for (const id of ["_r_1_", "«r1»", ":r1:", "_R_abc_"]) expect(uidSvgSeguro(id)).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it("no hace colisionar ids que solo difieren en mayúsculas o símbolos", () => {
    expect(uidSvgSeguro("_R_1_")).not.toBe(uidSvgSeguro("_r_1_"));
    expect(uidSvgSeguro(":r1:")).not.toBe(uidSvgSeguro("_r1_"));
  });

  it("es determinista", () => {
    expect(uidSvgSeguro("_r_7_")).toBe(uidSvgSeguro("_r_7_"));
  });
});
