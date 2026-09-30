import { describe, expect, it } from "vitest";
import { configDelReto, fotoQuienCaminaDelReto, urlInstagramVisible } from "@/lib/retos/config";

describe("configDelReto", () => {
  it("sin columnas de configuración (migraciones 0012/0015 sin aplicar) todo queda encendido", () => {
    expect(configDelReto({})).toEqual({
      seccion_intenciones: true,
      seccion_comentarios: true,
      seccion_minuto_a_minuto: true,
      seccion_instagram: true,
      respuestas_visitantes: true,
      peregrino_animado: true,
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
        peregrino_animado: false,
      })
    ).toEqual({
      seccion_intenciones: false,
      seccion_comentarios: true,
      seccion_minuto_a_minuto: false,
      seccion_instagram: true,
      respuestas_visitantes: false,
      peregrino_animado: false,
    });
  });

  it("un campo ausente cae a true sin afectar a los presentes", () => {
    expect(configDelReto({ seccion_comentarios: false })).toMatchObject({
      seccion_comentarios: false,
      respuestas_visitantes: true,
    });
  });

  it("peregrino_animado: ausente (código antes que la migración 0015) ⇒ true; false de BD ⇒ false (DT-034)", () => {
    expect(configDelReto({}).peregrino_animado).toBe(true);
    expect(configDelReto({ peregrino_animado: false }).peregrino_animado).toBe(false);
    expect(configDelReto({ peregrino_animado: true }).peregrino_animado).toBe(true);
  });

  it("no copia campos ajenos a la configuración", () => {
    const config = configDelReto({ seccion_instagram: false });
    expect(Object.keys(config).sort()).toEqual([
      "peregrino_animado",
      "respuestas_visitantes",
      "seccion_comentarios",
      "seccion_instagram",
      "seccion_intenciones",
      "seccion_minuto_a_minuto",
    ]);
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

  it("con el interruptor encendido y URL de perfil, devuelve la URL", () => {
    expect(urlInstagramVisible(encendido, "https://instagram.com/santi")).toBe("https://instagram.com/santi");
  });

  it("con el interruptor apagado, null aunque haya URL", () => {
    expect(urlInstagramVisible(apagado, "https://instagram.com/santi")).toBeNull();
  });

  it("con URL vacía o solo espacios, null aunque esté encendido", () => {
    expect(urlInstagramVisible(encendido, "")).toBeNull();
    expect(urlInstagramVisible(encendido, "   ")).toBeNull();
  });

  it("un valor antiguo que no es un perfil de Instagram no se pinta (DT-034)", () => {
    expect(urlInstagramVisible(encendido, "javascript:alert(1)")).toBeNull();
    expect(urlInstagramVisible(encendido, "https://evil.example/santi")).toBeNull();
  });
});
