/**
 * Layout protegido del panel superadmin.
 *
 * Al estar en un route group `(panel)`, este layout solo cubre las rutas
 * dentro del grupo (/superadmin), sin afectar a /superadmin/login — que
 * queda fuera del grupo y no tiene restricción de sesión.
 *
 * Si la sesión es inválida o ausente, redirige al login. Esta es la segunda
 * capa de defensa: la primera es proxy.ts, que actúa a nivel de edge.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verificarSesionSuperadmin, NOMBRE_COOKIE_SUPERADMIN_SESION } from "@/lib/auth/superadmin-session";

export default async function SuperadminPanelLayout({ children }: { children: React.ReactNode }) {
  const almacenCookies = await cookies();
  const cookieSesion = almacenCookies.get(NOMBRE_COOKIE_SUPERADMIN_SESION)?.value;
  if (!verificarSesionSuperadmin(cookieSesion)) {
    redirect("/superadmin/login");
  }

  return <>{children}</>;
}
