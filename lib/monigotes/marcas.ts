/**
 * Marcas de rastro y partículas del grito de los monigotes (DT-036), portadas
 * literalmente del catálogo aprobado (constantes MARCA y particulaSvg). Las
 * marcas se dibujan apuntando hacia arriba; el motor las rota según la
 * dirección de la marcha. Strings construidos solo con números y colores del
 * catálogo.
 */

import type { IdMarca, TipoParticula } from "@/lib/monigotes/catalogo";
import { ESTRELLA, n2 } from "@/lib/monigotes/piezas";

const bota = (color: string): string =>
  `<svg width="9" height="13" viewBox="0 0 9 13"><ellipse cx="4.5" cy="5" rx="3" ry="4.5" fill="${color}"/><ellipse cx="4.5" cy="11" rx="1.8" ry="1.5" fill="${color}"/></svg>`;

/**
 * `v` es un aleatorio en [0, 1) que varía tamaño o color de la marca;
 * `caliente` solo lo usa el pimiento (enfadado o picando deja llamitas).
 */
export const MARCAS: Record<IdMarca, (v: number, caliente: boolean) => string> = {
  bota: () => bota("#7A5A3C"),
  botaPeregrino: () => bota("#5B4330"),
  botaBorracho: () => bota("#6A5040"),
  tinta: (v) => { const s = n2(10 + v * 7); return `<svg width="${s}" height="${s}" viewBox="0 0 12 12"><path d="M6 1.5c2 0 2.2 1.6 3.4 2.3 1.3.8 1.6 2.6.6 3.8-.8 1-.4 2.6-2 3-1.5.4-2.2-.7-3.6-.4C3 10.5 1.4 9.6 1.4 8c0-1.3 1-1.7.8-3C2 3.4 4 1.5 6 1.5z" fill="#2B2B3A"/><circle cx="10.8" cy="2" r=".8" fill="#2B2B3A"/><circle cx="1.2" cy="11" r=".6" fill="#2B2B3A"/></svg>`; },
  estrella: (v) => { const s = n2(7 + v * 6), c = v < .5 ? "#C9A24B" : "#9B7FD0"; return `<svg width="${s}" height="${s}" viewBox="-2.2 -2.2 4.4 4.4"><path d="${ESTRELLA}" fill="${c}"/></svg>`; },
  nota: (v) => { const c = v < .33 ? "#2F5D50" : v < .66 ? "#D9773B" : "#3E6E85"; return `<svg width="11" height="15" viewBox="0 0 10 14"><ellipse cx="3.2" cy="11" rx="2.6" ry="1.9" transform="rotate(-20 3.2 11)" fill="${c}"/><path d="M5.5 11V1.5q3.6 1.2 3.2 5" stroke="${c}" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>`; },
  pezuna: () => `<svg width="10" height="11" viewBox="0 0 10 11"><path d="M4.4 1C2.4 1 1 3.6 1 6.4c0 2.4 1.4 3.6 3.4 3.4z" fill="#6B4A2E"/><path d="M5.6 1c2 0 3.4 2.6 3.4 5.4 0 2.4-1.4 3.6-3.4 3.4z" fill="#6B4A2E"/></svg>`,
  charco: (v) => `<svg width="16" height="8" viewBox="0 0 16 8"><ellipse cx="8" cy="5" rx="${n2(5 + v * 2)}" ry="2.2" fill="#6F97B4" opacity=".55"/><ellipse cx="6.5" cy="4.4" rx="2" ry=".6" fill="#fff" opacity=".6"/><circle cx="13.5" cy="2" r=".8" fill="#6F97B4"/></svg>`,
  tirita: () => `<svg width="9" height="13" viewBox="0 0 9 13"><ellipse cx="4.5" cy="5" rx="3" ry="4.5" fill="#7A5A3C"/><ellipse cx="4.5" cy="11" rx="1.8" ry="1.5" fill="#7A5A3C"/><rect x=".8" y="3.6" width="7.4" height="2.4" rx=".9" fill="#EFCFA6" stroke="#C9A27A" stroke-width=".3"/><circle cx="3.4" cy="4.8" r=".3" fill="#C9A27A"/><circle cx="5.6" cy="4.8" r=".3" fill="#C9A27A"/></svg>`,
  abuelo: () => `<svg width="13" height="13" viewBox="0 0 13 13"><ellipse cx="4.5" cy="5" rx="3" ry="4.5" fill="#5A4632"/><ellipse cx="4.5" cy="11" rx="1.8" ry="1.5" fill="#5A4632"/><circle cx="11" cy="3" r="1.2" fill="#6B4A2E"/></svg>`,
  chancla: () => `<svg width="9" height="14" viewBox="0 0 9 14"><path d="M4.5.6c2.4 0 3.6 2 3.4 4.6-.2 2-1 3-1 4.6 0 1.8-1 3.4-2.4 3.4S2.1 11.6 2.1 9.8c0-1.6-.8-2.6-1-4.6C.9 2.6 2.1.6 4.5.6z" fill="#2F7DC0" opacity=".5"/><path d="M1.6 6.2L4.5 3l2.9 3.2" stroke="#2F7DC0" stroke-width="1" fill="none"/></svg>`,
  humo: () => `<svg width="14" height="12" viewBox="0 0 14 12"><circle cx="5" cy="7" r="3.6" fill="#BFC3C7"/><circle cx="9" cy="5.5" r="3" fill="#D0D3D6"/><circle cx="7.5" cy="8.5" r="2.6" fill="#C8CBCE"/></svg>`,
  flecha: () => `<svg width="10" height="14" viewBox="0 0 10 14"><path d="M5 .8L9.2 5.6H6.6V13H3.4V5.6H.8Z" fill="#F4C21F" stroke="#C99A10" stroke-width=".5" stroke-linejoin="round"/><path d="M4.4 7v5" stroke="#FFE07A" stroke-width=".6" stroke-linecap="round"/></svg>`,
  piedra: (v) => `<svg width="10" height="8" viewBox="0 0 10 8"><path d="M1.2 5.2Q.8 2.2 3.8 1.4 8 .8 8.8 4 8.8 7 5.4 7.2 1.8 7.3 1.2 5.2z" fill="${v < .5 ? "#9C9B93" : "#B5B3AB"}" stroke="#6E6D66" stroke-width=".5"/></svg>`,
  baba: (v) => `<svg width="8" height="14" viewBox="0 0 8 14"><ellipse cx="4" cy="7" rx="2.6" ry="6.4" fill="#A9D3E4" opacity=".75"/><ellipse cx="3.2" cy="5" rx=".7" ry="2.2" fill="#fff" opacity=".9"/>${v > .75 ? `<path d="M6.4 1.6l.3.9.9.3-.9.3-.3.9-.3-.9-.9-.3.9-.3z" fill="#fff"/>` : ""}</svg>`,
  sello: (v) => { const c = v < .25 ? "#B8323A" : v < .5 ? "#2E4F9A" : v < .75 ? "#6B3A8C" : "#2F5D50";
    return `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="${c}" stroke-width="1"/><circle cx="8" cy="8" r="5.3" fill="none" stroke="${c}" stroke-width=".5" stroke-dasharray="1 .8"/><path d="M8 10.8L5.4 7.8Q8 5 10.6 7.8Z" fill="${c}"/><path d="M8 10.8V6.4M8 10.8L6.6 6.8M8 10.8L9.4 6.8" stroke="#fff" stroke-width=".35"/></svg>`; },
  pimiento: (_v, caliente) => caliente
    ? `<svg width="9" height="13" viewBox="0 0 12 17"><path d="M6 1Q9 6 10.5 9.5 11.5 16 6 16 .5 16 1.5 10 2.5 7 4 8.5 4 4 6 1z" fill="#F28A1F"/><path d="M6 8.5Q8 11 8 13 7.6 15 6 15 4.4 15 4.2 13 4.4 11 6 8.5z" fill="#FFD84A"/></svg>`
    : `<svg width="7" height="11" viewBox="0 0 9 13"><ellipse cx="4.5" cy="5" rx="3" ry="4.5" fill="#4E9A3A"/><ellipse cx="4.5" cy="11" rx="1.8" ry="1.5" fill="#4E9A3A"/></svg>`,
  azucar: (v) => `<svg width="12" height="10" viewBox="0 0 12 10"><g fill="#fff" stroke="#CFC7B4" stroke-width=".4"><circle cx="3" cy="5" r="1.4"/><circle cx="7.4" cy="3" r="1"/><circle cx="9" cy="7" r="${n2(.8 + v * .6)}"/><circle cx="5.4" cy="8.2" r=".6"/></g></svg>`,
  migas: (v) => `<svg width="12" height="10" viewBox="0 0 12 10"><rect x="1" y="3" width="3.2" height="2.8" rx=".6" fill="#F6CF6A" stroke="#C98A3E" stroke-width=".4" transform="rotate(${Math.round(v * 70)} 2.6 4.4)"/><circle cx="8" cy="6.4" r="1.1" fill="#E3A845"/><circle cx="6.4" cy="2" r=".7" fill="#C98A3E"/><circle cx="10.4" cy="3" r=".5" fill="#F6CF6A"/></svg>`,
  maiz: (v) => `<svg width="11" height="9" viewBox="0 0 11 9"><g fill="#F2C230" stroke="#B88A00" stroke-width=".4"><path d="M3 1.2Q5 1.6 4.8 4 4.4 6 3 6.1 1.6 6 1.3 4 1 1.6 3 1.2z" transform="rotate(${Math.round(v * 90 - 45)} 3 3.6)"/><path d="M8 3.2Q9.6 3.5 9.4 5.4 9.1 7 8 7.1 6.9 7 6.7 5.4 6.4 3.5 8 3.2z"/></g></svg>`,
  zeta: (v) => { const s = n2(9 + v * 6); return `<svg width="${s}" height="${s}" viewBox="0 0 10 10"><text x="5" y="8.8" text-anchor="middle" font-size="10" font-weight="800" font-family="Georgia, serif" fill="${v < .5 ? "#3E6E85" : "#5B3A8C"}" stroke="#fff" stroke-width=".7" paint-order="stroke">Z</text></svg>`; },
  huella: () => `<svg width="10" height="10" viewBox="0 0 10 10"><g fill="#8E5A2E"><ellipse cx="5" cy="6.8" rx="2.4" ry="2"/><circle cx="2" cy="4" r="1"/><circle cx="4" cy="2.2" r="1"/><circle cx="6" cy="2.2" r="1"/><circle cx="8" cy="4" r="1"/></g></svg>`,
};

export function particulaSvg(tipo: TipoParticula, c: string): string {
  switch (tipo) {
    case "burbuja": return `<svg width="26" height="26" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="${c}33" stroke="${c}" stroke-width="1.6"/><circle cx="7" cy="7" r="2" fill="#fff" opacity=".8"/></svg>`;
    case "estrella": return `<svg width="26" height="26" viewBox="-2.2 -2.2 4.4 4.4"><path d="${ESTRELLA}" fill="${c}"/></svg>`;
    case "nota": return `<svg width="24" height="32" viewBox="0 0 10 14"><ellipse cx="3.2" cy="11" rx="2.6" ry="1.9" transform="rotate(-20 3.2 11)" fill="${c}"/><path d="M5.5 11V1.5q3.6 1.2 3.2 5" stroke="${c}" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg>`;
    case "gota": return `<svg width="16" height="22" viewBox="0 0 20 26"><path d="M10 2q6 9 6 13a6 6 0 0 1-12 0q0-4 6-13z" fill="${c}"/></svg>`;
    case "humo": return `<svg width="46" height="38" viewBox="0 0 14 12"><circle cx="5" cy="7" r="3.6" fill="${c}"/><circle cx="9" cy="5.5" r="3" fill="${c}"/><circle cx="7.5" cy="8.5" r="2.6" fill="${c}"/></svg>`;
    case "tinta": return `<svg width="34" height="34" viewBox="0 0 12 12"><path d="M6 1.5c2 0 2.2 1.6 3.4 2.3 1.3.8 1.6 2.6.6 3.8-.8 1-.4 2.6-2 3-1.5.4-2.2-.7-3.6-.4C3 10.5 1.4 9.6 1.4 8c0-1.3 1-1.7.8-3C2 3.4 4 1.5 6 1.5z" fill="${c}"/></svg>`;
    case "interrogacion": return `<svg width="30" height="40" viewBox="0 0 30 40"><text x="15" y="34" text-anchor="middle" font-size="38" font-weight="900" fill="${c}" stroke="#fff" stroke-width="1.5" font-family="Georgia, serif">?</text></svg>`;
    case "flecha": return `<svg width="34" height="22" viewBox="0 0 17 11"><path d="M1 3.5h9V1l6 4.5-6 4.5V7.5H1z" fill="${c}" stroke="#1B211D" stroke-width=".6" stroke-linejoin="round"/></svg>`;
    case "piedra": return `<svg width="24" height="20" viewBox="0 0 11 9"><path d="M1.5 6Q1 2.5 4.5 1.5 9 .8 10 4.5 10 8 6 8.3 2 8.4 1.5 6z" fill="${c}" stroke="#6E6D66" stroke-width=".5"/></svg>`;
    case "sello": return `<svg width="36" height="36" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#fff" fill-opacity=".6" stroke="${c}" stroke-width="1"/><circle cx="8" cy="8" r="5.3" fill="none" stroke="${c}" stroke-width=".5" stroke-dasharray="1 .8"/><path d="M8 10.8L5.4 7.8Q8 5 10.6 7.8Z" fill="${c}"/></svg>`;
    case "llama": return `<svg width="24" height="34" viewBox="0 0 12 17"><path d="M6 1Q9 6 10.5 9.5 11.5 16 6 16 .5 16 1.5 10 2.5 7 4 8.5 4 4 6 1z" fill="${c}"/><path d="M6 8.5Q8 11 8 13 7.6 15 6 15 4.4 15 4.2 13 4.4 11 6 8.5z" fill="#FFE08A"/></svg>`;
    case "azucar": return `<svg width="20" height="20" viewBox="0 0 10 10"><g fill="${c}" stroke="#CFC7B4"><circle cx="5" cy="5" r="3.2" stroke-width=".5"/><circle cx="1.6" cy="2" r="1" stroke-width=".3"/><circle cx="8.6" cy="8.4" r=".8" stroke-width=".3"/></g></svg>`;
    case "patata": return `<svg width="22" height="20" viewBox="0 0 11 10"><rect x="1.5" y="2" width="7" height="6" rx="1.4" fill="${c}" stroke="#9A6424" stroke-width=".5" transform="rotate(-14 5 5)"/></svg>`;
    case "maiz": return `<svg width="16" height="20" viewBox="0 0 8 10"><path d="M4 .8Q7.4 1.4 7 5.4 6.4 9 4 9.2 1.6 9 1 5.4.6 1.4 4 .8z" fill="${c}" stroke="#B88A00" stroke-width=".5"/></svg>`;
    case "zeta": return `<svg width="32" height="32" viewBox="0 0 10 10"><text x="5" y="8.8" text-anchor="middle" font-size="10" font-weight="900" font-family="Georgia, serif" fill="${c}" stroke="#fff" stroke-width=".6" paint-order="stroke">Z</text></svg>`;
    case "huella": return `<svg width="28" height="28" viewBox="0 0 10 10"><g fill="${c}"><ellipse cx="5" cy="6.8" rx="2.4" ry="2"/><circle cx="2" cy="4" r="1"/><circle cx="4" cy="2.2" r="1"/><circle cx="6" cy="2.2" r="1"/><circle cx="8" cy="4" r="1"/></g></svg>`;
  }
}
