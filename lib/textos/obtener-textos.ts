/**
 * Lee la tabla `textos` (Supabase, cliente anon — RLS solo permite SELECT) y
 * fusiona el resultado con los valores por defecto de `defaults.ts`.
 *
 * Solo lectura en F3: la edición de textos es F4 (panel admin). Si la tabla
 * está vacía, si falta una clave concreta, o si la consulta falla, cada
 * clave cae a su valor por defecto — la web nunca sale en blanco (invariante
 * documentada en docs/tecnico/modelo-datos.md).
 */

import { getSupabasePublic } from "@/lib/supabase/public";
import { TEXTOS_POR_DEFECTO, type ClaveTexto } from "@/lib/textos/defaults";

export type Textos = Record<ClaveTexto, string>;

/**
 * Devuelve todos los textos de la web del reto indicado, con el override de
 * BD aplicado sobre los valores por defecto. Cada reto tiene sus propios
 * overrides (unique `(reto_id, clave)`, FP2.5/DT-028): sin el filtro por
 * reto, la misma clave de dos retos distintos colisionaría y ganaría la
 * última fila leída. No lanza: cualquier error de red o de consulta se trata
 * igual que "no hay overrides" (fallback completo a los defaults).
 */
export async function obtenerTextos(retoId: number): Promise<Textos> {
  const textos: Textos = { ...TEXTOS_POR_DEFECTO };

  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase
      .from("textos")
      .select("clave, valor")
      .eq("reto_id", retoId);

    if (error || !data) {
      return textos;
    }

    for (const fila of data) {
      if (esClaveConocida(fila.clave) && fila.valor.trim() !== "") {
        textos[fila.clave] = fila.valor;
      }
    }
  } catch {
    // Sin proyecto Supabase configurado, o fallo de red: se sirven los defaults.
    return textos;
  }

  return textos;
}

function esClaveConocida(clave: string): clave is ClaveTexto {
  return clave in TEXTOS_POR_DEFECTO;
}
