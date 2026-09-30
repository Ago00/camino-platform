"use client";

// Formulario de creación de reto del panel superadmin. Envía con
// `useActionState` para enseñar el estado pendiente y el resultado real de la
// acción (éxito con enlaces al reto nuevo, o el motivo del error).

import { startTransition, useActionState, useEffect, useRef } from "react";
import { crearReto } from "./actions";
import {
  COLORES_SUPERADMIN as C,
  CampoPasswordAdmin,
  CampoTexto,
  EnlacesReto,
  MensajeResultado,
  SelectorRuta,
  SelectorTipoRuta,
} from "./CamposReto";

export default function FormularioCrearReto() {
  const [resultado, enviarAccion, pendiente] = useActionState(crearReto, null);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resultado?.ok) formulario.current?.reset();
  }, [resultado]);

  // Se envía a mano (en vez de `action={enviarAccion}`) porque React resetea
  // el formulario tras cualquier envío por `action`, y si hay un error de
  // validación no se debe perder lo escrito. El reset solo va tras un éxito.
  function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    startTransition(() => enviarAccion(datos));
  }

  return (
    <form
      ref={formulario}
      onSubmit={alEnviar}
      aria-busy={pendiente}
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: "#00000012", background: "white" }}
    >
      <CampoTexto
        label="Slug"
        name="slug"
        placeholder="mi-reto-2026"
        required
        pattern="\s*[A-Za-z0-9\-]+\s*"
        maxLength={60}
        ayuda="Solo letras sin acentos, números y guiones; sin espacios. Será la dirección del reto (/mi-reto-2026)."
      />
      <CampoTexto label="Nombre" name="nombre" placeholder="Nombre del reto" required />
      <CampoTexto label="Descripción" name="descripcion" placeholder="Descripción opcional" />
      <SelectorTipoRuta defaultValue="predefinida" />
      <SelectorRuta />
      <CampoPasswordAdmin required />

      {resultado && !pendiente && (
        <MensajeResultado ok={resultado.ok}>
          <p>{resultado.mensaje}</p>
          {resultado.ok && (
            <div className="mt-2 flex flex-wrap gap-2" style={{ color: C.ink }}>
              <EnlacesReto slug={resultado.slug} />
            </div>
          )}
        </MensajeResultado>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="rounded-full px-4 py-2 text-[13px] font-medium text-white disabled:cursor-wait disabled:opacity-60"
        style={{ background: C.eucalipto }}
      >
        {pendiente ? "Creando…" : "Crear reto"}
      </button>
    </form>
  );
}
