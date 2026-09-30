/**
 * Acceso a `retos_gps` (DT-035): el token con el que el móvil de cada reto
 * autentica sus posiciones en `/api/track`. Solo servidor y solo con el
 * cliente service role — la tabla no tiene políticas RLS.
 *
 * El token viaja en claro (el panel vuelve a mostrar la URL y el QR), así que
 * quien llame a las funciones de lectura desde una página debe haber
 * verificado antes la sesión en esa misma página (DT-034). Las Server Actions
 * que regeneran el token nunca lo devuelven.
 */

import { randomBytes } from "crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const CODIGO_VIOLACION_UNICIDAD = "23505";

/** 24 bytes = 192 bits de entropía; en base64url son 32 caracteres sin relleno. */
const BYTES_TOKEN_GPS = 24;

export interface CredencialGps {
  token: string;
  /** Última vez que se generó (ISO 8601). */
  actualizadoEn: string;
}

/** Lo que `/api/track` necesita del reto de la URL para autenticar y filtrar el punto. */
export interface TokenGpsDelReto {
  retoId: number;
  rutaId: string | null;
  token: string;
}

export type ResultadoGuardarTokenGps = "guardado" | "token-repetido" | "error";

/** Token nuevo, aleatorio y apto para ir en una query string sin codificar. */
export function generarTokenGps(): string {
  return randomBytes(BYTES_TOKEN_GPS).toString("base64url");
}

const filaCredencial = z.object({ track_token: z.string().min(1), updated_at: z.string() });

/**
 * Token del reto con su fecha, o null si no tiene (o si la consulta falla).
 * Nunca lanza.
 */
export async function obtenerTokenGps(retoId: number): Promise<CredencialGps | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("retos_gps")
      .select("track_token, updated_at")
      .eq("reto_id", retoId)
      .maybeSingle();
    if (error || !data) return null;
    const fila = filaCredencial.safeParse(data);
    if (!fila.success) return null;
    return { token: fila.data.track_token, actualizadoEn: fila.data.updated_at };
  } catch {
    return null;
  }
}

const filaCredencialConReto = filaCredencial.extend({ reto_id: z.number() });

/** Token de todos los retos que lo tienen, por id de reto. Vacío si falla; nunca lanza. */
export async function listarCredencialesGps(): Promise<Map<number, CredencialGps>> {
  try {
    const { data, error } = await getSupabaseAdmin().from("retos_gps").select("reto_id, track_token, updated_at");
    if (error || !data) return new Map();
    const filas = z.array(filaCredencialConReto).safeParse(data);
    if (!filas.success) return new Map();
    return new Map(
      filas.data.map((fila) => [fila.reto_id, { token: fila.track_token, actualizadoEn: fila.updated_at }])
    );
  } catch {
    return new Map();
  }
}

const filaTokenConReto = z.object({
  track_token: z.string().min(1),
  retos: z.object({ id: z.number(), ruta_id: z.string().nullable() }),
});

/**
 * Reto del slug con su token, en una sola consulta (`retos_gps` con `retos`
 * embebido por su clave foránea). Null si el reto no existe, si no tiene
 * token o si la consulta falla: `/api/track` responde igual en los tres casos.
 * Nunca lanza.
 */
export async function obtenerTokenGpsPorSlug(slug: string): Promise<TokenGpsDelReto | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("retos_gps")
      .select("track_token, retos!inner(id, ruta_id)")
      .eq("retos.slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    const fila = filaTokenConReto.safeParse(data);
    if (!fila.success) return null;
    return { retoId: fila.data.retos.id, rutaId: fila.data.retos.ruta_id, token: fila.data.track_token };
  } catch {
    return null;
  }
}

/**
 * Crea o sustituye el token del reto (el anterior deja de valer en el acto).
 * "token-repetido" si otro reto ya tiene ese token (unicidad en BD). Nunca
 * lanza ni incluye el token en ningún error.
 */
export async function guardarTokenGps(retoId: number, token: string): Promise<ResultadoGuardarTokenGps> {
  try {
    const { error } = await getSupabaseAdmin()
      .from("retos_gps")
      .upsert({ reto_id: retoId, track_token: token, updated_at: new Date().toISOString() }, { onConflict: "reto_id" });
    if (!error) return "guardado";
    return error.code === CODIGO_VIOLACION_UNICIDAD ? "token-repetido" : "error";
  } catch {
    return "error";
  }
}

/**
 * Genera y guarda un token nuevo para el reto. Si choca con el de otro reto
 * (improbable con 192 bits, pero la BD lo impide) se reintenta una vez con
 * otro. True si quedó guardado. Nunca lanza.
 */
export async function asignarTokenGpsNuevo(retoId: number): Promise<boolean> {
  const primerIntento = await guardarTokenGps(retoId, generarTokenGps());
  if (primerIntento === "guardado") return true;
  if (primerIntento === "error") return false;
  return (await guardarTokenGps(retoId, generarTokenGps())) === "guardado";
}
