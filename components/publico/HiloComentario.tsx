// Un hilo del muro (FP3a, DT-030): comentario raíz + respuestas de un solo
// nivel. Con más de UMBRAL_PLEGADO respuestas el hilo arranca plegado tras
// "Ver N respuestas"; con 1-2 se muestran directamente. "Responder" abre
// RespuestaForm, y la respuesta enviada se añade aquí sin recargar el muro.

"use client";

import { useId, useState } from "react";
import InsigniaCaminante from "@/components/publico/InsigniaCaminante";
import RespuestaForm from "@/components/publico/RespuestaForm";
import type { Textos } from "@/lib/textos/obtener-textos";
import type { ComentarioPublico, HiloPublico } from "@/lib/types";

const UMBRAL_PLEGADO = 2;

const C = { ink: "#1B211D", texto: "#4A5450", eucalipto: "#2F5D50" };

interface HiloComentarioProps {
  hilo: HiloPublico;
  textos: Textos;
  slug: string;
}

export default function HiloComentario({ hilo, textos, slug }: HiloComentarioProps) {
  const [respuestas, setRespuestas] = useState<ComentarioPublico[]>(hilo.respuestas);
  const [desplegado, setDesplegado] = useState(hilo.respuestas.length <= UMBRAL_PLEGADO);
  const [respondiendo, setRespondiendo] = useState(false);
  const idRespuestas = useId();

  const plegable = respuestas.length > UMBRAL_PLEGADO;

  function alResponder(respuesta: ComentarioPublico) {
    setRespuestas((previas) => [...previas, respuesta]);
    setDesplegado(true);
    setRespondiendo(false);
  }

  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: "#00000010", background: "white" }}>
      <CuerpoComentario comentario={hilo} textos={textos} />

      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] font-medium">
        <button
          type="button"
          onClick={() => setRespondiendo((abierto) => !abierto)}
          aria-expanded={respondiendo}
          style={{ color: C.eucalipto }}
        >
          {textos.muro_boton_responder}
        </button>
        {plegable && (
          <button
            type="button"
            onClick={() => setDesplegado((abierto) => !abierto)}
            aria-expanded={desplegado}
            aria-controls={idRespuestas}
            style={{ color: C.eucalipto }}
          >
            {desplegado
              ? textos.muro_boton_ocultar_respuestas
              : textos.muro_boton_ver_respuestas.replaceAll("{n}", String(respuestas.length))}
          </button>
        )}
      </div>

      {respuestas.length > 0 && (
        <ul
          id={idRespuestas}
          hidden={!desplegado}
          className="mt-2 space-y-2 border-l-2 pl-3"
          style={{ borderColor: "#2F5D5022" }}
        >
          {respuestas.map((respuesta) => (
            <li key={respuesta.id}>
              <CuerpoComentario comentario={respuesta} textos={textos} />
            </li>
          ))}
        </ul>
      )}

      {respondiendo && (
        <RespuestaForm textos={textos} slug={slug} parentId={hilo.id} onRespondido={alResponder} />
      )}
    </div>
  );
}

function CuerpoComentario({ comentario, textos }: { comentario: ComentarioPublico; textos: Textos }) {
  return (
    <>
      <div className="text-[13px] font-semibold" style={{ color: C.ink }}>
        {comentario.nombre}
        {comentario.es_autor && <InsigniaCaminante etiqueta={textos.muro_insignia_caminante} />}
      </div>
      <div className="text-[13.5px]" style={{ color: C.texto }}>
        {comentario.texto}
      </div>
    </>
  );
}
