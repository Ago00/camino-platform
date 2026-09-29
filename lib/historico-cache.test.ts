/**
 * Tests de la caché compartida del histórico de posiciones (DT-021, fix
 * post-revisión de Seguridad). Mismo contrato que `lib/progreso-cache.ts`
 * (ver `lib/progreso-cache.test.ts`), aplicado a `Posicion[]`, con una
 * entrada por reto desde FP2.5 (DT-028).
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  CACHE_TTL_MS,
  guardarCacheHistorico,
  limpiarCacheHistorico,
  obtenerCacheHistorico,
} from "@/lib/historico-cache";
import type { Posicion } from "@/lib/types";

const RETO_A = 1;
const RETO_B = 2;

function posicion(overrides: Partial<Posicion> = {}): Posicion {
  return {
    id: 1,
    intento_id: 1,
    lat: 42.5,
    lon: -8.6,
    ts: "2026-09-12T10:00:00.000Z",
    batt: 90,
    acc: 5,
    fuente: "app",
    descartado: false,
    created_at: "2026-09-12T10:00:01.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  limpiarCacheHistorico();
});

describe("historico-cache", () => {
  it("obtenerCacheHistorico devuelve null cuando nunca se ha escrito nada", () => {
    expect(obtenerCacheHistorico(RETO_A)).toBeNull();
  });

  it("guardarCacheHistorico hace disponible el valor guardado con su timestamp", () => {
    const valor = [posicion({ id: 1 }), posicion({ id: 2 })];
    guardarCacheHistorico(RETO_A, valor);

    const cache = obtenerCacheHistorico(RETO_A);
    expect(cache).not.toBeNull();
    expect(cache?.valor).toEqual(valor);
    expect(typeof cache?.timestamp).toBe("number");
  });

  it("limpiarCacheHistorico(retoId) deja la caché de ese reto en null tras haber guardado un valor", () => {
    guardarCacheHistorico(RETO_A, [posicion()]);
    limpiarCacheHistorico(RETO_A);

    expect(obtenerCacheHistorico(RETO_A)).toBeNull();
  });

  it("guardarCacheHistorico sobrescribe cualquier valor previo del mismo reto", () => {
    guardarCacheHistorico(RETO_A, [posicion({ id: 1 })]);
    guardarCacheHistorico(RETO_A, [posicion({ id: 2 }), posicion({ id: 3 })]);

    expect(obtenerCacheHistorico(RETO_A)?.valor).toHaveLength(2);
  });

  it("comparte CACHE_TTL_MS (20 s) con lib/progreso-cache.ts — mismo TTL, una sola constante", () => {
    expect(CACHE_TTL_MS).toBe(20_000);
  });
});

describe("historico-cache — aislamiento por reto (FP2.5, DT-028)", () => {
  it("un histórico guardado para un reto no es visible desde otro reto", () => {
    guardarCacheHistorico(RETO_A, [posicion()]);

    expect(obtenerCacheHistorico(RETO_B)).toBeNull();
  });

  it("limpiarCacheHistorico(retoId) no borra la entrada de otro reto", () => {
    guardarCacheHistorico(RETO_A, [posicion({ id: 1, intento_id: 10 })]);
    guardarCacheHistorico(RETO_B, [posicion({ id: 2, intento_id: 20 })]);

    limpiarCacheHistorico(RETO_A);

    expect(obtenerCacheHistorico(RETO_A)).toBeNull();
    expect(obtenerCacheHistorico(RETO_B)?.valor[0]?.intento_id).toBe(20);
  });

  it("limpiarCacheHistorico() sin argumento vacía la caché de todos los retos", () => {
    guardarCacheHistorico(RETO_A, [posicion()]);
    guardarCacheHistorico(RETO_B, [posicion()]);

    limpiarCacheHistorico();

    expect(obtenerCacheHistorico(RETO_A)).toBeNull();
    expect(obtenerCacheHistorico(RETO_B)).toBeNull();
  });
});
