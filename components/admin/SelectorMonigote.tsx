// Selector del monigote de la web pública (DT-036), en la pestaña
// Configuración. Controlado: el estado vive en FormConfiguracion, que lo
// guarda junto con los interruptores.
//
// Galería role="radiogroup" con "Ninguno" + las 22 figuras andando en su
// sitio (sin rastro). Teclado de radiogroup: solo la opción elegida es
// tabulable y las flechas/Inicio/Fin mueven la elección. "Probar" (fuera del
// radio, para no anidar controles) pone al monigote en pose, lanza su grito y
// suena si está marcado. Las tarjetas fuera de pantalla se pausan.
//
// Se carga con next/dynamic (ssr: false) desde FormConfiguracion: las figuras
// y el motor son solo de navegador.

"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type RefObject } from "react";
import { IDS_MONIGOTE, MONIGOTES, type DefMonigote, type IdMonigote } from "@/lib/monigotes/catalogo";
import { uidSvgSeguro } from "@/lib/monigotes/figuras";
import { LONGITUD_MAXIMA_GRITO, longitudGrito } from "@/lib/monigotes/grito";
import { montarTarjeta, type ControlTarjeta } from "@/components/monigotes/motor";
import "@/components/monigotes/monigotes.css";

const C = { ink: "#1B211D", muted: "#4A5450", eucalipto: "#2F5D50", borde: "#00000014" };
const TAM_FIGURA = 64;

/** Valor editable del monigote: `grito` es lo que hay escrito ("" = el del catálogo). */
export interface ValorMonigote {
  id: IdMonigote | null;
  grito: string;
  sonido: boolean;
}

interface PropsSelectorMonigote {
  valor: ValorMonigote;
  onCambiar: (valor: ValorMonigote) => void;
  deshabilitado: boolean;
}

const OPCIONES: readonly (IdMonigote | null)[] = [null, ...IDS_MONIGOTE];

const claveOpcion = (id: IdMonigote | null): string => id ?? "ninguno";

export default function SelectorMonigote({ valor, onCambiar, deshabilitado }: PropsSelectorMonigote) {
  const uidBase = uidSvgSeguro(useId());
  const idTitulo = useId();
  const capaGritosRef = useRef<HTMLDivElement>(null);
  const radios = useRef(new Map<string, HTMLDivElement>());

  function elegir(id: IdMonigote | null) {
    if (deshabilitado || id === valor.id) return;
    // Con otro monigote el grito escrito ya no tiene sentido: se vuelve al suyo.
    onCambiar({ id, grito: "", sonido: valor.sonido });
  }

  function alPulsarTecla(evento: KeyboardEvent<HTMLDivElement>, indice: number) {
    if (deshabilitado) return;
    const ultimo = OPCIONES.length - 1;
    let destino: number;
    switch (evento.key) {
      case "ArrowRight":
      case "ArrowDown":
        destino = indice === ultimo ? 0 : indice + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        destino = indice === 0 ? ultimo : indice - 1;
        break;
      case "Home":
        destino = 0;
        break;
      case "End":
        destino = ultimo;
        break;
      case " ":
      case "Enter":
        evento.preventDefault();
        elegir(OPCIONES[indice]);
        return;
      default:
        return;
    }
    evento.preventDefault();
    const id = OPCIONES[destino];
    elegir(id);
    radios.current.get(claveOpcion(id))?.focus();
  }

  function registrarRadio(id: IdMonigote | null, el: HTMLDivElement | null) {
    if (el) radios.current.set(claveOpcion(id), el);
    else radios.current.delete(claveOpcion(id));
  }

  const elegido = valor.id === null ? null : MONIGOTES[valor.id];

  return (
    <div className="mng">
      <div ref={capaGritosRef} className="mng-capa-gritos" aria-hidden="true" />
      <div id={idTitulo} className="text-[14px] font-medium" style={{ color: C.ink }}>
        Monigote de la web
      </div>
      <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: C.muted }}>
        Pasea por la web y deja su rastro. Al pincharlo se enfada y grita. Pulsa «Probar» para verlo.
      </p>
      <div
        role="radiogroup"
        aria-labelledby={idTitulo}
        aria-disabled={deshabilitado || undefined}
        className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2"
      >
        {OPCIONES.map((id, indice) => {
          const comunes = {
            elegida: valor.id === id,
            // Roving tabindex: solo la opción elegida entra en el orden de tabulación.
            tabulable: valor.id === id,
            deshabilitado,
            onElegir: () => elegir(id),
            onTecla: (evento: KeyboardEvent<HTMLDivElement>) => alPulsarTecla(evento, indice),
            registrar: (el: HTMLDivElement | null) => registrarRadio(id, el),
          };
          return id === null ? (
            <OpcionNinguno key="ninguno" {...comunes} />
          ) : (
            <TarjetaMonigote
              key={id}
              {...comunes}
              def={MONIGOTES[id]}
              uid={`${uidBase}-${id}`}
              capaGritosRef={capaGritosRef}
              gritoParaProbar={valor.id === id ? valor.grito : null}
              sonido={valor.sonido}
            />
          );
        })}
      </div>

      {elegido && (
        <PanelMonigoteElegido def={elegido} valor={valor} deshabilitado={deshabilitado} onCambiar={onCambiar} />
      )}
    </div>
  );
}

interface PropsOpcion {
  elegida: boolean;
  tabulable: boolean;
  deshabilitado: boolean;
  onElegir: () => void;
  onTecla: (evento: KeyboardEvent<HTMLDivElement>) => void;
  registrar: (el: HTMLDivElement | null) => void;
}

function estiloTarjeta(elegida: boolean) {
  return {
    borderColor: elegida ? C.eucalipto : C.borde,
    boxShadow: elegida ? `0 0 0 2px ${C.eucalipto}40` : undefined,
    background: "white",
  };
}

const CLASE_RADIO =
  "flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg px-1 pt-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 aria-disabled:cursor-default";

function OpcionNinguno({ elegida, tabulable, deshabilitado, onElegir, onTecla, registrar }: PropsOpcion) {
  return (
    <div className="flex flex-col rounded-xl border p-1.5" style={estiloTarjeta(elegida)}>
      <div
        ref={registrar}
        role="radio"
        aria-checked={elegida}
        aria-disabled={deshabilitado || undefined}
        tabIndex={tabulable ? 0 : -1}
        onClick={onElegir}
        onKeyDown={onTecla}
        className={`${CLASE_RADIO} h-full justify-center pb-2`}
        style={{ outlineColor: C.eucalipto }}
      >
        <span aria-hidden className="flex h-[76px] items-center text-[28px]" style={{ color: "#C2C7C0" }}>
          —
        </span>
        <span className="text-center text-[12.5px] font-medium leading-tight" style={{ color: C.ink }}>
          Ninguno
        </span>
      </div>
    </div>
  );
}

function TarjetaMonigote({
  elegida,
  tabulable,
  deshabilitado,
  onElegir,
  onTecla,
  registrar,
  def,
  uid,
  capaGritosRef,
  gritoParaProbar,
  sonido,
}: PropsOpcion & {
  def: DefMonigote;
  uid: string;
  capaGritosRef: RefObject<HTMLDivElement | null>;
  gritoParaProbar: string | null;
  sonido: boolean;
}) {
  const figuraRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<ControlTarjeta | null>(null);

  useEffect(() => {
    const contenedor = figuraRef.current;
    const capaGritos = capaGritosRef.current;
    if (!contenedor || !capaGritos) return;
    const control = montarTarjeta(contenedor, capaGritos, def, uid, TAM_FIGURA);
    controlRef.current = control;
    const observador = new IntersectionObserver(
      (entradas) => entradas.forEach((entrada) => control.ponerVisible(entrada.isIntersecting)),
      { rootMargin: "60px" }
    );
    observador.observe(contenedor);
    return () => {
      observador.disconnect();
      control.destruir();
      controlRef.current = null;
    };
  }, [def, uid, capaGritosRef]);

  return (
    <div className="flex flex-col rounded-xl border p-1.5" style={estiloTarjeta(elegida)}>
      <div
        ref={registrar}
        role="radio"
        aria-checked={elegida}
        aria-disabled={deshabilitado || undefined}
        tabIndex={tabulable ? 0 : -1}
        onClick={onElegir}
        onKeyDown={onTecla}
        className={CLASE_RADIO}
        style={{ outlineColor: C.eucalipto }}
      >
        <div
          ref={figuraRef}
          aria-hidden="true"
          className={`flex h-[76px] w-full justify-center ${def.alto ? "items-center" : "items-end"}`}
        />
        <span className="text-center text-[12.5px] font-medium leading-tight" style={{ color: C.ink }}>
          {def.nombre}
        </span>
      </div>
      <button
        type="button"
        onClick={() => controlRef.current?.probar(gritoParaProbar, sonido)}
        aria-label={`Probar ${def.nombre}`}
        className="mx-auto mt-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ color: C.eucalipto, outlineColor: C.eucalipto }}
      >
        Probar
      </button>
    </div>
  );
}

function PanelMonigoteElegido({
  def,
  valor,
  deshabilitado,
  onCambiar,
}: {
  def: DefMonigote;
  valor: ValorMonigote;
  deshabilitado: boolean;
  onCambiar: (valor: ValorMonigote) => void;
}) {
  const idCampo = useId();
  const idAyuda = useId();
  const idSonido = useId();

  return (
    <div className="mt-4 rounded-xl border p-3" style={{ borderColor: C.borde, background: "#FAFAF7" }}>
      <label htmlFor={idCampo} className="text-[13px] font-medium" style={{ color: C.ink }}>
        Grito de {def.nombre}
      </label>
      <input
        id={idCampo}
        type="text"
        autoComplete="off"
        value={valor.grito}
        // Recorte por caracteres (un emoji = 1), como el contador, el servidor y la BD;
        // maxLength contaría unidades UTF-16 y cortaría antes con emojis.
        onChange={(e) =>
          onCambiar({ ...valor, grito: Array.from(e.target.value).slice(0, LONGITUD_MAXIMA_GRITO).join("") })
        }
        disabled={deshabilitado}
        placeholder={def.grito}
        aria-describedby={idAyuda}
        className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none placeholder:text-[#A8AEA8] focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-60"
        style={{ borderColor: "#00000015", outlineColor: C.eucalipto }}
      />
      <p id={idAyuda} className="mt-1 flex justify-between gap-3 text-[12px] leading-snug" style={{ color: C.muted }}>
        <span>
          Vacío, grita «{def.grito}»{def.gritoVivo ? " (los km bajan con cada pinchazo)" : ""}.
        </span>
        <span className="shrink-0 tabular-nums">
          {longitudGrito(valor.grito)}/{LONGITUD_MAXIMA_GRITO}
        </span>
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          id={idSonido}
          type="checkbox"
          checked={valor.sonido}
          onChange={(e) => onCambiar({ ...valor, sonido: e.target.checked })}
          disabled={deshabilitado}
          className="h-4 w-4"
          style={{ accentColor: C.eucalipto }}
        />
        <label htmlFor={idSonido} className="text-[13px]" style={{ color: C.ink }}>
          Que suene al pincharlo
        </label>
      </div>
    </div>
  );
}
