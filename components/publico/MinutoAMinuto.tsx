// Feed público "minuto a minuto": paginación offset/"cargar más" (mismo
// patrón que MuroComentarios.tsx) + polling opcional de entradas nuevas cada
// 30 s (modo "durante", DT-013) + interacción de clic → resaltar punto en el
// mapa. Sigue el mockup (design-sandbox/app/camino/durante-minuto-a-minuto/page.tsx).
// La sección entera se puede plegar (FP3b, DT-031): plegada, el polling sigue
// y la cabecera avisa de las entradas nuevas; el punto marcado en el mapa se
// conserva porque este componente no se desmonta al plegar.

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { contarNuevas } from "@/lib/minuto-a-minuto/contar-nuevas";
import { construirUrlPolling, fusionarSinDuplicados } from "@/lib/minuto-a-minuto/polling";
import type { Textos } from "@/lib/textos/obtener-textos";
import type { EntradaMinutoAMinutoPublica } from "@/lib/types";
import { useVistaPrevia } from "@/components/publico/VistaPrevia";
import { formatearHora } from "@/lib/fechas";

const PAGINA = 20;
const POLLING_MS = 30_000;

const C = { ink: "#1B211D", muted: "#4A5450", ember: "#D9773B" };

export type { EntradaMinutoAMinutoPublica };

interface RespuestaFeed {
  entradas: EntradaMinutoAMinutoPublica[];
  siguienteOffset: number | null;
}

interface PuntoResaltado {
  lat: number;
  lon: number;
  hora: string;
}

interface MinutoAMinutoProps {
  /** true en modo "durante" (feed en directo, poll cada 30 s). false en "llegada" (carga estática). */
  polling: boolean;
  /** Entradas ya cargadas server-side, para evitar un primer fetch en "llegada". Opcional. */
  entradasIniciales?: EntradaMinutoAMinutoPublica[];
  onSeleccionarPunto: (punto: PuntoResaltado | null) => void;
  textos: Textos;
  /** Slug del reto para construir las URLs de las APIs públicas (DT-026). */
  slug: string;
  /** true en "llegada": la sección arranca plegada. La elección no se persiste. */
  plegadoInicial?: boolean;
}

export default function MinutoAMinuto({
  polling,
  entradasIniciales,
  onSeleccionarPunto,
  textos,
  slug,
  plegadoInicial = false,
}: MinutoAMinutoProps) {
  const [entradas, setEntradas] = useState<EntradaMinutoAMinutoPublica[]>(entradasIniciales ?? []);
  const [siguienteOffset, setSiguienteOffset] = useState<number | null>(
    entradasIniciales ? null : 0
  );
  const [cargando, setCargando] = useState(false);
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const cargadoInicial = useRef(entradasIniciales !== undefined);
  const [plegado, setPlegado] = useState(plegadoInicial);
  // Referencia del aviso "N nuevas": id de la entrada más reciente que el
  // visitante tenía delante. null hasta la primera carga del feed.
  const [ultimoVistoId, setUltimoVistoId] = useState<number | null>(
    entradasIniciales ? idMasReciente(entradasIniciales) : null
  );
  const regionId = useId();
  const vistaPrevia = useVistaPrevia();
  const nuevas = plegado ? contarNuevas(entradas, ultimoVistoId) : 0;

  const cargarPagina = useCallback(async (offset: number) => {
    setCargando(true);
    try {
      const response = await fetch(`/${slug}/api/minuto-a-minuto?offset=${offset}&limit=${PAGINA}`);
      if (!response.ok) return;
      const data: RespuestaFeed = await response.json();
      setEntradas((previas) => (offset === 0 ? data.entradas : fusionarSinDuplicados(previas, data.entradas)));
      setSiguienteOffset(data.siguienteOffset);
      if (offset === 0) setUltimoVistoId(idMasReciente(data.entradas));
    } finally {
      setCargando(false);
    }
  }, [slug]);

  useEffect(() => {
    if (cargadoInicial.current) return;
    cargadoInicial.current = true;
    void cargarPagina(0);
  }, [cargarPagina]);

  // Poll de entradas nuevas (solo modo "durante"): cada 30 s, pide las
  // entradas con id mayor que la más reciente ya cargada (todas si el feed
  // está vacío) y las añade arriba. Igual con la sección plegada o no. En la
  // vista previa del admin no hay poll (DT-034): lo que se ve es una foto fija.
  const masRecienteIdRef = useRef<number | null>(null);
  useEffect(() => {
    masRecienteIdRef.current = entradas.length > 0 ? entradas[0].id : null;
  }, [entradas]);

  useEffect(() => {
    if (!polling || vistaPrevia) return;

    const id = setInterval(async () => {
      try {
        const response = await fetch(construirUrlPolling(slug, masRecienteIdRef.current));
        if (!response.ok) return;
        const data: RespuestaFeed = await response.json();
        if (data.entradas.length > 0) {
          setEntradas((previas) => fusionarSinDuplicados(data.entradas, previas));
        }
      } catch {
        // Fallo puntual de red: se mantiene el feed actual, el próximo
        // intervalo de polling reintenta.
      }
    }, POLLING_MS);

    return () => clearInterval(id);
  }, [polling, vistaPrevia, slug]);

  function alternarPlegado() {
    // Al plegar, lo que hay en pantalla es la referencia del aviso; al
    // desplegar, todo pasa a estar visto y el aviso vuelve a 0.
    setUltimoVistoId(idMasReciente(entradas));
    setPlegado((previo) => !previo);
  }

  function alPulsar(entrada: EntradaMinutoAMinutoPublica) {
    const esLaMisma = entrada.id === seleccionada;
    if (esLaMisma || entrada.lat === null || entrada.lon === null) {
      setSeleccionada(null);
      onSeleccionarPunto(null);
      return;
    }

    setSeleccionada(entrada.id);
    onSeleccionarPunto({ lat: entrada.lat, lon: entrada.lon, hora: formatearHora(entrada.created_at) });
  }

  const textoAviso =
    nuevas === 0
      ? ""
      : nuevas === 1
        ? textos.minuto_a_minuto_aviso_nueva
        : textos.minuto_a_minuto_aviso_nuevas.replaceAll("{n}", String(nuevas));

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-2.5">
        {/* Cabecera de acordeón: toda la fila pliega/despliega; el chevron indica el estado. */}
        <button
          type="button"
          onClick={alternarPlegado}
          aria-expanded={!plegado}
          aria-controls={regionId}
          className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: "#2F5D50" }}
        >
          {polling && (
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: C.ember }}
              />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: C.ember }} />
            </span>
          )}
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: C.muted }}>
            {textos.minuto_a_minuto_kicker}
          </span>
          {textoAviso && (
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium text-white"
              style={{ background: C.ember }}
              aria-hidden="true"
            >
              {textoAviso}
            </span>
          )}
          <motion.svg
            aria-hidden="true"
            className="ml-auto shrink-0"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.muted}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: plegado ? 0 : 180 }}
            transition={{ duration: 0.25 }}
          >
            <path d="m6 9 6 6 6-6" />
          </motion.svg>
        </button>
        <span aria-live="polite" className="sr-only">
          {textoAviso && `${textos.minuto_a_minuto_kicker}: ${textoAviso}`}
        </span>

        <div id={regionId}>
          <AnimatePresence initial={false}>
            {!plegado && (
              <motion.div
                key="contenido"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {entradas.map((entrada) => (
                      <FilaEntrada
                        key={entrada.id}
                        entrada={entrada}
                        esActiva={entrada.id === seleccionada}
                        onPulsar={alPulsar}
                      />
                    ))}
                  </AnimatePresence>

                  {siguienteOffset !== null ? (
                    <button
                      onClick={() => cargarPagina(siguienteOffset)}
                      disabled={cargando}
                      className="mx-auto flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] font-medium disabled:opacity-60"
                      style={{ borderColor: "#00000015", color: "#2F5D50", background: "#FBFAF7" }}
                    >
                      {cargando ? "Cargando…" : textos.minuto_a_minuto_boton_cargar_mas}
                    </button>
                  ) : entradas.length === 0 ? (
                    <div className="pt-1 text-center text-[11.5px]" style={{ color: "#9AA29C" }}>
                      {textos.minuto_a_minuto_mensaje_vacio}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

interface FilaEntradaProps {
  entrada: EntradaMinutoAMinutoPublica;
  esActiva: boolean;
  onPulsar: (entrada: EntradaMinutoAMinutoPublica) => void;
}

function FilaEntrada({ entrada, esActiva, onPulsar }: FilaEntradaProps) {
  const tienePosicion = entrada.lat !== null && entrada.lon !== null;
  return (
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      onClick={() => onPulsar(entrada)}
      disabled={!tienePosicion}
      className={
        entrada.foto_url
          ? "w-full overflow-hidden rounded-xl border text-left transition-colors disabled:cursor-default"
          : "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-default"
      }
      style={{
        borderColor: esActiva ? C.ember : "#00000010",
        background: esActiva ? "#D9773B0D" : "white",
      }}
    >
      {entrada.foto_url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL pública de Supabase Storage */}
          <img
            src={entrada.foto_url}
            alt=""
            className="w-full h-auto"
          />
          <div className="min-w-0 px-4 py-3">
            <div className="font-mono text-[11px]" style={{ color: C.muted }}>
              {formatearHora(entrada.created_at)}
            </div>
            <div className="mt-0.5 text-[14px] leading-snug" style={{ color: C.ink }}>
              {entrada.texto}
            </div>
          </div>
        </>
      ) : (
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px]" style={{ color: C.muted }}>
            {formatearHora(entrada.created_at)}
          </div>
          <div className="mt-0.5 text-[14px] leading-snug" style={{ color: C.ink }}>
            {entrada.texto}
          </div>
        </div>
      )}
    </motion.button>
  );
}

function idMasReciente(entradas: readonly EntradaMinutoAMinutoPublica[]): number {
  // 0 con la lista vacía: los ids empiezan en 1, así que cualquier entrada
  // que llegue después cuenta como nueva.
  return entradas[0]?.id ?? 0;
}

