// Interruptores de la configuración del reto (FP3c, DT-032), monigote de la
// web (DT-036) y perfil de Instagram (DT-034). Se editan en local y se guardan
// juntos con un solo botón, para que apagar varias secciones sea un único
// cambio en la web; interruptores y monigote van en la misma acción. Cada
// interruptor es un <button role="switch" aria-checked>, accesible con teclado
// y lector. El perfil de Instagram se valida aquí con la misma función pura
// que en el servidor (el servidor vuelve a validarlo) y se guarda con su
// propia acción, solo si ha cambiado. El selector del monigote se carga aparte
// (next/dynamic, solo cliente): trae las 22 figuras y su motor.

"use client";

import dynamic from "next/dynamic";
import { useId, useState, useTransition } from "react";
import { guardarConfiguracion, guardarInstagram } from "@/app/[slug]/admin/actions";
import { describirFalloDeEnvio, esControlDeFlujoDeNext } from "@/lib/envio/errores-de-envio";
import { normalizarPerfilInstagram } from "@/lib/retos/instagram";
import type { CampoConfigReto, ConfigReto, MonigoteDelReto } from "@/lib/retos/config";
import { MONIGOTES } from "@/lib/monigotes/catalogo";
import { normalizarGritoMonigote } from "@/lib/monigotes/grito";
import type { ValorMonigote } from "@/components/admin/SelectorMonigote";

const SelectorMonigote = dynamic(() => import("@/components/admin/SelectorMonigote"), {
  ssr: false,
  loading: () => <EsqueletoSelector />,
});

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
    descripcion: "Enlace a tu perfil de Instagram (indícalo justo debajo).",
  },
];

type EstadoGuardado = { fase: "inactivo" } | { fase: "guardado" } | { fase: "error"; mensaje: string };

/** Grito tal cual se guardaría (normalizado; null = el del catálogo). */
function gritoAGuardar(valor: ValorMonigote): string | null {
  return valor.id === null ? null : normalizarGritoMonigote(valor.grito, MONIGOTES[valor.id].grito);
}

function mismoMonigote(a: ValorMonigote, b: ValorMonigote): boolean {
  return a.id === b.id && a.sonido === b.sonido && gritoAGuardar(a) === gritoAGuardar(b);
}

interface FormConfiguracionProps {
  configInicial: ConfigReto;
  monigoteInicial: MonigoteDelReto;
  /** URL guardada del perfil de Instagram (vacía = sin enlace). */
  perfilInstagramInicial: string;
  slug: string;
}

export default function FormConfiguracion({
  configInicial,
  monigoteInicial,
  perfilInstagramInicial,
  slug,
}: FormConfiguracionProps) {
  const [config, setConfig] = useState<ConfigReto>(configInicial);
  const [guardadaUltima, setGuardadaUltima] = useState<ConfigReto>(configInicial);
  const valorMonigoteInicial: ValorMonigote = {
    id: monigoteInicial.id,
    grito: monigoteInicial.grito ?? "",
    sonido: monigoteInicial.sonido,
  };
  const [monigote, setMonigote] = useState<ValorMonigote>(valorMonigoteInicial);
  const [monigoteGuardado, setMonigoteGuardado] = useState<ValorMonigote>(valorMonigoteInicial);
  const [perfilInstagram, setPerfilInstagram] = useState(perfilInstagramInicial);
  const [perfilGuardado, setPerfilGuardado] = useState(perfilInstagramInicial);
  const [estado, setEstado] = useState<EstadoGuardado>({ fase: "inactivo" });
  const [pendiente, startTransition] = useTransition();

  const interruptoresSinCambios = INTERRUPTORES.every(({ campo }) => config[campo] === guardadaUltima[campo]);
  const monigoteSinCambios = mismoMonigote(monigote, monigoteGuardado);
  const perfilSinCambios = perfilInstagram.trim() === perfilGuardado.trim();
  const sinCambios = interruptoresSinCambios && monigoteSinCambios && perfilSinCambios;

  function alternar(campo: CampoConfigReto) {
    setConfig((previa) => ({ ...previa, [campo]: !previa[campo] }));
    setEstado({ fase: "inactivo" });
  }

  function cambiarMonigote(valor: ValorMonigote) {
    setMonigote(valor);
    setEstado({ fase: "inactivo" });
  }

  function cambiarPerfil(valor: string) {
    setPerfilInstagram(valor);
    setEstado({ fase: "inactivo" });
  }

  function guardar() {
    // Validación antes de enviar nada: con un perfil mal escrito no se guarda
    // tampoco lo demás, para no dejar la configuración a medias.
    let urlPerfil: string | null = null;
    if (!perfilSinCambios) {
      const perfil = normalizarPerfilInstagram(perfilInstagram);
      if (!perfil.ok) {
        setEstado({ fase: "error", mensaje: perfil.mensaje });
        return;
      }
      urlPerfil = perfil.url;
    }
    const configAGuardar = config;
    const monigoteAGuardar = monigote;

    startTransition(async () => {
      try {
        if (!interruptoresSinCambios || !monigoteSinCambios) {
          const resultado = await guardarConfiguracion(slug, {
            ...configAGuardar,
            monigote: monigoteAGuardar.id,
            monigote_grito: gritoAGuardar(monigoteAGuardar),
            monigote_sonido: monigoteAGuardar.sonido,
          });
          if (!resultado.ok) {
            setEstado({ fase: "error", mensaje: resultado.mensaje });
            return;
          }
          setGuardadaUltima(configAGuardar);
          setMonigoteGuardado(monigoteAGuardar);
        }
        if (urlPerfil !== null) {
          const resultado = await guardarInstagram(slug, urlPerfil);
          if (!resultado.ok) {
            setEstado({ fase: "error", mensaje: resultado.mensaje });
            return;
          }
          setPerfilInstagram(urlPerfil);
          setPerfilGuardado(urlPerfil);
        }
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
            {definicion.campo === "seccion_instagram" && (
              <CampoPerfilInstagram
                valor={perfilInstagram}
                sinEfecto={!config.seccion_instagram}
                deshabilitado={pendiente}
                onCambiar={cambiarPerfil}
              />
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t pt-4" style={{ borderColor: "#00000010" }}>
        <SelectorMonigote valor={monigote} onCambiar={cambiarMonigote} deshabilitado={pendiente} />
      </div>

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

/** Hueco del selector mientras se descarga (mismas proporciones, sin saltos). */
function EsqueletoSelector() {
  return (
    <div aria-busy="true" aria-label="Cargando monigotes">
      <div className="h-4 w-40 rounded bg-black/5" />
      <div className="mt-2 h-3 w-64 max-w-full rounded bg-black/5" />
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[132px] animate-pulse rounded-xl bg-black/5 motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}

function CampoPerfilInstagram({
  valor,
  sinEfecto,
  deshabilitado,
  onCambiar,
}: {
  valor: string;
  sinEfecto: boolean;
  deshabilitado: boolean;
  onCambiar: (valor: string) => void;
}) {
  const idCampo = useId();
  const idAyuda = useId();

  return (
    <div className="mt-3" style={{ opacity: sinEfecto ? 0.55 : 1 }}>
      <label htmlFor={idCampo} className="text-[13px] font-medium" style={{ color: C.ink }}>
        Perfil de Instagram
      </label>
      <input
        id={idCampo}
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        disabled={deshabilitado}
        maxLength={300}
        placeholder="@usuario o instagram.com/usuario"
        aria-describedby={idAyuda}
        className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none placeholder:text-[#A8AEA8] disabled:opacity-60"
        style={{ borderColor: "#00000015" }}
      />
      <p id={idAyuda} className="mt-1 text-[12px] leading-snug" style={{ color: C.muted }}>
        Se guarda como https://instagram.com/usuario. Vacío, no se muestra ningún enlace.
        {sinEfecto && " Sin efecto mientras Instagram esté apagado."}
      </p>
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
