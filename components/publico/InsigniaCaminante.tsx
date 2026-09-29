// Insignia junto al nombre en las respuestas del caminante (`es_autor`,
// FP3a/DT-030). Solo el panel admin puede publicar con ella.

export default function InsigniaCaminante({ etiqueta }: { etiqueta: string }) {
  return (
    <span
      className="ml-1.5 inline-flex items-center rounded-full px-2 py-px align-middle text-[10.5px] font-semibold uppercase tracking-wide"
      style={{ background: "#2F5D50", color: "white" }}
    >
      {etiqueta}
    </span>
  );
}
