// Formulario de comentarios + muro, juntos en las fases en que se muestran
// los dos (durante y llegada, guiado y libre). Existe para que el muro recargue
// su primera página cuando el visitante publica un comentario público: sin
// este padre común, `ComentarioForm` y `MuroComentarios` no se conocen.
// Los privados no salen en el muro, así que no provocan recarga.

"use client";

import { useRef } from "react";
import ComentarioForm from "@/components/publico/ComentarioForm";
import MuroComentarios, { type ControlMuroComentarios } from "@/components/publico/MuroComentarios";
import type { Textos } from "@/lib/textos/obtener-textos";

interface ComentariosConMuroProps {
  textos: Textos;
  slug: string;
  permitirRespuestas: boolean;
}

export default function ComentariosConMuro({ textos, slug, permitirRespuestas }: ComentariosConMuroProps) {
  const muroRef = useRef<ControlMuroComentarios>(null);

  return (
    <>
      <ComentarioForm
        textos={textos}
        slug={slug}
        onEnviado={(visibilidad) => {
          if (visibilidad === "publico") muroRef.current?.recargar();
        }}
      />
      <MuroComentarios ref={muroRef} textos={textos} slug={slug} permitirRespuestas={permitirRespuestas} />
    </>
  );
}
