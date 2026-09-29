/**
 * Tests de la caché compartida de `ProgresoPublico` (DT-014). Cubre el
 * contrato que consumen tanto `GET /api/progreso` (TTL) como
 * `crearMinutoAMinuto` (lectura del valor sin comprobar TTL).
 *
 * `ProgresoPublico` es una unión discriminada por `modo` desde DT-016 — la
 * caché es genérica sobre la unión completa, así que se prueba con ambas
 * ramas (guiado/libre) para no acoplar el módulo compartido a una sola.
 *
 * Desde FP2.5 (DT-028) hay una entrada por reto: se cubre que un reto nunca
 * lee ni invalida la entrada de otro.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  CACHE_TTL_MS,
  guardarCacheProgreso,
  limpiarCacheProgreso,
  obtenerCacheProgreso,
} from "@/lib/progreso-cache";
import type { ProgresoPublicoGuiado, ProgresoPublicoLibre } from "@/lib/types";

const RETO_A = 1;
const RETO_B = 2;

function progresoPublico(overrides: Partial<ProgresoPublicoGuiado> = {}): ProgresoPublicoGuiado {
  return {
    modo: "guiado",
    porcentaje: 0,
    kmAvanzados: 0,
    kmRestantes: 100,
    odometroKm: 0,
    estado: "en-ruta",
    ultimaPosicion: null,
    ...overrides,
  };
}

function progresoPublicoLibre(overrides: Partial<ProgresoPublicoLibre> = {}): ProgresoPublicoLibre {
  return {
    modo: "libre",
    distanciaRestanteKm: null,
    odometroKm: 0,
    ultimaPosicion: null,
    ...overrides,
  };
}

beforeEach(() => {
  limpiarCacheProgreso();
});

describe("progreso-cache", () => {
  it("obtenerCacheProgreso devuelve null cuando nunca se ha escrito nada", () => {
    expect(obtenerCacheProgreso(RETO_A)).toBeNull();
  });

  it("guardarCacheProgreso hace disponible el valor guardado con su timestamp", () => {
    const valor = progresoPublico({ porcentaje: 42 });
    guardarCacheProgreso(RETO_A, valor);

    const cache = obtenerCacheProgreso(RETO_A);
    expect(cache).not.toBeNull();
    expect(cache?.valor).toEqual(valor);
    expect(typeof cache?.timestamp).toBe("number");
  });

  it("limpiarCacheProgreso(retoId) deja la caché de ese reto en null tras haber guardado un valor", () => {
    guardarCacheProgreso(RETO_A, progresoPublico());
    limpiarCacheProgreso(RETO_A);

    expect(obtenerCacheProgreso(RETO_A)).toBeNull();
  });

  it("guardarCacheProgreso sobrescribe cualquier valor previo del mismo reto", () => {
    guardarCacheProgreso(RETO_A, progresoPublico({ porcentaje: 10 }));
    guardarCacheProgreso(RETO_A, progresoPublico({ porcentaje: 20 }));

    const valor = obtenerCacheProgreso(RETO_A)?.valor;
    expect(valor?.modo).toBe("guiado");
    expect(valor && valor.modo === "guiado" ? valor.porcentaje : null).toBe(20);
  });

  it("expone CACHE_TTL_MS como los 20 s documentados (DT-007)", () => {
    expect(CACHE_TTL_MS).toBe(20_000);
  });

  it("acepta también la rama 'libre' de ProgresoPublico (DT-016, unión discriminada)", () => {
    const valor = progresoPublicoLibre({ distanciaRestanteKm: 3.2 });
    guardarCacheProgreso(RETO_A, valor);

    expect(obtenerCacheProgreso(RETO_A)?.valor).toEqual(valor);
  });
});

describe("progreso-cache — aislamiento por reto (FP2.5, DT-028)", () => {
  it("un valor guardado para un reto no es visible desde otro reto", () => {
    guardarCacheProgreso(RETO_A, progresoPublico({ porcentaje: 42 }));

    expect(obtenerCacheProgreso(RETO_B)).toBeNull();
  });

  it("cada reto conserva su propio valor aunque se guarden los dos", () => {
    guardarCacheProgreso(RETO_A, progresoPublico({ porcentaje: 10 }));
    guardarCacheProgreso(RETO_B, progresoPublicoLibre({ distanciaRestanteKm: 5 }));

    expect(obtenerCacheProgreso(RETO_A)?.valor.modo).toBe("guiado");
    expect(obtenerCacheProgreso(RETO_B)?.valor.modo).toBe("libre");
  });

  it("limpiarCacheProgreso(retoId) no borra la entrada de otro reto", () => {
    guardarCacheProgreso(RETO_A, progresoPublico());
    guardarCacheProgreso(RETO_B, progresoPublico({ porcentaje: 77 }));

    limpiarCacheProgreso(RETO_A);

    expect(obtenerCacheProgreso(RETO_A)).toBeNull();
    expect(obtenerCacheProgreso(RETO_B)).not.toBeNull();
  });

  it("limpiarCacheProgreso() sin argumento vacía la caché de todos los retos", () => {
    guardarCacheProgreso(RETO_A, progresoPublico());
    guardarCacheProgreso(RETO_B, progresoPublico());

    limpiarCacheProgreso();

    expect(obtenerCacheProgreso(RETO_A)).toBeNull();
    expect(obtenerCacheProgreso(RETO_B)).toBeNull();
  });
});
