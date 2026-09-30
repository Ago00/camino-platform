import { describe, expect, it } from "vitest";
import { origenDelTracker, origenDesdeCabeceras, urlTrackerConToken, urlTrackerDelReto } from "@/lib/gps/url-tracker";

describe("urlTrackerDelReto", () => {
  it("usa el parámetro que lee /api/track (reto=) y el origen dado", () => {
    expect(urlTrackerDelReto("https://camino.example", "santi-ago")).toBe(
      "https://camino.example/api/track?reto=santi-ago"
    );
  });

  it("sin origen fiable queda relativa", () => {
    expect(urlTrackerDelReto(null, "santi-ago")).toBe("/api/track?reto=santi-ago");
  });
});

describe("urlTrackerConToken", () => {
  it("añade el token en t=, que es el parámetro que comprueba /api/track", () => {
    expect(urlTrackerConToken("https://camino.example", "santi-ago", "abc123")).toBe(
      "https://camino.example/api/track?reto=santi-ago&t=abc123"
    );
  });

  it("codifica un token con caracteres reservados para que no rompa la query", () => {
    expect(urlTrackerConToken(null, "santi-ago", "a&b=c d+/")).toBe(
      "/api/track?reto=santi-ago&t=a%26b%3Dc%20d%2B%2F"
    );
  });
});

describe("origenDesdeCabeceras", () => {
  it("usa https salvo que el proxy diga http", () => {
    expect(origenDesdeCabeceras("camino.example", null)).toBe("https://camino.example");
    expect(origenDesdeCabeceras("192.168.1.20:3000", "http")).toBe("http://192.168.1.20:3000");
  });

  it.each([null, "", "evil.example/ruta", "host con espacios", "a@b"])("rechaza un host no fiable (%j)", (host) => {
    expect(origenDesdeCabeceras(host, "https")).toBeNull();
  });
});

describe("origenDelTracker", () => {
  it("prefiere el dominio de producción de Vercel y no lo marca como provisional", () => {
    expect(origenDelTracker("camino.vercel.app", "https://preview-123.vercel.app")).toEqual({
      origen: "https://camino.vercel.app",
      provisional: false,
    });
  });

  it("sin dominio de producción usa el de la petición y lo marca como provisional", () => {
    expect(origenDelTracker(undefined, "http://localhost:3000")).toEqual({
      origen: "http://localhost:3000",
      provisional: true,
    });
    expect(origenDelTracker("  ", null)).toEqual({ origen: null, provisional: true });
  });

  it("ignora un dominio de producción mal formado", () => {
    expect(origenDelTracker("https://camino.vercel.app", "https://x.example")).toEqual({
      origen: "https://x.example",
      provisional: true,
    });
  });
});
