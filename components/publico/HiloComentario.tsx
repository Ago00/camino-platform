// Un hilo del muro (FP3a, DT-030): comentario raíz + respuestas de un solo
// nivel. Con más de UMBRAL_PLEGADO respuestas el hilo arranca plegado tras
// "Ver N respuestas"; con 1-2 se muestran directamente. "Responder" abre
// RespuestaForm, y la respuesta enviada la añade el muro a este hilo sin
// recargar (las respuestas viven en el estado del muro, que también fusiona
// las que trae el poll; aquí solo hay estado de interfaz).

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
  /** false si el reto tiene apagadas las respuestas de visitantes (FP3c): sin "Responder"; las existentes se ven igual. */
  permitirRespuestas: boolean;
  onRespuestaPublicada: (hiloId: number, respuesta: ComentarioPublico) => void;
}

export default function HiloComentario({
  hilo,
  textos,
  slug,
  permitirRespuestas,
  onRespuestaPublicada,
}: HiloComentarioProps) {
  const respuestas = hilo.respuestas;
  const [desplegado, setDesplegado] = useState(hilo.respuestas.length <= UMBRAL_PLEGADO);
  // Nombre de a quién se contesta (raíz o una respuesta). Un solo nivel: toda
  // respuesta va al hilo, así que el formulario se abre al final, donde aparecerá.
  const [respondiendoA, setRespondiendoA] = useState<{ id: number; nombre: string } | null>(null);
  const idRespuestas = useId();

  const plegable = respuestas.length > UMBRAL_PLEGADO;
  const respuestasVisibles = respuestas.length > 0 && desplegado;

  function alResponder(respuesta: ComentarioPublico) {
    onRespuestaPublicada(hilo.id, respuesta);
    setDesplegado(true);
    setRespondiendoA(null);
  }

  function botonResponder(comentario: ComentarioPublico) {
    if (!permitirRespuestas) return null;
    return (
      <button
        type="button"
        onClick={() =>
          setRespondiendoA((actual) =>
            actual?.id === comentario.id ? null : { id: comentario.id, nombre: comentario.nombre }
          )
        }
        aria-expanded={respondiendoA?.id === comentario.id}
        style={{ color: C.eucalipto }}
      >
        {textos.muro_boton_responder}
      </button>
    );
  }

  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: "#00000010", background: "white" }}>
      <CuerpoComentario comentario={hilo} textos={textos} />

      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] font-medium">
        {!respuestasVisibles && botonResponder(hilo)}
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
              <div className="mt-0.5 text-[12px] font-medium">{botonResponder(respuesta)}</div>
            </li>
          ))}
        </ul>
      )}

      {permitirRespuestas && respondiendoA !== null && (
        <RespuestaForm
          textos={textos}
          slug={slug}
          parentId={hilo.id}
          destinatarioId={respondiendoA.id}
          destinatario={respondiendoA.nombre}
          onRespondido={alResponder}
        />
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
