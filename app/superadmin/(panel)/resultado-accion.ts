/**
 * Contrato entre las Server Actions del panel superadmin y sus formularios
 * cliente (`useActionState`), más los avisos que el panel muestra tras una
 * acción que termina en redirección.
 *
 * Las acciones devuelven el resultado en vez de lanzar porque, en producción,
 * Next redacta el mensaje de cualquier error lanzado desde una Server Action:
 * el superadmin no vería el motivo real. No se reutiliza `ResultadoPublicacion`
 * (lib/types.ts) porque aquí el éxito también lleva mensaje y crear necesita
 * devolver el slug para enlazar al reto recién creado.
 *
 * Editar y eliminar terminan con `redirect()` al panel limpio en vez de
 * devolver `ok: true`: al eliminar, la revalidación retira la tarjeta en la
 * misma respuesta y un mensaje guardado en su estado nunca llegaría a verse;
 * al editar, hay que salir de `?edit=<id>`. El aviso viaja en la query.
 */

export type ResultadoAccionSuperadmin = { ok: true; mensaje: string } | { ok: false; mensaje: string };

export type ResultadoCrearReto = { ok: true; mensaje: string; slug: string } | { ok: false; mensaje: string };

const PARAM_RETO_GUARDADO = "guardado";
const PARAM_RETO_ELIMINADO = "eliminado";

const PATRON_SLUG = /^[a-z0-9-]{1,60}$/;

export function urlPanelTrasGuardar(retoId: number): string {
  return `/superadmin?${PARAM_RETO_GUARDADO}=${retoId}`;
}

export function urlPanelTrasEliminar(slug: string): string {
  return `/superadmin?${PARAM_RETO_ELIMINADO}=${encodeURIComponent(slug)}`;
}

export type AvisoPanelSuperadmin = { tipo: "guardado"; retoId: number } | { tipo: "eliminado"; slug: string };

/**
 * Lee de la query el aviso que dejó la última acción. La query la controla
 * cualquiera que tenga la URL, así que solo se aceptan ids enteros positivos y
 * slugs con el formato válido: nunca se muestra texto arbitrario.
 */
export function leerAvisoPanel(query: Record<string, string | undefined>): AvisoPanelSuperadmin | null {
  const guardado = query[PARAM_RETO_GUARDADO];
  if (guardado !== undefined && /^[1-9]\d{0,15}$/.test(guardado)) {
    return { tipo: "guardado", retoId: Number(guardado) };
  }
  const eliminado = query[PARAM_RETO_ELIMINADO];
  if (eliminado !== undefined && PATRON_SLUG.test(eliminado)) {
    return { tipo: "eliminado", slug: eliminado };
  }
  return null;
}
