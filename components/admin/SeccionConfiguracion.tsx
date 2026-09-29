// Pestaña "Configuración" (FP3c, DT-032): interruptores de las secciones de la
// web pública y de las respuestas de visitantes, y foto de "quién camina".
// Server Component: la configuración ya viene en el `reto` resuelto por la
// página (select * de `retos`), no hace falta otra consulta.

import { configDelReto, fotoQuienCaminaDelReto } from "@/lib/retos/config";
import { obtenerTextos } from "@/lib/textos/obtener-textos";
import type { Reto } from "@/lib/types";
import FormConfiguracion from "@/components/admin/FormConfiguracion";
import FotoQuienCaminaForm from "@/components/admin/FotoQuienCaminaForm";

const C = { ink: "#1B211D", muted: "#4A5450" };

export default async function SeccionConfiguracion({ reto, slug }: { reto: Reto; slug: string }) {
  const textos = await obtenerTextos(reto.id);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-[16px] font-semibold" style={{ color: C.ink }}>
            Secciones de la web
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: C.muted }}>
            Una sección apagada desaparece de la web en todas las fases. Lo ya
            recibido no se borra y lo sigues viendo aquí en el panel.
          </p>
        </div>
        <FormConfiguracion configInicial={configDelReto(reto)} slug={slug} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[16px] font-semibold" style={{ color: C.ink }}>
            Foto de «quién camina»
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: C.muted }}>
            Se muestra en la web antes de empezar. Sin foto, aparece una silueta.
          </p>
        </div>
        <FotoQuienCaminaForm
          fotoActual={fotoQuienCaminaDelReto(reto)}
          nombreCaminante={textos.quien_camina_nombre}
          slug={slug}
        />
      </section>
    </div>
  );
}
