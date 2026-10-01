// Puente entre WebReto (Server Component) y el monigote suelto (DT-036).
// `next/dynamic` con `ssr: false` solo se admite en Client Components, y el
// monigote no tiene nada que renderizar en el servidor: así su código (figuras,
// motor, sonidos y CSS) solo se descarga en las webs que tienen monigote.

"use client";

import dynamic from "next/dynamic";
import type { PropsMonigoteSuelto } from "@/components/monigotes/MonigoteSuelto";

const MonigoteSuelto = dynamic(() => import("@/components/monigotes/MonigoteSuelto"), { ssr: false });

export default function MonigoteWeb(props: PropsMonigoteSuelto) {
  return <MonigoteSuelto {...props} />;
}
