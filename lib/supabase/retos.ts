/**
 * Helpers de resolución de reto por slug o por ID, y listados de retos.
 *
 * `obtenerRetoPorSlug` está envuelta en `React.cache()` para deduplicar la
 * consulta dentro del render tree de un mismo request: si layout y page la
 * llaman con el mismo slug, solo hay un round-trip a BD (DT-026).
 *
 * `listarRetosActivos` usa el cliente público porque la política RLS de la
 * tabla `retos` ya filtra por `activo = true` para el rol anon.
 *
 * `listarTodosLosRetos` usa el cliente admin porque necesita ver todos los
 * retos (activos e inactivos) para el panel superadmin, y la política RLS
 * bloquea los inactivos al cliente público.
 */

import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabasePublic } from "@/lib/supabase/public";
import type { Reto } from "@/lib/types";

/**
 * Devuelve el reto completo dado su slug. Null si no existe o si Supabase
 * falla; nunca lanza. El caller es responsable de llamar a `notFound()` si
 * necesita responder con un 404.
 */
export const obtenerRetoPorSlug = cache(async (slug: string): Promise<Reto | null> => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("retos")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return data as Reto;
  } catch {
    return null;
  }
});

/**
 * Devuelve todos los retos con `activo = true`, ordenados por fecha de
 * creación descendente. Usa el cliente público — la política RLS de la
 * tabla `retos` ya filtra por `activo` para el rol anon.
 * Devuelve array vacío si falla; nunca lanza.
 */
export async function listarRetosActivos(): Promise<Reto[]> {
  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase
      .from("retos")
      .select("*")
      .eq("activo", true)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as Reto[];
  } catch {
    return [];
  }
}

/**
 * Devuelve todos los retos (activos e inactivos), ordenados por fecha de
 * creación descendente. Usa el cliente admin para poder ver los inactivos
 * (la política RLS bloquea al cliente público para retos con activo = false).
 * Devuelve array vacío si falla; nunca lanza.
 */
export async function listarTodosLosRetos(): Promise<Reto[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("retos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data as Reto[];
  } catch {
    return [];
  }
}
