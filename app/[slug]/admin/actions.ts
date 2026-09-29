"use server";

/**
 * Server Actions del panel admin con namespace de slug (DT-026, FP1).
 *
 * Cada acción recibe `slug: string` como primer parámetro. Los componentes
 * cliente lo vinculan con `.bind(null, slug)` antes de llamar. El slug se
 * usa para:
 *   1. Resolver el reto y verificar que la sesión es de ESE reto
 *      (`requerirSesion(slug)` → `resolverRetoConSesion`, FP2.6 / DT-029).
 *   2. Invalidar la ruta correcta con `revalidatePath`.
 *
 * Aislamiento por reto (FP2.5, DT-028): toda lectura y escritura queda
 * acotada al reto del slug. El intento activo se busca siempre con
 * `soloIntentoActivoDelReto`; las filas con `reto_id` propio (comentarios,
 * intenciones, config_trafico) se filtran por `reto_id` además de por `id`;
 * las que cuelgan de un intento (posiciones, minuto_a_minuto) se filtran por
 * el intento activo del reto. Así un admin en `/reto-a/admin` no puede
 * modificar datos de `reto-b` aunque envíe un id ajeno.
 *
 * Cada acción verifica la sesión con `requerirSesion(slug)` como primera
 * operación, sin confiar en que proxy.ts filtró la petición (el proxy no
 * consulta BD y no detecta un cambio de contraseña).
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { soloIntentoActivoDelReto } from "@/lib/supabase/intentos";
import { subirFotoMinutoAMinuto, subirFotoLlegada, ErrorDeSubidaDeFoto } from "@/lib/supabase/storage";
import { NOMBRE_COOKIE_SESION } from "@/lib/auth/admin-session";
import { resolverRetoConSesion } from "@/lib/auth/sesion-admin-servidor";
import { guardarCacheProgreso, limpiarCacheProgreso, obtenerCacheProgreso } from "@/lib/progreso-cache";
import { limpiarCacheHistorico } from "@/lib/historico-cache";
import { calcularProgresoActual } from "@/lib/traza/progreso-actual";
import type { ResultadoPublicacion, Reto } from "@/lib/types";
import type { ClaveTexto } from "@/lib/textos/defaults";
import { CLAVES_TEXTOS } from "@/lib/textos/defaults";
import { obtenerTextos } from "@/lib/textos/obtener-textos";
import { motivoRechazoPadre, type MotivoRechazoPadre } from "@/lib/comentarios/hilos";

class SesionInvalidaError extends Error {
  constructor() {
    super("Sesión de admin inválida o expirada.");
  }
}

/**
 * Las acciones que devuelven `ResultadoPublicacion` (DT-017) no lanzan: con
 * sesión inválida para el reto devuelven este mensaje.
 */
const MENSAJE_SESION_CADUCADA = "Tu sesión de admin ha caducado. Vuelve a entrar y reintenta.";

/**
 * Reto del slug si la petición trae una sesión de admin válida PARA ESE reto
 * (id, slug y huella de su contraseña actual, DT-029). Lanza
 * `SesionInvalidaError` en cualquier otro caso (sin sesión, sesión de otro
 * reto, contraseña cambiada, reto inexistente) antes de tocar la BD.
 */
async function requerirSesion(slug: string): Promise<Reto> {
  const reto = await resolverRetoConSesion(slug);
  if (!reto) throw new SesionInvalidaError();
  return reto;
}

/**
 * Id del intento activo del reto, o null si no hay ninguno (o la consulta
 * falla). Para las acciones que acotan filas hijas (posiciones,
 * minuto_a_minuto) al intento del reto.
 */
async function obtenerIdIntentoActivo(retoId: number): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id"),
    retoId
  ).maybeSingle();
  if (error || !data) return null;
  return data.id;
}

/** Invalida las cachés en memoria que dependen del histórico del reto. */
function limpiarCachesDelReto(retoId: number): void {
  limpiarCacheProgreso(retoId);
  limpiarCacheHistorico(retoId);
}

function revalidarAdmin(slug: string): void {
  revalidatePath(`/${slug}/admin`);
}

/** Borra la cookie de sesión. No requiere sesión previa válida: cerrar sesión
 * debe funcionar incluso si la cookie ya está corrupta o expirada. */
export async function cerrarSesion(): Promise<void> {
  const almacenCookies = await cookies();
  almacenCookies.delete(NOMBRE_COOKIE_SESION);
}

// ---------------------------------------------------------------------------
// Actividad
// ---------------------------------------------------------------------------

/**
 * Siembra la primera fila de `intentos` del reto cuando no tiene ningún
 * intento activo (arranque desde cero, sin SQL manual). Distinta de
 * `reiniciarReto()`: esa exige una fila activa previa que cerrar; esta exige
 * que NO exista ninguna. Mantenerlas separadas evita que una sola función
 * tenga dos caminos con significado distinto según el estado de la BD.
 */
export async function crearPrimerIntento(slug: string): Promise<void> {
  const reto = await requerirSesion(slug);
  const supabase = getSupabaseAdmin();

  const { data: intentoActivo, error: errorBusqueda } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id"),
    reto.id
  ).maybeSingle();

  if (errorBusqueda) throw new Error("No se pudo comprobar si ya existe un intento activo.");
  if (intentoActivo) throw new Error("Ya existe un intento activo.");

  const { error: errorCreacion } = await supabase.from("intentos").insert({ fase: "antes", reto_id: reto.id });
  if (errorCreacion) throw new Error("No se pudo crear el intento.");

  revalidarAdmin(slug);
}

/**
 * Parámetros de iniciarReto() (DT-016): el modo se elige en el momento de
 * pulsar "Iniciar" y queda fijo durante toda la vida del intento.
 */
export interface IniciarRetoParams {
  modo: "guiado" | "libre";
  destinoLat?: number;
  destinoLon?: number;
}

const parametrosIniciarReto = z.discriminatedUnion("modo", [
  z.object({ modo: z.literal("guiado") }),
  z.object({
    modo: z.literal("libre"),
    destinoLat: z.number().min(-90).max(90),
    destinoLon: z.number().min(-180).max(180),
  }),
]);

/**
 * antes → durante, sobre el intento activo del reto. En modo libre guarda
 * destino_lat/destino_lon junto con la transición de fase.
 */
export async function iniciarReto(slug: string, params: IniciarRetoParams): Promise<void> {
  const reto = await requerirSesion(slug);

  const datos = parametrosIniciarReto.safeParse(params);
  if (!datos.success) {
    throw new Error("El modo libre exige un destino (lat/lon) válido.");
  }

  const supabase = getSupabaseAdmin();

  const { data: intentoActivo, error: errorBusqueda } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id, fase"),
    reto.id
  ).maybeSingle();

  if (errorBusqueda || !intentoActivo || intentoActivo.fase !== "antes") {
    throw new Error("No hay ningún intento en fase 'antes' que iniciar.");
  }

  const cambios: {
    fase: "durante";
    started_at: string;
    modo?: "libre";
    destino_lat?: number;
    destino_lon?: number;
  } = {
    fase: "durante",
    started_at: new Date().toISOString(),
  };
  if (datos.data.modo === "libre") {
    cambios.modo = "libre";
    cambios.destino_lat = datos.data.destinoLat;
    cambios.destino_lon = datos.data.destinoLon;
  }

  const { error } = await supabase.from("intentos").update(cambios).eq("id", intentoActivo.id);

  if (error) throw new Error("No se pudo iniciar el reto.");
  // /api/progreso es público y puede haber cacheado el progreso vacío de "antes".
  limpiarCachesDelReto(reto.id);
  revalidarAdmin(slug);
}

/**
 * durante → llegada, sobre el intento activo del reto, con el mensaje de
 * llegada editado y, opcional, la foto de llegada (DT-024).
 */
export async function finalizarReto(slug: string, formData: FormData): Promise<ResultadoPublicacion> {
  const reto = await resolverRetoConSesion(slug);
  if (!reto) return { ok: false, mensaje: MENSAJE_SESION_CADUCADA };

  const mensajeLimpio = String(formData.get("mensaje") ?? "").trim();
  if (mensajeLimpio.length === 0) {
    return { ok: false, mensaje: "El mensaje de llegada no puede estar vacío." };
  }
  if (mensajeLimpio.length > 1000) {
    return { ok: false, mensaje: "El mensaje de llegada no puede superar 1000 caracteres." };
  }

  const cambios: {
    fase: "llegada";
    ended_at: string;
    mensaje_llegada: string;
    foto_llegada_url?: string | null;
  } = {
    fase: "llegada",
    ended_at: new Date().toISOString(),
    mensaje_llegada: mensajeLimpio,
  };

  const foto = formData.get("foto");
  const quitarFoto = formData.get("quitarFoto") === "true";

  if (foto instanceof File && foto.size > 0) {
    try {
      cambios.foto_llegada_url = await subirFotoLlegada(foto);
    } catch (error) {
      if (error instanceof ErrorDeSubidaDeFoto) {
        return { ok: false, mensaje: error.message };
      }
      console.error("Fallo inesperado al subir la foto de llegada", error);
      return { ok: false, mensaje: "No se pudo subir la foto. Vuelve a intentarlo." };
    }
  } else if (quitarFoto) {
    cambios.foto_llegada_url = null;
  }

  const supabase = getSupabaseAdmin();
  const { data: intentoActivo, error: errorBusqueda } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id, fase"),
    reto.id
  ).maybeSingle();

  if (errorBusqueda || !intentoActivo || intentoActivo.fase !== "durante") {
    return { ok: false, mensaje: "No hay ningún intento en fase 'durante' que finalizar." };
  }

  const { error } = await supabase.from("intentos").update(cambios).eq("id", intentoActivo.id);

  if (error) return { ok: false, mensaje: "No se pudo finalizar el reto." };
  limpiarCacheProgreso(reto.id);
  revalidarAdmin(slug);
  return { ok: true };
}

/**
 * llegada → durante, SOBRE EL MISMO intento: deshace el Finalizar.
 */
export async function retomarReto(slug: string): Promise<void> {
  const reto = await requerirSesion(slug);
  const supabase = getSupabaseAdmin();

  const { data: intentoActivo, error: errorBusqueda } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id, fase"),
    reto.id
  ).maybeSingle();

  if (errorBusqueda || !intentoActivo || intentoActivo.fase !== "llegada") {
    throw new Error("No hay ningún intento en fase 'llegada' que retomar.");
  }

  const { error } = await supabase
    .from("intentos")
    .update({ fase: "durante", ended_at: null })
    .eq("id", intentoActivo.id);

  if (error) throw new Error("No se pudo retomar el reto.");
  limpiarCacheProgreso(reto.id);
  revalidarAdmin(slug);
}

/**
 * Cierra el intento actual del reto y abre uno nuevo en blanco, en `antes`.
 */
export async function reiniciarReto(slug: string): Promise<void> {
  const reto = await requerirSesion(slug);
  const supabase = getSupabaseAdmin();

  const { data: intentoActivo, error: errorBusqueda } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id"),
    reto.id
  ).maybeSingle();

  if (errorBusqueda || !intentoActivo) {
    throw new Error("No hay ningún intento activo que reiniciar.");
  }

  const { error: errorCierre } = await supabase
    .from("intentos")
    .update({ cerrado: true })
    .eq("id", intentoActivo.id);

  if (errorCierre) throw new Error("No se pudo cerrar el intento actual.");

  const { error: errorCreacion } = await supabase.from("intentos").insert({ fase: "antes", reto_id: reto.id });
  if (errorCreacion) throw new Error("No se pudo abrir un nuevo intento.");

  limpiarCachesDelReto(reto.id);
  revalidarAdmin(slug);
}

// ---------------------------------------------------------------------------
// Posición (DT-006 capa 2: descartar cualquier punto del histórico)
// ---------------------------------------------------------------------------

/**
 * Solo puede descartar posiciones del intento activo del reto — el único
 * histórico que muestra la pestaña Posición.
 */
export async function descartarPosicion(slug: string, id: number): Promise<void> {
  const reto = await requerirSesion(slug);
  const intentoId = await obtenerIdIntentoActivo(reto.id);
  if (intentoId === null) throw new Error("No hay ningún intento activo en este reto.");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("posiciones")
    .update({ descartado: true })
    .eq("id", id)
    .eq("intento_id", intentoId);
  if (error) throw new Error("No se pudo descartar la posición.");
  limpiarCachesDelReto(reto.id);
  revalidarAdmin(slug);
}

// ---------------------------------------------------------------------------
// Intenciones (hard delete: la tabla no tiene columna de soft-delete)
// ---------------------------------------------------------------------------

export async function eliminarIntencion(slug: string, id: number): Promise<void> {
  const reto = await requerirSesion(slug);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("intenciones").delete().eq("id", id).eq("reto_id", reto.id);
  if (error) throw new Error("No se pudo eliminar la intención.");
  revalidarAdmin(slug);
}

// ---------------------------------------------------------------------------
// Comentarios
// ---------------------------------------------------------------------------

export async function ocultarComentario(slug: string, id: number): Promise<void> {
  const reto = await requerirSesion(slug);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("comentarios")
    .update({ oculto: true })
    .eq("id", id)
    .eq("reto_id", reto.id);
  if (error) throw new Error("No se pudo ocultar el comentario.");
  revalidarAdmin(slug);
}

export async function mostrarComentario(slug: string, id: number): Promise<void> {
  const reto = await requerirSesion(slug);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("comentarios")
    .update({ oculto: false })
    .eq("id", id)
    .eq("reto_id", reto.id);
  if (error) throw new Error("No se pudo mostrar el comentario.");
  revalidarAdmin(slug);
}

export async function eliminarComentario(slug: string, id: number): Promise<void> {
  const reto = await requerirSesion(slug);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("comentarios").delete().eq("id", id).eq("reto_id", reto.id);
  if (error) throw new Error("No se pudo eliminar el comentario.");
  revalidarAdmin(slug);
}

const LONGITUD_MAXIMA_NOMBRE_COMENTARIO = 80;

const textoRespuestaAdmin = z.string().trim().min(1).max(1000);

const MENSAJES_RECHAZO_PADRE: Record<MotivoRechazoPadre, string> = {
  no_existe: "El comentario ya no existe.",
  otro_reto: "El comentario ya no existe.",
  es_respuesta: "Solo se puede responder a comentarios, no a respuestas.",
  privado: "No se puede responder a un comentario privado.",
  oculto: "No se puede responder a un comentario oculto. Muéstralo antes.",
};

/**
 * Respuesta del caminante a un comentario raíz (FP3a, DT-030): se guarda con
 * `es_autor = true` (insignia "Caminante") y con el nombre editable
 * `quien_camina_nombre` del reto. Devuelve el fallo en vez de lanzarlo
 * (DT-017) para que el formulario muestre el motivo real.
 */
export async function responderComentario(
  slug: string,
  parentId: number,
  texto: string
): Promise<ResultadoPublicacion> {
  const reto = await resolverRetoConSesion(slug);
  if (!reto) return { ok: false, mensaje: MENSAJE_SESION_CADUCADA };

  const textoValidado = textoRespuestaAdmin.safeParse(texto);
  if (!textoValidado.success) {
    return { ok: false, mensaje: "La respuesta debe tener entre 1 y 1000 caracteres." };
  }
  if (!Number.isInteger(parentId) || parentId <= 0) {
    return { ok: false, mensaje: "El comentario ya no existe." };
  }

  const supabase = getSupabaseAdmin();
  const { data: padre, error: errorPadre } = await supabase
    .from("comentarios")
    .select("reto_id, parent_id, visibilidad, oculto")
    .eq("id", parentId)
    .eq("reto_id", reto.id)
    .maybeSingle();

  if (errorPadre) return { ok: false, mensaje: "No se pudo publicar la respuesta. Vuelve a intentarlo." };
  const motivo = motivoRechazoPadre(padre, reto.id);
  if (motivo !== null) return { ok: false, mensaje: MENSAJES_RECHAZO_PADRE[motivo] };

  const textos = await obtenerTextos(reto.id);
  const nombre = (textos.quien_camina_nombre.trim() || reto.nombre).slice(0, LONGITUD_MAXIMA_NOMBRE_COMENTARIO);

  const { error } = await supabase.from("comentarios").insert({
    reto_id: reto.id,
    parent_id: parentId,
    nombre,
    texto: textoValidado.data,
    visibilidad: "publico",
    es_autor: true,
  });

  if (error) return { ok: false, mensaje: "No se pudo publicar la respuesta. Vuelve a intentarlo." };
  revalidarAdmin(slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

function esClaveDeTexto(clave: string): clave is ClaveTexto {
  return (CLAVES_TEXTOS as readonly string[]).includes(clave);
}

export async function guardarTexto(slug: string, clave: string, valor: string): Promise<void> {
  const reto = await requerirSesion(slug);
  if (!esClaveDeTexto(clave)) {
    throw new Error(`Clave de texto desconocida: ${clave}`);
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("textos")
    .upsert({ reto_id: reto.id, clave, valor }, { onConflict: "reto_id,clave" });

  if (error) throw new Error("No se pudo guardar el texto.");
  revalidarAdmin(slug);
}

// ---------------------------------------------------------------------------
// Minuto a minuto (DT-013)
// ---------------------------------------------------------------------------

/**
 * Crea una entrada del feed "minuto a minuto" sobre el intento activo del
 * reto. Devuelve el fallo en vez de lanzarlo (DT-017).
 */
export async function crearMinutoAMinuto(slug: string, formData: FormData): Promise<ResultadoPublicacion> {
  const reto = await resolverRetoConSesion(slug);
  if (!reto) return { ok: false, mensaje: MENSAJE_SESION_CADUCADA };

  const texto = String(formData.get("texto") ?? "").trim();
  if (texto.length === 0) {
    return { ok: false, mensaje: "El texto no puede estar vacío." };
  }
  if (texto.length > 500) {
    return { ok: false, mensaje: "El texto no puede superar 500 caracteres." };
  }

  const foto = formData.get("foto");
  let fotoUrl: string | null = null;
  if (foto instanceof File && foto.size > 0) {
    try {
      fotoUrl = await subirFotoMinutoAMinuto(foto);
    } catch (error) {
      if (error instanceof ErrorDeSubidaDeFoto) {
        return { ok: false, mensaje: error.message };
      }
      console.error("Fallo inesperado al subir la foto del minuto a minuto", error);
      return { ok: false, mensaje: "No se pudo subir la foto. Vuelve a intentarlo." };
    }
  }

  const supabase = getSupabaseAdmin();

  const intentoId = await obtenerIdIntentoActivo(reto.id);
  if (intentoId === null) {
    return { ok: false, mensaje: "No hay ningún intento activo sobre el que publicar." };
  }

  const cacheProgreso = obtenerCacheProgreso(reto.id);
  let ultimaPosicion = cacheProgreso?.valor.ultimaPosicion ?? null;
  if (!cacheProgreso) {
    const progresoRecalculado = await calcularProgresoActual(reto);
    guardarCacheProgreso(reto.id, progresoRecalculado);
    ultimaPosicion = progresoRecalculado.ultimaPosicion;
  }

  const { error: errorInsercion } = await supabase.from("minuto_a_minuto").insert({
    intento_id: intentoId,
    texto,
    foto_url: fotoUrl,
    lat: ultimaPosicion?.lat ?? null,
    lon: ultimaPosicion?.lon ?? null,
  });

  if (errorInsercion) {
    return { ok: false, mensaje: "No se pudo publicar la entrada. Vuelve a intentarlo." };
  }
  revalidarAdmin(slug);
  return { ok: true };
}

/**
 * Corrige solo el texto de una entrada existente del intento activo del reto
 * (las únicas que muestra la pestaña Minuto a minuto).
 */
export async function editarMinutoAMinuto(slug: string, id: number, texto: string): Promise<void> {
  const reto = await requerirSesion(slug);

  const textoLimpio = texto.trim();
  if (textoLimpio.length === 0) {
    throw new Error("El texto no puede estar vacío.");
  }
  if (textoLimpio.length > 500) {
    throw new Error("El texto no puede superar 500 caracteres.");
  }

  const intentoId = await obtenerIdIntentoActivo(reto.id);
  if (intentoId === null) throw new Error("No hay ningún intento activo en este reto.");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("minuto_a_minuto")
    .update({ texto: textoLimpio, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("intento_id", intentoId);

  if (error) throw new Error("No se pudo editar la entrada.");
  revalidarAdmin(slug);
}

/**
 * Hard delete, igual que `intenciones`. Solo entradas del intento activo del
 * reto.
 */
export async function eliminarMinutoAMinuto(slug: string, id: number): Promise<void> {
  const reto = await requerirSesion(slug);
  const intentoId = await obtenerIdIntentoActivo(reto.id);
  if (intentoId === null) throw new Error("No hay ningún intento activo en este reto.");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("minuto_a_minuto")
    .delete()
    .eq("id", id)
    .eq("intento_id", intentoId);
  if (error) throw new Error("No se pudo eliminar la entrada.");
  revalidarAdmin(slug);
}

// ---------------------------------------------------------------------------
// Tráfico (DT-023)
// ---------------------------------------------------------------------------

/**
 * Adelanta `config_trafico.cuenta_desde` del reto a ahora. Upsert por
 * `reto_id` (unique en BD): si el reto todavía no tiene fila de
 * configuración, se crea en vez de no hacer nada.
 */
export async function resetearContadorTrafico(slug: string): Promise<void> {
  const reto = await requerirSesion(slug);
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("config_trafico")
    .upsert({ reto_id: reto.id, cuenta_desde: new Date().toISOString() }, { onConflict: "reto_id" });

  if (error) throw new Error("No se pudo resetear el contador de tráfico.");
  revalidarAdmin(slug);
}
