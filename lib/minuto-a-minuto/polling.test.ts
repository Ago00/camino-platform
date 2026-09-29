import { describe, expect, it } from "vitest";
import { construirUrlPolling, fusionarSinDuplicados } from "@/lib/minuto-a-minuto/polling";

describe("construirUrlPolling", () => {
  it("con el feed vacío pide desde el principio (despuesDeId=0) en vez de no preguntar", () => {
    expect(construirUrlPolling("mi-reto", null)).toBe("/mi-reto/api/minuto-a-minuto?despuesDeId=0");
  });

  it("con entradas pide solo las posteriores a la más reciente", () => {
    expect(construirUrlPolling("mi-reto", 42)).toBe("/mi-reto/api/minuto-a-minuto?despuesDeId=42");
  });
});

describe("fusionarSinDuplicados", () => {
  const e = (id: number, texto = `t${id}`) => ({ id, texto });

  it("con el feed vacío añade todas las entradas que llegan", () => {
    expect(fusionarSinDuplicados([e(2), e(1)], [])).toEqual([e(2), e(1)]);
  });

  it("pone las nuevas del poll delante de las previas", () => {
    expect(fusionarSinDuplicados([e(5), e(4)], [e(3), e(2)])).toEqual([e(5), e(4), e(3), e(2)]);
  });

  it("descarta de la segunda lista los ids ya presentes en la primera", () => {
    const previas = [e(5), e(4), e(3)];
    const paginaDesplazada = [e(3), e(2), e(1)];
    expect(fusionarSinDuplicados(previas, paginaDesplazada).map((x) => x.id)).toEqual([5, 4, 3, 2, 1]);
  });

  it("conserva la versión de la primera lista cuando un id se repite", () => {
    expect(fusionarSinDuplicados([e(1, "poll")], [e(1, "inicial")])).toEqual([e(1, "poll")]);
  });
});
