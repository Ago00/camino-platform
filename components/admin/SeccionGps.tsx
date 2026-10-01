// Pestaña "GPS" (DT-035): tutorial de OwnTracks, URL y regeneración del token del
// GPS de este reto. Server Component.
//
// Vuelve a verificar la sesión del reto aunque la página ya lo haya hecho:
// esta sección envía el token al navegador y no debe depender de quién la
// monte (DT-034). Las consultas de `resolverRetoConSesion` (reto y hash) van
// con `React.cache`, así que no se repiten dentro del mismo request.

import ConfigGps from "@/components/gps/ConfigGps";
import { regenerarTokenGps } from "@/app/[slug]/admin/actions";
import { resolverRetoConSesion } from "@/lib/auth/sesion-admin-servidor";
import { obtenerOrigenTracker, prepararDatosConfigGps } from "@/lib/gps/config-gps-servidor";
import { obtenerTokenGps } from "@/lib/supabase/credenciales-gps";
import type { Reto } from "@/lib/types";

const C = { ink: "#1B211D", muted: "#4A5450" };

export default async function SeccionGps({ reto }: { reto: Reto }) {
  const retoConSesion = await resolverRetoConSesion(reto.slug);
  if (!retoConSesion || retoConSesion.id !== reto.id) return null;

  const [credencial, origen] = await Promise.all([obtenerTokenGps(retoConSesion.id), obtenerOrigenTracker()]);
  const datos = credencial === null ? null : await prepararDatosConfigGps(retoConSesion.slug, credencial, origen);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[16px] font-semibold" style={{ color: C.ink }}>
          GPS del móvil (OwnTracks)
        </h2>
        <p className="mt-1 text-[13px]" style={{ color: C.muted }}>
          El móvil envía su posición a la web con un token propio de este reto. Si lo regeneras, el anterior deja
          de funcionar al momento.
        </p>
      </div>
      <div className="rounded-2xl border p-4" style={{ borderColor: "#00000012", background: "white" }}>
        <ConfigGps datos={datos} accionRegenerar={regenerarTokenGps.bind(null, retoConSesion.slug)} />
      </div>
    </section>
  );
}
