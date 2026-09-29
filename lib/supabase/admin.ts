/**
 * Cliente Supabase con service_role key — exclusivamente server-side.
 *
 * Da acceso ALL a todas las tablas (bypassa RLS), así que nunca debe importarse
 * desde código que se ejecute en el navegador. Se usa en route handlers y
 * server actions: `/api/track`, `/admin/actions.ts`, etc.
 *
 * Construcción perezosa (lazy): el cliente solo se construye la primera vez
 * que alguien llama a `getSupabaseAdmin()`. Esto evita que el build falle
 * si las env vars no están presentes en el entorno de construcción.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Comentario,
  ConfigTrafico,
  Intencion,
  Intento,
  MinutoAMinuto,
  Posicion,
  Reto,
  RetoAdmin,
  Texto,
  VisitaWeb,
} from "@/lib/types";

type CampoRetoOpcionalAlCrear =
  | "seccion_intenciones"
  | "seccion_comentarios"
  | "seccion_minuto_a_minuto"
  | "seccion_instagram"
  | "respuestas_visitantes"
  | "quien_camina_foto_url";

/**
 * Esquema de BD tipado para el cliente Supabase (espejo de lib/types.ts).
 *
 * `Relationships`, `Views` y `Functions` son obligatorios en el contrato de
 * @supabase/postgrest-js (GenericSchema): `Views`/`Functions` van vacíos
 * (`Record<string, never>`) porque no se usan.
 *
 * Cada `Row` se envuelve en `Pick<T, keyof T>` a propósito. `@supabase/
 * supabase-js` exige que `Row` sea estructuralmente asignable a
 * `Record<string, unknown>` (index signature), y los `interface` de
 * lib/types.ts (Intento, Posicion...) no tienen index signature implícito
 * — TypeScript los trata como no asignables a `Record<string, unknown>`.
 * Sin este envoltorio, el chequeo `Schema extends GenericSchema` de
 * @supabase/supabase-js falla de forma silenciosa (cae a su default `never`
 * sin avisar) y CUALQUIER `.from(tabla).insert(...)/.update(...)` resuelve
 * a `never` sin ningún error hasta que se llama con datos reales. `Pick<T,
 * keyof T>` reconstruye T como mapped type (sí tiene index signature
 * estructural) preservando exactamente los mismos campos. Reproducido y
 * documentado: ver docs/tecnico/decisiones-tecnicas.md si se añade una
 * entrada, o el propio comentario aquí como única fuente por ahora.
 */
export interface BaseDeDatos {
  public: {
    Tables: {
      retos: {
        Row: Pick<Reto, keyof Reto>;
        // La configuración de FP3c (DT-032) tiene defaults en BD: el
        // superadmin crea retos sin fijarla.
        Insert: Omit<Pick<Reto, keyof Reto>, "id" | "created_at" | CampoRetoOpcionalAlCrear> &
          Partial<Pick<Pick<Reto, keyof Reto>, CampoRetoOpcionalAlCrear>>;
        Update: Partial<Pick<Reto, keyof Reto>>;
        Relationships: [];
      };
      intentos: {
        Row: Pick<Intento, keyof Intento>;
        // reto_id es el único campo sin default en BD. El resto: fase/modo/cerrado
        // tienen defaults; destino_lat/lon/started_at/etc. son nullable.
        // id y created_at son generados por BD — excluidos.
        Insert: Pick<Pick<Intento, keyof Intento>, "reto_id"> &
          Partial<Omit<Pick<Intento, keyof Intento>, "id" | "created_at" | "reto_id">>;
        Update: Partial<Pick<Intento, keyof Intento>>;
        Relationships: [];
      };
      posiciones: {
        Row: Pick<Posicion, keyof Posicion>;
        Insert: Omit<Pick<Posicion, keyof Posicion>, "id" | "created_at" | "descartado"> &
          Partial<Pick<Pick<Posicion, keyof Posicion>, "descartado">>;
        Update: Partial<Pick<Posicion, keyof Posicion>>;
        Relationships: [];
      };
      intenciones: {
        Row: Pick<Intencion, keyof Intencion>;
        // reto_id es requerido (NOT NULL en BD). FP1 lo inyectará desde el contexto
        // del reto activo; en FP0 los callers usan reto_id: 1 (portuguesa-110).
        Insert: Omit<Pick<Intencion, keyof Intencion>, "id" | "created_at">;
        Update: Partial<Pick<Intencion, keyof Intencion>>;
        Relationships: [];
      };
      comentarios: {
        Row: Pick<Comentario, keyof Comentario>;
        // reto_id requerido; oculto, parent_id y es_autor opcionales (defaults en BD).
        Insert: Omit<Pick<Comentario, keyof Comentario>, "id" | "created_at" | "oculto" | "parent_id" | "es_autor"> &
          Partial<Pick<Pick<Comentario, keyof Comentario>, "oculto" | "parent_id" | "es_autor">>;
        Update: Partial<Pick<Comentario, keyof Comentario>>;
        Relationships: [];
      };
      textos: {
        Row: Pick<Texto, keyof Texto>;
        // id generado automáticamente; updated_at con default en BD.
        Insert: Omit<Pick<Texto, keyof Texto>, "id" | "updated_at">;
        Update: Partial<Pick<Texto, keyof Texto>>;
        Relationships: [];
      };
      minuto_a_minuto: {
        Row: Pick<MinutoAMinuto, keyof MinutoAMinuto>;
        Insert: Omit<Pick<MinutoAMinuto, keyof MinutoAMinuto>, "id" | "created_at" | "updated_at">;
        Update: Partial<Pick<MinutoAMinuto, keyof MinutoAMinuto>>;
        Relationships: [];
      };
      visitas_web: {
        Row: Pick<VisitaWeb, keyof VisitaWeb>;
        // reto_id requerido (NOT NULL en BD). FP1 lo inyectará dinámicamente.
        Insert: Omit<Pick<VisitaWeb, keyof VisitaWeb>, "id" | "created_at">;
        Update: Partial<Pick<VisitaWeb, keyof VisitaWeb>>;
        Relationships: [];
      };
      config_trafico: {
        Row: Pick<ConfigTrafico, keyof ConfigTrafico>;
        // reto_id requerido (no tiene default en BD); cuenta_desde opcional (default now()).
        Insert: Pick<Pick<ConfigTrafico, keyof ConfigTrafico>, "reto_id"> &
          Partial<Omit<Pick<ConfigTrafico, keyof ConfigTrafico>, "id" | "created_at" | "reto_id">>;
        Update: Partial<Pick<ConfigTrafico, keyof ConfigTrafico>>;
        Relationships: [];
      };
      retos_admin: {
        Row: Pick<RetoAdmin, keyof RetoAdmin>;
        // updated_at tiene default now() en BD, pero el upsert lo fija
        // explícitamente para que también cambie al actualizar.
        Insert: Pick<Pick<RetoAdmin, keyof RetoAdmin>, "reto_id" | "password_hash"> &
          Partial<Pick<Pick<RetoAdmin, keyof RetoAdmin>, "updated_at">>;
        Update: Partial<Pick<RetoAdmin, keyof RetoAdmin>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

let clienteAdmin: SupabaseClient<BaseDeDatos> | null = null;

/**
 * Devuelve el cliente admin, construyéndolo la primera vez que se llama.
 * Lanza si `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` no están
 * definidas — pero solo en ese momento, nunca al importar el módulo.
 *
 * La URL usa el prefijo `NEXT_PUBLIC_` (misma variable que public.ts) porque
 * la URL de un proyecto Supabase no es secreta — no tiene sentido una
 * variable de servidor separada solo para ella. El secreto real de este
 * cliente es `SUPABASE_SERVICE_ROLE_KEY`, que sigue sin prefijo.
 */
export function getSupabaseAdmin(): SupabaseClient<BaseDeDatos> {
  if (clienteAdmin) return clienteAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan las env vars NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. " +
        "Este cliente solo puede usarse server-side, con el proyecto Supabase configurado."
    );
  }

  clienteAdmin = createClient<BaseDeDatos>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return clienteAdmin;
}
