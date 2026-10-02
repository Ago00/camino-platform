// Logo del proyecto: el mojón del Camino. Si el reto tiene monigote, va dentro
// del mojón en versión esquemática (la misma figura del catálogo, pequeña y
// quieta); sin monigote, el logo es solo el mojón. La figura se calcula en el
// servidor (lib/monigotes/logo.ts) y llega por contexto: así no hay que pasarla
// por todos los modos de la web ni por el modal "Finalizar" del admin.
// El SVG inyectado sale únicamente del código de lib/monigotes (nunca de datos
// del usuario).

"use client";

import { createContext, useContext } from "react";
import "./logo-mojon.css";

const FiguraLogoContext = createContext<string | null>(null);

export function LogoMojonProvider({ figuraSvg, children }: { figuraSvg: string | null; children?: React.ReactNode }) {
  return <FiguraLogoContext.Provider value={figuraSvg}>{children}</FiguraLogoContext.Provider>;
}

/** Sitio del cuadro de la figura dentro del mojón (viewBox 0 0 54 96): cuerpo de piedra, bajo el azulejo. */
const POSICION_FIGURA = "translate(13 47)";

export default function LogoMojon() {
  const figuraSvg = useContext(FiguraLogoContext);

  return (
    <svg viewBox="0 0 54 96" width="48" height="85" fill="none" aria-label="Camino de Santi">
      <ellipse cx="27" cy="89" rx="17" ry="2.6" fill="#00000012" />
      <path d="M35 13L39 15L45 85L39 87Z" fill="#A79D9D" stroke="#ffffff" strokeWidth="1" strokeLinejoin="round" />
      <path d="M20 13L35 13L39 87L13 87Z" fill="#C5BDBD" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20 13L35 13L39 15L24 15Z" fill="#D4CDCD" stroke="#ffffff" strokeWidth="1" strokeLinejoin="round" />
      <rect x="19.5" y="17.5" width="14" height="15" rx="1.2" fill="#0A5BA6" stroke="#ffffff" strokeWidth="0.7" />
      <g stroke="#F5C518" strokeWidth="1" strokeLinecap="round">
        <path d="M23 31L20.5 21M23 31L22.5 19.8M23 31L25.5 19.4M23 31L28.5 20M23 31L31 21.5M23 31L31.8 25M23 31L31 28.5M23 31L28 30.5" />
      </g>
      {figuraSvg !== null && (
        <g className="logo-fig" transform={POSICION_FIGURA} dangerouslySetInnerHTML={{ __html: figuraSvg }} />
      )}
    </svg>
  );
}
