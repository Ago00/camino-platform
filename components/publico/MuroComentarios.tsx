// Muro de comentarios públicos en hilos (FP3a, DT-030), paginado por offset
// sobre los comentarios raíz ("cargar más", página=20). Hace fetch a
// GET /[slug]/api/comentarios. Sigue el patrón de paginación del mockup
// (design-sandbox/app/camino/page.tsx, MuroComentarios).
//
// En vivo: cada 60 s, solo con la pestaña visible, vuelve a pedir la página 0
// y la fusiona por id con lo cargado (lib/comentarios/muro-en-vivo.ts): raíces
// nuevas arriba, respuestas nuevas dentro de su hilo, sin perder páginas
// siguientes ni respuestas propias. Los hilos conservan su `key`, así que un
// formulario de respuesta abierto no se desmonta. Sin poll en la vista previa
// del admin; un 403 (sección apagada) lo para y refresca la página.

"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import HiloComentario from "@/components/publico/HiloComentario";
import { useVistaPrevia } from "@/components/publico/VistaPrevia";
import { useRefrescoSiSeccionApagada } from "@/components/publico/useRefrescoSiSeccionApagada";
import {
  aplicarPaginaCero,
  aplicarPaginaSiguiente,
  aplicarRespuestaPropia,
  ESTADO_MURO_INICIAL,
  type EstadoMuro,
} from "@/lib/comentarios/muro-en-vivo";
import type { Textos } from "@/lib/textos/obtener-textos";
import type { ComentarioPublico, RespuestaMuro } from "@/lib/types";

const PAGINA = 20;
const POLLING_MS = 60_000;

interface MuroComentariosProps {
  textos: Textos;
  slug: string;
  /** Respuestas de visitantes encendidas en la configuración del reto (FP3c, DT-032). */
  permitirRespuestas: boolean;
  /** Para que el padre pida recargar el muro tras publicar un comentario público. */
  ref?: Ref<ControlMuroComentarios>;
}

export interface ControlMuroComentarios {
  /** Vuelve a pedir la página 0 y la fusiona con lo cargado (mismo camino que el poll). */
  recargar: () => void;
}

export default function MuroComentarios({ textos, slug, permitirRespuestas, ref }: MuroComentariosProps) {
  const [muro, setMuro] = useState<EstadoMuro>(ESTADO_MURO_INICIAL);
  const [cargando, setCargando] = useState(false);
  const cargadoInicial = useRef(false);
  const vistaPrevia = useVistaPrevia();
  const pararSiSeccionApagada = useRefrescoSiSeccionApagada();

  const urlPagina = useCallback(
    (offset: number) => `/${slug}/api/comentarios?offset=${offset}&limit=${PAGINA}`,
    [slug]
  );

  /** Página 0 sin tocar `cargando`: el poll no debe hacer parpadear "Cargar más". */
  const refrescarPaginaCero = useCallback(async (): Promise<Response | null> => {
    try {
      const response = await fetch(urlPagina(0));
      if (response.ok) {
        const data: RespuestaMuro = await response.json();
        setMuro((previo) => aplicarPaginaCero(previo, data));
      }
      return response;
    } catch {
      // Fallo puntual de red: se mantiene lo cargado; el próximo poll reintenta.
      return null;
    }
  }, [urlPagina]);

  const cargarMas = useCallback(
    async (offset: number) => {
      setCargando(true);
      try {
        const response = await fetch(urlPagina(offset));
        if (!response.ok) return;
        const data: RespuestaMuro = await response.json();
        setMuro((previo) => aplicarPaginaSiguiente(previo, data));
      } catch {
        // Sin cambios: el botón sigue ahí para reintentar.
      } finally {
        setCargando(false);
      }
    },
    [urlPagina]
  );

  useEffect(() => {
    if (cargadoInicial.current) return;
    cargadoInicial.current = true;
    setCargando(true);
    void refrescarPaginaCero().finally(() => setCargando(false));
  }, [refrescarPaginaCero]);

  useImperativeHandle(ref, () => ({ recargar: () => void refrescarPaginaCero() }), [refrescarPaginaCero]);

  useEffect(() => {
    if (vistaPrevia) return;

    let intervalo: ReturnType<typeof setInterval> | null = null;
    let seccionApagada = false;

    function parar() {
      if (intervalo === null) return;
      clearInterval(intervalo);
      intervalo = null;
    }

    async function sondear() {
      const response = await refrescarPaginaCero();
      if (response && pararSiSeccionApagada(response.status)) {
        seccionApagada = true;
        parar();
      }
    }

    function arrancar() {
      if (intervalo !== null || seccionApagada) return;
      intervalo = setInterval(() => void sondear(), POLLING_MS);
    }

    // Al volver a la pestaña se sondea en el acto: lo normal es que haya pasado
    // más de un intervalo y lo que se ve esté atrasado.
    function alCambiarVisibilidad() {
      if (document.visibilityState === "visible") {
        if (seccionApagada) return;
        void sondear();
        arrancar();
      } else {
        parar();
      }
    }

    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      parar();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [vistaPrevia, refrescarPaginaCero, pararSiSeccionApagada]);

  const alPublicarRespuesta = useCallback((hiloId: number, respuesta: ComentarioPublico) => {
    setMuro((previo) => aplicarRespuestaPropia(previo, hiloId, respuesta));
  }, []);

  const { hilos, paginacion } = muro;

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
            <HiloComentario
              hilo={hilo}
              textos={textos}
              slug={slug}
              permitirRespuestas={permitirRespuestas}
              onRespuestaPublicada={alPublicarRespuesta}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {paginacion.estado === "mas" ? (
        <button
          onClick={() => cargarMas(paginacion.siguienteOffset)}
          disabled={cargando}
          className="mx-auto flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] font-medium disabled:opacity-60"
          style={{ borderColor: "#00000015", color: "#2F5D50", background: "#FBFAF7" }}
        >
          <IconChevronDown size={13} /> {cargando ? "Cargando…" : textos.muro_boton_cargar_mas}
        </button>
      ) : paginacion.estado === "fin" && hilos.length > 0 ? (
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
