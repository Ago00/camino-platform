/**
 * Helpers de resolución de reto por slug o por ID.
 *
 * `obtenerRetoPorSlug` está envuelta en `React.cache()` para deduplicar la
 * consulta dentro del render tree de un mismo request: si layout y page la
 * llaman con el mismo slug, solo hay un round-trip a BD (DT-026).
 */

import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
