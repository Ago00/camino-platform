// Foto de "quién camina" del reto (FP3c, DT-032): subir, cambiar o quitar.
//
// Mismo patrón que la foto de llegada (ModalFinalizar.tsx, DT-024): la foto
// pasa por prepararFotoParaSubida (DT-017) y el envío usa
// ejecutarConReintentos. onSubmit propio en vez de <form action={fn}> para no
// perder el <input type="file"> si el envío falla.
//
// La foto guardada viene siempre de la prop `fotoActual` (el servidor
// revalida el panel tras guardar); el estado local solo guarda la foto
// elegida y aún no enviada.

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { guardarFotoQuienCamina } from "@/app/[slug]/admin/actions";
import { prepararFotoParaSubida } from "@/lib/imagen/preparar-foto";
import { ejecutarConReintentos } from "@/lib/envio/reintentar";
import { describirFalloDeEnvio, esControlDeFlujoDeNext } from "@/lib/envio/errores-de-envio";
import type { ResultadoPublicacion } from "@/lib/types";

const C = { ink: "#1B211D", muted: "#4A5450", verde: "#2F5D50", peligro: "#B03A2E" };

type EstadoEnvio =
  | { fase: "inactivo" }
  | { fase: "preparando-foto" }
  | { fase: "enviando" }
  | { fase: "reintentando"; intento: number }
  | { fase: "error"; mensaje: string };

interface FotoElegida {
  archivo: File;
  previewUrl: string;
}

interface FotoQuienCaminaFormProps {
  fotoActual: string | null;
  nombreCaminante: string;
  slug: string;
}

export default function FotoQuienCaminaForm({ fotoActual, nombreCaminante, slug }: FotoQuienCaminaFormProps) {
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const [elegida, setElegida] = useState<FotoElegida | null>(null);
  const [estado, setEstado] = useState<EstadoEnvio>({ fase: "inactivo" });
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    if (elegida === null) return;
    return () => URL.revokeObjectURL(elegida.previewUrl);
  }, [elegida]);

  function descartarElegida() {
    if (inputFotoRef.current) inputFotoRef.current.value = "";
    setElegida(null);
  }

  function onSeleccionarFoto(archivo: File | null) {
    setEstado({ fase: "inactivo" });
    if (!archivo) return;
    setElegida({ archivo, previewUrl: URL.createObjectURL(archivo) });
  }

  function enviar(construirFormData: () => Promise<FormData | null>) {
    startTransition(async () => {
      try {
        const formData = await construirFormData();
        if (formData === null) return;

        setEstado({ fase: "enviando" });
        const resultado: ResultadoPublicacion = await ejecutarConReintentos(
          () => guardarFotoQuienCamina(slug, formData),
          { alReintentar: (intento) => setEstado({ fase: "reintentando", intento }) }
        );

        if (!resultado.ok) {
          setEstado({ fase: "error", mensaje: resultado.mensaje });
          return;
        }
        descartarElegida();
        setEstado({ fase: "inactivo" });
      } catch (error) {
        if (esControlDeFlujoDeNext(error)) throw error;
        setEstado({ fase: "error", mensaje: describirFalloDeEnvio(error) });
      }
    });
  }

  function guardarElegida() {
    if (elegida === null) return;
    const { archivo } = elegida;
    enviar(async () => {
      setEstado({ fase: "preparando-foto" });
      const preparada = await prepararFotoParaSubida(archivo);
      if (preparada.estado === "demasiado-grande") {
        setEstado({ fase: "error", mensaje: preparada.mensaje });
        return null;
      }
      const formData = new FormData();
      formData.set("foto", preparada.foto);
      return formData;
    });
  }

  function quitarFoto() {
    if (!window.confirm("¿Quitar la foto? En la web se mostrará una silueta.")) return;
    enviar(async () => {
      const formData = new FormData();
      formData.set("quitarFoto", "true");
      return formData;
    });
  }

  const urlMostrada = elegida?.previewUrl ?? fotoActual;

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "#00000012", background: "white" }}>
      <input
        ref={inputFotoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onSeleccionarFoto(e.target.files?.[0] ?? null)}
      />

      <div
        className="relative overflow-hidden rounded-xl"
        style={{ aspectRatio: "4/3", maxWidth: 320, background: "linear-gradient(150deg,#3C4C46,#182721 80%)" }}
      >
        {urlMostrada ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview local (blob), foto de Storage o ruta de /public
          <img src={urlMostrada} alt={nombreCaminante} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[12.5px] text-white/70">
            Sin foto (se muestra una silueta)
          </div>
        )}
        {elegida && (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
            Sin guardar
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {elegida ? (
          <>
            <button
              type="button"
              onClick={guardarElegida}
              disabled={pendiente}
              className="rounded-full px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
              style={{ background: C.verde }}
            >
              {etiquetaGuardar(estado, pendiente)}
            </button>
            <button
              type="button"
              onClick={descartarElegida}
              disabled={pendiente}
              className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-50"
              style={{ borderColor: "#00000015", color: C.muted }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputFotoRef.current?.click()}
              disabled={pendiente}
              className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-50"
              style={{ borderColor: "#00000015", color: C.ink, background: "#FBFAF7" }}
            >
              {fotoActual ? "Cambiar foto" : "Subir foto"}
            </button>
            {fotoActual && (
              <button
                type="button"
                onClick={quitarFoto}
                disabled={pendiente}
                className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium disabled:opacity-50"
                style={{ borderColor: "#B03A2E33", color: C.peligro }}
              >
                {pendiente ? "Quitando…" : "Quitar foto"}
              </button>
            )}
          </>
        )}
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

      {estado.fase === "reintentando" && (
        <p aria-live="polite" className="mt-3 text-[12.5px]" style={{ color: C.muted }}>
          No salió a la primera. Reintentando… (intento {estado.intento})
        </p>
      )}
    </div>
  );
}

function etiquetaGuardar(estado: EstadoEnvio, pendiente: boolean): string {
  if (!pendiente) return "Guardar foto";
  if (estado.fase === "preparando-foto") return "Preparando foto…";
  if (estado.fase === "reintentando") return "Reintentando…";
  return "Guardando…";
}
