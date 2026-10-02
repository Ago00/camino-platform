// Configuración del GPS de un reto (DT-035), compartida por la pestaña GPS
// del admin del reto y las tarjetas del superadmin: tutorial para configurar
// OwnTracks a mano y la URL con el token (lib/gps/config-gps-servidor.ts),
// oculta por defecto para que no quede a la vista en una pantalla compartida.
// Sin token (`datos` null), solo "Generar", que es la misma acción que "Regenerar".

"use client";

import { useRef, useState, useTransition } from "react";
import { describirFalloDeEnvio, esControlDeFlujoDeNext } from "@/lib/envio/errores-de-envio";
import { formatearFechaHora } from "@/lib/fechas";
import type { DatosConfigGps } from "@/lib/gps/config-gps-servidor";
import type { ResultadoPublicacion } from "@/lib/types";

const C = {
  ink: "#1B211D",
  muted: "#4A5450",
  paper: "#F4F3EF",
  eucalipto: "#2F5D50",
  peligro: "#B03A2E",
  aviso: "#8A5A00",
};

const TOKEN_OCULTO = "••••••••";

const CONFIRMACION_REGENERAR =
  "¿Regenerar el token del GPS? El móvil dejará de enviar posiciones hasta que pegues la URL nueva en OwnTracks.";

type EstadoCopia = "inactivo" | "copiado" | "seleccionado";
type EstadoAccion = { fase: "inactivo" } | { fase: "hecho" } | { fase: "error"; mensaje: string };

interface ConfigGpsProps {
  datos: DatosConfigGps | null;
  accionRegenerar: () => Promise<ResultadoPublicacion>;
}

const ESTILO_BOTON = "rounded-lg border px-3 py-1 text-[12.5px] font-medium disabled:opacity-50";

export default function ConfigGps({ datos, accionRegenerar }: ConfigGpsProps) {
  const [visible, setVisible] = useState(false);
  const [estadoCopia, setEstadoCopia] = useState<EstadoCopia>("inactivo");
  const [estadoAccion, setEstadoAccion] = useState<EstadoAccion>({ fase: "inactivo" });
  const [pendiente, startTransition] = useTransition();
  const refUrl = useRef<HTMLElement>(null);

  function ejecutarRegeneracion(conConfirmacion: boolean) {
    if (conConfirmacion && !window.confirm(CONFIRMACION_REGENERAR)) return;
    setEstadoAccion({ fase: "inactivo" });
    startTransition(async () => {
      try {
        const resultado = await accionRegenerar();
        if (!resultado.ok) {
          setEstadoAccion({ fase: "error", mensaje: resultado.mensaje });
          return;
        }
        // Recién regenerado es justo cuando hay que reconfigurar el móvil: se muestra la URL nueva.
        setVisible(true);
        setEstadoCopia("inactivo");
        setEstadoAccion({ fase: "hecho" });
      } catch (error) {
        if (esControlDeFlujoDeNext(error)) throw error;
        setEstadoAccion({ fase: "error", mensaje: describirFalloDeEnvio(error) });
      }
    });
  }

  const mensajes = (
    <>
      {estadoAccion.fase === "hecho" && (
        <p aria-live="polite" className="mt-2 text-[12.5px]" style={{ color: C.eucalipto }}>
          Token nuevo generado. Pega la URL nueva en OwnTracks (paso 3 del tutorial).
        </p>
      )}
      {estadoAccion.fase === "error" && (
        <p
          role="alert"
          className="mt-2 rounded-lg px-3 py-2 text-[12.5px] leading-snug"
          style={{ background: "#B03A2E12", color: C.peligro }}
        >
          {estadoAccion.mensaje}
        </p>
      )}
    </>
  );

  if (datos === null) {
    return (
      <div>
        <p className="text-[13px]" style={{ color: C.peligro }}>
          Sin token GPS: el móvil no puede enviar posiciones de este reto.
        </p>
        <button
          type="button"
          onClick={() => ejecutarRegeneracion(false)}
          disabled={pendiente}
          className="mt-2 rounded-full px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: C.eucalipto }}
        >
          {pendiente ? "Generando…" : "Generar"}
        </button>
        {mensajes}
      </div>
    );
  }

  function seleccionarUrl() {
    const nodo = refUrl.current;
    const seleccion = window.getSelection();
    if (!nodo || !seleccion) return;
    const rango = document.createRange();
    rango.selectNodeContents(nodo);
    seleccion.removeAllRanges();
    seleccion.addRange(rango);
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setEstadoCopia("copiado");
    } catch {
      // Sin permiso de portapapeles (o contexto no seguro): se enseña la URL
      // seleccionada para copiarla a mano.
      setVisible(true);
      requestAnimationFrame(seleccionarUrl);
      setEstadoCopia("seleccionado");
    }
  }

  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-snug" style={{ color: C.muted }}>
        <li>Instala OwnTracks en el móvil (iPhone o Android) y dale permiso de ubicación «Siempre».</li>
        <li>
          En OwnTracks, abre los ajustes y entra en <strong>Connection</strong>: pon <strong>Mode</strong> en{" "}
          <strong>HTTP</strong>.
        </li>
        <li>
          En el campo <strong>URL</strong> (o <em>Host</em>) pega la URL del GPS de abajo (botón «Copiar»). Deja
          desactivada la autenticación: no hace falta usuario ni contraseña.
        </li>
        <li>
          <strong>Importante:</strong> en la pantalla principal elige el modo de seguimiento{" "}
          <strong>Move</strong> (icono de modo arriba; en Android, en el menú <em>Monitoring</em>).
        </li>
        <li>
          En los ajustes avanzados pon <strong>Locator interval</strong> en <strong>30</strong> segundos. Ese valor
          es cada cuánto tiempo envía el móvil su posición: con 30 s llega un punto cada medio minuto y el mapa se
          ve fluido. Un número más alto envía menos puntos y ahorra batería.
        </li>
        <li>
          Pulsa el botón de enviar ubicación (flecha hacia arriba) y comprueba en el admin del reto, pestaña
          Posición, que llega el punto.
        </li>
      </ol>

      {datos.origenProvisional && (
        <p className="rounded-lg px-3 py-2 text-[12.5px] leading-snug" style={{ background: "#8A5A0012", color: C.aviso }}>
          Esta URL usa el dominio desde el que abres el panel, no el de producción. Si es una preview o tu
          ordenador, el móvil dejará de enviar cuando deje de existir: configúralo desde la web de producción.
        </p>
      )}

      <div>
        <p className="text-[12px] font-medium" style={{ color: C.muted }}>
          URL del GPS
        </p>
        <code
          ref={refUrl}
          className="mt-0.5 block select-all break-all rounded-md px-2 py-1 font-mono text-[12.5px]"
          style={{ background: C.paper, color: C.ink }}
        >
          {visible ? datos.urlTracker : `${datos.urlSinToken}&t=${TOKEN_OCULTO}`}
        </code>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className={ESTILO_BOTON}
          style={{ borderColor: "#00000018" }}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
        <button
          type="button"
          onClick={() => copiar(datos.urlTracker)}
          className={ESTILO_BOTON}
          style={{ borderColor: "#00000018" }}
        >
          Copiar
        </button>
        <button
          type="button"
          onClick={() => ejecutarRegeneracion(true)}
          disabled={pendiente}
          className={ESTILO_BOTON}
          style={{ borderColor: `${C.peligro}40`, color: C.peligro }}
        >
          {pendiente ? "Regenerando…" : "Regenerar"}
        </button>
        <span aria-live="polite" className="text-[12px]" style={{ color: C.eucalipto }}>
          {estadoCopia === "copiado" && "Copiada"}
          {estadoCopia === "seleccionado" && "No se pudo copiar: está seleccionada, cópiala con Ctrl+C."}
        </span>
      </div>

      <p className="text-[12px]" style={{ color: C.muted }}>
        Token generado el {formatearFechaHora(datos.fechaActualizacion)}. Solo sirve para este reto; no lo compartas
        fuera de quien configura el móvil.
      </p>

      {mensajes}
    </div>
  );
}
