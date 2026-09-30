import { describe, expect, it } from "vitest";
import { debeUsarDatosReales, modoDeVistaPrevia } from "@/lib/vista-previa/fuente";

describe("debeUsarDatosReales", () => {
  it("'antes' siempre es real (no necesita datos de intento), haya intento o no", () => {
    expect(debeUsarDatosReales("antes", null)).toBe(true);
    expect(debeUsarDatosReales("antes", "durante")).toBe(true);
  });

  it("real solo si el intento está justo en la fase elegida", () => {
    expect(debeUsarDatosReales("durante", "durante")).toBe(true);
    expect(debeUsarDatosReales("llegada", "llegada")).toBe(true);
  });

  it("ejemplo si el reto está en otra fase o no hay intento", () => {
    expect(debeUsarDatosReales("durante", "antes")).toBe(false);
    expect(debeUsarDatosReales("durante", "llegada")).toBe(false);
    expect(debeUsarDatosReales("llegada", "durante")).toBe(false);
    expect(debeUsarDatosReales("llegada", null)).toBe(false);
  });
});

describe("modoDeVistaPrevia", () => {
  it("un reto sin ruta es siempre libre, aunque el intento diga guiado", () => {
    expect(modoDeVistaPrevia("guiado", null)).toBe("libre");
    expect(modoDeVistaPrevia(null, null)).toBe("libre");
  });

  it("con ruta, el modo del intento; sin intento, guiado", () => {
    expect(modoDeVistaPrevia("libre", "portuguesa-110")).toBe("libre");
    expect(modoDeVistaPrevia("guiado", "portuguesa-110")).toBe("guiado");
    expect(modoDeVistaPrevia(null, "portuguesa-110")).toBe("guiado");
  });
});
