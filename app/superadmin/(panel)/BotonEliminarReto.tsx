"use client";

import { eliminarReto } from "./actions";

interface Props {
  id: number;
  nombre: string;
}

/** Botón de eliminación con diálogo de confirmación nativo del navegador. */
export default function BotonEliminarReto({ id, nombre }: Props) {
  const eliminarConId = eliminarReto.bind(null, id);

  function handleSubmit(evento: React.FormEvent<HTMLFormElement>) {
    if (!confirm(`¿Eliminar el reto "${nombre}"? Esta acción no se puede deshacer.`)) {
      evento.preventDefault();
    }
  }

  return (
    <form action={eliminarConId} onSubmit={handleSubmit}>
      <button
        type="submit"
        className="rounded-lg border px-3 py-1.5 text-[13px] font-medium"
        style={{ borderColor: "#B03A2E40", color: "#B03A2E" }}
      >
        Eliminar
      </button>
    </form>
  );
}
