import { describe, expect, it } from "vitest";
import {
  esUrlPerfilInstagram,
  MENSAJE_PERFIL_INSTAGRAM_NO_VALIDO,
  normalizarPerfilInstagram,
} from "@/lib/retos/instagram";

describe("normalizarPerfilInstagram", () => {
  it.each([
    ["@santi.ago", "https://instagram.com/santi.ago"],
    ["santi_ago", "https://instagram.com/santi_ago"],
    ["  @Santi_Ago  ", "https://instagram.com/Santi_Ago"],
    ["instagram.com/santi", "https://instagram.com/santi"],
    ["www.instagram.com/santi/", "https://instagram.com/santi"],
    ["https://instagram.com/santi", "https://instagram.com/santi"],
    ["https://www.instagram.com/santi/", "https://instagram.com/santi"],
    ["http://www.instagram.com/santi", "https://instagram.com/santi"],
    ["https://www.instagram.com/santi?igsh=MWx0eXZ4", "https://instagram.com/santi"],
    ["HTTPS://WWW.INSTAGRAM.COM/santi", "https://instagram.com/santi"],
    ["a".repeat(30), `https://instagram.com/${"a".repeat(30)}`],
  ])("normaliza %j a %j", (entrada, url) => {
    expect(normalizarPerfilInstagram(entrada)).toEqual({ ok: true, url });
  });

  it("vacío o solo espacios significa sin enlace", () => {
    expect(normalizarPerfilInstagram("")).toEqual({ ok: true, url: "" });
    expect(normalizarPerfilInstagram("   ")).toEqual({ ok: true, url: "" });
  });

  it.each([
    ["esquema javascript:", "javascript:alert(1)"],
    ["javascript: con apariencia de URL de Instagram", "javascript://instagram.com/santi"],
    ["otro dominio", "https://evil.example/santi"],
    ["subdominio engañoso", "https://instagram.com.evil.example/santi"],
    ["dominio que solo contiene instagram", "https://notinstagram.com/santi"],
    ["publicación en vez de perfil", "https://www.instagram.com/p/C0dE123/"],
    ["reel", "https://www.instagram.com/reel/C0dE123"],
    ["ruta con segmentos de más", "instagram.com/santi/tagged"],
    ["ruta reservada de un solo segmento", "instagram.com/explore"],
    ["usuario con caracteres no permitidos", "@santi-ago"],
    ["usuario con espacios", "santi ago"],
    ["usuario de más de 30 caracteres", "a".repeat(31)],
    ["arroba sola", "@"],
    ["dominio sin usuario", "https://instagram.com/"],
    ["esquema ftp", "ftp://instagram.com/santi"],
    ["entrada enorme", `https://instagram.com/santi?${"x".repeat(400)}`],
  ])("rechaza %s", (_motivo, entrada) => {
    expect(normalizarPerfilInstagram(entrada)).toEqual({ ok: false, mensaje: MENSAJE_PERFIL_INSTAGRAM_NO_VALIDO });
  });
});

describe("esUrlPerfilInstagram", () => {
  it.each([
    "https://instagram.com/santi",
    "https://www.instagram.com/santi/",
    "http://instagram.com/santi",
    "https://www.instagram.com/santi?igsh=abc",
  ])("acepta %j (incluidos valores guardados antes de normalizar)", (url) => {
    expect(esUrlPerfilInstagram(url)).toBe(true);
  });

  it.each([
    "",
    "santi",
    "@santi",
    "instagram.com/santi",
    "javascript:alert(1)",
    "https://evil.example/santi",
    "https://www.instagram.com/p/C0dE123/",
    "https://instagram.com/santi/tagged",
  ])("rechaza %j", (url) => {
    expect(esUrlPerfilInstagram(url)).toBe(false);
  });

  it("toda salida válida de normalizarPerfilInstagram se puede pintar", () => {
    for (const entrada of ["@santi", "instagram.com/santi.ago", "https://www.instagram.com/x_y/"]) {
      const resultado = normalizarPerfilInstagram(entrada);
      expect(resultado.ok && esUrlPerfilInstagram(resultado.url)).toBe(true);
    }
  });
});
