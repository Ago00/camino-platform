// Pestaña "Vista previa" del panel (DT-034): la web pública del reto dentro de
// un marco de móvil, con un selector de fase. La fase es estado local y no
// `?fase=` del panel: ese parámetro ya lo usa la pestaña "Tráfico". El iframe
// carga /<slug>/admin/vista-previa, que pinta la web con la configuración y
// los textos actuales sin escribir nada.

"use client";

import { useState } from "react";
import type { Fase } from "@/lib/types";

const C = { ink: "#1B211D", muted: "#4A5450", eucalipto: "#2F5D50" };

const FASES: readonly { valor: Fase; etiqueta: string }[] = [
  { valor: "antes", etiqueta: "Antes" },
  { valor: "durante", etiqueta: "Durante" },
  { valor: "llegada", etiqueta: "Llegada" },
];

const ANCHO_MOVIL_PX = 390;
const ALTO_MOVIL_PX = 780;

export default function SeccionVistaPrevia({ slug }: { slug: string }) {
  const [fase, setFase] = useState<Fase>("antes");
  // Cambiar la key vuelve a montar el iframe: recarga con los últimos cambios
  // guardados en Configuración o Textos sin salir de la pestaña.
  const [recargas, setRecargas] = useState(0);
  const etiquetaFase = FASES.find((f) => f.valor === fase)?.etiqueta ?? fase;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Fase de la web" className="inline-flex rounded-full border p-0.5" style={{ borderColor: "#00000015" }}>
          {FASES.map(({ valor, etiqueta }) => (
            <button
              key={valor}
              type="button"
              aria-pressed={fase === valor}
              onClick={() => setFase(valor)}
              className="rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors"
              style={fase === valor ? { background: C.eucalipto, color: "white" } : { color: C.ink }}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRecargas((n) => n + 1)}
          className="rounded-full border px-4 py-1.5 text-[13px] font-medium"
          style={{ borderColor: "#00000018", color: C.ink }}
        >
          Recargar
        </button>
      </div>

      <p className="text-[12.5px] leading-snug" style={{ color: C.muted }}>
        Los datos de Durante/Llegada son de ejemplo si el reto aún no está en esa fase. En la vista previa
        los formularios no envían nada.
      </p>

      <div className="flex justify-center">
        <div
          className="max-w-full overflow-hidden rounded-[2.5rem] border-[10px] shadow-xl"
          style={{ borderColor: C.ink, width: ANCHO_MOVIL_PX + 20 }}
        >
          <iframe
            key={`${fase}-${recargas}`}
            src={`/${encodeURIComponent(slug)}/admin/vista-previa?fase=${fase}`}
            title={`Vista previa de la web: ${etiquetaFase}`}
            className="block w-full bg-white"
            style={{ height: ALTO_MOVIL_PX }}
          />
        </div>
      </div>
    </div>
  );
}
