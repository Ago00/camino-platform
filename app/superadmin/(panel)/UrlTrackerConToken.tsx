// URL completa del GPS de un reto, con el token, para pegarla en OwnTracks
// (DT-034). Solo en el superadmin: el token es global y da acceso de escritura
// a /api/track de todos los retos. Oculta por defecto (para que no quede a la
// vista en una pantalla compartida); "Mostrar" la enseña y "Copiar" la copia
// al portapapeles o, si el navegador no lo permite, la deja seleccionada.

"use client";

import { useRef, useState } from "react";
import { COLORES_SUPERADMIN as C } from "./CamposReto";

type EstadoCopia = "inactivo" | "copiado" | "seleccionado";

const TOKEN_OCULTO = "••••••••";

export default function UrlTrackerConToken({ urlSinToken, urlConToken }: { urlSinToken: string; urlConToken: string }) {
  const [visible, setVisible] = useState(false);
  const [estadoCopia, setEstadoCopia] = useState<EstadoCopia>("inactivo");
  const refCodigo = useRef<HTMLElement>(null);

  function seleccionarUrl() {
    const nodo = refCodigo.current;
    const seleccion = window.getSelection();
    if (!nodo || !seleccion) return;
    const rango = document.createRange();
    rango.selectNodeContents(nodo);
    seleccion.removeAllRanges();
    seleccion.addRange(rango);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(urlConToken);
      setEstadoCopia("copiado");
    } catch {
      // Sin permiso de portapapeles (o contexto no seguro): se enseña la URL
      // seleccionada para copiarla a mano.
      setVisible(true);
      requestAnimationFrame(seleccionarUrl);
      setEstadoCopia("seleccionado");
    }
  }

  return (
    <div>
      <code
        ref={refCodigo}
        className="mt-0.5 block select-all break-all rounded-md px-2 py-1 font-mono text-[12.5px]"
        style={{ background: C.paper }}
      >
        {visible ? urlConToken : `${urlSinToken}&t=${TOKEN_OCULTO}`}
      </code>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="rounded-lg border px-3 py-1 text-[12.5px] font-medium"
          style={{ borderColor: "#00000018" }}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
        <button
          type="button"
          onClick={copiar}
          className="rounded-lg border px-3 py-1 text-[12.5px] font-medium"
          style={{ borderColor: "#00000018" }}
        >
          Copiar
        </button>
        <span aria-live="polite" className="text-[12px]" style={{ color: C.eucalipto }}>
          {estadoCopia === "copiado" && "Copiado"}
          {estadoCopia === "seleccionado" && "No se pudo copiar: está seleccionada, cópiala con Ctrl+C."}
        </span>
      </div>
    </div>
  );
}
