/**
 * Pestaña GPS del admin (DT-035): solo con la sesión de ESTE reto se lee el
 * token y se envían al navegador la URL y el QR. `ConfigGps` se sustituye por
 * un doble y se inspeccionan las props del elemento que devuelve la sección;
 * la preparación de la URL, el enlace y el QR es la real.
 */

import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CredencialGps } from "@/lib/supabase/credenciales-gps";
import type { Reto } from "@/lib/types";

const TOKEN = "token-secreto-del-reto-0123456789abcdef";

const mocks = vi.hoisted(() => ({
  ConfigGpsFalso: () => null,
  resolverRetoConSesion: vi.fn(),
  obtenerTokenGps: vi.fn(),
  regenerarTokenGps: vi.fn(),
}));

vi.mock("@/components/gps/ConfigGps", () => ({ default: mocks.ConfigGpsFalso }));
vi.mock("@/lib/auth/sesion-admin-servidor", () => ({ resolverRetoConSesion: mocks.resolverRetoConSesion }));
vi.mock("@/lib/supabase/credenciales-gps", () => ({ obtenerTokenGps: mocks.obtenerTokenGps }));
vi.mock("@/app/[slug]/admin/actions", () => ({ regenerarTokenGps: mocks.regenerarTokenGps }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "camino.example" }),
}));

const { default: SeccionGps } = await import("@/components/admin/SeccionGps");

const RETO: Reto = {
  id: 3,
  slug: "santi-ago",
  nombre: "Santi",
  descripcion: null,
  ruta_tipo: "predefinida",
  ruta_id: "portuguesa-110",
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
const CREDENCIAL: CredencialGps = { token: TOKEN, actualizadoEn: "2026-09-30T10:00:00.000Z" };

function buscarElemento(nodo: ReactNode, tipo: unknown): ReactElement<Record<string, unknown>> | null {
  if (!isValidElement<{ children?: ReactNode }>(nodo)) return null;
  if (nodo.type === tipo) return nodo as ReactElement<Record<string, unknown>>;
  const hijos = nodo.props.children;
  for (const hijo of Array.isArray(hijos) ? hijos : [hijos]) {
    const encontrado = buscarElemento(hijo, tipo);
    if (encontrado) return encontrado;
  }
  return null;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  mocks.resolverRetoConSesion.mockReset().mockResolvedValue(RETO);
  mocks.obtenerTokenGps.mockReset().mockResolvedValue(CREDENCIAL);
});

describe("SeccionGps — acceso", () => {
  it("sin sesión del reto no lee el token ni devuelve nada", async () => {
    mocks.resolverRetoConSesion.mockResolvedValue(null);

    const elemento = await SeccionGps({ reto: RETO });

    expect(elemento).toBeNull();
    expect(mocks.obtenerTokenGps).not.toHaveBeenCalled();
  });

  it("con la sesión de otro reto (id distinto) tampoco lo lee", async () => {
    mocks.resolverRetoConSesion.mockResolvedValue({ ...RETO, id: 99 });

    const elemento = await SeccionGps({ reto: RETO });

    expect(elemento).toBeNull();
    expect(mocks.obtenerTokenGps).not.toHaveBeenCalled();
  });
});

describe("SeccionGps — con sesión", () => {
  it("pasa a ConfigGps la URL con el token del reto, el enlace de OwnTracks y el QR", async () => {
    const elemento = await SeccionGps({ reto: RETO });
    const config = buscarElemento(elemento, mocks.ConfigGpsFalso);

    expect(mocks.obtenerTokenGps).toHaveBeenCalledWith(RETO.id);
    expect(config?.props.datos).toMatchObject({
      urlSinToken: "https://camino.example/api/track?reto=santi-ago",
      urlTracker: `https://camino.example/api/track?reto=santi-ago&t=${TOKEN}`,
      enlaceOwnTracks: expect.stringMatching(/^owntracks:\/\/\/config\?inline=/),
      qrDataUrl: expect.stringMatching(/^data:image\/svg\+xml;base64,/),
      fechaActualizacion: CREDENCIAL.actualizadoEn,
      origenProvisional: true,
    });
  });

  it("sin token pasa datos null para que se ofrezca «Generar»", async () => {
    mocks.obtenerTokenGps.mockResolvedValue(null);

    const elemento = await SeccionGps({ reto: RETO });

    expect(buscarElemento(elemento, mocks.ConfigGpsFalso)?.props.datos).toBeNull();
  });
});
