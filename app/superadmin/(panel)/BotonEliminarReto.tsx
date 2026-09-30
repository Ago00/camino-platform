"use client";

import { useActionState } from "react";
import { MensajeResultado } from "./CamposReto";
import type { ResultadoAccionSuperadmin } from "./resultado-accion";

interface Props {
  nombre: string;
  /** `eliminarReto` con el id del reto ya enlazado en el servidor. */
  accion: () => Promise<ResultadoAccionSuperadmin>;
}

/**
 * Botón de eliminación con diálogo de confirmación nativo del navegador.
 * Si termina bien, la acción redirige al panel con el aviso de eliminación;
 * si falla, el motivo se muestra debajo de los botones de la tarjeta.
 */
export default function BotonEliminarReto({ nombre, accion }: Props) {
  const [resultado, enviarAccion, pendiente] = useActionState(accion, null);

  function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    if (pendiente || !confirm(`¿Eliminar el reto "${nombre}"? Esta acción no se puede deshacer.`)) {
      evento.preventDefault();
    }
  }

  return (
    <>
      {/* `contents`: el botón se alinea con el resto de acciones de la tarjeta y el mensaje baja a su propia línea. */}
      <form action={enviarAccion} onSubmit={alEnviar} aria-busy={pendiente} className="contents">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg border px-3 py-1.5 text-[13px] font-medium disabled:cursor-wait disabled:opacity-60"
          style={{ borderColor: "#B03A2E40", color: "#B03A2E" }}
        >
          {pendiente ? "Eliminando…" : "Eliminar"}
        </button>
      </form>
      {resultado && !pendiente && (
        <div className="basis-full">
          <MensajeResultado ok={resultado.ok}>{resultado.mensaje}</MensajeResultado>
        </div>
      )}
    </>
  );
}
