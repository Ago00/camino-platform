"use server";

/**
 * Server Actions del panel admin con namespace de slug (DT-026, FP1).
 *
 * Cada acción recibe `slug: string` como primer parámetro. Los componentes
 * cliente lo vinculan con `.bind(null, slug)` antes de llamar. El slug se
 * usa para:
 *   1. Resolver `reto_id` (obtenerRetoPorSlug — con React.cache, una sola
 *      consulta por request aunque lo llamen varias acciones seguidas).
 *   2. Invalidar la ruta correcta con `revalidatePath`.
 *
 * Todas las demás reglas de seguridad permanecen igual que en la versión
 * anterior (app/admin/actions.ts): cada acción verifica la sesión con
 * `requerirSesion()`, sin confiar en que proxy.ts filtró la petición.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { subirFotoMinutoAMinuto, subirFotoLlegada, ErrorDeSubidaDeFoto } from "@/lib/supabase/storage";
import { verificarSesion, NOMBRE_COOKIE_SESION } from "@/lib/auth/admin-session";
import { guardarCacheProgreso, limpiarCacheProgreso, obtenerCacheProgreso } from "@/lib/progreso-cache";
import { calcularProgresoActual } from "@/lib/traza/progreso-actual";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";
import type { ResultadoPublicacion } from "@/lib/types";
import type { ClaveTexto } from "@/lib/textos/defaults";
import { CLAVES_TEXTOS } from "@/lib/textos/defaults";

class SesionInvalidaError extends Error {
  constructor() {
    super("Sesión de admin inválida o expirada.");
  }
}

async function requerirSesion(): Promise<void> {
  const almacenCookies = await cookies();
  const cookieSesion = almacenCookies.get(NOMBRE_COOKIE_SESION)?.value;
  if (!verificarSesion(cookieSesion)) {
    throw new SesionInvalidaError();
  }
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
 * Siembra la primera fila de `intentos` cuando la tabla está completamente
 * vacía (arranque desde cero, sin SQL manual). Distinta de `reiniciarReto()`:
 * esa exige una fila activa previa que cerrar; esta exige que NO exista
 * ninguna. Mantenerlas separadas evita que una sola función tenga dos
 * caminos con significado distinto según el estado de la BD.
 */
export async function crearPrimerIntento(slug: string): Promise<void> {
  await requerirSesion();
  const supabase = getSupabaseAdmin();

  const { data: intentoActivo, error: errorBusqueda } = await supabase
    .from("intentos")
    .select("id")
    .eq("cerrado", false)
    .maybeSingle();

  if (errorBusqueda) throw new Error("No se pudo comprobar si ya existe un intento activo.");
  if (intentoActivo) throw new Error("Ya existe un intento activo.");

  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) throw new Error(`Reto '${slug}' no encontrado.`);

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
 * antes → durante, sobre el intento activo actual. En modo libre guarda
 * destino_lat/destino_lon junto con la transición de fase.
 */
export async function iniciarReto(slug: string, params: IniciarRetoParams): Promise<void> {
  await requerirSesion();

  const datos = parametrosIniciarReto.safeParse(params);
  if (!datos.success) {
    throw new Error("El modo libre exige un destino (lat/lon) válido.");
  }

  const supabase = getSupabaseAdmin();

  const { data: intentoActivo, error: errorBusqueda } = await supabase
    .from("intentos")
    .select("id, fase")
    .eq("cerrado", false)
    .maybeSingle();

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
  revalidarAdmin(slug);
}

/**
 * durante → llegada, sobre el intento activo actual, con el mensaje de
 * llegada editado y, opcional, la foto de llegada (DT-024).
 */
export async function finalizarReto(slug: string, formData: FormData): Promise<ResultadoPublicacion> {
  try {
    await requerirSesion();
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return { ok: false, mensaje: "Tu sesión de admin ha caducado. Vuelve a entrar y reintenta." };
    }
    throw error;
  }

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
  const { data: intentoActivo, error: errorBusqueda } = await supabase
    .from("intentos")
    .select("id, fase")
    .eq("cerrado", false)
    .maybeSingle();

  if (errorBusqueda || !intentoActivo || intentoActivo.fase !== "durante") {
    return { ok: false, mensaje: "No hay ningún intento en fase 'durante' que finalizar." };
  }

  const { error } = await supabase.from("intentos").update(cambios).eq("id", intentoActivo.id);

  if (error) return { ok: false, mensaje: "No se pudo finalizar el reto." };
  limpiarCacheProgreso();
  revalidarAdmin(slug);
  return { ok: true };
}

/**
 * llegada → durante, SOBRE EL MISMO intento: deshace el Finalizar.
 */
export async function retomarReto(slug: string): Promise<void> {
  await requerirSesion();
  const supabase = getSupabaseAdmin();

  const { data: intentoActivo, error: errorBusqueda } = await supabase
    .from("intentos")
    .select("id, fase")
    .eq("cerrado", false)
    .maybeSingle();

  if (errorBusqueda || !intentoActivo || intentoActivo.fase !== "llegada") {
    throw new Error("No hay ningún intento en fase 'llegada' que retomar.");
  }

  const { error } = await supabase
    .from("intentos")
    .update({ fase: "durante", ended_at: null })
    .eq("id", intentoActivo.id);

  if (error) throw new Error("No se pudo retomar el reto.");
  limpiarCacheProgreso();
  revalidarAdmin(slug);
}

/**
 * Cierra el intento actual y abre uno nuevo en blanco, en `antes`.
 */
export async function reiniciarReto(slug: string): Promise<void> {
  await requerirSesion();
  const supabase = getSupabaseAdmin();

  const { data: intentoActivo, error: errorBusqueda } = await supabase
    .from("intentos")
    .select("id")
    .eq("cerrado", false)
    .maybeSingle();

  if (errorBusqueda || !intentoActivo) {
    throw new Error("No hay ningún intento activo que reiniciar.");
  }

  const { error: errorCierre } = await supabase
    .from("intentos")
    .update({ cerrado: true })
    .eq("id", intentoActivo.id);

  if (errorCierre) throw new Error("No se pudo cerrar el intento actual.");

  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) throw new Error(`Reto '${slug}' no encontrado.`);

  const { error: errorCreacion } = await supabase.from("intentos").insert({ fase: "antes", reto_id: reto.id });
  if (errorCreacion) throw new Error("No se pudo abrir un nuevo intento.");

  limpiarCacheProgreso();
  revalidarAdmin(slug);
}

// ---------------------------------------------------------------------------
// Posición (DT-006 capa 2: descartar cualquier punto del histórico)
// ---------------------------------------------------------------------------

export async function descartarPosicion(slug: string, id: number): Promise<void> {
  await requerirSesion();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("posiciones").update({ descartado: true }).eq("id", id);
  if (error) throw new Error("No se pudo descartar la posición.");
  limpiarCacheProgreso();
  revalidarAdmin(slug);
}

// ---------------------------------------------------------------------------
// Intenciones (hard delete: la tabla no tiene columna de soft-delete)
// ---------------------------------------------------------------------------

export async function eliminarIntencion(slug: string, id: number): Promise<void> {
  await requerirSesion();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("intenciones").delete().eq("id", id);
  if (error) throw new Error("No se pudo eliminar la intención.");
  revalidarAdmin(slug);
}

// ---------------------------------------------------------------------------
// Comentarios
// ---------------------------------------------------------------------------

export async function ocultarComentario(slug: string, id: number): Promise<void> {
  await requerirSesion();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("comentarios").update({ oculto: true }).eq("id", id);
  if (error) throw new Error("No se pudo ocultar el comentario.");
  revalidarAdmin(slug);
}

export async function mostrarComentario(slug: string, id: number): Promise<void> {
  await requerirSesion();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("comentarios").update({ oculto: false }).eq("id", id);
  if (error) throw new Error("No se pudo mostrar el comentario.");
  revalidarAdmin(slug);
}

export async function eliminarComentario(slug: string, id: number): Promise<void> {
  await requerirSesion();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("comentarios").delete().eq("id", id);
  if (error) throw new Error("No se pudo eliminar el comentario.");
  revalidarAdmin(slug);
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

function esClaveDeTexto(clave: string): clave is ClaveTexto {
  return (CLAVES_TEXTOS as readonly string[]).includes(clave);
}

export async function guardarTexto(slug: string, clave: string, valor: string): Promise<void> {
  await requerirSesion();
  if (!esClaveDeTexto(clave)) {
    throw new Error(`Clave de texto desconocida: ${clave}`);
  }

  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) throw new Error(`Reto '${slug}' no encontrado.`);

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
 * Crea una entrada del feed "minuto a minuto" sobre el intento activo.
 * Devuelve el fallo en vez de lanzarlo (DT-017).
 */
export async function crearMinutoAMinuto(slug: string, formData: FormData): Promise<ResultadoPublicacion> {
  try {
    await requerirSesion();
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return { ok: false, mensaje: "Tu sesión de admin ha caducado. Vuelve a entrar y reintenta." };
    }
    throw error;
  }

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

  const { data: intentoActivo, error: errorBusquedaIntento } = await supabase
    .from("intentos")
    .select("id")
    .eq("cerrado", false)
    .maybeSingle();

  if (errorBusquedaIntento || !intentoActivo) {
    return { ok: false, mensaje: "No hay ningún intento activo sobre el que publicar." };
  }

  const cacheProgreso = obtenerCacheProgreso();
  let ultimaPosicion = cacheProgreso?.valor.ultimaPosicion ?? null;
  if (!cacheProgreso) {
    const progresoRecalculado = await calcularProgresoActual();
    guardarCacheProgreso(progresoRecalculado);
    ultimaPosicion = progresoRecalculado.ultimaPosicion;
  }

  const { error: errorInsercion } = await supabase.from("minuto_a_minuto").insert({
    intento_id: intentoActivo.id,
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
 * Corrige solo el texto de una entrada existente.
 */
export async function editarMinutoAMinuto(slug: string, id: number, texto: string): Promise<void> {
  await requerirSesion();

  const textoLimpio = texto.trim();
  if (textoLimpio.length === 0) {
    throw new Error("El texto no puede estar vacío.");
  }
  if (textoLimpio.length > 500) {
    throw new Error("El texto no puede superar 500 caracteres.");
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("minuto_a_minuto")
    .update({ texto: textoLimpio, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("No se pudo editar la entrada.");
  revalidarAdmin(slug);
}

/**
 * Hard delete, igual que `intenciones`.
 */
export async function eliminarMinutoAMinuto(slug: string, id: number): Promise<void> {
  await requerirSesion();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("minuto_a_minuto").delete().eq("id", id);
  if (error) throw new Error("No se pudo eliminar la entrada.");
  revalidarAdmin(slug);
}

// ---------------------------------------------------------------------------
// Tráfico (DT-023)
// ---------------------------------------------------------------------------

/**
 * Adelanta `config_trafico.cuenta_desde` a ahora.
 */
export async function resetearContadorTrafico(slug: string): Promise<void> {
  await requerirSesion();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("config_trafico")
    .update({ cuenta_desde: new Date().toISOString() })
    .eq("id", 1);

  if (error) throw new Error("No se pudo resetear el contador de tráfico.");
  revalidarAdmin(slug);
}
