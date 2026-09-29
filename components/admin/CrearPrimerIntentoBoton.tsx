// Arranque desde una base de datos vacía: siembra la primera fila de
// `intentos` sin tocar SQL. Ver crearPrimerIntento() en app/[slug]/admin/actions.ts.

"use client";

import { crearPrimerIntento } from "@/app/[slug]/admin/actions";
import BotonConfirmable from "@/components/admin/BotonConfirmable";

interface CrearPrimerIntentoBotonProps {
  slug: string;
}

export default function CrearPrimerIntentoBoton({ slug }: CrearPrimerIntentoBotonProps) {
  return (
    <BotonConfirmable
      etiqueta="Iniciar primer intento"
      etiquetaPendiente="Creando…"
      mensajeConfirmacion="¿Crear el primer intento? Se creará en fase 'antes'."
      accion={crearPrimerIntento.bind(null, slug)}
    />
  );
}
