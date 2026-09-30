"use client";

// Formulario de edición inline de un reto del panel superadmin. Si la acción
// termina bien redirige al panel con el aviso "Cambios guardados" en la
// tarjeta; si falla, muestra el motivo aquí sin perder lo escrito.

import Link from "next/link";
import { startTransition, useActionState } from "react";
import type { Reto } from "@/lib/types";
import { COLORES_SUPERADMIN as C, CampoPasswordAdmin, CampoTexto, MensajeResultado, SelectorRuta, SelectorTipoRuta } from "./CamposReto";
import type { ResultadoAccionSuperadmin } from "./resultado-accion";

interface Props {
  reto: Reto;
  /** `editarReto` con el id del reto ya enlazado en el servidor. */
  accion: (estadoPrevio: ResultadoAccionSuperadmin | null, formData: FormData) => Promise<ResultadoAccionSuperadmin>;
}

export default function FormularioEditarReto({ reto, accion }: Props) {
  const [resultado, enviarAccion, pendiente] = useActionState(accion, null);

  // Envío manual: con `action={...}` React resetearía el formulario y un error
  // haría perder los cambios escritos.
  function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    startTransition(() => enviarAccion(datos));
  }

  return (
    <form
      onSubmit={alEnviar}
      aria-busy={pendiente}
      className="mt-4 space-y-3 border-t pt-4"
      style={{ borderColor: "#00000010" }}
    >
      <CampoTexto label="Nombre" name="nombre" defaultValue={reto.nombre} required />
      <CampoTexto label="Descripción" name="descripcion" defaultValue={reto.descripcion ?? ""} />
      <SelectorTipoRuta defaultValue={reto.ruta_tipo} />
      <SelectorRuta defaultValue={reto.ruta_id ?? undefined} />
      <div>
        <label className="mb-1 block text-[13px] font-medium">Estado</label>
        <select
          name="activo"
          defaultValue={String(reto.activo)}
          className="w-full rounded-lg border px-3 py-2 text-[14px]"
          style={{ borderColor: "#00000015" }}
        >
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </div>
      <CampoPasswordAdmin placeholder="Dejar vacío para no cambiar" />

      {resultado && !pendiente && <MensajeResultado ok={resultado.ok}>{resultado.mensaje}</MensajeResultado>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-full px-4 py-2 text-[13px] font-medium text-white disabled:cursor-wait disabled:opacity-60"
          style={{ background: C.eucalipto }}
        >
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </button>
        <Link
          href="/superadmin"
          aria-disabled={pendiente}
          className={`rounded-full border px-4 py-2 text-[13px] font-medium ${pendiente ? "pointer-events-none opacity-60" : ""}`}
          style={{ borderColor: "#00000018" }}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
