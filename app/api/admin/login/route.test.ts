/**
 * Tests de integración de POST /api/admin/login (FP2.6, DT-029): contraseña
 * por reto, respuestas indistinguibles ante reto inexistente / sin contraseña
 * / contraseña errónea, cookie ligada al reto y rate limiting.
 *
 * Retos y credenciales se mockean (sin red); el hash es un scrypt real y la
 * cookie se verifica con `verificarSesion` real.
 *
 * El rate limiting (DT-011) agrupa por IP; cada test usa su propia IP y se
 * resetea el limitador para no interferir entre tests.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Reto } from "@/lib/types";

const PASSWORD_TEST = "contraseña-secreta-de-test";

function retoFalso(id: number, slug: string): Reto {
  return {
    id,
    slug,
    nombre: slug,
    descripcion: null,
    ruta_tipo: "libre",
    ruta_id: null,
    activo: true,
    created_at: "2026-09-01T00:00:00.000Z",
  };
}

const RETO_CON_PASSWORD = retoFalso(1, "reto-a");
const RETO_SIN_PASSWORD = retoFalso(2, "reto-sin-password");
const RETOS_POR_SLUG = new Map([RETO_CON_PASSWORD, RETO_SIN_PASSWORD].map((r) => [r.slug, r]));

let hashesPorReto = new Map<number, string>();

vi.mock("@/lib/supabase/retos", () => ({
  obtenerRetoPorSlug: vi.fn(async (slug: string) => RETOS_POR_SLUG.get(slug) ?? null),
}));

vi.mock("@/lib/supabase/credenciales-admin", () => ({
  obtenerHashAdmin: vi.fn(async (retoId: number) => hashesPorReto.get(retoId) ?? null),
}));

const { POST } = await import("@/app/api/admin/login/route");
const { NOMBRE_COOKIE_SESION, verificarSesion } = await import("@/lib/auth/admin-session");
const { hashearPassword, huellaCredencial } = await import("@/lib/auth/password");
const { reiniciarRateLimit } = await import("@/lib/rate-limit");

let hashRetoA = "";

function crearPeticion(body: unknown, ip = "203.0.113.1"): NextRequest {
  return new NextRequest("http://localhost/api/admin/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });
}

beforeAll(async () => {
  hashRetoA = await hashearPassword(PASSWORD_TEST);
});

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-de-sesion-de-test-largo");
  hashesPorReto = new Map([[RETO_CON_PASSWORD.id, hashRetoA]]);
  reiniciarRateLimit();
});

describe("POST /api/admin/login — contraseña por reto", () => {
  it("con la contraseña correcta responde 200 y fija una cookie HttpOnly válida solo para ese reto", async () => {
    const response = await POST(crearPeticion({ slug: RETO_CON_PASSWORD.slug, password: PASSWORD_TEST }));

    expect(response.status).toBe(200);
    const cookie = response.cookies.get(NOMBRE_COOKIE_SESION);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.secure).toBe(true);
    const huella = huellaCredencial(hashRetoA);
    expect(verificarSesion(cookie?.value, RETO_CON_PASSWORD, huella)).toBe(true);
    expect(verificarSesion(cookie?.value, RETO_SIN_PASSWORD, huella)).toBe(false);
  });

  it("slug inexistente, reto sin contraseña y contraseña errónea responden el mismo 401 con el mismo cuerpo y sin cookie", async () => {
    const casos = [
      { slug: "reto-que-no-existe", password: PASSWORD_TEST },
      { slug: RETO_SIN_PASSWORD.slug, password: PASSWORD_TEST },
      { slug: RETO_CON_PASSWORD.slug, password: "contraseña-incorrecta" },
    ];

    const respuestas = await Promise.all(casos.map((cuerpo, i) => POST(crearPeticion(cuerpo, `203.0.113.${10 + i}`))));

    for (const response of respuestas) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "credenciales incorrectas" });
      expect(response.cookies.get(NOMBRE_COOKIE_SESION)).toBeUndefined();
    }
  });

  it("ignora ADMIN_PASSWORD: con la env var definida pero el reto sin contraseña, responde 401", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD_TEST);

    const response = await POST(crearPeticion({ slug: RETO_SIN_PASSWORD.slug, password: PASSWORD_TEST }));

    expect(response.status).toBe(401);
    expect(response.cookies.get(NOMBRE_COOKIE_SESION)).toBeUndefined();
  });

  it("la contraseña de un reto no abre el panel de otro reto", async () => {
    hashesPorReto.set(RETO_SIN_PASSWORD.id, await hashearPassword("otra-contraseña-distinta"));

    const response = await POST(crearPeticion({ slug: RETO_SIN_PASSWORD.slug, password: PASSWORD_TEST }));

    expect(response.status).toBe(401);
  });

  it("responde 400 sin slug, con slug mal formado o sin password", async () => {
    const cuerposInvalidos = [
      { password: PASSWORD_TEST },
      { slug: "Reto A", password: PASSWORD_TEST },
      { slug: "a".repeat(61), password: PASSWORD_TEST },
      { slug: RETO_CON_PASSWORD.slug },
      { slug: RETO_CON_PASSWORD.slug, password: "" },
      { slug: RETO_CON_PASSWORD.slug, password: "x".repeat(201) },
    ];
    for (const cuerpo of cuerposInvalidos) {
      const response = await POST(crearPeticion(cuerpo));
      expect(response.status).toBe(400);
    }
  });

  it("responde 400 cuando el body es JSON malformado", async () => {
    const request = new NextRequest("http://localhost/api/admin/login", {
      method: "POST",
      body: "{ esto no es json",
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe("POST /api/admin/login — rate limiting por IP (DT-011)", () => {
  it("responde 429 al superar 10 intentos en 15 minutos desde la misma IP, incluso con la contraseña correcta", async () => {
    const ip = "198.51.100.20";

    for (let i = 0; i < 10; i++) {
      const response = await POST(crearPeticion({ slug: RETO_CON_PASSWORD.slug, password: "incorrecta" }, ip));
      expect(response.status).toBe(401);
    }

    const response = await POST(crearPeticion({ slug: RETO_CON_PASSWORD.slug, password: PASSWORD_TEST }, ip));
    expect(response.status).toBe(429);
  });

  it("no limita a una IP distinta aunque otra haya agotado su cupo de intentos", async () => {
    const ipBloqueada = "198.51.100.20";
    for (let i = 0; i < 10; i++) {
      await POST(crearPeticion({ slug: RETO_CON_PASSWORD.slug, password: "incorrecta" }, ipBloqueada));
    }

    const response = await POST(crearPeticion({ slug: RETO_CON_PASSWORD.slug, password: PASSWORD_TEST }, "198.51.100.21"));
    expect(response.status).toBe(200);
  });
});
