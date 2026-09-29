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
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { esRutaPredefinida } from "@/lib/rutas/catalogo";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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

  revalidatePath("/superadmin");
  revalidatePath("/");
  revalidatePath("/", "layout");
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
