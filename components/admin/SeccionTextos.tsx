// Sección "Textos": las 6 claves de CLAVES_TEXTOS con su valor actual en el
// reto del panel (BD si hay override, si no el default) y un campo editable
// por clave que hace upsert en la tabla `textos` vía guardarTexto().

import { obtenerTextos } from "@/lib/textos/obtener-textos";
import { CLAVES_TEXTOS } from "@/lib/textos/defaults";
import type { Reto } from "@/lib/types";
import CampoTexto from "@/components/admin/CampoTexto";

export default async function SeccionTextos({ reto, slug }: { reto: Reto; slug: string }) {
  const textos = await obtenerTextos(reto.id);

  return (
    <div className="space-y-4">
      {CLAVES_TEXTOS.map((clave) => (
        <CampoTexto key={clave} clave={clave} valorInicial={textos[clave]} slug={slug} />
      ))}
    </div>
  );
}
