// Detecta cambios de fase del intento activo y recarga la página entera
// cuando ocurren (DT-012, docs/tecnico/decisiones-tecnicas.md). Se renderiza
// una única vez en components/publico/WebReto.tsx, junto al modo activo, y
// nunca en la vista previa del admin (DT-034).
// FP1 (DT-026): recibe `slug` para construir la URL correcta del endpoint.

"use client";

import { useEffect } from "react";
import type { Fase } from "@/lib/types";

const POLLING_MS = 30_000;

interface RefrescoAlCambiarFaseProps {
  faseActual: Fase;
  slug: string;
}

export default function RefrescoAlCambiarFase({ faseActual, slug }: RefrescoAlCambiarFaseProps) {
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const response = await fetch(`/${slug}/api/fase`);
        if (!response.ok) return;
        const { fase }: { fase: Fase } = await response.json();
        if (fase !== faseActual) {
          window.location.reload();
        }
      } catch {
        // Fallo puntual de red (o 429, etc.): no se hace nada, el siguiente
        // intervalo de polling reintenta.
      }
    }, POLLING_MS);
    return () => clearInterval(id);
  }, [faseActual, slug]);

  return null;
}
