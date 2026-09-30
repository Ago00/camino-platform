"use client";

import { eliminarComentario, mostrarComentario, ocultarComentario } from "@/app/[slug]/admin/actions";
import BotonConfirmable from "@/components/admin/BotonConfirmable";

const CLASE_BOTON = "shrink-0 rounded-full px-3 py-1 text-[12px] font-medium disabled:opacity-50";

interface AccionesComentarioProps {
  id: number;
  oculto: boolean;
  slug: string;
  /** Respuestas que se borran en cascada con este comentario (0 en una respuesta). */
  numRespuestas: number;
  /**
   * false en los privados: no se ven en la web, así que Ocultar/Mostrar no
   * tiene efecto y solo se ofrece Eliminar.
   */
  ocultable: boolean;
}

function mensajeConfirmacionBorrado(numRespuestas: number): string {
  const base = "¿Eliminar este comentario? Se borra de forma permanente, no se puede deshacer.";
  if (numRespuestas === 0) return base;
  const respuestas = numRespuestas === 1 ? "1 respuesta" : `${numRespuestas} respuestas`;
  return `${base} Se borrarán también ${respuestas}.`;
}

export default function AccionesComentario({ id, oculto, slug, numRespuestas, ocultable }: AccionesComentarioProps) {
  return (
    <div className="flex shrink-0 gap-1.5">
      {ocultable &&
        (oculto ? (
          <BotonConfirmable
            etiqueta="Mostrar"
            etiquetaPendiente="Mostrando…"
            accion={() => mostrarComentario(slug, id)}
            className={CLASE_BOTON}
          />
        ) : (
          <BotonConfirmable
            etiqueta="Ocultar"
            etiquetaPendiente="Ocultando…"
            accion={() => ocultarComentario(slug, id)}
            variante="peligro"
            className={CLASE_BOTON}
          />
        ))}
      <BotonConfirmable
        etiqueta="Eliminar"
        etiquetaPendiente="Eliminando…"
        mensajeConfirmacion={mensajeConfirmacionBorrado(numRespuestas)}
        accion={() => eliminarComentario(slug, id)}
        variante="peligro"
        className={CLASE_BOTON}
      />
    </div>
  );
}
