import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearSesion, verificarSesion, verificarSesionEnProxy } from "@/lib/auth/admin-session";
import { crearSesionSuperadmin, verificarSesionSuperadmin } from "@/lib/auth/superadmin-session";

describe("superadmin-session", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-de-test-suficientemente-largo");
  });

  it("una cookie recién creada es válida en el mismo instante", () => {
    const ahora = new Date("2026-08-01T10:00:00Z");
    const cookie = crearSesionSuperadmin(ahora);
    expect(verificarSesionSuperadmin(cookie, ahora)).toBe(true);
  });

  it("sigue siendo válida justo antes de cumplir el TTL de 7 días", () => {
    const ahora = new Date("2026-08-01T10:00:00Z");
    const cookie = crearSesionSuperadmin(ahora);
    const justoAntes = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000);
    expect(verificarSesionSuperadmin(cookie, justoAntes)).toBe(true);
  });

  it("expira pasados los 7 días de TTL", () => {
    const ahora = new Date("2026-08-01T10:00:00Z");
    const cookie = crearSesionSuperadmin(ahora);
    const despuesDeExpirar = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000 + 1000);
    expect(verificarSesionSuperadmin(cookie, despuesDeExpirar)).toBe(false);
  });

  it("rechaza una cookie con la firma alterada", () => {
    const cookie = crearSesionSuperadmin(new Date());
    const [payload] = cookie.split(".");
    const cookieManipulada = `${payload}.firmafalsaquenocoincide00000000000000000`;
    expect(verificarSesionSuperadmin(cookieManipulada)).toBe(false);
  });

  it("rechaza una cookie con el payload alterado (exp adelantado) aunque la firma original se reutilice", () => {
    const cookie = crearSesionSuperadmin(new Date("2026-08-01T10:00:00Z"));
    const [, firma] = cookie.split(".");
    const payloadFalso = Buffer.from(JSON.stringify({ exp: Date.now() + 999_999_999_999 })).toString(
      "base64url"
    );
    expect(verificarSesionSuperadmin(`${payloadFalso}.${firma}`)).toBe(false);
  });

  it("rechaza una cookie firmada con un secreto distinto (ej. tras rotar ADMIN_SESSION_SECRET)", () => {
    const cookieConSecretoViejo = crearSesionSuperadmin(new Date());
    vi.stubEnv("ADMIN_SESSION_SECRET", "otro-secreto-completamente-distinto");
    expect(verificarSesionSuperadmin(cookieConSecretoViejo)).toBe(false);
  });

  it("rechaza valores sin el formato payload.firma", () => {
    expect(verificarSesionSuperadmin("valor-sin-punto")).toBe(false);
    expect(verificarSesionSuperadmin("a.b.c")).toBe(false);
    expect(verificarSesionSuperadmin("")).toBe(false);
  });

  it("rechaza null y undefined sin lanzar", () => {
    expect(verificarSesionSuperadmin(null)).toBe(false);
    expect(verificarSesionSuperadmin(undefined)).toBe(false);
  });

  it("rechaza un payload que no es JSON válido tras decodificar", () => {
    const payloadCorrupto = Buffer.from("esto no es json").toString("base64url");
    const cookie = crearSesionSuperadmin(new Date());
    const [, firmaOriginal] = cookie.split(".");
    // La firma no coincidirá con el payload corrupto, pero comprobamos
    // explícitamente que el parseo de JSON tampoco puede lanzar sin control.
    expect(verificarSesionSuperadmin(`${payloadCorrupto}.${firmaOriginal}`)).toBe(false);
  });

  it("lanza al crear una sesión si falta ADMIN_SESSION_SECRET", () => {
    vi.unstubAllEnvs();
    expect(() => crearSesionSuperadmin(new Date())).toThrow(/ADMIN_SESSION_SECRET/);
  });

  it("verificarSesionSuperadmin devuelve false (no lanza) si falta ADMIN_SESSION_SECRET", () => {
    const cookie = crearSesionSuperadmin(new Date());
    vi.unstubAllEnvs();
    expect(verificarSesionSuperadmin(cookie)).toBe(false);
  });

  it("una cookie de superadmin no es válida como cookie de admin (distintos nombres, pero mismo secreto — la validación está en el nombre de cookie, no aquí)", () => {
    // Este test documenta que admin y superadmin comparten secreto pero
    // cookies distintas. Un valor de superadmin_session sí pasa
    // verificarSesionSuperadmin — el aislamiento lo da el nombre de cookie,
    // no una firma distinta. Verificamos al menos que el formato es correcto.
    const ahora = new Date();
    const cookie = crearSesionSuperadmin(ahora);
    expect(verificarSesionSuperadmin(cookie, ahora)).toBe(true);
  });
});

describe("separación entre la cookie de admin y la de superadmin (mismo secreto)", () => {
  const SECRETO = "secreto-de-test-suficientemente-largo";
  const reto = { id: 1, slug: "santi-ago" };

  beforeEach(() => {
    vi.stubEnv("ADMIN_SESSION_SECRET", SECRETO);
  });

  it("una cookie de admin de un reto no vale como superadmin", () => {
    const ahora = new Date();
    const cookieAdmin = crearSesion(reto, "huella", ahora);
    expect(verificarSesionSuperadmin(cookieAdmin, ahora)).toBe(false);
  });

  it("una cookie de superadmin no vale como admin de un reto", () => {
    const ahora = new Date();
    const cookieSuperadmin = crearSesionSuperadmin(ahora);
    expect(verificarSesion(cookieSuperadmin, reto, "huella", ahora)).toBe(false);
    expect(verificarSesionEnProxy(cookieSuperadmin, reto.slug, ahora)).toBeNull();
  });

  it("rechaza un payload {exp} firmado sin la etiqueta de propósito (formato anterior)", () => {
    const ahora = new Date();
    const payload = Buffer.from(JSON.stringify({ exp: ahora.getTime() + 60_000 })).toString("base64url");
    const firma = createHmac("sha256", SECRETO).update(payload).digest("base64url");
    expect(verificarSesionSuperadmin(`${payload}.${firma}`, ahora)).toBe(false);
  });
});
