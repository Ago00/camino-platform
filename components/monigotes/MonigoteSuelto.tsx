// Monigote suelto de la web pública (DT-036). Solo crea las tres capas fijas
// (rastros, monigote y grito) y entrega el trabajo al motor imperativo
// (motor.ts) en un efecto. Se carga solo en el cliente (MonigoteWeb, ssr:false):
// no tiene nada que pintar en el servidor.
//
// StrictMode-safe: el efecto monta y la limpieza destruye todo lo que creó
// (rAF, temporizadores, marcas y grito), así que el doble montaje de
// desarrollo deja un único monigote.

"use client";

import { useEffect, useId, useRef } from "react";
import { MONIGOTES, type IdMonigote } from "@/lib/monigotes/catalogo";
import { uidSvgSeguro } from "@/lib/monigotes/figuras";
import { crearSuelto } from "@/components/monigotes/motor";
import "@/components/monigotes/monigotes.css";

export interface PropsMonigoteSuelto {
  id: IdMonigote;
  /** Grito personalizado del reto (null = el del catálogo). */
  grito: string | null;
  sonido: boolean;
}

export default function MonigoteSuelto({ id, grito, sonido }: PropsMonigoteSuelto) {
  const uid = uidSvgSeguro(useId());
  const rastrosRef = useRef<HTMLDivElement>(null);
  const sueltoRef = useRef<HTMLDivElement>(null);
  const gritosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rastros = rastrosRef.current;
    const suelto = sueltoRef.current;
    const gritos = gritosRef.current;
    if (!rastros || !suelto || !gritos) return;
    const control = crearSuelto({ rastros, suelto, gritos }, MONIGOTES[id], { uid, grito, sonido });
    return () => control.destruir();
  }, [id, grito, sonido, uid]);

  return (
    <div className="mng">
      <div ref={rastrosRef} className="mng-capa-rastros" aria-hidden="true" />
      <div ref={sueltoRef} className="mng-capa-suelto" />
      <div ref={gritosRef} className="mng-capa-gritos" aria-hidden="true" />
    </div>
  );
}
