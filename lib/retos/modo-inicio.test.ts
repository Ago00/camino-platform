import { describe, expect, it } from "vitest";
import { modosDeInicioPermitidos } from "@/lib/retos/modo-inicio";

describe("modosDeInicioPermitidos", () => {
  it("un reto con ruta admite guiado y libre, con guiado primero (preseleccionado)", () => {
    expect(modosDeInicioPermitidos({ ruta_id: "portuguesa-110" })).toEqual(["guiado", "libre"]);
  });

  it("un reto sin ruta solo admite libre", () => {
    expect(modosDeInicioPermitidos({ ruta_id: null })).toEqual(["libre"]);
  });
});
