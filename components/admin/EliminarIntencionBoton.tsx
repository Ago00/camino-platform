"use client";

import { eliminarIntencion } from "@/app/[slug]/admin/actions";
import BotonConfirmable from "@/components/admin/BotonConfirmable";

interface EliminarIntencionBotonProps {
  id: number;
  slug: string;
}

export default function EliminarIntencionBoton({ id, slug }: EliminarIntencionBotonProps) {
  return (
    <BotonConfirmable
      etiqueta="Eliminar"
      etiquetaPendiente="Eliminando…"
      mensajeConfirmacion="¿Eliminar esta intención? Se borra de forma permanente, no se puede deshacer."
      accion={() => eliminarIntencion(slug, id)}
      variante="peligro"
      className="shrink-0 rounded-full px-3 py-1 text-[12px] font-medium disabled:opacity-50"
    />
  );
}
