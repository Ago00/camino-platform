import { existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { esRutaPredefinida, RUTAS_PREDEFINIDAS } from "@/lib/rutas/catalogo";

describe("catálogo de rutas predefinidas", () => {
  it.each(RUTAS_PREDEFINIDAS.map((r) => r.id))("la ruta %s tiene sus dos trazas en disco", (id) => {
    expect(existsSync(join(__dirname, id, "traza.geojson"))).toBe(true);
    expect(existsSync(join(__dirname, id, "traza-mapa.geojson"))).toBe(true);
  });

  it("acepta un id del catálogo", () => {
    expect(esRutaPredefinida("portuguesa-110")).toBe(true);
  });

  it.each(["", "no-existe", "../../etc", "portuguesa-110/../x"])("rechaza %j", (id) => {
    expect(esRutaPredefinida(id)).toBe(false);
  });
});
