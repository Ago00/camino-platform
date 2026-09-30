import { describe, expect, it } from "vitest";
import { leerAvisoPanel, urlPanelTrasEliminar, urlPanelTrasGuardar } from "./resultado-accion";

function queryDe(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url, "https://ejemplo.test").searchParams);
}

describe("leerAvisoPanel", () => {
  it("lee el aviso de guardado que genera urlPanelTrasGuardar", () => {
    expect(leerAvisoPanel(queryDe(urlPanelTrasGuardar(12)))).toEqual({ tipo: "guardado", retoId: 12 });
  });

  it("lee el aviso de eliminación que genera urlPanelTrasEliminar", () => {
    expect(leerAvisoPanel(queryDe(urlPanelTrasEliminar("mi-reto-2026")))).toEqual({
      tipo: "eliminado",
      slug: "mi-reto-2026",
    });
  });

  it("sin aviso en la query devuelve null", () => {
    expect(leerAvisoPanel({ edit: "3" })).toBeNull();
  });

  it.each(["0", "-1", "1.5", "abc", "", "3 "])("ignora un id de guardado no válido (%j)", (valor) => {
    expect(leerAvisoPanel({ guardado: valor })).toBeNull();
  });

  it.each(["<script>", "Con Mayúsculas", "con espacio", "", "a".repeat(61)])(
    "no muestra texto arbitrario como slug eliminado (%j)",
    (valor) => {
      expect(leerAvisoPanel({ eliminado: valor })).toBeNull();
    }
  );
});
