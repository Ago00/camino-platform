/**
 * Total "desde la salida" fijado a mano para retos concretos.
 *
 * El mojón de la salida de un reto muestra una cifra que la gente toma como la
 * distancia a recorrer (p. ej. 100,220 km) y que puede no coincidir con la que
 * sale de proyectar el primer punto GPS sobre la traza (aquí 98,8 km). Si hace
 * falta que "andado + restante" cuadre con la cifra que vio la gente, se fija
 * aquí por id de reto. Sin entrada, `calcularProgreso` usa el total derivado de
 * la traza. Temporal: si se repite en más retos, mejor una columna en `retos`.
 */
const TOTAL_SALIDA_FIJO_KM: Readonly<Record<number, number>> = {
  // saco-walkers (producción): el mojón de la salida marcaba 100,220 km.
  3: 100.22,
};

export function totalSalidaFijoKm(retoId: number): number | undefined {
  return TOTAL_SALIDA_FIJO_KM[retoId];
}
