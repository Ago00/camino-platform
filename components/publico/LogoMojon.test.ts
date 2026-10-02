import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LogoMojon, { LogoMojonProvider } from "@/components/publico/LogoMojon";
import { figuraParaLogo } from "@/lib/monigotes/logo";

describe("LogoMojon", () => {
  it("sin monigote es solo el mojón: sin figura dentro", () => {
    const html = renderToString(createElement(LogoMojonProvider, { figuraSvg: null }, createElement(LogoMojon)));
    expect(html).toContain('aria-label="Camino de Santi"');
    expect(html).not.toContain("logo-fig");
    expect(html).not.toContain("class=\"mono");
  });

  it("sin proveedor tampoco hay figura", () => {
    expect(renderToString(createElement(LogoMojon))).not.toContain("logo-fig");
  });

  it("con monigote lo lleva dentro del mojón", () => {
    const html = renderToString(
      createElement(LogoMojonProvider, { figuraSvg: figuraParaLogo("pulpo") }, createElement(LogoMojon))
    );
    expect(html).toContain("logo-fig");
    expect(html).toContain("m-pulpo");
  });

  it("cambia con el monigote elegido", () => {
    const con = (id: "atleti" | "perro") =>
      renderToString(createElement(LogoMojonProvider, { figuraSvg: figuraParaLogo(id) }, createElement(LogoMojon)));
    expect(con("atleti")).toContain("m-atleti");
    expect(con("perro")).toContain("m-perro");
    expect(con("perro")).not.toContain("m-atleti");
  });
});
