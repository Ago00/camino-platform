/**
 * Datos de ejemplo para la vista previa del admin (DT-034): cómo se vería la
 * web en "durante" o "llegada" cuando el reto todavía no está en esa fase.
 *
 * Dominio puro: sin I/O y sin `Date.now()` (el instante de referencia entra
 * como `ahora`), así que con las mismas entradas devuelve siempre lo mismo.
 *
 * Las cifras del modo guiado se sacan de la traza de PINTADO que ya recibe el
 * mapa. Su longitud no vale para calcular el progreso real (AGENTS.md, regla
 * de las dos trazas), pero aquí solo se busca una cifra verosímil para una
 * maqueta; la traza de cálculo nunca se lee desde este módulo.
 */

import { haversineKm } from "@/lib/traza/proyeccion";
import type {
  EntradaMinutoAMinutoPublica,
  ModoIntento,
  ProgresoPublicoGuiado,
  ProgresoPublicoLibre,
  UltimaPosicionPublica,
} from "@/lib/types";

export type FaseConDatos = "durante" | "llegada";

export interface PuntoGpsEjemplo {
  lat: number;
  lon: number;
}

interface DatosEjemploComunes {
  startedAt: string;
  /** null en "durante". */
  endedAt: string | null;
  puntosGps: PuntoGpsEjemplo[];
  entradasMinutoAMinuto: EntradaMinutoAMinutoPublica[];
  /** null: la web usa el mensaje de llegada por defecto. */
  mensajeLlegada: null;
  fotoLlegadaUrl: null;
}

export type DatosEjemplo =
  | (DatosEjemploComunes & { modo: "guiado"; progreso: ProgresoPublicoGuiado })
  | (DatosEjemploComunes & { modo: "libre"; progreso: ProgresoPublicoLibre });

const MS_MINUTO = 60_000;
const MS_HORA = 60 * MS_MINUTO;

/** Parte del recorrido hecha en "durante": algo menos de la mitad, para que se vea camino por delante. */
const FRACCION_DURANTE = 0.42;
/** Rodeos, paradas en bares…: lo andado siempre es algo más que lo avanzado sobre la ruta. */
const FACTOR_ODOMETRO = 1.02;

/** Tiempos pensados para dar un ritmo de paseo (~4 km/h) sobre una ruta de ~110 km. */
const HORAS_EN_MARCHA_DURANTE = 11;
const MINUTOS_DESDE_ULTIMA_SENAL = 2;
const HORAS_TOTALES_LLEGADA = 29;
const HORAS_DESDE_LLEGADA = 1;

/**
 * Recorrido fijo del modo libre (no hay traza oficial): de Padrón a Santiago
 * en línea quebrada, en [lon, lat] como las trazas GeoJSON.
 */
const TRAZA_LIBRE_EJEMPLO: readonly [number, number][] = [
  [-8.6606, 42.7389],
  [-8.6472, 42.7571],
  [-8.6283, 42.7739],
  [-8.6109, 42.7912],
  [-8.5968, 42.8105],
  [-8.5821, 42.8288],
  [-8.5655, 42.8467],
  [-8.5512, 42.8651],
  [-8.5446, 42.8806],
];

const ENTRADAS_EJEMPLO: readonly { texto: string; minutosAntes: number; posicion: "final" | "mitad" | "inicio" }[] = [
  { texto: "Parada para comer algo y seguimos.", minutosAntes: 20, posicion: "final" },
  { texto: "Media jornada: las piernas responden.", minutosAntes: 3 * 60, posicion: "mitad" },
  { texto: "Primer café del día y a caminar.", minutosAntes: 6 * 60, posicion: "inicio" },
];

export function datosEjemplo(
  fase: FaseConDatos,
  modo: ModoIntento,
  trazaCoords: readonly [number, number][],
  ahora: Date
): DatosEjemplo {
  const ahoraMs = ahora.getTime();
  const fraccion = fase === "durante" ? FRACCION_DURANTE : 1;
  const startedAtMs = ahoraMs - (fase === "durante" ? HORAS_EN_MARCHA_DURANTE : HORAS_TOTALES_LLEGADA) * MS_HORA;
  const endedAtMs = fase === "llegada" ? ahoraMs - HORAS_DESDE_LLEGADA * MS_HORA : null;
  const ultimaSenalMs = endedAtMs ?? ahoraMs - MINUTOS_DESDE_ULTIMA_SENAL * MS_MINUTO;

  const traza = modo === "guiado" ? trazaCoords : TRAZA_LIBRE_EJEMPLO;
  const acumulados = kmAcumulados(traza);
  const longitudKm = acumulados.at(-1) ?? 0;
  const kmAvanzados = longitudKm * fraccion;
  const recorrido = traza.filter((_, i) => acumulados[i] <= kmAvanzados).map(([lon, lat]) => ({ lat, lon }));
  const odometroKm = redondear(kmAvanzados * FACTOR_ODOMETRO);
  const ultimaPosicion = ultimaPosicionDe(recorrido, ultimaSenalMs);

  const comunes: DatosEjemploComunes = {
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: endedAtMs === null ? null : new Date(endedAtMs).toISOString(),
    puntosGps: recorrido,
    entradasMinutoAMinuto: entradasEjemplo(recorrido, ultimaSenalMs),
    mensajeLlegada: null,
    fotoLlegadaUrl: null,
  };

  if (modo === "guiado") {
    return {
      ...comunes,
      modo: "guiado",
      progreso: {
        modo: "guiado",
        porcentaje: Math.round(fraccion * 100),
        kmAvanzados: redondear(kmAvanzados),
        kmRestantes: redondear(longitudKm - kmAvanzados),
        odometroKm,
        estado: "en-ruta",
        ultimaPosicion,
      },
    };
  }

  const [destinoLon, destinoLat] = TRAZA_LIBRE_EJEMPLO[TRAZA_LIBRE_EJEMPLO.length - 1];
  return {
    ...comunes,
    modo: "libre",
    progreso: {
      modo: "libre",
      distanciaRestanteKm:
        ultimaPosicion === null
          ? null
          : redondear(haversineKm(ultimaPosicion.lat, ultimaPosicion.lon, destinoLat, destinoLon)),
      odometroKm,
      ultimaPosicion,
    },
  };
}

function kmAcumulados(traza: readonly [number, number][]): number[] {
  const acumulados: number[] = [];
  let total = 0;
  traza.forEach(([lon, lat], i) => {
    if (i > 0) {
      const [lonPrevia, latPrevia] = traza[i - 1];
      total += haversineKm(latPrevia, lonPrevia, lat, lon);
    }
    acumulados.push(total);
  });
  return acumulados;
}

function ultimaPosicionDe(recorrido: readonly PuntoGpsEjemplo[], tsMs: number): UltimaPosicionPublica | null {
  const ultimo = recorrido.at(-1);
  return ultimo === undefined ? null : { lat: ultimo.lat, lon: ultimo.lon, ts: new Date(tsMs).toISOString() };
}

/**
 * Tres entradas, la más reciente primero (como las sirve la API). Ids
 * negativos para que nunca coincidan con uno real y sin foto (no hay nada que
 * enseñar). Se sitúan sobre el recorrido de ejemplo para que el clic → mapa
 * funcione.
 */
function entradasEjemplo(recorrido: readonly PuntoGpsEjemplo[], referenciaMs: number): EntradaMinutoAMinutoPublica[] {
  return ENTRADAS_EJEMPLO.map((entrada, i) => {
    const punto = puntoDelRecorrido(recorrido, entrada.posicion);
    return {
      id: -(i + 1),
      texto: entrada.texto,
      foto_url: null,
      lat: punto?.lat ?? null,
      lon: punto?.lon ?? null,
      created_at: new Date(referenciaMs - entrada.minutosAntes * MS_MINUTO).toISOString(),
    };
  });
}

function puntoDelRecorrido(
  recorrido: readonly PuntoGpsEjemplo[],
  posicion: "final" | "mitad" | "inicio"
): PuntoGpsEjemplo | undefined {
  if (recorrido.length === 0) return undefined;
  const indice =
    posicion === "final" ? recorrido.length - 1 : posicion === "mitad" ? Math.floor((recorrido.length - 1) / 2) : 0;
  return recorrido[indice];
}

function redondear(km: number): number {
  return Math.round(km * 100) / 100;
}
