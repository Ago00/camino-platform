/**
 * Aviso de "sigue subiendo" para los envíos del panel admin que tardan.
 *
 * La invocación de una Server Action no acepta `AbortSignal`: abandonar la
 * espera no cancela la petición, y reintentar por timeout duplicaría el envío.
 * Con una conexión colgada (túnel, cambio de celda) la promesa puede tardar
 * minutos en resolverse, y sin ninguna señal quien publica cree que la web se
 * ha quedado bloqueada y recarga, perdiendo lo escrito. Por eso no se aborta
 * nada: pasado el umbral solo se avisa de que siga esperando.
 */

export const UMBRAL_AVISO_ENVIO_LENTO_MS = 15_000;

export const MENSAJE_ENVIO_LENTO = "Sigue subiendo, no cierres la página.";

/**
 * Espera `promesa` tal cual (mismo valor, mismo rechazo) y llama a `avisar`
 * una sola vez si sigue pendiente pasados `umbralMs`. El temporizador se
 * limpia en cuanto la promesa se resuelve o rechaza.
 */
export async function avisarSiTarda<T>(promesa: Promise<T>, umbralMs: number, avisar: () => void): Promise<T> {
  const temporizador = setTimeout(avisar, umbralMs);
  try {
    return await promesa;
  } finally {
    clearTimeout(temporizador);
  }
}
