/**
 * WebReto monta el monigote del reto (DT-036) solo si tiene uno, también en
 * la vista previa, y su elección entra en la huella que vigila la web abierta.
 * Los componentes cliente se sustituyen por dobles y se recorre el árbol de
 * elementos que devuelve WebReto (fase "antes": sin I/O).
 */

import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Reto } from "@/lib/types";
import { TEXTOS_POR_DEFECTO } from "@/lib/textos/defaults";
import { configDelReto } from "@/lib/retos/config";

const dobles = vi.hoisted(() => ({
  MonigoteWeb: () => null,
  RefrescoAlCambiarFase: () => null,
  ModoAntes: () => null,
}));

vi.mock("@/components/publico/MonigoteWeb", () => ({ default: dobles.MonigoteWeb }));
vi.mock("@/components/publico/RefrescoAlCambiarFase", () => ({ default: dobles.RefrescoAlCambiarFase }));
vi.mock("@/components/publico/ModoAntes", () => ({ default: dobles.ModoAntes }));
vi.mock("@/components/publico/ModoDurante", () => ({ default: () => null }));
vi.mock("@/components/publico/ModoDuranteLibre", () => ({ default: () => null }));
vi.mock("@/components/publico/ModoLlegada", () => ({ default: () => null }));
vi.mock("@/components/publico/ModoLlegadaLibre", () => ({ default: () => null }));

const { default: WebReto } = await import("@/components/publico/WebReto");

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
  monigote: "pulpo",
  monigote_grito: "¡Á feira, xa!",
  monigote_sonido: false,
  quien_camina_foto_url: null,
  created_at: "2026-09-01T00:00:00.000Z",
};

function renderizar(reto: Reto, vistaPrevia = false): ReactNode {
  return WebReto({
    reto,
    config: configDelReto(reto),
    textos: TEXTOS_POR_DEFECTO,
    trazaCoords: [],
    fase: "antes",
    fuente: { tipo: "real", intento: null },
    vistaPrevia,
  });
}

/** Props de los elementos del árbol cuyo tipo es `tipo` (sin renderizar componentes). */
function buscar(nodo: ReactNode, tipo: unknown): Record<string, unknown>[] {
  if (Array.isArray(nodo)) return nodo.flatMap((hijo) => buscar(hijo, tipo));
  if (!isValidElement<Record<string, unknown> & { children?: ReactNode }>(nodo)) return [];
  const propio = nodo.type === tipo ? [nodo.props] : [];
  return [...propio, ...buscar(nodo.props.children, tipo)];
}

describe("WebReto — monigote del reto (DT-036)", () => {
  it("con monigote monta MonigoteWeb con su id, grito y sonido", () => {
    expect(buscar(renderizar(RETO), dobles.MonigoteWeb)).toEqual([
      { id: "pulpo", grito: "¡Á feira, xa!", sonido: false },
    ]);
  });

  it("sin monigote (null) no monta MonigoteWeb aunque peregrino_animado siga a true", () => {
    expect(buscar(renderizar({ ...RETO, monigote: null }), dobles.MonigoteWeb)).toEqual([]);
  });

  it("con un id fuera del catálogo no monta nada", () => {
    expect(buscar(renderizar({ ...RETO, monigote: "dragon" }), dobles.MonigoteWeb)).toEqual([]);
  });

  it("también aparece en la vista previa del admin", () => {
    expect(buscar(renderizar(RETO, true), dobles.MonigoteWeb)).toHaveLength(1);
  });

  it("la vista previa no monta RefrescoAlCambiarFase (recargaría el iframe sin parar, DT-034)", () => {
    expect(buscar(renderizar(RETO, true), dobles.RefrescoAlCambiarFase)).toEqual([]);
    expect(buscar(renderizar(RETO, false), dobles.RefrescoAlCambiarFase)).toHaveLength(1);
  });

  it("cambiar de monigote cambia la huella que vigila la web abierta", () => {
    const [refrescoPulpo] = buscar(renderizar(RETO), dobles.RefrescoAlCambiarFase);
    const [refrescoVaca] = buscar(renderizar({ ...RETO, monigote: "vaca" }), dobles.RefrescoAlCambiarFase);
    expect(refrescoPulpo.huellaActual).toEqual(expect.any(String));
    expect(refrescoVaca.huellaActual).not.toBe(refrescoPulpo.huellaActual);
  });
});
