/**
 * Tests de GET /[slug]/api/minuto-a-minuto con la configuración del reto
 * (FP3c, DT-032): con la sección apagada responde 403 sin consultar el feed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { reiniciarRateLimit } from "@/lib/rate-limit";
import type { Reto } from "@/lib/types";

const RETO: Reto = {
  id: 3,
  slug: "reto-de-prueba",
  nombre: "Reto de prueba",
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

let retoActual: Reto = RETO;
let tablasConsultadas: string[] = [];

/** Builder encadenable: sin intento activo, el feed resuelve vacío. */
function crearConsulta(tabla: string) {
  tablasConsultadas.push(tabla);
  const consulta: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "gt", "order", "range", "limit"]) {
    consulta[metodo] = () => consulta;
  }
  consulta.maybeSingle = () => Promise.resolve({ data: null, error: null });
  return consulta;
}

vi.mock("@/lib/supabase/public", () => ({
  getSupabasePublic: () => ({ from: (tabla: string) => crearConsulta(tabla) }),
}));

vi.mock("@/lib/supabase/retos", () => ({
  obtenerRetoPorSlug: async (slug: string) => (slug === RETO.slug ? retoActual : null),
}));

const { GET } = await import("@/app/[slug]/api/minuto-a-minuto/route");

const PARAMS = { params: Promise.resolve({ slug: RETO.slug }) };

function peticion(query = ""): NextRequest {
  return new NextRequest(`http://localhost/${RETO.slug}/api/minuto-a-minuto${query}`);
}

beforeEach(() => {
  reiniciarRateLimit();
  retoActual = RETO;
  tablasConsultadas = [];
});

describe("GET /[slug]/api/minuto-a-minuto — sección minuto a minuto", () => {
  it("apagada: responde 403 sin consultar la BD", async () => {
    retoActual = { ...RETO, seccion_minuto_a_minuto: false };

    const respuesta = await GET(peticion(), PARAMS);

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({ error: "no disponible" });
    expect(tablasConsultadas).toEqual([]);
  });

  it("apagada: el poll incremental también responde 403", async () => {
    retoActual = { ...RETO, seccion_minuto_a_minuto: false };

    expect((await GET(peticion("?despuesDeId=0"), PARAMS)).status).toBe(403);
  });

  it("encendida: sirve el feed (vacío sin intento activo)", async () => {
    const respuesta = await GET(peticion(), PARAMS);

    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ entradas: [], siguienteOffset: null });
    expect(tablasConsultadas).toEqual(["intentos"]);
  });
});
