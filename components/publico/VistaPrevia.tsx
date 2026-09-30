// Contexto de la vista previa del admin (DT-034). WebReto lo activa cuando la
// web se pinta dentro del iframe de la pestaña "Vista previa": los formularios
// no envían y los componentes con polling no consultan las APIs. Fuera de la
// vista previa el valor por defecto es false y todo funciona como siempre.

"use client";

import { createContext, useContext } from "react";

const ContextoVistaPrevia = createContext(false);

export function VistaPreviaProvider({ activa, children }: React.PropsWithChildren<{ activa: boolean }>) {
  return <ContextoVistaPrevia.Provider value={activa}>{children}</ContextoVistaPrevia.Provider>;
}

export function useVistaPrevia(): boolean {
  return useContext(ContextoVistaPrevia);
}
