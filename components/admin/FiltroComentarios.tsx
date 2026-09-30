"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FILTROS_COMENTARIO, type FiltroComentario } from "@/lib/admin/navegacion";
import type { ContadoresComentariosAdmin } from "@/lib/comentarios/hilos";

const C = { eucalipto: "#2F5D50", ink: "#1B211D" };

interface FiltroComentariosProps {
  activo: FiltroComentario;
  slug: string;
  contadores: ContadoresComentariosAdmin;
}

export default function FiltroComentarios({ activo, slug, contadores }: FiltroComentariosProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function elegir(valor: FiltroComentario) {
    const params = new URLSearchParams(searchParams);
    params.set("filtroComentarios", valor);
    router.push(`/${slug}/admin?${params.toString()}`);
  }

  return (
    <div
      role="group"
      aria-label="Tipo de comentarios"
      className="inline-flex rounded-full border p-0.5 text-[12.5px]"
      style={{ borderColor: "#00000015" }}
    >
      {FILTROS_COMENTARIO.map((opcion) => {
        const esActivo = activo === opcion.valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={esActivo}
            onClick={() => elegir(opcion.valor)}
            className="rounded-full px-3 py-1 font-medium transition-colors"
            style={esActivo ? { background: C.eucalipto, color: "white" } : { color: C.ink }}
          >
            {opcion.etiqueta} ({contadores[opcion.valor]})
          </button>
        );
      })}
    </div>
  );
}
