/**
 * Verificación completa de la sesión de admin en Server Components y Server
 * Actions (FP2.6, DT-029): cookie firmada y vigente, del reto del slug (id y
 * slug) y con la huella de su contraseña actual. Es la comprobación que
 * `proxy.ts` no puede hacer porque no consulta BD.
 *
 * Solo servidor (lee cookies y usa el cliente service role).
 */

import { cookies } from "next/headers";
import { NOMBRE_COOKIE_SESION, verificarSesion } from "@/lib/auth/admin-session";
import { huellaCredencial } from "@/lib/auth/password";
import { obtenerHashAdmin } from "@/lib/supabase/credenciales-admin";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";
import type { Reto } from "@/lib/types";

/**
 * Reto del slug si la petición trae una sesión de admin válida para él; null
 * si no hay cookie, es de otro reto, está caducada, la contraseña cambió, el
 * reto no tiene contraseña o el reto no existe. No distingue el motivo.
 */
export async function resolverRetoConSesion(slug: string): Promise<Reto | null> {
  const almacenCookies = await cookies();
  const cookieSesion = almacenCookies.get(NOMBRE_COOKIE_SESION)?.value;
  if (!cookieSesion) return null;

  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) return null;

  const hash = await obtenerHashAdmin(reto.id);
  const huellaActual = hash === null ? null : huellaCredencial(hash);
  return verificarSesion(cookieSesion, reto, huellaActual) ? reto : null;
}
