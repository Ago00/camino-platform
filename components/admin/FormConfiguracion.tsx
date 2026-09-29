// Interruptores de la configuración del reto (FP3c, DT-032). Se editan en
// local y se guardan juntos con un solo botón, para que apagar varias
// secciones sea un único cambio en la web. Cada interruptor es un
// <button role="switch" aria-checked>, accesible con teclado y lector.

"use client";

import { useId, useState, useTransition } from "react";
import { guardarConfiguracion } from "@/app/[slug]/admin/actions";
import { describirFalloDeEnvio, esControlDeFlujoDeNext } from "@/lib/envio/errores-de-envio";
import type { CampoConfigReto, ConfigReto } from "@/lib/retos/config";

const C = { ink: "#1B211D", muted: "#4A5450", eucalipto: "#2F5D50", peligro: "#B03A2E" };

interface DefinicionInterruptor {
  campo: CampoConfigReto;
  etiqueta: string;
  descripcion: string;
  /** Interruptor del que depende: si está apagado, este no tiene efecto y se avisa. */
  dependeDe?: { campo: CampoConfigReto; aviso: string };
}

const INTERRUPTORES: readonly DefinicionInterruptor[] = [
  {
    campo: "seccion_intenciones",
    etiqueta: "Intenciones",
    descripcion: "Texto «Por intenciones» y formulario para dejar una intención.",
  },
  {
    campo: "seccion_comentarios",
    etiqueta: "Comentarios",
    descripcion: "Formulario para comentar y muro de comentarios públicos.",
  },
  {
    campo: "respuestas_visitantes",
    etiqueta: "Respuestas de visitantes",
    descripcion:
      "Botón «Responder» en el muro. Apagado, las respuestas existentes se siguen viendo y tú puedes seguir respondiendo desde la pestaña Comentarios.",
    dependeDe: { campo: "seccion_comentarios", aviso: "Sin efecto mientras los comentarios estén apagados." },
  },
  {
    campo: "seccion_minuto_a_minuto",
    etiqueta: "Minuto a minuto",
    descripcion: "Feed de entradas durante el reto y recopilatorio tras la llegada.",
  },
  {
    campo: "seccion_instagram",
    etiqueta: "Instagram",
    descripcion: "Enlace a Instagram (solo si has puesto la URL en Textos).",
  },
];

type EstadoGuardado = { fase: "inactivo" } | { fase: "guardado" } | { fase: "error"; mensaje: string };

interface FormConfiguracionProps {
  configInicial: ConfigReto;
  slug: string;
}

export default function FormConfiguracion({ configInicial, slug }: FormConfiguracionProps) {
  const [config, setConfig] = useState<ConfigReto>(configInicial);
  const [guardadaUltima, setGuardadaUltima] = useState<ConfigReto>(configInicial);
  const [estado, setEstado] = useState<EstadoGuardado>({ fase: "inactivo" });
  const [pendiente, startTransition] = useTransition();

  const sinCambios = INTERRUPTORES.every(({ campo }) => config[campo] === guardadaUltima[campo]);

  function alternar(campo: CampoConfigReto) {
    setConfig((previa) => ({ ...previa, [campo]: !previa[campo] }));
    setEstado({ fase: "inactivo" });
  }

  function guardar() {
    startTransition(async () => {
      try {
        const resultado = await guardarConfiguracion(slug, config);
        if (!resultado.ok) {
          setEstado({ fase: "error", mensaje: resultado.mensaje });
          return;
        }
        setGuardadaUltima(config);
        setEstado({ fase: "guardado" });
      } catch (error) {
        if (esControlDeFlujoDeNext(error)) throw error;
        setEstado({ fase: "error", mensaje: describirFalloDeEnvio(error) });
      }
    });
  }

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "#00000012", background: "white" }}>
      <ul className="divide-y" style={{ borderColor: "#00000010" }}>
        {INTERRUPTORES.map((definicion) => (
          <li key={definicion.campo} className="py-3 first:pt-0 last:pb-0">
            <Interruptor
              definicion={definicion}
              activo={config[definicion.campo]}
              sinEfecto={definicion.dependeDe !== undefined && !config[definicion.dependeDe.campo]}
              deshabilitado={pendiente}
              onAlternar={() => alternar(definicion.campo)}
            />
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={sinCambios || pendiente}
          className="rounded-full px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: C.eucalipto }}
        >
          {pendiente ? "Guardando…" : "Guardar configuración"}
        </button>
        <span aria-live="polite" className="text-[12.5px]" style={{ color: C.eucalipto }}>
          {estado.fase === "guardado" && sinCambios ? "Guardado" : ""}
        </span>
      </div>

      {estado.fase === "error" && (
        <p
          role="alert"
          className="mt-3 rounded-lg px-3 py-2 text-[12.5px] leading-snug"
          style={{ background: "#B03A2E12", color: C.peligro }}
        >
          {estado.mensaje}
        </p>
      )}
    </div>
  );
}

function Interruptor({
  definicion,
  activo,
  sinEfecto,
  deshabilitado,
  onAlternar,
}: {
  definicion: DefinicionInterruptor;
  activo: boolean;
  sinEfecto: boolean;
  deshabilitado: boolean;
  onAlternar: () => void;
}) {
  const idEtiqueta = useId();
  const idDescripcion = useId();

  return (
    <div className="flex items-start gap-3" style={{ opacity: sinEfecto ? 0.55 : 1 }}>
      <div className="min-w-0 flex-1">
        <div id={idEtiqueta} className="text-[14px] font-medium" style={{ color: C.ink }}>
          {definicion.etiqueta}
        </div>
        <p id={idDescripcion} className="mt-0.5 text-[12.5px] leading-snug" style={{ color: C.muted }}>
          {definicion.descripcion}
          {sinEfecto && definicion.dependeDe && ` ${definicion.dependeDe.aviso}`}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-labelledby={idEtiqueta}
        aria-describedby={idDescripcion}
        disabled={deshabilitado}
        onClick={onAlternar}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        style={{ background: activo ? C.eucalipto : "#C2C7C0", outlineColor: C.eucalipto }}
      >
        <span
          aria-hidden
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]"
          style={{ left: activo ? "22px" : "2px" }}
        />
      </button>
    </div>
  );
}
