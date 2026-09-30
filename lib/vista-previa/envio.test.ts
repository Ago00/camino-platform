import { describe, expect, it } from "vitest";
import { envioPermitido } from "@/lib/vista-previa/envio";

describe("envioPermitido", () => {
  it("fuera de la vista previa, con los campos completos y sin envío en curso, se puede enviar", () => {
    expect(envioPermitido({ vistaPrevia: false, completo: true, enviando: false })).toBe(true);
  });

  it("en la vista previa nunca se envía, aunque el formulario esté completo", () => {
    expect(envioPermitido({ vistaPrevia: true, completo: true, enviando: false })).toBe(false);
  });

  it("incompleto o con un envío en curso no se envía", () => {
    expect(envioPermitido({ vistaPrevia: false, completo: false, enviando: false })).toBe(false);
    expect(envioPermitido({ vistaPrevia: false, completo: true, enviando: true })).toBe(false);
  });
});
