// Respuesta del caminante a un comentario raíz desde el panel (FP3a, DT-030).
// Se publica con la insignia "Caminante" y el nombre `quien_camina_nombre`.
// Solo se ofrece en raíces públicas no ocultas (la acción lo vuelve a
// comprobar en servidor). Mismo patrón de envío que ComposerMinutoAMinuto:
// onSubmit propio y ResultadoPublicacion devuelto, sin perder el texto si falla.

"use client";

import { useState, useTransition } from "react";
import { responderComentario } from "@/app/[slug]/admin/actions";

const C = { eucalipto: "#2F5D50", error: "#B03A2E" };

interface FormRespuestaAdminProps {
  slug: string;
  parentId: number;
}

export default function FormRespuestaAdmin({ slug, parentId }: FormRespuestaAdminProps) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (texto.trim().length === 0 || pendiente) return;
    setError(null);
    startTransition(async () => {
      const resultado = await responderComentario(slug, parentId, texto);
      if (resultado.ok) {
        setTexto("");
        setAbierto(false);
      } else {
        setError(resultado.mensaje);
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-2 text-[12.5px] font-medium"
        style={{ color: C.eucalipto }}
      >
        Responder
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-2 space-y-2">
      <textarea
        rows={2}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={1000}
        aria-label="Tu respuesta como caminante"
        placeholder="Tu respuesta (se publica con la insignia «Caminante»)"
        className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-[14px] outline-none"
        style={{ borderColor: "#00000015" }}
      />
      {error && (
        <p className="text-[12.5px]" style={{ color: C.error }} role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={texto.trim().length === 0 || pendiente}
          className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50"
          style={{ background: C.eucalipto }}
        >
          {pendiente ? "Publicando…" : "Publicar respuesta"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
          disabled={pendiente}
          className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium disabled:opacity-50"
          style={{ color: C.eucalipto }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
