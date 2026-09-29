/**
 * Tests de integración de POST /api/superadmin/login.
 *
 * Espeja `app/api/admin/login/route.test.ts` con los ajustes pertinentes:
 * lee SUPERADMIN_PASSWORD, fija superadmin_session.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/superadmin/login/route";
import { NOMBRE_COOKIE_SUPERADMIN_SESION, verificarSesionSuperadmin } from "@/lib/auth/superadmin-session";
import { reiniciarRateLimit } from "@/lib/rate-limit";

const PASSWORD_TEST = "contraseña-superadmin-de-test";

function crearPeticion(body: unknown, ip = "203.0.113.1"): NextRequest {
  return new NextRequest("http://localhost/api/superadmin/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  vi.stubEnv("SUPERADMIN_PASSWORD", PASSWORD_TEST);
  vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-de-sesion-de-test-largo");
  reiniciarRateLimit();
});

describe("POST /api/superadmin/login", () => {
  it("responde 200 y fija una cookie de sesión válida con la contraseña correcta", async () => {
    const response = await POST(crearPeticion({ password: PASSWORD_TEST }));

    expect(response.status).toBe(200);
    const cookie = response.cookies.get(NOMBRE_COOKIE_SUPERADMIN_SESION);
    expect(cookie).toBeDefined();
    expect(verificarSesionSuperadmin(cookie?.value)).toBe(true);
  });

  it("la cookie fijada es HttpOnly", async () => {
    const response = await POST(crearPeticion({ password: PASSWORD_TEST }));
    const cookie = response.cookies.get(NOMBRE_COOKIE_SUPERADMIN_SESION);
    expect(cookie?.httpOnly).toBe(true);
  });

  it("responde 401 sin fijar cookie cuando la contraseña es incorrecta", async () => {
    const response = await POST(crearPeticion({ password: "contraseña-incorrecta" }));

    expect(response.status).toBe(401);
    expect(response.cookies.get(NOMBRE_COOKIE_SUPERADMIN_SESION)).toBeUndefined();
  });

  it("responde 401 cuando la contraseña recibida tiene distinta longitud que la esperada", async () => {
    const response = await POST(crearPeticion({ password: "x" }));
    expect(response.status).toBe(401);
  });

  it("responde 400 cuando el body no trae password", async () => {
    const response = await POST(crearPeticion({}));
    expect(response.status).toBe(400);
  });

  it("responde 400 cuando el body es JSON malformado", async () => {
    const request = new NextRequest("http://localhost/api/superadmin/login", {
      method: "POST",
      body: "{ esto no es json",
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("responde 401 sin distinguir el motivo cuando SUPERADMIN_PASSWORD no está configurada", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-de-sesion-de-test-largo");
    const response = await POST(crearPeticion({ password: PASSWORD_TEST }));
    expect(response.status).toBe(401);
  });

  it("no fija la cookie admin_session, solo superadmin_session", async () => {
    const response = await POST(crearPeticion({ password: PASSWORD_TEST }));
    expect(response.cookies.get("admin_session")).toBeUndefined();
    expect(response.cookies.get(NOMBRE_COOKIE_SUPERADMIN_SESION)).toBeDefined();
  });
});

describe("POST /api/superadmin/login — rate limiting por IP (DT-011)", () => {
  it("responde 429 al superar 10 intentos en 15 minutos desde la misma IP, incluso con la contraseña correcta", async () => {
    const ip = "198.51.100.30";

    for (let i = 0; i < 10; i++) {
      const response = await POST(crearPeticion({ password: "contraseña-incorrecta" }, ip));
      expect(response.status).toBe(401);
    }

    const response = await POST(crearPeticion({ password: PASSWORD_TEST }, ip));
    expect(response.status).toBe(429);
  });

  it("no limita a una IP distinta aunque otra haya agotado su cupo de intentos", async () => {
    const ipBloqueada = "198.51.100.30";
    for (let i = 0; i < 10; i++) {
      await POST(crearPeticion({ password: "contraseña-incorrecta" }, ipBloqueada));
    }

    const response = await POST(crearPeticion({ password: PASSWORD_TEST }, "198.51.100.31"));
    expect(response.status).toBe(200);
  });
});
