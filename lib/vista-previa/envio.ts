/**
 * Regla común de los formularios públicos (intención, comentario, respuesta)
 * para decidir si se puede enviar (DT-034). Dominio puro: la usan tanto el
 * `disabled` del botón como la salida temprana del envío, para que la vista
 * previa del admin no pueda escribir nada aunque el botón se active a mano.
 */

export const AVISO_ENVIO_EN_VISTA_PREVIA = "Vista previa: no se envía";

export interface EstadoEnvioFormulario {
  vistaPrevia: boolean;
  /** Campos obligatorios rellenos. */
  completo: boolean;
  enviando: boolean;
}

export function envioPermitido({ vistaPrevia, completo, enviando }: EstadoEnvioFormulario): boolean {
  return !vistaPrevia && completo && !enviando;
}
