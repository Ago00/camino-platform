"use server";

/**
 * Server Actions del panel superadmin: CRUD de retos.
 *
 * Cada acción verifica la sesión por sí misma, sin confiar en que el layout o
 * el proxy ya lo hicieron (DT-010: las Server Actions se sirven como POST a su
 * propia ruta).
 *
 * Las acciones de CRUD se usan con `useActionState` y devuelven un resultado
 * en vez de lanzar (ver `resultado-accion.ts`): en producción Next redacta el
 * mensaje de los errores lanzados y el superadmin no sabría qué ha pasado.
 * Eso incluye la sesión caducada: no se ejecuta nada y se le pide volver a
 * entrar, en vez de mostrarle un error genérico. Editar y eliminar redirigen
 * al panel limpio cuando terminan bien.
 *
 * `crearReto` inserta el intento inicial en fase "antes" justo después de
 * crear el reto, de modo que el panel admin del reto tenga algo con lo que
 * trabajar desde el primer momento.
 *
 * Contraseña de admin por reto (FP2.6, DT-029): obligatoria al crear,
 * opcional al editar (vacía = no cambiar). Se guarda solo su hash scrypt en
 * `retos_admin`; el texto plano no se guarda, no se registra ni aparece nunca
 * en un resultado.
 *
 * Token del GPS por reto (DT-035): `crearReto` le genera uno; si falla, el
 * reto se crea igual y su tarjeta muestra "Sin token GPS" con el botón
 * "Generar" (`regenerarTokenGpsReto`, la misma acción que regenerar).
 * Ninguna acción devuelve el token.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { limpiarCacheHistorico } from "@/lib/historico-cache";
import { limpiarCacheProgreso } from "@/lib/progreso-cache";
import { esRutaPredefinida } from "@/lib/rutas/catalogo";
import { hashearPassword } from "@/lib/auth/password";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { guardarHashAdmin } from "@/lib/supabase/credenciales-admin";
import { asignarTokenGpsNuevo } from "@/lib/supabase/credenciales-gps";
import { verificarSesionSuperadmin, NOMBRE_COOKIE_SUPERADMIN_SESION } from "@/lib/auth/superadmin-session";
import {
  urlPanelTrasEliminar,
  urlPanelTrasGuardar,
  type ResultadoAccionSuperadmin,
  type ResultadoCrearReto,
} from "./resultado-accion";

const CODIGO_VIOLACION_UNICIDAD = "23505";

const RESULTADO_SESION_CADUCADA = {
  ok: false,
  mensaje: "Tu sesión de superadmin ha caducado. Vuelve a iniciar sesión.",
} as const satisfies ResultadoAccionSuperadmin;

const RESULTADO_RETO_INEXISTENTE = {
  ok: false,
  mensaje: "Ese reto ya no existe. Recarga el panel.",
} as const satisfies ResultadoAccionSuperadmin;

async function haySesionSuperadminValida(): Promise<boolean> {
  const almacenCookies = await cookies();
  const cookieSesion = almacenCookies.get(NOMBRE_COOKIE_SUPERADMIN_SESION)?.value;
  return verificarSesionSuperadmin(cookieSesion);
}

function revalidarPaneles(): void {
  revalidatePath("/superadmin");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Lectura y validación del formulario
// ---------------------------------------------------------------------------

/** Valor de texto de un campo; undefined si no viene o no es texto (un fichero). */
function leerTexto(formData: FormData, campo: string): string | undefined {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : undefined;
}

function primerMensaje(error: z.ZodError, porDefecto: string): string {
  return error.issues[0]?.message ?? porDefecto;
}

const esquemaSlug = z
  .string()
  .min(1, "El slug es obligatorio.")
  .max(60, "El slug no puede superar 60 caracteres.")
  .regex(/^[a-z0-9-]+$/, "El slug solo puede contener minúsculas, números y guiones.");

const esquemaNombre = z
  .string()
  .min(1, "El nombre es obligatorio.")
  .max(100, "El nombre no puede superar 100 caracteres.");

const esquemaTipoRuta = z.enum(["predefinida", "libre"], { error: "Elige un tipo de ruta válido." });

const esquemaPasswordAdmin = z
  .string()
  .min(8, "La contraseña de admin debe tener al menos 8 caracteres.")
  .max(200, "La contraseña de admin no puede superar 200 caracteres.");

const esquemaIdReto = z.number().int().positive();

function validarRuta(data: { ruta_tipo: "predefinida" | "libre"; ruta_id?: string }, ctx: z.RefinementCtx): void {
  if (data.ruta_tipo === "predefinida" && !(data.ruta_id && esRutaPredefinida(data.ruta_id))) {
    ctx.addIssue({
      code: "custom",
      message: "Elige una ruta predefinida válida.",
      path: ["ruta_id"],
    });
  }
}

const esquemaCrearReto = z
  .object({
    slug: esquemaSlug,
    nombre: esquemaNombre,
    descripcion: z.string().optional(),
    ruta_tipo: esquemaTipoRuta,
    ruta_id: z.string().optional(),
  })
  .superRefine(validarRuta);

const esquemaEditarReto = z
  .object({
    nombre: esquemaNombre,
    descripcion: z.string().optional(),
    ruta_tipo: esquemaTipoRuta,
    ruta_id: z.string().optional(),
    activo: z.boolean(),
  })
  .superRefine(validarRuta);

function rutaIdAGuardar(data: { ruta_tipo: "predefinida" | "libre"; ruta_id?: string }): string | null {
  return data.ruta_tipo === "predefinida" ? (data.ruta_id ?? null) : null;
}

/** Hashea y guarda la contraseña del reto. False si falla: el llamante decide cómo avisar. */
async function guardarPasswordAdmin(retoId: number, password: string): Promise<boolean> {
  try {
    await guardarHashAdmin(retoId, await hashearPassword(password));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Crea un nuevo reto con sus datos básicos, siembra el primer intento en fase
 * "antes" y guarda el hash de su contraseña de admin.
 */
export async function crearReto(_estadoPrevio: ResultadoCrearReto | null, formData: FormData): Promise<ResultadoCrearReto> {
  if (!(await haySesionSuperadminValida())) return RESULTADO_SESION_CADUCADA;

  const resultado = esquemaCrearReto.safeParse({
    slug: (leerTexto(formData, "slug") ?? "").trim().toLowerCase(),
    nombre: leerTexto(formData, "nombre") ?? "",
    descripcion: leerTexto(formData, "descripcion"),
    ruta_tipo: leerTexto(formData, "ruta_tipo"),
    ruta_id: leerTexto(formData, "ruta_id") || undefined,
  });
  if (!resultado.success) {
    return { ok: false, mensaje: primerMensaje(resultado.error, "Datos del reto inválidos.") };
  }
  // Antes de insertar nada: un reto nuevo sin contraseña no tendría panel usable.
  const password = esquemaPasswordAdmin.safeParse(leerTexto(formData, "password_admin") ?? "");
  if (!password.success) {
    return { ok: false, mensaje: primerMensaje(password.error, "Contraseña de admin inválida.") };
  }

  const { slug, nombre } = resultado.data;
  const supabase = getSupabaseAdmin();

  const { data: retoCreado, error: errorReto } = await supabase
    .from("retos")
    .insert({
      slug,
      nombre,
      descripcion: resultado.data.descripcion ?? null,
      ruta_tipo: resultado.data.ruta_tipo,
      ruta_id: rutaIdAGuardar(resultado.data),
      activo: true,
    })
    .select("id")
    .single();

  if (errorReto?.code === CODIGO_VIOLACION_UNICIDAD) {
    return { ok: false, mensaje: `Ya existe un reto con el slug «${slug}». Elige otro.` };
  }
  if (errorReto || !retoCreado) {
    return { ok: false, mensaje: "No se pudo crear el reto. Inténtalo de nuevo." };
  }

  // Sembrar el primer intento en fase "antes" para que el panel admin
  // tenga una fila activa con la que trabajar desde el primer momento.
  const { error: errorIntento } = await supabase.from("intentos").insert({
    reto_id: retoCreado.id,
    fase: "antes",
  });

  // El reto ya existe pase lo que pase a partir de aquí: el panel debe verlo.
  revalidarPaneles();

  // Aunque falle el intento se intenta guardar la contraseña: sin ella el
  // admin del reto no podría entrar a crear ese intento desde su panel.
  const passwordGuardada = await guardarPasswordAdmin(retoCreado.id, password.data);
  const tokenGpsGuardado = await asignarTokenGpsNuevo(retoCreado.id);
  const avisoTokenGps = tokenGpsGuardado ? "" : " No se pudo generar su token del GPS: pulsa «Generar» en su tarjeta.";

  if (errorIntento) {
    const avisoPassword = passwordGuardada ? "" : " Tampoco se pudo guardar la contraseña: fíjala editándolo.";
    return {
      ok: false,
      mensaje: `El reto «${nombre}» se creó, pero no se pudo preparar su primer intento: créalo desde su panel admin.${avisoPassword}${avisoTokenGps}`,
    };
  }
  if (!passwordGuardada) {
    // No se deshace el reto (aparece como "sin configurar"): basta con fijar
    // la contraseña editándolo.
    return {
      ok: false,
      mensaje: `El reto «${nombre}» se creó, pero no se pudo guardar la contraseña: fíjala editándolo.${avisoTokenGps}`,
    };
  }

  return { ok: true, mensaje: `Reto «${nombre}» creado.${avisoTokenGps}`, slug };
}

/**
 * Actualiza los campos editables de un reto (el slug es inmutable) y, si
 * termina bien, redirige al panel con el aviso de guardado.
 */
export async function editarReto(
  id: number,
  _estadoPrevio: ResultadoAccionSuperadmin | null,
  formData: FormData
): Promise<ResultadoAccionSuperadmin> {
  if (!(await haySesionSuperadminValida())) return RESULTADO_SESION_CADUCADA;
  if (!esquemaIdReto.safeParse(id).success) return RESULTADO_RETO_INEXISTENTE;

  const resultado = esquemaEditarReto.safeParse({
    nombre: leerTexto(formData, "nombre") ?? "",
    descripcion: leerTexto(formData, "descripcion"),
    ruta_tipo: leerTexto(formData, "ruta_tipo"),
    ruta_id: leerTexto(formData, "ruta_id") || undefined,
    activo: leerTexto(formData, "activo") === "true",
  });
  if (!resultado.success) {
    return { ok: false, mensaje: primerMensaje(resultado.error, "Datos del reto inválidos.") };
  }
  // Vacío = no cambiar la contraseña. Se valida antes de tocar la BD para no
  // dejar la edición a medias si la contraseña nueva no es válida.
  const passwordEnFormulario = leerTexto(formData, "password_admin") ?? "";
  let passwordNueva: string | null = null;
  if (passwordEnFormulario !== "") {
    const password = esquemaPasswordAdmin.safeParse(passwordEnFormulario);
    if (!password.success) {
      return { ok: false, mensaje: primerMensaje(password.error, "Contraseña de admin inválida.") };
    }
    passwordNueva = password.data;
  }

  const supabase = getSupabaseAdmin();

  const { data: retosActualizados, error } = await supabase
    .from("retos")
    .update({
      nombre: resultado.data.nombre,
      descripcion: resultado.data.descripcion ?? null,
      ruta_tipo: resultado.data.ruta_tipo,
      ruta_id: rutaIdAGuardar(resultado.data),
      activo: resultado.data.activo,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return { ok: false, mensaje: "No se pudieron guardar los cambios del reto. Inténtalo de nuevo." };
  }
  if (!retosActualizados || retosActualizados.length === 0) {
    revalidarPaneles();
    return RESULTADO_RETO_INEXISTENTE;
  }

  // El progreso cacheado se calculó con la ruta anterior.
  limpiarCacheProgreso(id);
  limpiarCacheHistorico(id);

  revalidatePath("/superadmin");
  revalidatePath("/");
  revalidatePath("/", "layout");

  // Un hash nuevo (salt nuevo) cambia la huella: las sesiones de admin
  // abiertas con la contraseña anterior dejan de valer (DT-029).
  if (passwordNueva !== null && !(await guardarPasswordAdmin(id, passwordNueva))) {
    return {
      ok: false,
      mensaje: "Los cambios del reto se guardaron, pero no se pudo cambiar la contraseña. Inténtalo de nuevo.",
    };
  }

  redirect(urlPanelTrasGuardar(id));
}

/**
 * Elimina un reto y todos sus datos asociados (cascada en BD) y, si termina
 * bien, redirige al panel con el aviso de eliminación.
 */
export async function eliminarReto(id: number): Promise<ResultadoAccionSuperadmin> {
  if (!(await haySesionSuperadminValida())) return RESULTADO_SESION_CADUCADA;
  if (!esquemaIdReto.safeParse(id).success) return RESULTADO_RETO_INEXISTENTE;

  const supabase = getSupabaseAdmin();

  const { data: retosEliminados, error } = await supabase.from("retos").delete().eq("id", id).select("slug");

  if (error) {
    return { ok: false, mensaje: "No se pudo eliminar el reto. Inténtalo de nuevo." };
  }

  revalidarPaneles();

  const retoEliminado = retosEliminados?.[0];
  if (!retoEliminado) return RESULTADO_RETO_INEXISTENTE;

  redirect(urlPanelTrasEliminar(retoEliminado.slug));
}

/**
 * Genera un token del GPS nuevo para el reto (o el primero, si no tenía): el
 * anterior deja de valer en el acto. No devuelve el token; el panel lo vuelve
 * a leer al revalidarse, tras verificar la sesión en la página.
 */
export async function regenerarTokenGpsReto(retoId: number): Promise<ResultadoAccionSuperadmin> {
  if (!(await haySesionSuperadminValida())) return RESULTADO_SESION_CADUCADA;
  if (!esquemaIdReto.safeParse(retoId).success) return RESULTADO_RETO_INEXISTENTE;

  // Un reto inexistente hace fallar el upsert por la clave foránea: mismo
  // mensaje genérico, y la revalidación retira su tarjeta si ya no está.
  const guardado = await asignarTokenGpsNuevo(retoId);
  revalidatePath("/superadmin");
  if (!guardado) return { ok: false, mensaje: "No se pudo generar el token del GPS. Inténtalo de nuevo." };
  return { ok: true, mensaje: "Token del GPS generado. Pega la URL nueva en OwnTracks." };
}

/**
 * Cierra la sesión del superadmin borrando su cookie.
 * No requiere sesión previa válida: cerrar sesión debe funcionar aunque
 * la cookie ya esté corrupta o expirada.
 */
export async function cerrarSesionSuperadmin(): Promise<void> {
  const almacenCookies = await cookies();
  almacenCookies.delete(NOMBRE_COOKIE_SUPERADMIN_SESION);
}
