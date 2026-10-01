import { describe, expect, it } from "vitest";
import {
  configDelReto,
  esRespuestaDeSeccionApagada,
  fotoQuienCaminaDelReto,
  monigoteDelReto,
  urlInstagramVisible,
} from "@/lib/retos/config";

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
    expect(Object.keys(config).sort()).toEqual([
      "respuestas_visitantes",
      "seccion_comentarios",
      "seccion_instagram",
      "seccion_intenciones",
      "seccion_minuto_a_minuto",
    ]);
  });
});

describe("monigoteDelReto (DT-036)", () => {
  it("sin la columna monigote (0017 sin aplicar) respeta peregrino_animado: encendido o ausente ⇒ atleti", () => {
    expect(monigoteDelReto({ peregrino_animado: true })).toEqual({ id: "atleti", grito: null, sonido: true });
    expect(monigoteDelReto({})).toEqual({ id: "atleti", grito: null, sonido: true });
  });

  it("sin la columna monigote y peregrino_animado apagado ⇒ ninguno", () => {
    expect(monigoteDelReto({ peregrino_animado: false })).toEqual({ id: null, grito: null, sonido: true });
  });

  it("con la columna, manda monigote aunque peregrino_animado diga otra cosa", () => {
    expect(monigoteDelReto({ monigote: null, peregrino_animado: true }).id).toBeNull();
    expect(monigoteDelReto({ monigote: "pulpo", peregrino_animado: false }).id).toBe("pulpo");
  });

  it("un id que no está en el catálogo ⇒ ninguno", () => {
    expect(monigoteDelReto({ monigote: "dragon", monigote_grito: "¡Fuego!" })).toEqual({
      id: null,
      grito: null,
      sonido: true,
    });
  });

  it("devuelve el grito personalizado normalizado y el sonido guardado", () => {
    expect(monigoteDelReto({ monigote: "vaca", monigote_grito: " ¡Muuu  fuerte! ", monigote_sonido: false })).toEqual({
      id: "vaca",
      grito: "¡Muuu fuerte!",
      sonido: false,
    });
  });

  it("un grito guardado igual al del catálogo cuenta como no personalizado", () => {
    expect(monigoteDelReto({ monigote: "vaca", monigote_grito: "¡Muuu!" }).grito).toBeNull();
  });

  it("sonido ausente ⇒ true (default de BD)", () => {
    expect(monigoteDelReto({ monigote: "perro", monigote_grito: null }).sonido).toBe(true);
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

describe("esRespuestaDeSeccionApagada", () => {
  it("solo el 403 significa sección apagada", () => {
    expect(esRespuestaDeSeccionApagada(403)).toBe(true);
  });

  it.each([200, 404, 429, 500])("%i no para el polling", (estado) => {
    expect(esRespuestaDeSeccionApagada(estado)).toBe(false);
  });
});
