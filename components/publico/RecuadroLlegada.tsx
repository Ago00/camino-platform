// Recuadro superior de la pantalla "llegada": kicker + título + mensaje sobre
// fondo degradado dorado, con el logo del proyecto. Extraído de
// ModoLlegada.tsx (DT-024) para que el modal "Finalizar" del panel admin
// (components/admin/ModalFinalizar.tsx) pueda mostrar una preview real, con
// el mismo marcado y los mismos estilos, en vez de una aproximación en texto
// plano — el mensaje se ve exactamente igual mientras se escribe que una vez
// publicado.

import LogoMojon from "@/components/publico/LogoMojon";

const C = { ink: "#1B211D", gold: "#C9A24B" };

interface RecuadroLlegadaProps {
  kicker: string;
  titulo: string;
  mensaje: string;
}

export default function RecuadroLlegada({ kicker, titulo, mensaje }: RecuadroLlegadaProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 text-center"
      style={{ background: "linear-gradient(180deg,#F3E6C9,#EFE8DA)", border: `1px solid ${C.gold}44` }}
    >
      <div className="relative">
        <div className="flex justify-center">
          <LogoMojon />
        </div>
        <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: C.gold }}>
          {kicker}
        </div>
        <h2 className="[font-family:var(--font-fraunces)] mt-1 text-[30px] font-semibold" style={{ color: C.ink }}>
          {titulo}
        </h2>
        <p className="mx-auto mt-4 max-w-xs text-[14px] leading-relaxed" style={{ color: "#3C433E" }}>
          {mensaje}
        </p>
      </div>
    </div>
  );
}
