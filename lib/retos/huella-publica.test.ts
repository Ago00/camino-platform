import { describe, expect, it } from "vitest";
import { configDelReto, monigoteDelReto } from "@/lib/retos/config";
import { huellaContenidoPublico } from "@/lib/retos/huella-publica";

const base = {
  config: configDelReto({}),
  monigote: monigoteDelReto({ monigote: "atleti", monigote_grito: null, monigote_sonido: true }),
  fotoQuienCamina: "/santi.jpg",
  textos: { a: "uno", b: "dos" },
};

describe("huellaContenidoPublico", () => {
  it("es estable ante el orden de las claves", () => {
    expect(huellaContenidoPublico(base)).toBe(huellaContenidoPublico({ ...base, textos: { b: "dos", a: "uno" } }));
  });

  it("cambia al apagar una sección (p.ej. Instagram)", () => {
    const apagado = { ...base, config: { ...base.config, seccion_instagram: false } };
    expect(huellaContenidoPublico(apagado)).not.toBe(huellaContenidoPublico(base));
  });

  it("cambia al editar un texto o la foto", () => {
    expect(huellaContenidoPublico({ ...base, textos: { a: "uno", b: "tres" } })).not.toBe(huellaContenidoPublico(base));
    expect(huellaContenidoPublico({ ...base, fotoQuienCamina: null })).not.toBe(huellaContenidoPublico(base));
  });

  it("cambia al cambiar el monigote, su grito o su sonido (DT-036)", () => {
    const original = huellaContenidoPublico(base);
    expect(huellaContenidoPublico({ ...base, monigote: { ...base.monigote, id: "pulpo" } })).not.toBe(original);
    expect(huellaContenidoPublico({ ...base, monigote: { ...base.monigote, id: null } })).not.toBe(original);
    expect(huellaContenidoPublico({ ...base, monigote: { ...base.monigote, grito: "¡Vamos!" } })).not.toBe(original);
    expect(huellaContenidoPublico({ ...base, monigote: { ...base.monigote, sonido: false } })).not.toBe(original);
  });

  it("devuelve 8 caracteres hexadecimales", () => {
    expect(huellaContenidoPublico(base)).toMatch(/^[0-9a-f]{8}$/);
  });
});
