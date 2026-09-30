import { describe, expect, it } from "vitest";
import { urlTrackerConToken, urlTrackerDelReto } from "@/lib/superadmin/url-tracker";

describe("urlTrackerDelReto", () => {
  it("usa el parámetro que lee /api/track (reto=) y el origen de la petición", () => {
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
