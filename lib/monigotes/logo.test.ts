import { describe, expect, it } from "vitest";
import { IDS_MONIGOTE } from "@/lib/monigotes/catalogo";
import { figuraParaLogo, TAMANO_FIGURA_LOGO } from "@/lib/monigotes/logo";

describe("figuraParaLogo", () => {
  it("sin monigote no hay figura: el logo es solo el mojón", () => {
    expect(figuraParaLogo(null)).toBeNull();
  });

  it.each(IDS_MONIGOTE)("%s devuelve un SVG con su clase y el tamaño del logo", (id) => {
    const svg = figuraParaLogo(id);
    expect(svg).toMatch(/^<svg class="mono m-/);
    expect(svg).toContain(`class="mono m-${id}"`);
    expect(svg).toContain(`width="${TAMANO_FIGURA_LOGO}"`);
    expect(svg).not.toMatch(/<script|javascript:|onload=|onerror=/i);
  });
});
