import { describe, expect, it } from "vitest";
import { configDelReto, fotoQuienCaminaDelReto, urlInstagramVisible } from "@/lib/retos/config";

describe("configDelReto", () => {
  it("sin columnas de configuración (migración 0012 sin aplicar) todo queda encendido", () => {
    expect(configDelReto({})).toEqual({
      seccion_intenciones: true,
      seccion_comentarios: true,
      seccion_minuto_a_minuto: true,
      seccion_instagram: true,
      respuestas_visitantes: true,
    });
  });

  it("respeta los valores false de BD campo a campo", () => {
    expect(
      configDelReto({
        seccion_intenciones: false,
        seccion_comentarios: true,
        seccion_minuto_a_minuto: false,
        seccion_instagram: true,
        respuestas_visitantes: false,
      })
    ).toEqual({
      seccion_intenciones: false,
      seccion_comentarios: true,
      seccion_minuto_a_minuto: false,
      seccion_instagram: true,
      respuestas_visitantes: false,
    });
  });

  it("un campo ausente cae a true sin afectar a los presentes", () => {
    expect(configDelReto({ seccion_comentarios: false })).toMatchObject({
      seccion_comentarios: false,
      respuestas_visitantes: true,
    });
  });

  it("no copia campos ajenos a la configuración", () => {
    const config = configDelReto({ seccion_instagram: false });
    expect(Object.keys(config).sort()).toEqual(
      ["respuestas_visitantes", "seccion_comentarios", "seccion_instagram", "seccion_intenciones", "seccion_minuto_a_minuto"]
    );
  });
});

describe("fotoQuienCaminaDelReto", () => {
  it("devuelve la URL guardada", () => {
    expect(fotoQuienCaminaDelReto({ quien_camina_foto_url: "/santi.jpg" })).toBe("/santi.jpg");
  });

  it("null o columna ausente ⇒ null (silueta)", () => {
    expect(fotoQuienCaminaDelReto({ quien_camina_foto_url: null })).toBeNull();
    expect(fotoQuienCaminaDelReto({})).toBeNull();
  });
});

describe("urlInstagramVisible", () => {
  const encendido = configDelReto({});
  const apagado = configDelReto({ seccion_instagram: false });

  it("con el interruptor encendido y URL, devuelve la URL", () => {
    expect(urlInstagramVisible(encendido, "https://instagram.com/santi")).toBe("https://instagram.com/santi");
  });

  it("con el interruptor apagado, null aunque haya URL", () => {
    expect(urlInstagramVisible(apagado, "https://instagram.com/santi")).toBeNull();
  });

  it("con URL vacía o solo espacios, null aunque esté encendido", () => {
    expect(urlInstagramVisible(encendido, "")).toBeNull();
    expect(urlInstagramVisible(encendido, "   ")).toBeNull();
  });
});
