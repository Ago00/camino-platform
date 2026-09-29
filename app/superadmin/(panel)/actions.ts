"use server";

/**
 * Server Actions del panel superadmin: CRUD de retos.
 *
 * Cada acción verifica la sesión con `requerirSesionSuperadmin()` por sí
 * misma, sin confiar en que el layout o el proxy ya lo hicieron (DT-010:
 * las Server Actions se sirven como POST a su propia ruta).
 *
 * `crearReto` inserta el intento inicial en fase "antes" justo después de
 * crear el reto, de modo que el panel admin del reto tenga algo con lo que
 * trabajar desde el primer momento.
 *
 * Contraseña de admin por reto (FP2.6, DT-029): obligatoria al crear,
 * opcional al editar (vacía = no cambiar). Se guarda solo su hash scrypt en
 * `retos_admin`; el texto plano no se guarda ni se registra nunca.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { limpiarCacheHistorico } from "@/lib/historico-cache";
import { limpiarCacheProgreso } from "@/lib/progreso-cache";
import { esRutaPredefinida } from "@/lib/rutas/catalogo";
import { hashearPassword } from "@/lib/auth/password";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { guardarHashAdmin } from "@/lib/supabase/credenciales-admin";
import { verificarSesionSuperadmin, NOMBRE_COOKIE_SUPERADMIN_SESION } from "@/lib/auth/superadmin-session";

class SesionSuperadminInvalidaError extends Error {
  constructor() {
    super("Sesión de superadmin inválida o expirada.");
  }
}

async function requerirSesionSuperadmin(): Promise<void> {
  const almacenCookies = await cookies();
  const cookieSesion = almacenCookies.get(NOMBRE_COOKIE_SUPERADMIN_SESION)?.value;
  if (!verificarSesionSuperadmin(cookieSesion)) {
    throw new SesionSuperadminInvalidaError();
  }
}

function revalidarPaneles(): void {
  revalidatePath("/superadmin");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Esquemas Zod
// ---------------------------------------------------------------------------

const esquemaSlug = z
  .string()
  .min(1, "El slug es obligatorio.")
  .max(60, "El slug no puede superar 60 caracteres.")
  .regex(/^[a-z0-9-]+$/, "El slug solo puede contener minúsculas, números y guiones.");

const esquemaNombre = z
  .string()
  .min(1, "El nombre es obligatorio.")
  .max(100, "El nombre no puede superar 100 caracteres.");

const esquemaPasswordAdmin = z
  .string()
  .min(8, "La contraseña de admin debe tener al menos 8 caracteres.")
  .max(200, "La contraseña de admin no puede superar 200 caracteres.");

/** Valor del campo `password_admin` del formulario; "" si no viene o no es texto. */
function leerPasswordAdmin(formData: FormData): string {
  const valor = formData.get("password_admin");
  return typeof valor === "string" ? valor : "";
}

function validarPasswordAdmin(password: string): string {
  const resultado = esquemaPasswordAdmin.safeParse(password);
  if (!resultado.success) {
    throw new Error(resultado.error.issues[0]?.message ?? "Contraseña de admin inválida.");
  }
  return resultado.data;
}

function validarRuta(data: { ruta_tipo: "predefinida" | "libre"; ruta_id?: string }, ctx: z.RefinementCtx): void {
  if (data.ruta_tipo === "predefinida" && !(data.ruta_id && esRutaPredefinida(data.ruta_id))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
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
    ruta_tipo: z.enum(["predefinida", "libre"]),
    ruta_id: z.string().optional(),
  })
  .superRefine(validarRuta);

const esquemaEditarReto = z
  .object({
    nombre: esquemaNombre,
    descripcion: z.string().optional(),
    ruta_tipo: z.enum(["predefinida", "libre"]),
    ruta_id: z.string().optional(),
    activo: z.boolean(),
  })
  .superRefine(validarRuta);

function rutaIdAGuardar(data: { ruta_tipo: "predefinida" | "libre"; ruta_id?: string }): string | null {
  return data.ruta_tipo === "predefinida" ? (data.ruta_id ?? null) : null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Crea un nuevo reto con sus datos básicos y siembra el primer intento en
 * fase "antes" para que el panel admin funcione desde el primer momento.
 */
export async function crearReto(formData: FormData): Promise<void> {
  await requerirSesionSuperadmin();

  const datos = {
    slug: formData.get("slug") as string,
    nombre: formData.get("nombre") as string,
    descripcion: formData.get("descripcion") as string | undefined,
    ruta_tipo: formData.get("ruta_tipo") as string,
    ruta_id: (formData.get("ruta_id") as string) || undefined,
  };

  const resultado = esquemaCrearReto.safeParse(datos);
  if (!resultado.success) {
    const primer = resultado.error.issues[0];
    throw new Error(primer?.message ?? "Datos del reto inválidos.");
  }
  // Antes de insertar nada: un reto nuevo sin contraseña no tendría panel usable.
  const passwordAdmin = validarPasswordAdmin(leerPasswordAdmin(formData));

  const supabase = getSupabaseAdmin();

  const { data: retoCreado, error: errorReto } = await supabase
    .from("retos")
    .insert({
      slug: resultado.data.slug,
      nombre: resultado.data.nombre,
      descripcion: resultado.data.descripcion ?? null,
      ruta_tipo: resultado.data.ruta_tipo,
      ruta_id: rutaIdAGuardar(resultado.data),
      activo: true,
    })
    .select("id")
    .single();

  if (errorReto || !retoCreado) {
    throw new Error("No se pudo crear el reto.");
  }

  // Sembrar el primer intento en fase "antes" para que el panel admin
  // tenga una fila activa con la que trabajar desde el primer momento.
  const { error: errorIntento } = await supabase.from("intentos").insert({
    reto_id: retoCreado.id,
    fase: "antes",
  });

  if (errorIntento) {
    throw new Error("El reto se creó pero no se pudo sembrar el intento inicial.");
  }

  revalidarPaneles();

  try {
    await guardarHashAdmin(retoCreado.id, await hashearPassword(passwordAdmin));
  } catch {
    // El reto ya existe (y aparece como "sin configurar" en el panel): no se
    // deshace, basta con fijar la contraseña editándolo.
    throw new Error("Reto creado; fija la contraseña editándolo.");
  }
}

/**
 * Actualiza los campos editables de un reto. El slug es inmutable.
 */
export async function editarReto(id: number, formData: FormData): Promise<void> {
  await requerirSesionSuperadmin();

  const datos = {
    nombre: formData.get("nombre") as string,
    descripcion: formData.get("descripcion") as string | undefined,
    ruta_tipo: formData.get("ruta_tipo") as string,
    ruta_id: (formData.get("ruta_id") as string) || undefined,
    activo: formData.get("activo") === "true",
  };

  const resultado = esquemaEditarReto.safeParse(datos);
  if (!resultado.success) {
    const primer = resultado.error.issues[0];
    throw new Error(primer?.message ?? "Datos del reto inválidos.");
  }
  // Vacío = no cambiar la contraseña. Se valida antes de tocar la BD para no
  // dejar la edición a medias si la contraseña nueva no es válida.
  const passwordEnFormulario = leerPasswordAdmin(formData);
  const passwordNueva = passwordEnFormulario === "" ? null : validarPasswordAdmin(passwordEnFormulario);

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("retos")
    .update({
      nombre: resultado.data.nombre,
      descripcion: resultado.data.descripcion ?? null,
      ruta_tipo: resultado.data.ruta_tipo,
      ruta_id: rutaIdAGuardar(resultado.data),
      activo: resultado.data.activo,
    })
    .eq("id", id);

  if (error) {
    throw new Error("No se pudo actualizar el reto.");
  }

  // El progreso cacheado se calculó con la ruta anterior.
  limpiarCacheProgreso(id);
  limpiarCacheHistorico(id);

  revalidatePath("/superadmin");
  revalidatePath("/");
  revalidatePath("/", "layout");

  if (passwordNueva !== null) {
    // Un hash nuevo (salt nuevo) cambia la huella: las sesiones de admin
    // abiertas con la contraseña anterior dejan de valer (DT-029).
    await guardarHashAdmin(id, await hashearPassword(passwordNueva));
  }
}

/**
 * Elimina un reto y todos sus datos asociados (cascada en BD).
 */
export async function eliminarReto(id: number): Promise<void> {
  await requerirSesionSuperadmin();

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("retos").delete().eq("id", id);

  if (error) {
    throw new Error("No se pudo eliminar el reto.");
  }

  revalidarPaneles();
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
