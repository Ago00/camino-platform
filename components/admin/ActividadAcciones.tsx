// Botones de transición de fase de Actividad. Client Component: cada botón
// pide o no confirmación según el diseño acordado en docs/tareas/CURRENT.md:
//
// - antes  → elegir modo (guiado/libre, DT-016) + Iniciar (confirmación, por
//             simetría con las demás transiciones)
// - durante → Finalizar (abre ModalFinalizar.tsx, DT-024: mensaje + foto
//             opcional + preview real) + Reiniciar (confirmación; aborta el
//             intento en marcha)
// - llegada → Retomar (SIN confirmación: reversible con otro Finalizar,
//             mismo intento) + Reiniciar (confirmación: cierra de verdad)

"use client";

import { useState, useTransition } from "react";
import { iniciarReto, reiniciarReto, retomarReto } from "@/app/[slug]/admin/actions";
import BotonConfirmable from "@/components/admin/BotonConfirmable";
import ModalFinalizar from "@/components/admin/ModalFinalizar";
import type { ModoIntento } from "@/lib/types";

const C = { eucalipto: "#2F5D50", peligro: "#B03A2E" };

interface ActividadAccionesProps {
  fase: "antes" | "durante" | "llegada";
  mensajeLlegadaDefault: string;
  /** Foto de llegada ya subida en una finalización anterior, o null. */
  fotoLlegadaUrlActual: string | null;
  llegadaKicker: string;
  llegadaTitulo: string;
  slug: string;
}

export default function ActividadAcciones({
  fase,
  mensajeLlegadaDefault,
  fotoLlegadaUrlActual,
  llegadaKicker,
  llegadaTitulo,
  slug,
}: ActividadAccionesProps) {
  if (fase === "antes") {
    return <IniciarConModo slug={slug} />;
  }

  if (fase === "durante") {
    return (
      <FinalizarYReiniciar
        mensajeLlegadaDefault={mensajeLlegadaDefault}
        fotoLlegadaUrlActual={fotoLlegadaUrlActual}
        llegadaKicker={llegadaKicker}
        llegadaTitulo={llegadaTitulo}
        slug={slug}
      />
    );
  }

  return <RetomarYReiniciar slug={slug} />;
}

function IniciarConModo({ slug }: { slug: string }) {
  const [modo, setModo] = useState<ModoIntento>("guiado");
  const [destinoLat, setDestinoLat] = useState("");
  const [destinoLon, setDestinoLon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const latNum = Number(destinoLat);
  const lonNum = Number(destinoLon);
  const destinoValido =
    destinoLat.trim() !== "" &&
    destinoLon.trim() !== "" &&
    Number.isFinite(latNum) &&
    Number.isFinite(lonNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lonNum >= -180 &&
    lonNum <= 180;

  const puedeIniciar = modo === "guiado" || destinoValido;

  function iniciar() {
    if (!window.confirm("¿Iniciar el reto? La web pública pasará a mostrar el mapa en directo.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await iniciarReto(
          slug,
          modo === "libre" ? { modo, destinoLat: latNum, destinoLon: lonNum } : { modo }
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo iniciar el reto.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[12.5px] font-medium" style={{ color: "#4A5450" }}>
          Modo del intento
        </label>
        <div className="mt-1 flex gap-2">
          <SelectorModoBoton etiqueta="Guiado" activo={modo === "guiado"} onClick={() => setModo("guiado")} />
          <SelectorModoBoton etiqueta="Libre" activo={modo === "libre"} onClick={() => setModo("libre")} />
        </div>
      </div>

      {modo === "libre" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[12.5px] font-medium" style={{ color: "#4A5450" }}>
              Latitud del destino
            </label>
            <input
              type="number"
              step="any"
              value={destinoLat}
              onChange={(e) => setDestinoLat(e.target.value)}
              placeholder="42.8805"
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none"
              style={{ borderColor: "#00000015" }}
            />
          </div>
          <div>
            <label className="text-[12.5px] font-medium" style={{ color: "#4A5450" }}>
              Longitud del destino
            </label>
            <input
              type="number"
              step="any"
              value={destinoLon}
              onChange={(e) => setDestinoLon(e.target.value)}
              placeholder="-8.5464"
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none"
              style={{ borderColor: "#00000015" }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-[13px]" style={{ color: C.peligro }}>
          {error}
        </p>
      )}

      <button
        onClick={iniciar}
        disabled={!puedeIniciar || pendiente}
        className="rounded-full px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
        style={{ background: C.eucalipto }}
      >
        {pendiente ? "Iniciando…" : "Iniciar"}
      </button>
    </div>
  );
}

function SelectorModoBoton({
  etiqueta,
  activo,
  onClick,
}: {
  etiqueta: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="rounded-full px-3 py-1.5 text-[12.5px] font-medium"
      style={
        activo
          ? { background: C.eucalipto, color: "white" }
          : { background: "white", color: "#4A5450", border: "1px solid #00000015" }
      }
    >
      {etiqueta}
    </button>
  );
}

function FinalizarYReiniciar({
  mensajeLlegadaDefault,
  fotoLlegadaUrlActual,
  llegadaKicker,
  llegadaTitulo,
  slug,
}: {
  mensajeLlegadaDefault: string;
  fotoLlegadaUrlActual: string | null;
  llegadaKicker: string;
  llegadaTitulo: string;
  slug: string;
}) {
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setModalAbierto(true)}
          className="rounded-full px-4 py-2 text-[13px] font-medium text-white"
          style={{ background: C.eucalipto }}
        >
          Finalizar
        </button>
        <BotonConfirmable
          etiqueta="Reiniciar"
          etiquetaPendiente="Reiniciando…"
          mensajeConfirmacion="¿Reiniciar? Se cerrará este intento (queda guardado para siempre) y se abrirá uno nuevo desde cero."
          accion={reiniciarReto.bind(null, slug)}
          variante="peligro"
        />
      </div>

      {modalAbierto && (
        <ModalFinalizar
          mensajeLlegadaDefault={mensajeLlegadaDefault}
          fotoLlegadaUrlActual={fotoLlegadaUrlActual}
          kicker={llegadaKicker}
          titulo={llegadaTitulo}
          onClose={() => setModalAbierto(false)}
          slug={slug}
        />
      )}
    </div>
  );
}

function RetomarYReiniciar({ slug }: { slug: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Retomar: reversible con otro Finalizar, sin confirmación (ver CURRENT.md). */}
      <BotonConfirmable etiqueta="Retomar" etiquetaPendiente="Retomando…" accion={retomarReto.bind(null, slug)} />
      <BotonConfirmable
        etiqueta="Reiniciar"
        etiquetaPendiente="Reiniciando…"
        mensajeConfirmacion="¿Reiniciar? Se cerrará este intento (queda guardado para siempre) y se abrirá uno nuevo desde cero."
        accion={reiniciarReto.bind(null, slug)}
        variante="peligro"
      />
    </div>
  );
}
