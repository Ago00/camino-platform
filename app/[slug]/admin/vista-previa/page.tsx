// Vista previa de la web pública para el admin del reto (DT-034). Se abre
// dentro del iframe de la pestaña "Vista previa" del panel con `?fase=` y
// pinta la web tal cual se vería ahora en esa fase con la configuración y los
// textos actuales: con los datos reales si el reto está justo en esa fase, y
// con datos de ejemplo si no. Nada de lo que se hace aquí escribe en BD
// (WebReto con `vistaPrevia`: formularios bloqueados, sin polling).
//
// Vive bajo /:slug/admin/*: proxy.ts ya exige la sesión del reto y no
// registra visitas en "Tráfico". Aun así la sesión se verifica aquí contra
// BD (DT-029), como en el panel.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolverRetoConSesion } from "@/lib/auth/sesion-admin-servidor";
import { esFaseWeb } from "@/lib/admin/navegacion";
import { obtenerTextos } from "@/lib/textos/obtener-textos";
import { cargarTrazaDeMapa } from "@/lib/traza/cargar-traza-mapa";
import { configDelReto } from "@/lib/retos/config";
import { datosEjemplo } from "@/lib/vista-previa/datos-ejemplo";
import { debeUsarDatosReales, modoDeVistaPrevia } from "@/lib/vista-previa/fuente";
import type { Fase } from "@/lib/types";
import WebReto, { obtenerIntentoActivo, type FuenteDatosWeb } from "@/components/publico/WebReto";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const SIN_TRAZA: [number, number][] = [];

interface VistaPreviaPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function VistaPreviaPage({ params, searchParams }: VistaPreviaPageProps) {
  const { slug } = await params;

  const reto = await resolverRetoConSesion(slug);
  if (!reto) {
    redirect(`/admin/login?returnTo=/${slug}/admin`);
  }

  const sp = await searchParams;
  const fase: Fase = esFaseWeb(sp.fase) ? sp.fase : "antes";

  const [intentoActivo, textos] = await Promise.all([obtenerIntentoActivo(reto.id), obtenerTextos(reto.id)]);
  const trazaCoords = reto.ruta_id !== null ? cargarTrazaDeMapa(reto.ruta_id) : SIN_TRAZA;

  const fuente: FuenteDatosWeb =
    fase === "antes" || debeUsarDatosReales(fase, intentoActivo?.fase ?? null)
      ? { tipo: "real", intento: intentoActivo }
      : {
          tipo: "ejemplo",
          datos: datosEjemplo(fase, modoDeVistaPrevia(intentoActivo?.modo ?? null, reto.ruta_id), trazaCoords, new Date()),
        };

  return (
    <WebReto
      reto={reto}
      config={configDelReto(reto)}
      textos={textos}
      trazaCoords={trazaCoords}
      fase={fase}
      fuente={fuente}
      vistaPrevia
    />
  );
}
