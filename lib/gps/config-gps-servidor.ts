/**
 * Prepara en el servidor lo que el panel enseña para configurar el GPS de un
 * reto (DT-035): la URL de `/api/track` con su token, que se pega a mano en
 * OwnTracks siguiendo el tutorial del panel. Lo usan la pestaña GPS del admin
 * del reto y las tarjetas del superadmin (`components/gps/ConfigGps.tsx`).
 *
 * Solo servidor. Recibe una credencial ya leída: quien la lea tiene que haber
 * verificado la sesión en su propia página (DT-034).
 */

import { headers } from "next/headers";
import {
  origenDelTracker,
  origenDesdeCabeceras,
  urlTrackerConToken,
  urlTrackerDelReto,
  type OrigenTracker,
} from "@/lib/gps/url-tracker";
import type { CredencialGps } from "@/lib/supabase/credenciales-gps";

export interface DatosConfigGps {
  /** Para mostrar la URL con el token enmascarado mientras está oculta. */
  urlSinToken: string;
  urlTracker: string;
  fechaActualizacion: string;
  /** La URL usa el dominio de esta petición, no el de producción (ver `origenDelTracker`). */
  origenProvisional: boolean;
}

/** Origen para la URL del GPS: el de producción de Vercel o, si no hay, el de esta petición. */
export async function obtenerOrigenTracker(): Promise<OrigenTracker> {
  const cabeceras = await headers();
  const origenPeticion = origenDesdeCabeceras(
    cabeceras.get("x-forwarded-host") ?? cabeceras.get("host"),
    cabeceras.get("x-forwarded-proto")
  );
  return origenDelTracker(process.env.VERCEL_PROJECT_PRODUCTION_URL, origenPeticion);
}

export async function prepararDatosConfigGps(
  slug: string,
  credencial: CredencialGps,
  origen: OrigenTracker
): Promise<DatosConfigGps> {
  return {
    urlSinToken: urlTrackerDelReto(origen.origen, slug),
    urlTracker: urlTrackerConToken(origen.origen, slug, credencial.token),
    fechaActualizacion: credencial.actualizadoEn,
    origenProvisional: origen.provisional,
  };
}
