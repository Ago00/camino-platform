// Detecta cambios de fase del intento activo y recarga la página entera
// cuando ocurren (DT-012, docs/tecnico/decisiones-tecnicas.md). Se renderiza
// una única vez en components/publico/WebReto.tsx, junto al modo activo, y
// nunca en la vista previa del admin (DT-034).
// FP1 (DT-026): recibe `slug` para construir la URL correcta del endpoint.
//
// También compara la huella de configuración y textos (lib/retos/huella-publica.ts):
// si el admin apaga una sección, cambia la foto o edita un texto, la web abierta
// se actualiza con router.refresh(), que conserva el estado del cliente (un
// comentario a medio escribir no se pierde).

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Fase } from "@/lib/types";

const POLLING_MS = 30_000;

interface RefrescoAlCambiarFaseProps {
  faseActual: Fase;
  huellaActual: string;
  slug: string;
}

export default function RefrescoAlCambiarFase({ faseActual, huellaActual, slug }: RefrescoAlCambiarFaseProps) {
  const router = useRouter();
  // Evita refrescos repetidos si el servidor tarda en servir la versión nueva.
  const huellaPedida = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const response = await fetch(`/${slug}/api/fase`);
        if (!response.ok) return;
        const { fase, huella }: { fase: Fase; huella?: string } = await response.json();
        if (fase !== faseActual) {
          window.location.reload();
          return;
        }
        if (huella && huella !== huellaActual && huella !== huellaPedida.current) {
          huellaPedida.current = huella;
          router.refresh();
        }
      } catch {
        // Fallo puntual de red (o 429, etc.): no se hace nada, el siguiente
        // intervalo de polling reintenta.
      }
    }, POLLING_MS);
    return () => clearInterval(id);
  }, [faseActual, huellaActual, slug, router]);

  return null;
}
