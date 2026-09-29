/**
 * Tests de POST /[slug]/api/intenciones con la configuración del reto (FP3c,
 * DT-032): con la sección de intenciones apagada responde 403 sin insertar.
 * `intenciones` no tiene política RLS para anon, así que esta comprobación es
 * la única barrera y debe cubrirse aquí.
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
  quien_camina_foto_url: null,
  created_at: "2026-09-01T00:00:00.000Z",
};

let retoActual: Reto = RETO;
const insertSpy = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (tabla: string) => ({
      insert: (fila: unknown) => {
        insertSpy(tabla, fila);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

vi.mock("@/lib/supabase/retos", () => ({
  obtenerRetoPorSlug: async (slug: string) => (slug === RETO.slug ? retoActual : null),
}));

const { POST } = await import("@/app/[slug]/api/intenciones/route");

const PARAMS = { params: Promise.resolve({ slug: RETO.slug }) };

function peticion(cuerpo: unknown): NextRequest {
  return new NextRequest(`http://localhost/${RETO.slug}/api/intenciones`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

beforeEach(() => {
  reiniciarRateLimit();
  retoActual = RETO;
  insertSpy.mockClear();
});

describe("POST /[slug]/api/intenciones — sección de intenciones", () => {
  it("encendida: guarda la intención del reto y responde 201", async () => {
    const respuesta = await POST(peticion({ texto: "Por mi abuela", nombre: "Ana" }), PARAMS);

    expect(respuesta.status).toBe(201);
    expect(insertSpy).toHaveBeenCalledWith("intenciones", { reto_id: RETO.id, texto: "Por mi abuela", nombre: "Ana" });
  });

  it("apagada: responde 403 sin insertar", async () => {
    retoActual = { ...RETO, seccion_intenciones: false };

    const respuesta = await POST(peticion({ texto: "Por mi abuela" }), PARAMS);

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({ error: "no disponible" });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("apagar otras secciones no afecta a las intenciones", async () => {
    retoActual = { ...RETO, seccion_comentarios: false, seccion_minuto_a_minuto: false };

    const respuesta = await POST(peticion({ texto: "Por mi abuela" }), PARAMS);

    expect(respuesta.status).toBe(201);
  });
});
