"use client";

import { descartarPosicion } from "@/app/[slug]/admin/actions";
import BotonConfirmable from "@/components/admin/BotonConfirmable";

interface DescartarPosicionBotonProps {
  id: number;
  slug: string;
}

export default function DescartarPosicionBoton({ id, slug }: DescartarPosicionBotonProps) {
  return (
    <BotonConfirmable
      etiqueta="Descartar"
      etiquetaPendiente="Descartando…"
      accion={() => descartarPosicion(slug, id)}
      variante="peligro"
      className="shrink-0 rounded-full px-3 py-1 text-[12px] font-medium disabled:opacity-50"
    />
  );
}
