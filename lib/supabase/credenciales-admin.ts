/**
 * Acceso a `retos_admin` (FP2.6, DT-029): hash de la contraseña de admin de
 * cada reto. Solo servidor y solo con el cliente service role — la tabla no
 * tiene políticas RLS, así que el cliente público no puede ni leerla.
 *
 * Aquí solo viajan hashes (`lib/auth/password.ts`); nunca texto plano.
 */

import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Hash guardado de la contraseña de admin del reto, o null si no tiene
 * (o si la consulta falla: quien lo usa para autenticar debe rechazar, así
 * que fallar cerrado es lo correcto). Nunca lanza. `React.cache` deduplica la
 * consulta dentro de un mismo request (página + secciones).
 */
export const obtenerHashAdmin = cache(async (retoId: number): Promise<string | null> => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("retos_admin")
      .select("password_hash")
      .eq("reto_id", retoId)
      .maybeSingle();
    if (error || !data) return null;
    return data.password_hash;
  } catch {
    return null;
  }
});

/**
 * Crea o sustituye la credencial del reto. Lanza si Supabase falla (el
 * llamador decide el mensaje; el error nunca incluye el hash).
 */
export async function guardarHashAdmin(retoId: number, hash: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("retos_admin")
    .upsert({ reto_id: retoId, password_hash: hash, updated_at: new Date().toISOString() }, { onConflict: "reto_id" });
  if (error) throw new Error("No se pudo guardar la contraseña de admin del reto.");
}

/** Ids de los retos que tienen contraseña de admin configurada. Vacío si falla; nunca lanza. */
export async function listarRetosConCredencial(): Promise<Set<number>> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("retos_admin").select("reto_id");
    if (error || !data) return new Set();
    return new Set(data.map((fila) => fila.reto_id));
  } catch {
    return new Set();
  }
}
