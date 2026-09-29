// Muro de comentarios públicos en hilos (FP3a, DT-030), paginado por offset
// sobre los comentarios raíz ("cargar más", página=20). Hace fetch a
// GET /[slug]/api/comentarios. Sigue el patrón de paginación del mockup
// (design-sandbox/app/camino/page.tsx, MuroComentarios).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import HiloComentario from "@/components/publico/HiloComentario";
import type { Textos } from "@/lib/textos/obtener-textos";
import type { HiloPublico, RespuestaMuro } from "@/lib/types";

const PAGINA = 20;

interface MuroComentariosProps {
  textos: Textos;
  slug: string;
  /** Respuestas de visitantes encendidas en la configuración del reto (FP3c, DT-032). */
  permitirRespuestas: boolean;
}

export default function MuroComentarios({ textos, slug, permitirRespuestas }: MuroComentariosProps) {
  const [hilos, setHilos] = useState<HiloPublico[]>([]);
  const [siguienteOffset, setSiguienteOffset] = useState<number | null>(0);
  const [cargando, setCargando] = useState(false);
  const cargadoInicial = useRef(false);

  const cargarPagina = useCallback(async (offset: number) => {
    setCargando(true);
    try {
      const response = await fetch(`/${slug}/api/comentarios?offset=${offset}&limit=${PAGINA}`);
      if (!response.ok) return;
      const data: RespuestaMuro = await response.json();
      // Si entra una raíz nueva entre páginas, el offset desplaza y la siguiente repite un hilo.
      setHilos((previos) => {
        if (offset === 0) return data.comentarios;
        const vistos = new Set(previos.map((h) => h.id));
        return [...previos, ...data.comentarios.filter((h) => !vistos.has(h.id))];
      });
      setSiguienteOffset(data.siguienteOffset);
    } finally {
      setCargando(false);
    }
  }, [slug]);

  useEffect(() => {
    if (cargadoInicial.current) return;
    cargadoInicial.current = true;
    void cargarPagina(0);
  }, [cargarPagina]);

  return (
    <div className="space-y-2.5">
      <AnimatePresence initial={false}>
        {hilos.map((hilo) => (
          <motion.div
            key={hilo.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <HiloComentario hilo={hilo} textos={textos} slug={slug} permitirRespuestas={permitirRespuestas} />
          </motion.div>
        ))}
      </AnimatePresence>

      {siguienteOffset !== null ? (
        <button
          onClick={() => cargarPagina(siguienteOffset)}
          disabled={cargando}
          className="mx-auto flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] font-medium disabled:opacity-60"
          style={{ borderColor: "#00000015", color: "#2F5D50", background: "#FBFAF7" }}
        >
          <IconChevronDown size={13} /> {cargando ? "Cargando…" : textos.muro_boton_cargar_mas}
        </button>
      ) : hilos.length > 0 ? (
        <div className="pt-1 text-center text-[11.5px]" style={{ color: "#9AA29C" }}>
          {textos.muro_mensaje_fin}
        </div>
      ) : null}
    </div>
  );
}

function IconChevronDown(p: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const { size = 16, ...rest } = p;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
