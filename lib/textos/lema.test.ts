import { describe, expect, it } from "vitest";
import { TEXTOS_POR_DEFECTO } from "@/lib/textos/defaults";
import { partirLema } from "@/lib/textos/lema";

describe("partirLema", () => {
  it("destaca la palabra entre asteriscos y conserva el resto", () => {
    expect(partirLema("…y este camino, ¡no lo *hago* solo!")).toEqual([
      { texto: "…y este camino, ¡no lo ", enfasis: false },
      { texto: "hago", enfasis: true },
      { texto: " solo!", enfasis: false },
    ]);
  });

  it("sin asteriscos devuelve un único trozo normal", () => {
    expect(partirLema("Ánimo, peregrino")).toEqual([{ texto: "Ánimo, peregrino", enfasis: false }]);
  });

  it("admite varios destacados y que la frase empiece o acabe con uno", () => {
    expect(partirLema("*Vamos* Laura, *tú puedes*")).toEqual([
      { texto: "Vamos", enfasis: true },
      { texto: " Laura, ", enfasis: false },
      { texto: "tú puedes", enfasis: true },
    ]);
  });

  it("un asterisco suelto o vacío se queda como texto", () => {
    expect(partirLema("a * b")).toEqual([{ texto: "a * b", enfasis: false }]);
    expect(partirLema("a ** b")).toEqual([{ texto: "a ** b", enfasis: false }]);
  });

  it("el marcado nunca se interpreta como HTML: se devuelve tal cual como texto", () => {
    expect(partirLema("<b>x</b> *y*")).toEqual([
      { texto: "<b>x</b> ", enfasis: false },
      { texto: "y", enfasis: true },
    ]);
  });

  it("el texto por defecto reproduce el de la portada actual", () => {
    const texto = partirLema(TEXTOS_POR_DEFECTO.portada_lema).map((t) => t.texto).join("");
    expect(texto).toBe("…y este camino, ¡no lo hago solo!");
  });
});
