/**
 * Página del superadmin (DT-035): verifica la sesión ella misma antes de leer
 * los tokens del GPS, y a cada tarjeta le pasa los datos de SU reto (o null
 * si no tiene token, para ofrecer «Generar»). Se inspecciona el árbol de
 * elementos que devuelve la página, sin renderizarlo.
 */

import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CredencialGps } from "@/lib/supabase/credenciales-gps";
import type { Reto } from "@/lib/types";

class RedireccionSimulada extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

const mocks = vi.hoisted(() => ({
  sesionValida: true,
  listarTodosLosRetos: vi.fn(),
  listarRetosConCredencial: vi.fn(),
  listarCredencialesGps: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "cookie" }) }),
  headers: async () => new Headers({ host: "camino.example" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedireccionSimulada(url);
  },
}));
vi.mock("@/lib/auth/superadmin-session", () => ({
  NOMBRE_COOKIE_SUPERADMIN_SESION: "superadmin_session",
  verificarSesionSuperadmin: () => mocks.sesionValida,
}));
vi.mock("@/lib/supabase/retos", () => ({ listarTodosLosRetos: mocks.listarTodosLosRetos }));
vi.mock("@/lib/supabase/credenciales-admin", () => ({ listarRetosConCredencial: mocks.listarRetosConCredencial }));
vi.mock("@/lib/supabase/credenciales-gps", () => ({ listarCredencialesGps: mocks.listarCredencialesGps }));
vi.mock("@/app/superadmin/(panel)/actions", () => ({
  cerrarSesionSuperadmin: vi.fn(),
  editarReto: vi.fn(),
  eliminarReto: vi.fn(),
  regenerarTokenGpsReto: vi.fn(),
}));

const { default: SuperadminPage } = await import("@/app/superadmin/(panel)/page");

function reto(id: number, slug: string): Reto {
  return {
    id,
    slug,
    nombre: slug,
    descripcion: null,
    ruta_tipo: "libre",
    ruta_id: null,
    activo: true,
    seccion_intenciones: true,
    seccion_comentarios: true,
    seccion_minuto_a_minuto: true,
    seccion_instagram: true,
    respuestas_visitantes: true,
    peregrino_animado: true,
    monigote: "atleti",
    monigote_grito: null,
    monigote_sonido: true,
    quien_camina_foto_url: null,
    created_at: "2026-09-01T00:00:00.000Z",
  };
}

const RETO_CON_TOKEN = reto(1, "santi-ago");
const RETO_SIN_TOKEN = reto(2, "otro-reto");
const CREDENCIAL: CredencialGps = { token: "token-de-santi-ago-0123456789abcdef", actualizadoEn: "2026-09-30T10:00:00.000Z" };

/** Props de cada elemento del árbol que recibe `datosGps` (las tarjetas de reto). */
function propsDeTarjetas(nodo: ReactNode): Record<string, unknown>[] {
  if (Array.isArray(nodo)) return nodo.flatMap(propsDeTarjetas);
  if (!isValidElement<Record<string, unknown> & { children?: ReactNode }>(nodo)) return [];
  const propias = "datosGps" in nodo.props ? [nodo.props] : [];
  return [...propias, ...propsDeTarjetas(nodo.props.children)];
}

async function renderizar() {
  return SuperadminPage({ searchParams: Promise.resolve({}) });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  mocks.sesionValida = true;
  mocks.listarTodosLosRetos.mockReset().mockResolvedValue([RETO_CON_TOKEN, RETO_SIN_TOKEN]);
  mocks.listarRetosConCredencial.mockReset().mockResolvedValue(new Set([1, 2]));
  mocks.listarCredencialesGps.mockReset().mockResolvedValue(new Map([[RETO_CON_TOKEN.id, CREDENCIAL]]));
});

describe("panel superadmin — GPS por reto (DT-035)", () => {
  it("sin sesión redirige al login sin leer ningún token", async () => {
    mocks.sesionValida = false;

    await expect(renderizar()).rejects.toMatchObject({ url: "/superadmin/login" });
    expect(mocks.listarCredencialesGps).not.toHaveBeenCalled();
  });

  it("cada tarjeta recibe la URL con el token de su reto, o null si no tiene", async () => {
    const tarjetas = propsDeTarjetas(await renderizar());
    const porSlug = new Map(tarjetas.map((props) => [(props.reto as Reto).slug, props.datosGps]));

    expect(porSlug.get(RETO_CON_TOKEN.slug)).toMatchObject({
      urlTracker: `https://camino.example/api/track?reto=santi-ago&t=${CREDENCIAL.token}`,
    });
    expect(porSlug.get(RETO_SIN_TOKEN.slug)).toBeNull();
  });
});
