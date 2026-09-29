/**
 * Tests de proxy.ts (actualizados para FP1, DT-026):
 * - /:slug/admin/*: redirección a /admin/login sin sesión válida o con la
 *   sesión de otro reto; acceso y renovación (conservando reto y huella) con
 *   la sesión del reto de la URL, sin consultar BD (DT-010, DT-029).
 * - /:slug/* (rutas públicas): captura de visitas en visitas_web (DT-022) —
 *   genera/reutiliza la cookie de visitante, y un fallo del insert nunca impide
 *   NextResponse.next().
 * - /: pass-through puro sin captura de visita (redirect estático a /portuguesa-110).
 *
 * Mock de lib/supabase/admin: mismo patrón que app/api/track/route.test.ts —
 * builder falso que registra la llamada a `.from("visitas_web").insert(...)`
 * sin tocar red.
 *
 * Mock de lib/supabase/retos: obtenerRetoPorSlug devuelve un reto falso para
 * "portuguesa-110" y null para cualquier otro slug.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { crearSesion, NOMBRE_COOKIE_SESION, verificarSesionEnProxy } from "@/lib/auth/admin-session";

// ---------------------------------------------------------------------------
// Mock de lib/supabase/admin
// ---------------------------------------------------------------------------

const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
let getSupabaseAdminDebeLanzar = false;

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => {
    if (getSupabaseAdminDebeLanzar) {
      throw new Error("Faltan env vars de Supabase");
    }
    return {
      from: vi.fn((tabla: string) => {
        if (tabla === "visitas_web") {
          return { insert: insertSpy };
        }
        throw new Error(`Tabla no mockada: ${tabla}`);
      }),
    };
  }),
}));

// ---------------------------------------------------------------------------
// Mock de lib/supabase/retos
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/retos", () => ({
  obtenerRetoPorSlug: vi.fn(async (slug: string) => {
    if (slug === "portuguesa-110") {
      return { id: 1, slug: "portuguesa-110", ruta_id: "portuguesa-110" };
    }
    return null;
  }),
}));

// Import dinámico posterior al mock (proxy.ts importa getSupabaseAdmin y obtenerRetoPorSlug).
const { proxy, NOMBRE_COOKIE_VISITANTE } = await import("@/proxy");
const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
const { obtenerRetoPorSlug } = await import("@/lib/supabase/retos");

const RETO_PORTUGUESA = { id: 1, slug: "portuguesa-110" };
const HUELLA = "huellaDeTest0001";

beforeEach(() => {
  vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-de-sesion-de-test-largo");
  insertSpy.mockClear();
  vi.mocked(getSupabaseAdmin).mockClear();
  vi.mocked(obtenerRetoPorSlug).mockClear();
  getSupabaseAdminDebeLanzar = false;
});

function peticionA(pathname: string, cookieValor?: string, headers?: Record<string, string>): NextRequest {
  const request = new NextRequest(`http://localhost${pathname}`, { headers });
  if (cookieValor !== undefined) {
    request.cookies.set(NOMBRE_COOKIE_SESION, cookieValor);
  }
  return request;
}

// ---------------------------------------------------------------------------
// /:slug/admin/* (DT-010)
// ---------------------------------------------------------------------------

describe("proxy — /:slug/admin/*", () => {
  it("deja pasar /admin/login sin cookie de sesión", async () => {
    // El login sigue en /admin/login (sin slug): va a proxyPublico, no a proxyAdmin.
    // obtenerRetoPorSlug("admin") devuelve null → sin inserción, pero 200.
    const response = await proxy(peticionA("/admin/login"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirige a /admin/login cuando no hay cookie de sesión", async () => {
    const response = await proxy(peticionA("/portuguesa-110/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/login");
  });

  it("redirige a /admin/login cuando la cookie es inválida (manipulada)", async () => {
    const response = await proxy(peticionA("/portuguesa-110/admin", "cookie.invalida"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/admin/login");
  });

  it("permite el acceso a /portuguesa-110/admin con una cookie de sesión de ese reto", async () => {
    const cookieValida = crearSesion(RETO_PORTUGUESA, HUELLA);
    const response = await proxy(peticionA("/portuguesa-110/admin", cookieValida));
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirige a login con la cookie de otro reto (sesión de A en /b/admin)", async () => {
    const cookieDeOtroReto = crearSesion({ id: 2, slug: "otro-reto" }, HUELLA);
    const response = await proxy(peticionA("/portuguesa-110/admin", cookieDeOtroReto));
    expect(response.status).toBe(307);
    const destino = new URL(response.headers.get("location") ?? "");
    expect(destino.pathname).toBe("/admin/login");
    expect(destino.searchParams.get("returnTo")).toBe("/portuguesa-110/admin");
    expect(response.cookies.get(NOMBRE_COOKIE_SESION)).toBeUndefined();
  });

  it("renueva la cookie conservando reto y huella en cada petición válida a /:slug/admin/*", async () => {
    const hace1Dia = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cookieValida = crearSesion(RETO_PORTUGUESA, HUELLA, hace1Dia);
    const response = await proxy(peticionA("/portuguesa-110/admin/posicion", cookieValida));

    const renovada = response.cookies.get(NOMBRE_COOKIE_SESION)?.value;
    expect(renovada).toBeDefined();
    expect(renovada).not.toBe(cookieValida);
    const payload = verificarSesionEnProxy(renovada, RETO_PORTUGUESA.slug);
    expect(payload).toMatchObject({ r: RETO_PORTUGUESA.id, s: RETO_PORTUGUESA.slug, v: HUELLA });
    expect(payload?.exp).toBeGreaterThan(Date.now() + 6.9 * 24 * 60 * 60 * 1000);
  });

  it("no consulta la BD en la rama admin (ni con sesión válida ni sin ella)", async () => {
    await proxy(peticionA("/portuguesa-110/admin", crearSesion(RETO_PORTUGUESA, HUELLA)));
    await proxy(peticionA("/portuguesa-110/admin"));
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    expect(obtenerRetoPorSlug).not.toHaveBeenCalled();
  });

  it("no inserta ninguna visita al pasar por /:slug/admin/*", async () => {
    await proxy(peticionA("/portuguesa-110/admin/login"));
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// /:slug/* (DT-022 — captura de visitas)
// ---------------------------------------------------------------------------

function peticionPublica(headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/portuguesa-110", { headers });
}

function peticionPublicaConCookieVisitante(visitanteId: string): NextRequest {
  const request = new NextRequest("http://localhost/portuguesa-110");
  request.cookies.set("visitante_id", visitanteId);
  return request;
}

describe("proxy — /:slug/* (captura de visitas)", () => {
  it("responde sin redirigir y sirve la petición normalmente", async () => {
    const response = await proxy(peticionPublica());
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("genera una cookie de visitante nueva cuando no existe y la fija en la respuesta", async () => {
    const response = await proxy(peticionPublica());
    const cookieFijada = response.cookies.get(NOMBRE_COOKIE_VISITANTE);
    expect(cookieFijada).toBeDefined();
    expect(cookieFijada?.value).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reutiliza la cookie de visitante existente en vez de generar una nueva", async () => {
    const visitanteIdExistente = "11111111-1111-4111-8111-111111111111";
    const response = await proxy(peticionPublicaConCookieVisitante(visitanteIdExistente));

    // No hace falta volver a fijarla: ya existía en la petición.
    const cookieFijada = response.cookies.get(NOMBRE_COOKIE_VISITANTE);
    expect(cookieFijada).toBeUndefined();
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ visitante_id: visitanteIdExistente })
    );
  });

  it("inserta la visita con ruta, timestamp, visitante_id y referer", async () => {
    await proxy(peticionPublica({ referer: "https://ejemplo.com/pagina" }));

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ruta: "/portuguesa-110",
        referer: "https://ejemplo.com/pagina",
        visitante_id: expect.any(String),
        ts: expect.any(String),
      })
    );
  });

  it("inserta referer null cuando no viene la cabecera", async () => {
    await proxy(peticionPublica());

    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ referer: null }));
  });

  it("sigue sirviendo la petición (NextResponse.next()) aunque el insert falle", async () => {
    insertSpy.mockRejectedValueOnce(new Error("relation \"visitas_web\" does not exist"));

    const response = await proxy(peticionPublica());

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("sigue sirviendo la petición aunque getSupabaseAdmin() lance (env vars ausentes)", async () => {
    getSupabaseAdminDebeLanzar = true;

    const response = await proxy(peticionPublica());

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// / (raíz — FP1: pass-through puro, el redirect lo hace app/page.tsx)
// ---------------------------------------------------------------------------

describe("proxy — / (pass-through)", () => {
  it("responde sin redirigir ni capturar visita", async () => {
    const response = await proxy(new NextRequest("http://localhost/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
