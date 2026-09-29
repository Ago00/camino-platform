// Formulario de respuesta a un comentario raíz → POST /[slug]/api/comentarios
// con `parent_id` (FP3a, DT-030). Las respuestas son siempre públicas: sin
// selector de visibilidad. Al acertar entrega la respuesta creada al hilo
// para que la pinte sin recargar el muro.

"use client";

import { useState } from "react";
import type { Textos } from "@/lib/textos/obtener-textos";
import type { ComentarioPublico } from "@/lib/types";

const C = { eucalipto: "#2F5D50" };

type Estado = "idle" | "enviando" | "error";

/** Contrato de la respuesta 201 del POST con `parent_id` (route.ts). Mismo
 * criterio que el resto de componentes públicos: la API es nuestra y no se
 * añade zod al bundle del cliente para revalidarla. */
interface RespuestaCreada {
  ok: true;
  comentario: ComentarioPublico;
}

interface RespuestaFormProps {
  textos: Textos;
  slug: string;
  parentId: number;
  onRespondido: (respuesta: ComentarioPublico) => void;
}

export default function RespuestaForm({ textos, slug, parentId, onRespondido }: RespuestaFormProps) {
  const [nombre, setNombre] = useState("");
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");

  const incompleto = nombre.trim().length === 0 || texto.trim().length === 0;

  async function enviar() {
    if (incompleto || estado === "enviando") return;
    setEstado("enviando");
    try {
      const response = await fetch(`/${slug}/api/comentarios`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), texto: texto.trim(), parent_id: parentId }),
      });
      if (!response.ok) throw new Error("respuesta no ok");
      const datos: RespuestaCreada = await response.json();
      setTexto("");
      setEstado("idle");
      onRespondido(datos.comentario);
    } catch {
      setEstado("error");
    }
  }

  return (
    <div className="mt-2 rounded-lg border p-3" style={{ borderColor: "#00000012", background: "#FBFAF7" }}>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={80}
        aria-label={textos.comentario_form_placeholder_nombre}
        placeholder={textos.comentario_form_placeholder_nombre}
        className="w-full rounded-lg border bg-white px-3 py-1.5 text-[13.5px] outline-none placeholder:text-[#A8AEA8]"
        style={{ borderColor: "#00000015" }}
      />
      <textarea
        rows={2}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={1000}
        aria-label={textos.respuesta_form_placeholder_texto}
        placeholder={textos.respuesta_form_placeholder_texto}
        className="mt-2 w-full resize-none rounded-lg border bg-white px-3 py-1.5 text-[13.5px] outline-none placeholder:text-[#A8AEA8]"
        style={{ borderColor: "#00000015" }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        {estado === "error" ? (
          <p className="text-[12px]" style={{ color: "#B03A2E" }} role="alert">
            {textos.mensaje_error_generico}
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={enviar}
          disabled={incompleto || estado === "enviando"}
          className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50"
          style={{ background: C.eucalipto }}
        >
          {estado === "enviando" ? "Enviando…" : textos.respuesta_form_boton_enviar}
        </button>
      </div>
    </div>
  );
}
