/**
 * Prepara en el servidor lo que el panel enseña para configurar el GPS de un
 * reto (DT-035): URL de `/api/track` con su token, enlace de configuración de
 * OwnTracks y su QR. Lo usan la pestaña GPS del admin del reto y las tarjetas
 * del superadmin (`components/gps/ConfigGps.tsx`).
 *
 * Solo servidor. Recibe una credencial ya leída: quien la lea tiene que haber
 * verificado la sesión en su propia página (DT-034).
 */

import { headers } from "next/headers";
import { toString as generarQr } from "qrcode";
import { construirConfigOwnTracks, enlaceOwnTracks, tidDesdeSlug } from "@/lib/gps/owntracks";
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
  enlaceOwnTracks: string;
  /** `data:image/svg+xml;base64,…`, o null si no se pudo generar (queda el enlace). */
  qrDataUrl: string | null;
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
  const urlTracker = urlTrackerConToken(origen.origen, slug, credencial.token);
  const enlace = enlaceOwnTracks(construirConfigOwnTracks({ url: urlTracker, tid: tidDesdeSlug(slug), deviceId: slug }));
  return {
    urlSinToken: urlTrackerDelReto(origen.origen, slug),
    urlTracker,
    enlaceOwnTracks: enlace,
    qrDataUrl: await qrComoDataUrl(enlace),
    fechaActualizacion: credencial.actualizadoEn,
    origenProvisional: origen.provisional,
  };
}

/**
 * SVG en vez de PNG: no depende de un codificador de imágenes y escala sin
 * perder nitidez. Corrección de errores "M": el enlace ronda los 500
 * caracteres y un nivel más alto densificaría el QR sin necesidad (se escanea
 * de una pantalla, no de papel dañado).
 */
async function qrComoDataUrl(texto: string): Promise<string | null> {
  try {
    const svg = await generarQr(texto, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  } catch {
    return null;
  }
}
