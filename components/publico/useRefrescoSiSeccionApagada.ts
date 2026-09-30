// Para los componentes de la web que sondean una API de sección (muro de
// comentarios, minuto a minuto). Si el admin apaga la sección con la web
// abierta, la API responde 403: el componente deja de sondear y la página se
// refresca UNA vez para que el servidor la pinte ya sin la sección.

"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { esRespuestaDeSeccionApagada } from "@/lib/retos/config";

/** Devuelve una función que, con el estado HTTP del poll, dice si hay que parar (y refresca la primera vez). */
export function useRefrescoSiSeccionApagada(): (estadoHttp: number) => boolean {
  const router = useRouter();
  const refrescado = useRef(false);

  return useCallback(
    (estadoHttp: number) => {
      if (!esRespuestaDeSeccionApagada(estadoHttp)) return false;
      if (!refrescado.current) {
        refrescado.current = true;
        router.refresh();
      }
      return true;
    },
    [router]
  );
}
