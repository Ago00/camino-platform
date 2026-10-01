/**
 * La web pública delega toda la composición en WebReto (DT-034), compartida
 * con la vista previa del admin: si alguien vuelve a componer aquí, la vista
 * previa dejaría de enseñar lo mismo que ve el visitante. WebReto se sustituye
 * por un doble y se inspecciona el elemento que devuelve la página.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reto } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  WebRetoFalso: () => null,
  obtenerIntentoActivo: vi.fn(),
  obtenerRetoPorSlug: vi.fn(),
  cargarTrazaDeMapa: vi.fn(),
}));

vi.mock("@/components/publico/WebReto", () => ({
  default: mocks.WebRetoFalso,
  obtenerIntentoActivo: mocks.obtenerIntentoActivo,
}));
vi.mock("@/lib/supabase/retos", () => ({ obtenerRetoPorSlug: mocks.obtenerRetoPorSlug }));
vi.mock("@/lib/textos/obtener-textos", () => ({ obtenerTextos: async () => ({ reto_titulo: "Título" }) }));
vi.mock("@/lib/traza/cargar-traza-mapa", () => ({ cargarTrazaDeMapa: mocks.cargarTrazaDeMapa }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: SlugPage } = await import("@/app/[slug]/page");

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
  peregrino_animado: false,
  monigote: null,
  monigote_grito: null,
  monigote_sonido: true,
  quien_camina_foto_url: null,
  created_at: "2026-09-01T00:00:00.000Z",
};
const TRAZA: [number, number][] = [
  [-8.6, 42.1],
  [-8.5, 42.2],
];

async function renderizar(slug = RETO.slug) {
  const elemento = await SlugPage({ params: Promise.resolve({ slug }) });
  return elemento;
}

beforeEach(() => {
  mocks.obtenerRetoPorSlug.mockReset().mockResolvedValue(RETO);
  mocks.obtenerIntentoActivo.mockReset().mockResolvedValue(null);
  mocks.cargarTrazaDeMapa.mockReset().mockReturnValue(TRAZA);
});

describe("app/[slug]/page — usa WebReto (DT-034)", () => {
  it("sin intento activo pinta WebReto en 'antes', con datos reales y sin vista previa", async () => {
    const elemento = await renderizar();

    expect(elemento.type).toBe(mocks.WebRetoFalso);
    expect(elemento.props).toMatchObject({
      reto: RETO,
      fase: "antes",
      fuente: { tipo: "real", intento: null },
      vistaPrevia: false,
      trazaCoords: TRAZA,
      textos: { reto_titulo: "Título" },
    });
    // El monigote (DT-036) lo lee WebReto del propio reto: ya no viaja en la configuración.
    expect(elemento.props.config).not.toHaveProperty("peregrino_animado");
  });

  it("con intento activo usa su fase y le pasa el intento", async () => {
    const intento = { id: 9, fase: "durante", modo: "guiado" };
    mocks.obtenerIntentoActivo.mockResolvedValue(intento);

    const elemento = await renderizar();

    expect(mocks.obtenerIntentoActivo).toHaveBeenCalledWith(RETO.id);
    expect(elemento.props).toMatchObject({ fase: "durante", fuente: { tipo: "real", intento } });
  });

  it("un reto sin ruta no carga traza de mapa", async () => {
    mocks.obtenerRetoPorSlug.mockResolvedValue({ ...RETO, ruta_tipo: "libre", ruta_id: null });

    const elemento = await renderizar();

    expect(mocks.cargarTrazaDeMapa).not.toHaveBeenCalled();
    expect(elemento.props.trazaCoords).toEqual([]);
  });

  it("reto inexistente ⇒ notFound", async () => {
    mocks.obtenerRetoPorSlug.mockResolvedValue(null);

    await expect(renderizar("no-existe")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
