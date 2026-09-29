// Sección "Textos": todas las claves de CLAVES_TEXTOS con su valor actual en el
// reto del panel (BD si hay override, si no el default) y un campo editable
// por clave que hace upsert en la tabla `textos` vía guardarTexto().
//
// FP3c (DT-032): agrupadas por bloques (lib/textos/bloques.ts), con un índice
// de anclas arriba y un <details> por bloque, sin JavaScript de cliente. Los
// bloques de una sección apagada en Configuración se marcan: sus textos no se
// ven en la web mientras siga apagada.

import { obtenerTextos } from "@/lib/textos/obtener-textos";
import { BLOQUES_TEXTOS } from "@/lib/textos/bloques";
import { configDelReto } from "@/lib/retos/config";
import type { Reto } from "@/lib/types";
import CampoTexto from "@/components/admin/CampoTexto";

const C = { ink: "#1B211D", muted: "#4A5450", eucalipto: "#2F5D50", apagado: "#8A6D1F" };

function anclaDelBloque(id: string): string {
  return `textos-${id}`;
}

export default async function SeccionTextos({ reto, slug }: { reto: Reto; slug: string }) {
  const textos = await obtenerTextos(reto.id);
  const config = configDelReto(reto);

  const bloques = BLOQUES_TEXTOS.map((bloque) => ({
    ...bloque,
    apagado: "seccion" in bloque ? !config[bloque.seccion] : false,
  }));

  return (
    <div className="space-y-4">
      <nav aria-label="Bloques de textos" className="flex flex-wrap gap-2">
        {bloques.map((bloque) => (
          <a
            key={bloque.id}
            href={`#${anclaDelBloque(bloque.id)}`}
            className="rounded-full border px-3 py-1 text-[12.5px] font-medium"
            style={{ borderColor: "#00000015", color: C.eucalipto, background: "white" }}
          >
            {bloque.titulo}
          </a>
        ))}
      </nav>

      {bloques.map((bloque) => (
        <details
          key={bloque.id}
          id={anclaDelBloque(bloque.id)}
          className="scroll-mt-4 rounded-2xl border"
          style={{ borderColor: "#00000012", background: "#FBFAF7" }}
        >
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[14.5px] font-semibold" style={{ color: C.ink }}>
            <span>{bloque.titulo}</span>
            <span className="text-[12px] font-normal" style={{ color: C.muted }}>
              ({bloque.claves.length})
            </span>
            {bloque.apagado && (
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: "#C9A24B22", color: C.apagado }}
              >
                sección apagada
              </span>
            )}
          </summary>
          <div className="space-y-4 px-4 pb-4">
            {bloque.claves.map((clave) => (
              <CampoTexto key={clave} clave={clave} valorInicial={textos[clave]} slug={slug} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
