import { describe, expect, it } from "vitest";
import { datosEjemplo } from "@/lib/vista-previa/datos-ejemplo";
import { haversineKm } from "@/lib/traza/proyeccion";

const AHORA = new Date("2026-10-10T12:00:00.000Z");

/** Traza sintética recta hacia el norte, [lon, lat], ~11,1 km por tramo. */
const TRAZA: [number, number][] = Array.from({ length: 11 }, (_, i) => [-8.5, 42 + i * 0.1]);
const LONGITUD_TRAZA_KM = TRAZA.slice(1).reduce(
  (total, [lon, lat], i) => total + haversineKm(TRAZA[i][1], TRAZA[i][0], lat, lon),
  0
);

describe("datosEjemplo — modo guiado", () => {
  it("en 'durante' marca ~42 % de la longitud de la traza de mapa, en ruta y sin fin", () => {
    const datos = datosEjemplo("durante", "guiado", TRAZA, AHORA);
    if (datos.modo !== "guiado") throw new Error("se esperaba modo guiado");

    expect(datos.progreso.modo).toBe("guiado");
    expect(datos.progreso.porcentaje).toBe(42);
    expect(datos.progreso.kmAvanzados).toBeCloseTo(LONGITUD_TRAZA_KM * 0.42, 1);
    expect(datos.progreso.kmAvanzados + datos.progreso.kmRestantes).toBeCloseTo(LONGITUD_TRAZA_KM, 1);
    expect(datos.progreso.odometroKm).toBeGreaterThanOrEqual(datos.progreso.kmAvanzados);
    expect(datos.progreso.estado).toBe("en-ruta");
    expect(datos.endedAt).toBeNull();
  });

  it("los puntos GPS son un prefijo de la traza y la última posición es el último de ellos", () => {
    const datos = datosEjemplo("durante", "guiado", TRAZA, AHORA);
    const prefijo = TRAZA.slice(0, datos.puntosGps.length).map(([lon, lat]) => ({ lat, lon }));

    expect(datos.puntosGps.length).toBeGreaterThan(0);
    expect(datos.puntosGps.length).toBeLessThan(TRAZA.length);
    expect(datos.puntosGps).toEqual(prefijo);
    expect(datos.progreso.ultimaPosicion).toMatchObject(datos.puntosGps[datos.puntosGps.length - 1]);
  });

  it("en 'llegada' el recorrido está completo (100 %, 0 km restantes) y el fin es anterior a ahora", () => {
    const datos = datosEjemplo("llegada", "guiado", TRAZA, AHORA);
    if (datos.modo !== "guiado") throw new Error("se esperaba modo guiado");

    expect(datos.progreso.porcentaje).toBe(100);
    expect(datos.progreso.kmRestantes).toBe(0);
    expect(datos.puntosGps).toHaveLength(TRAZA.length);
    expect(datos.endedAt).not.toBeNull();
    expect(new Date(datos.endedAt ?? "").getTime()).toBeLessThan(AHORA.getTime());
    expect(datos.progreso.ultimaPosicion?.ts).toBe(datos.endedAt);
  });

  it("sin traza (caso límite) no rompe: 0 km y sin posición", () => {
    const datos = datosEjemplo("durante", "guiado", [], AHORA);
    if (datos.modo !== "guiado") throw new Error("se esperaba modo guiado");

    expect(datos.progreso.kmAvanzados).toBe(0);
    expect(datos.progreso.kmRestantes).toBe(0);
    expect(datos.progreso.ultimaPosicion).toBeNull();
    expect(datos.entradasMinutoAMinuto.every((e) => e.lat === null && e.lon === null)).toBe(true);
  });
});

describe("datosEjemplo — modo libre", () => {
  it("usa una traza sintética propia (ignora la recibida), con distancia restante y sin porcentaje", () => {
    const datos = datosEjemplo("durante", "libre", TRAZA, AHORA);
    if (datos.modo !== "libre") throw new Error("se esperaba modo libre");

    expect(datos.progreso.modo).toBe("libre");
    expect("porcentaje" in datos.progreso).toBe(false);
    expect(datos.progreso.distanciaRestanteKm).toBeGreaterThan(0);
    expect(datos.progreso.odometroKm).toBeGreaterThan(0);
    expect(datos.puntosGps[0]).not.toEqual({ lat: TRAZA[0][1], lon: TRAZA[0][0] });
    expect(datosEjemplo("durante", "libre", [], AHORA)).toEqual(datos);
  });

  it("en 'llegada' la distancia restante al destino es 0", () => {
    const datos = datosEjemplo("llegada", "libre", [], AHORA);
    if (datos.modo !== "libre") throw new Error("se esperaba modo libre");

    expect(datos.progreso.distanciaRestanteKm).toBe(0);
  });
});

describe("datosEjemplo — invariantes comunes", () => {
  it.each([
    ["durante", "guiado"],
    ["llegada", "guiado"],
    ["durante", "libre"],
    ["llegada", "libre"],
  ] as const)("%s/%s: tiempos relativos a ahora, 3 entradas de ejemplo y sin mensaje ni foto", (fase, modo) => {
    const datos = datosEjemplo(fase, modo, TRAZA, AHORA);

    expect(datos.modo).toBe(modo);
    expect(new Date(datos.startedAt).getTime()).toBeLessThan(AHORA.getTime());
    expect(datos.mensajeLlegada).toBeNull();
    expect(datos.fotoLlegadaUrl).toBeNull();
    expect(datos.entradasMinutoAMinuto).toHaveLength(3);
    expect(datos.entradasMinutoAMinuto.every((e) => e.id < 0 && e.foto_url === null)).toBe(true);
    const fechas = datos.entradasMinutoAMinuto.map((e) => new Date(e.created_at).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    expect(Math.max(...fechas)).toBeLessThanOrEqual(AHORA.getTime());
  });

  it("el porcentaje guiado queda siempre entre 0 y 100", () => {
    for (const fase of ["durante", "llegada"] as const) {
      const datos = datosEjemplo(fase, "guiado", TRAZA, AHORA);
      if (datos.modo !== "guiado") throw new Error("se esperaba modo guiado");
      expect(datos.progreso.porcentaje).toBeGreaterThanOrEqual(0);
      expect(datos.progreso.porcentaje).toBeLessThanOrEqual(100);
    }
  });

  it("es determinista: mismo resultado con el mismo instante; los tiempos se mueven con otro", () => {
    expect(datosEjemplo("durante", "guiado", TRAZA, AHORA)).toEqual(
      datosEjemplo("durante", "guiado", TRAZA, new Date(AHORA.getTime()))
    );
    expect(datosEjemplo("durante", "guiado", TRAZA, new Date(AHORA.getTime() + 60_000)).startedAt).not.toBe(
      datosEjemplo("durante", "guiado", TRAZA, AHORA).startedAt
    );
  });
});
