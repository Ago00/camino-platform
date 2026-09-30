/**
 * Página de la vista previa del admin (DT-034): exige la sesión del reto,
 * valida `?fase=` y elige entre datos reales y de ejemplo antes de delegar en
 * WebReto con `vistaPrevia`. WebReto se sustituye por un doble y se inspecciona
 * el elemento que devuelve la página.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reto } from "@/lib/types";

class RedireccionSimulada extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

const mocks = vi.hoisted(() => ({
  WebRetoFalso: () => null,
  obtenerIntentoActivo: vi.fn(),
  resolverRetoConSesion: vi.fn(),
  cargarTrazaDeMapa: vi.fn(),
}));

vi.mock("@/components/publico/WebReto", () => ({
  default: mocks.WebRetoFalso,
  obtenerIntentoActivo: mocks.obtenerIntentoActivo,
}));
vi.mock("@/lib/auth/sesion-admin-servidor", () => ({ resolverRetoConSesion: mocks.resolverRetoConSesion }));
vi.mock("@/lib/textos/obtener-textos", () => ({ obtenerTextos: async () => ({ reto_titulo: "Título" }) }));
vi.mock("@/lib/traza/cargar-traza-mapa", () => ({ cargarTrazaDeMapa: mocks.cargarTrazaDeMapa }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedireccionSimulada(url);
  },
}));

const { default: VistaPreviaPage, metadata } = await import("@/app/[slug]/admin/vista-previa/page");

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
  quien_camina_foto_url: null,
  created_at: "2026-09-01T00:00:00.000Z",
};
const TRAZA: [number, number][] = [
  [-8.6, 42.1],
  [-8.5, 42.2],
  [-8.4, 42.3],
];

async function renderizar(query: Record<string, string | undefined> = {}) {
  const elemento = await VistaPreviaPage({
    params: Promise.resolve({ slug: RETO.slug }),
    searchParams: Promise.resolve(query),
  });
  return elemento;
}

beforeEach(() => {
  mocks.resolverRetoConSesion.mockReset().mockResolvedValue(RETO);
  mocks.obtenerIntentoActivo.mockReset().mockResolvedValue(null);
  mocks.cargarTrazaDeMapa.mockReset().mockReturnValue(TRAZA);
});

describe("vista previa — acceso", () => {
  it("sin sesión válida del reto redirige al login del panel sin cargar nada", async () => {
    mocks.resolverRetoConSesion.mockResolvedValue(null);

    await expect(renderizar({ fase: "durante" })).rejects.toMatchObject({
      url: `/admin/login?returnTo=/${RETO.slug}/admin`,
    });
    expect(mocks.resolverRetoConSesion).toHaveBeenCalledWith(RETO.slug);
    expect(mocks.obtenerIntentoActivo).not.toHaveBeenCalled();
  });

  it("no se indexa", () => {
    expect(metadata).toEqual({ robots: { index: false, follow: false } });
  });
});

describe("vista previa — fase y fuente de datos", () => {
  it("pinta WebReto con vistaPrevia activa", async () => {
    const elemento = await renderizar({ fase: "antes" });

    expect(elemento.type).toBe(mocks.WebRetoFalso);
    expect(elemento.props).toMatchObject({ reto: RETO, vistaPrevia: true, trazaCoords: TRAZA });
  });

  it.each([undefined, "", "despues", "LLEGADA", "<script>"])("una fase inválida (%j) cae a 'antes'", async (fase) => {
    const elemento = await renderizar({ fase });

    expect(elemento.props).toMatchObject({ fase: "antes", fuente: { tipo: "real", intento: null } });
  });

  it("si el reto está en la fase elegida usa los datos reales del intento", async () => {
    const intento = { id: 9, fase: "durante", modo: "guiado" };
    mocks.obtenerIntentoActivo.mockResolvedValue(intento);

    const elemento = await renderizar({ fase: "durante" });

    expect(elemento.props).toMatchObject({ fase: "durante", fuente: { tipo: "real", intento } });
  });

  it("si el reto está en otra fase usa datos de ejemplo con el modo del intento", async () => {
    mocks.obtenerIntentoActivo.mockResolvedValue({ id: 9, fase: "antes", modo: "libre" });

    const elemento = await renderizar({ fase: "llegada" });

    expect(elemento.props.fase).toBe("llegada");
    expect(elemento.props.fuente).toMatchObject({ tipo: "ejemplo", datos: { modo: "libre" } });
  });

  it("sin intento, 'durante' sale con datos de ejemplo guiados sobre la traza del reto", async () => {
    const elemento = await renderizar({ fase: "durante" });

    expect(elemento.props.fuente).toMatchObject({
      tipo: "ejemplo",
      datos: { modo: "guiado", progreso: { modo: "guiado", porcentaje: 42 } },
    });
  });

  it("un reto sin ruta se previsualiza en modo libre y sin traza", async () => {
    mocks.resolverRetoConSesion.mockResolvedValue({ ...RETO, ruta_tipo: "libre", ruta_id: null });

    const elemento = await renderizar({ fase: "durante" });

    expect(mocks.cargarTrazaDeMapa).not.toHaveBeenCalled();
    expect(elemento.props.trazaCoords).toEqual([]);
    expect(elemento.props.fuente).toMatchObject({ tipo: "ejemplo", datos: { modo: "libre" } });
  });
});
