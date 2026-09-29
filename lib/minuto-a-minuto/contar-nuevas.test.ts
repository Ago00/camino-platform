import { describe, expect, it } from "vitest";
import { contarNuevas } from "@/lib/minuto-a-minuto/contar-nuevas";

const conIds = (...ids: number[]) => ids.map((id) => ({ id }));

describe("contarNuevas", () => {
  it("devuelve 0 si todavía no hay referencia (ultimoVistoId null)", () => {
    expect(contarNuevas(conIds(9, 8, 7), null)).toBe(0);
  });

  it("devuelve 0 si no ha llegado nada desde que se plegó", () => {
    expect(contarNuevas(conIds(9, 8, 7), 9)).toBe(0);
  });

  it("cuenta las entradas llegadas arriba con id mayor que la última vista", () => {
    expect(contarNuevas(conIds(12, 11, 9, 8), 9)).toBe(2);
  });

  it("no cuenta las páginas antiguas añadidas abajo", () => {
    const trasCargarMas = conIds(9, 8, 7, 3, 2, 1);
    expect(contarNuevas(trasCargarMas, 9)).toBe(0);
  });

  it("acumula varias tandas de polling mientras sigue plegado", () => {
    const ultimoVisto = 9;
    const trasPrimeraTanda = [...conIds(10), ...conIds(9, 8)];
    const trasSegundaTanda = [...conIds(13, 12), ...trasPrimeraTanda];
    expect(contarNuevas(trasPrimeraTanda, ultimoVisto)).toBe(1);
    expect(contarNuevas(trasSegundaTanda, ultimoVisto)).toBe(3);
  });

  it("con referencia 0 (plegado con el feed vacío) cuenta todas las entradas", () => {
    expect(contarNuevas(conIds(2, 1), 0)).toBe(2);
    expect(contarNuevas([], 0)).toBe(0);
  });
});
