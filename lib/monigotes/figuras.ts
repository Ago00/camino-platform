/**
 * Las 22 figuras de los monigotes (DT-036), portadas literalmente del catálogo
 * aprobado (design-sandbox/public/monigotes-tematicos.html, constante FIG).
 * Cada una devuelve el contenido de un <svg viewBox="0 0 40 48"> como string.
 *
 * `uid` va en los id internos del SVG (url(#ra-…) del atleti): debe ser único
 * en el documento y venir ya saneado a [a-z0-9-] (ver `uidSvgSeguro`). Las
 * clases (.pa, .pose, .bob…) solo tienen estilo dentro de un contenedor
 * `.mng` (components/monigotes/monigotes.css).
 *
 * La placa del mojón se pinta con los km iniciales; el motor la actualiza con
 * el contador real al montarla (textContent).
 */

import type { IdMonigote } from "@/lib/monigotes/catalogo";
import { KM_INICIAL_MOJON } from "@/lib/monigotes/grito";
import { ESTRELLA, cara, destello, gesto, mofletes, n2, notaSvg, pierna, vapor, vieira } from "@/lib/monigotes/piezas";

export const FIGURAS: Record<IdMonigote, (uid: string) => string> = {
  atleti: (u) => `<g class="bob">
    <line x1="30" y1="9" x2="27" y2="45" stroke="#B98A5A" stroke-width="2" stroke-linecap="round"/>
    <circle cx="30" cy="10" r="2" fill="#C9A24B"/>
    <rect x="8" y="20" width="7" height="12" rx="3" fill="#2F5D50"/>
    ${pierna(19, 32, 16, 43, "#2A2A2A", 3, 1)}${pierna(21, 32, 24, 43, "#2A2A2A", 3, -1)}
    <defs><pattern id="ra-${u}" patternUnits="userSpaceOnUse" width="4.4" height="48"><rect width="2.2" height="48" fill="#CE2029"/><rect x="2.2" width="2.2" height="48" fill="#fff"/></pattern></defs>
    <path d="M13 19h11a3 3 0 0 1 3 3v8a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4v-8a3 3 0 0 1 3-3z" fill="url(#ra-${u})" stroke="#1B211D" stroke-width=".6"/>
    <line x1="24" y1="23" x2="29" y2="13" stroke="#CE2029" stroke-width="3" stroke-linecap="round"/>
    ${vapor(11, 26, 9)}
    ${cara(18.5, 12)}
    <path d="M10 9q8.5-5.5 17 0" stroke="#6B4A2E" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M14 9q4.5-4 9 0z" fill="#8A5A34"/></g>`,

  peregrino: () => `<g class="bob">
    <rect x="5" y="19.5" width="8.5" height="13" rx="3" fill="#7A5A3C" stroke="#5B4330" stroke-width=".4"/>
    ${vieira(7.8, 25.6, .5)}
    ${pierna(19, 32, 16.5, 43.5, "#3A2E26", 2.8, 1)}${pierna(21, 32, 23.5, 43.5, "#3A2E26", 2.8, -1)}
    <path d="M13 19h11a3 3 0 0 1 3 3v9.5a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 10 31.5V22a3 3 0 0 1 3-3z" fill="#9C8763" stroke="#1B211D" stroke-width=".5"/>
    <path d="M10 29.5h17" stroke="#6B4A2E" stroke-width="1.3"/>
    <path d="M10.2 19.8Q18.5 16.6 26.8 19.8L27.6 25.6Q18.5 28.4 9.4 25.6Z" fill="#5B4330" stroke="#1B211D" stroke-width=".4"/>
    ${vieira(15.5, 23.2, .42)}
    <g class="brazo vb" style="transform-origin:24px 23px">
      <line x1="31" y1="5" x2="28.5" y2="45" stroke="#8A5A34" stroke-width="2" stroke-linecap="round"/>
      <circle cx="31" cy="5.4" r="1.5" fill="#6B4A2E"/>
      <path d="M30.9 9.4q2 .8 2.2 2.6" stroke="#6B4A2E" stroke-width=".6" fill="none"/>
      <circle cx="33.1" cy="13.1" r="1.5" fill="#D9A441" stroke="#8A6A2E" stroke-width=".4"/>
      <circle cx="33.3" cy="16.3" r="2.2" fill="#D9A441" stroke="#8A6A2E" stroke-width=".4"/>
      <line x1="24" y1="23" x2="29.8" y2="16.6" stroke="#5B4330" stroke-width="3" stroke-linecap="round"/>
      <circle cx="30" cy="16.3" r="1.3" fill="#E9C9A8"/>
    </g>
    ${cara(18.5, 12, { pose: "alegre", mejillas: true })}
    <ellipse cx="18.5" cy="7.4" rx="11" ry="2" fill="#3B2A1E"/>
    <path d="M13.8 7.4q4.7-6 9.4 0z" fill="#4A3526"/>
    ${vieira(18.5, 5.5, .36)}
    <g class="solo-pose">${destello(6, 8, .9)}${destello(35, 3, 1.1)}${destello(3, 16, .7)}</g></g>`,

  borrachillo: () => `<g class="bob">
    ${pierna(19, 32, 16, 43.5, "#4A4A5A", 2.9, 1)}${pierna(21, 32, 25, 43, "#4A4A5A", 2.9, -1)}
    <path d="M13 19h10.5a3.5 3.5 0 0 1 3.5 3.5c1.6 3 1.6 7-.5 10a3 3 0 0 1-2.5 1.5H14a4 4 0 0 1-4-4v-8a3 3 0 0 1 3-3z" fill="#EFE8D8" stroke="#1B211D" stroke-width=".5"/>
    <ellipse cx="21.5" cy="26.5" rx="2.2" ry="1.5" fill="#8E2A3E" opacity=".65"/>
    <path d="M10 29.4h17.4" stroke="#B8323A" stroke-width="2"/>
    <g class="bota vb" style="transform-origin:26px 22px">
      <line x1="24" y1="23" x2="29.2" y2="18" stroke="#1B211D" stroke-width="3.8" stroke-linecap="round" opacity=".55"/>
      <line x1="24" y1="23" x2="29.2" y2="18" stroke="#EFE8D8" stroke-width="3" stroke-linecap="round"/>
      <path d="M29 15.5q5.5-.5 6 5 .2 5-3.8 5.2-4-.2-3.4-5.4.3-3.5 1.2-4.8z" fill="#6B3A1E" stroke="#3A1E0E" stroke-width=".45"/>
      <path d="M30 17.5q2.2-.4 3 1.6" stroke="#9A5A30" stroke-width=".6" fill="none"/>
      <path d="M29.6 15.6l-1.4-2.4" stroke="#1B211D" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="28" cy="12.9" r=".7" fill="#B8323A"/>
      <circle cx="29.4" cy="17.9" r="1.3" fill="#E9C9A8"/>
    </g>
    ${cara(18.5, 12, { normal: "achispado", pose: "grito", mejillas: true })}
    <circle cx="18.5" cy="13.3" r="1.5" fill="#D9534F"/>
    <path d="M12.8 8l1-2.1 1 1.6 1.5-2.1 1 2.1 1.6-1.9.8 2.3 1.4-1.6.7 2" stroke="#6B4A2E" stroke-width="1.1" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    <g class="solo-pose">
      <circle class="sube" cx="21" cy="15" r="1.4" fill="none" stroke="#7FB0C6" stroke-width=".6"/>
      <circle class="sube" style="animation-delay:.3s" cx="24" cy="12" r="1.9" fill="none" stroke="#7FB0C6" stroke-width=".6"/>
      <circle class="sube" style="animation-delay:.6s" cx="22.5" cy="8" r="1.2" fill="none" stroke="#7FB0C6" stroke-width=".6"/>
    </g></g>`,

  pulpo: () => {
    const T = [[12.5, -3, 1], [20, .5, 1], [27.5, 3, 1], [11, -4.5, 0], [15.5, -2, 0], [20, 1, 0], [24.5, 2.5, 0], [29, 4.5, 0]];
    const tent = T.map(([x, dx, atras], i) =>
      `<path class="tent t${i % 2}${atras ? " atras" : ""}" d="M${x} 25q${dx} 8 ${n2(dx * .3)} 15q-.6 2.6 ${dx >= 0 ? 2.4 : -2.4} 2.6" stroke="${atras ? "#B85A48" : "#E07A63"}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`);
    return `<g class="bob">
    ${tent.slice(0, 3).join("")}
    <line x1="33.5" y1="13" x2="31.5" y2="44" stroke="#8A5A34" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="34.6" cy="17.4" r="1.7" fill="#D9A441" stroke="#8A6A2E" stroke-width=".35"/>
    ${tent.slice(3).join("")}
    <path class="manto" d="M20 4.5C28.5 4.5 31 12 30.2 18.5 29.6 23.5 26 26.5 20 26.5S10.4 23.5 9.8 18.5C9 12 11.5 4.5 20 4.5Z" fill="#E07A63" stroke="#B85A48" stroke-width=".5"/>
    <circle cx="14" cy="11" r="1.2" fill="#F2A591"/><circle cx="26.5" cy="12" r=".9" fill="#F2A591"/><circle cx="25" cy="22.5" r="1" fill="#F2A591"/>
    <ellipse cx="16.6" cy="16" rx="2.3" ry="2.7" fill="#fff"/><ellipse cx="23.4" cy="16" rx="2.3" ry="2.7" fill="#fff"/>
    <circle cx="17.2" cy="16.4" r="1.15" fill="#1B211D"/><circle cx="24" cy="16.4" r="1.15" fill="#1B211D"/>
    <g class="solo-normal"><path d="M18 21.2q2 1.4 4 0" stroke="#7A2A2A" stroke-width=".8" fill="none" stroke-linecap="round"/></g>
    <g class="solo-pose"><path d="M14 12.6l4.2 1.3M26 12.6l-4.2 1.3" stroke="#1B211D" stroke-width="1" stroke-linecap="round"/><ellipse cx="20" cy="21.6" rx="1.3" ry="1" fill="#5A1E1E"/>
      <g class="pop"><circle cx="6.5" cy="33" r="4" fill="#2B2B3A"/><circle cx="3.6" cy="37.4" r="2.6" fill="#2B2B3A"/><circle cx="9.2" cy="38.2" r="2" fill="#2B2B3A"/><circle cx="2.8" cy="30.6" r="1.3" fill="#2B2B3A"/></g></g>
    <ellipse cx="20" cy="6" rx="8.5" ry="1.7" fill="#3B2A1E"/>
    <path d="M15.5 6q4.5-5.5 9 0z" fill="#4A3526"/>
    ${vieira(20, 4.5, .34)}</g>`;
  },

  meiga: () => `<g class="flota">
    <g class="emisor"><path d="M8.5 35.2L1 31.6.4 36 1.4 40.6Z" fill="#D9B45A" stroke="#A88A3A" stroke-width=".5" stroke-linejoin="round"/>
      <path d="M2 33.4l6 1.6M1.4 36.6l6.8-.8M2 39.4l6.2-3" stroke="#A88A3A" stroke-width=".35"/></g>
    <path d="M7.5 35.6l1.6-.3" stroke="#B8323A" stroke-width="1.6"/>
    <line x1="8" y1="35.4" x2="38" y2="30.6" stroke="#7A4E2A" stroke-width="1.7" stroke-linecap="round"/>
    <path class="capa vb" style="transform-origin:15px 21px" d="M15 21Q8 24 3.4 30.5Q9.5 29.4 14 31.2Z" fill="#2E1B45"/>
    <path class="pelo vb" style="transform-origin:15px 14px" d="M15 14Q10.5 19 11 25.5" stroke="#C8642E" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M13 34Q14 22 19.5 20 25 22 26 34Z" fill="#4B2E6B" stroke="#1B211D" stroke-width=".4"/>
    <path d="M23.8 32.8l5.6 3.4" stroke="#1B211D" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M29 35.8l2.4.2" stroke="#1B211D" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="22" y1="25" x2="28" y2="31.4" stroke="#4B2E6B" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="28.3" cy="31.6" r="1.2" fill="#E6D5B8"/>
    ${cara(19.5, 14.6, { r: 5.5, piel: "#E6D5B8", pose: "alegre", mejillas: true })}
    <path d="M18.3 15.4l1.2 1.4-1.4.2" stroke="#B89C80" stroke-width=".5" fill="none"/>
    <ellipse cx="19.5" cy="10.2" rx="8" ry="1.6" fill="#1B211D"/>
    <path d="M15 10.2Q18 4 21 1.6 23 1 24 3 22.5 5 23.8 10.2Z" fill="#1B211D"/>
    <path d="M15.6 9h8" stroke="#C9A24B" stroke-width="1"/>
    <g transform="translate(20.6 6.2) scale(.55)"><path d="${ESTRELLA}" fill="#C9A24B"/></g>
    <g class="solo-pose">
      <line x1="22.5" y1="21" x2="31" y2="11" stroke="#3B2A1E" stroke-width="1" stroke-linecap="round"/>
      <g transform="translate(31.6 10.4) scale(1.3)"><path class="giro" d="${ESTRELLA}" fill="#C9A24B"/></g>
      ${destello(35, 6, .8, "#B79BE0")}${destello(28, 5, .6)}${destello(36.5, 14, .6)}
    </g></g>`,

  gaiteiro: () => `<g class="bob">
    <line x1="15" y1="21" x2="7" y2="7" stroke="#3B2A1E" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M12.6 17l1 -.6M10.2 12.8l1-.6" stroke="#C9A24B" stroke-width="1.2"/>
    <g class="emisor"><circle cx="7" cy="6.8" r="1.2" fill="#C9A24B"/></g>
    <path class="borla vb" style="transform-origin:7.4px 7.6px" d="M7.4 7.6q-2.4 3-1.2 6.4M7.6 7.6q-.6 3.4 1 5.8" stroke="#B8323A" stroke-width=".9" fill="none" stroke-linecap="round"/>
    ${pierna(19, 32, 16.5, 43.5, "#1B211D", 2.8, 1)}${pierna(21, 32, 23.5, 43.5, "#1B211D", 2.8, -1)}
    <path d="M13 19h11a3 3 0 0 1 3 3v8a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4v-8a3 3 0 0 1 3-3z" fill="#1B211D"/>
    <path d="M16.2 19L18.5 25.5 20.8 19Z" fill="#F4F1EA"/>
    <circle cx="14.2" cy="23.5" r=".5" fill="#C9A24B"/><circle cx="14.2" cy="26.5" r=".5" fill="#C9A24B"/>
    <path d="M10 30.2h17" stroke="#B8323A" stroke-width="2.2"/>
    <g class="fol vb" style="transform-origin:22.5px 25.5px">
      <ellipse cx="22.5" cy="25.5" rx="5" ry="3.8" fill="#2F5D50" stroke="#1B211D" stroke-width=".4"/>
      <path d="M17.8 27q4.7 3.6 9.4 0" stroke="#C9A24B" stroke-width="1.2" stroke-dasharray=".6 .8" fill="none"/>
    </g>
    <line x1="21" y1="22.2" x2="20.2" y2="15.6" stroke="#3B2A1E" stroke-width="1.1" stroke-linecap="round"/>
    <line x1="25.5" y1="27.5" x2="28.5" y2="38" stroke="#3B2A1E" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="28.7" cy="38.6" r="1.2" fill="#C9A24B"/>
    <line x1="24" y1="23" x2="27.4" y2="31" stroke="#1B211D" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="27.3" cy="31.2" r="1.2" fill="#E9C9A8"/>
    ${cara(18.5, 12, { normal: "normal", pose: "grito" })}
    <circle class="moflete" cx="15.2" cy="13.8" r="1.5" fill="#F0A08C" opacity=".85"/>
    <circle class="moflete" cx="21.8" cy="13.8" r="1.5" fill="#F0A08C" opacity=".85"/>
    <path d="M11.2 9Q18.5 .5 25.8 9 18.5 7 11.2 9Z" fill="#1B211D"/>
    <path d="M12.4 8.2Q18.5 5.8 24.6 8.2" stroke="#B8323A" stroke-width=".9" fill="none"/>
    <circle cx="18.5" cy="3" r="1.4" fill="#B8323A"/>
    <g class="solo-pose"><g class="pop">${notaSvg(29, 2, .7, "#2F5D50")}${notaSvg(33, 10, .55, "#D9773B")}</g></g></g>`,

  vaca: () => {
    const pata = (x: number, c: string, lado: number) => `<g class="${lado > 0 ? "pa" : "pb"}"><line x1="${x}" y1="30" x2="${x}" y2="42.4" stroke="${c}" stroke-width="3" stroke-linecap="round"/><line x1="${x}" y1="42.8" x2="${x}" y2="44" stroke="#3A2A1E" stroke-width="3" stroke-linecap="round"/></g>`;
    return `<g class="bob">
    <g class="rabo vb" style="transform-origin:6.5px 24px"><path d="M6.5 24q-3 4-2.2 10" stroke="#B8773E" stroke-width="1.3" fill="none" stroke-linecap="round"/><ellipse cx="4.4" cy="34.6" rx="1" ry="1.6" fill="#8A5A2E"/></g>
    ${pata(10, "#A86A35", -1)}${pata(23, "#A86A35", 1)}
    <ellipse cx="17.5" cy="26" rx="12.5" ry="7" fill="#C98A4B"/>
    <ellipse cx="17" cy="29.5" rx="8" ry="2.8" fill="#DDA56A" opacity=".8"/>
    <ellipse cx="12.5" cy="32.6" rx="2.2" ry="1.3" fill="#E8A5A0"/>
    ${pata(13, "#C98A4B", 1)}${pata(26, "#C98A4B", -1)}
    <path d="M26 22.5q1 3.4 3.8 4.2" stroke="#6B3A1E" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <g class="cabeza vb" style="transform-origin:27px 22px">
      <ellipse cx="26.2" cy="16.4" rx="2.4" ry="1.1" fill="#B8773E" transform="rotate(-25 26.2 16.4)"/>
      <path d="M28.2 14.6q-2.2-3 0-5.2M32.6 14.4q2.4-2.8.6-5.4" stroke="#EFE6CF" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="30.5" cy="18.8" rx="4.6" ry="5" fill="#C98A4B"/>
      <path d="M28.4 14.5q2.1-1.8 4.2 0-2.1 1.2-4.2 0z" fill="#E0A866"/>
      <circle cx="31.8" cy="17.8" r=".95" fill="#222"/>
      <path class="solo-normal" d="M31 16.5l-.5-.6M32 16.3l0-.7M32.9 16.6l.4-.6" stroke="#222" stroke-width=".4"/>
      <path class="solo-pose" d="M30.4 16.2l2.6.9" stroke="#222" stroke-width=".9" stroke-linecap="round"/>
      <ellipse cx="33.4" cy="22.6" rx="3.8" ry="2.7" fill="#EBCBA5"/>
      <circle cx="32.4" cy="22" r=".55" fill="#7A5A4A"/><circle cx="34.8" cy="22" r=".55" fill="#7A5A4A"/>
      <path class="solo-normal" d="M31.8 24.2q1.6.8 3.2 0" stroke="#7A5A4A" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <ellipse class="solo-pose" cx="33.6" cy="24.4" rx="1.5" ry="1.2" fill="#5A1E1E"/>
      ${vapor(35.5, 38, 20)}
    </g>
    <g class="cencerro vb" style="transform-origin:28.3px 26.6px"><path d="M26.9 26.6h2.8l.9 3.6h-4.6z" fill="#C9A24B" stroke="#8A6A2E" stroke-width=".4"/><circle cx="28.3" cy="30.7" r=".6" fill="#6B4A2E"/></g></g>`;
  },

  gallego: () => {
    const gotas = [13, 16.5, 20, 23.5, 27].map((x, i) => `<line class="gota" style="animation-delay:-${i * .13}s" x1="${x}" y1="5.8" x2="${x - .4}" y2="7.2" stroke="#6F97B4" stroke-width=".9" stroke-linecap="round"/>`).join("");
    const extra = [14.8, 18.3, 21.8, 25.2].map((x, i) => `<line class="gota" style="animation-delay:-${i * .07 + .05}s" x1="${x}" y1="5.6" x2="${x - .4}" y2="7" stroke="#6F97B4" stroke-width=".9" stroke-linecap="round"/>`).join("");
    return `<g>
    <g class="nube"><rect x="12" y="3" width="13.5" height="2.6" rx="1.3" fill="#9AA3AB"/><circle cx="14" cy="3.3" r="2.4" fill="#AEB6BE"/><circle cx="18.5" cy="2.4" r="3" fill="#B8C0C7"/><circle cx="23.5" cy="3.3" r="2.4" fill="#AEB6BE"/></g>
    ${gotas}<g class="solo-pose">${extra}</g>
    <circle class="escurre" cx="6.8" cy="14" r=".7" fill="#6F97B4"/><circle class="escurre" style="animation-delay:-.45s" cx="31.2" cy="14" r=".7" fill="#6F97B4"/>
    <line x1="19" y1="7.6" x2="19" y2="28.5" stroke="#3A3A3A" stroke-width=".9"/>
    <path d="M19 28.5q0 1.6-1.4 1.6" stroke="#3A3A3A" stroke-width=".9" fill="none" stroke-linecap="round"/>
    <path d="M6.5 13.5Q19 1.5 31.5 13.5 28.4 11.6 25.25 13.5 22.1 11.6 19 13.5 15.9 11.6 12.75 13.5 9.6 11.6 6.5 13.5Z" fill="#1B211D"/>
    <path d="M19 7.6L12.75 13.2M19 7.6L25.25 13.2" stroke="#3A413C" stroke-width=".4"/>
    <g class="bob">
      ${pierna(17.2, 36, 15.8, 44.5, "#2A2A2A", 2.6, 1)}${pierna(20.3, 36, 21.8, 44.5, "#2A2A2A", 2.6, -1)}
      <path d="M14 25h9.5a2.5 2.5 0 0 1 2.5 2.5v9H11.5v-9A2.5 2.5 0 0 1 14 25z" fill="#56645A" stroke="#1B211D" stroke-width=".4"/>
      <path d="M16 25l2.6 3 2.6-3" stroke="#3E4A42" stroke-width=".7" fill="none"/>
      <circle cx="18.6" cy="30.5" r=".45" fill="#2A2A2A"/><circle cx="18.6" cy="33" r=".45" fill="#2A2A2A"/>
      <g class="hombro vb" style="transform-origin:13px 27px"><line x1="13" y1="27" x2="12" y2="33" stroke="#46534A" stroke-width="2.4" stroke-linecap="round"/><circle cx="11.9" cy="33.5" r="1.1" fill="#E9C9A8"/></g>
      <line x1="24.2" y1="27.2" x2="19.8" y2="28.4" stroke="#46534A" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="19.3" cy="28.6" r="1.1" fill="#E9C9A8"/>
      ${cara(18.5, 19.8, { r: 4.8, pose: "neutro" })}
      <path d="M14.2 17.4q4.3-3.8 8.6 0" stroke="#4A3526" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    </g></g>`;
  },

  cojo: () => `<g class="salto">
    <rect x="7.5" y="19.5" width="7.5" height="12.5" rx="3" fill="#D9773B"/>
    ${vieira(11, 25.5, .5)}
    <line x1="30" y1="9" x2="27" y2="45" stroke="#B98A5A" stroke-width="2" stroke-linecap="round"/>
    <circle cx="30" cy="10" r="2" fill="#C9A24B"/>
    <g class="alta vb" style="transform-origin:18px 32px">
      <path d="M18 32L14.5 37 11 35.2" stroke="#34405E" stroke-width="2.8" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
      <ellipse cx="10.3" cy="35.9" rx="1.4" ry="2.1" fill="#F0CFA8"/>
      <path d="M9.1 35.1l2.4 1.2M9.2 36.9l2.3-1" stroke="#E7BE8E" stroke-width="1.1"/>
      <circle cx="9.6" cy="37.5" r=".55" fill="#E35D5D"/>
    </g>
    <line x1="20.5" y1="32" x2="20.5" y2="43.2" stroke="#34405E" stroke-width="2.8" stroke-linecap="round"/>
    <ellipse cx="21.6" cy="44" rx="2.5" ry="1.1" fill="#6B4A2E"/>
    <rect x="20.1" y="43.1" width="2.8" height="1.6" rx=".5" fill="#EFCFA6" stroke="#C9A27A" stroke-width=".3"/>
    <path d="M13 19h11a3 3 0 0 1 3 3v8a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4v-8a3 3 0 0 1 3-3z" fill="#3E6E85" stroke="#1B211D" stroke-width=".5"/>
    <line x1="24" y1="23" x2="29" y2="13" stroke="#3E6E85" stroke-width="3" stroke-linecap="round"/>
    <g class="solo-pose"><line x1="13" y1="23" x2="10.8" y2="33.8" stroke="#3E6E85" stroke-width="2.6" stroke-linecap="round"/>
      <path class="cae" d="M16.2 14.2q.8 1.2 0 1.8-.8-.6 0-1.8z" fill="#8EC3E0"/><path class="cae" style="animation-delay:.35s" d="M20.8 14.2q.8 1.2 0 1.8-.8-.6 0-1.8z" fill="#8EC3E0"/></g>
    ${cara(18.5, 12, { pose: "dolor" })}
    <path class="solo-normal" d="M25.4 7.4q1.2 1.8 0 2.6-1.2-.8 0-2.6z" fill="#8EC3E0"/>
    <path d="M11.5 9.5q7-7 14 0z" fill="#E9D9A8"/>
    <path d="M24 9.3h4.2" stroke="#D8C48E" stroke-width="1.4" stroke-linecap="round"/></g>`,

  abuelo: () => `<g>
    ${pierna(17.5, 32, 16.5, 43.5, "#4A4038", 3, 1, true)}${pierna(19.5, 32, 21, 43.5, "#4A4038", 3, -1, true)}
    <g transform="rotate(10 18 32)">
      <path d="M13 19h10a3 3 0 0 1 3 3v9.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 10 31.5V22a3 3 0 0 1 3-3z" fill="#8C6E4E" stroke="#1B211D" stroke-width=".5"/>
      <path d="M16 19l2.5 2.5L21 19" stroke="#F4F1EA" stroke-width="1" fill="none"/>
      <circle cx="18.5" cy="24" r=".6" fill="#5A4632"/><circle cx="18.5" cy="27" r=".6" fill="#5A4632"/><circle cx="18.5" cy="30" r=".6" fill="#5A4632"/>
      <g class="garrota vb" style="transform-origin:24px 23px">
        <line x1="24" y1="23" x2="28" y2="26.6" stroke="#7A5E42" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M28.3 27L29.6 42.6" stroke="#6B4A2E" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M28.3 27q-.2-3.2 2.4-3.2 2.2.1 2 2.4" stroke="#6B4A2E" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <circle cx="28.3" cy="27.2" r="1.2" fill="#E8C4A2"/>
      </g>
      ${cara(19, 12.5, { piel: "#E8C4A2" })}
      <circle cx="17" cy="12.5" r="1.7" stroke="#4A4A4A" stroke-width=".5" fill="none"/><circle cx="21" cy="12.5" r="1.7" stroke="#4A4A4A" stroke-width=".5" fill="none"/>
      <path d="M18.7 12.3h.6" stroke="#4A4A4A" stroke-width=".5"/>
      <path d="M15.4 10q1.6-1 3 0M19.6 10q1.6-1 3 0" stroke="#F2F2EE" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M16.4 15q1.3-1.3 2.6-.4 1.3-.9 2.6.4-1.3 1.2-2.6.4-1.3.8-2.6-.4z" fill="#F2F2EE" stroke="#CFCFC8" stroke-width=".3"/>
      <path d="M11.6 9.6Q12.5 4.4 19 4.4 26 4.4 27.2 8.8 20 7.6 11.6 9.6Z" fill="#2B2B2B"/>
      <path d="M19.4 4.5l.4-1.4" stroke="#2B2B2B" stroke-width="1" stroke-linecap="round"/>
    </g></g>`,

  guiri: () => {
    const pie = (x1: number, x2: number, xs: number, lado: number) => `<g class="${lado > 0 ? "pa" : "pb"}"><line x1="${x1}" y1="32" x2="${x2}" y2="43.5" stroke="#F2B8A0" stroke-width="2.6" stroke-linecap="round"/><line x1="${xs}" y1="40" x2="${x2}" y2="43.5" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/><line x1="${xs}" y1="40" x2="${x2}" y2="43.5" stroke="#D5D5D0" stroke-width="3" stroke-linecap="round" stroke-dasharray="0 3.6 .01 9" opacity=".7"/><ellipse cx="${x2 + .3}" cy="44.4" rx="2.3" ry=".8" fill="#2F7DC0"/></g>`;
    return `<g class="bob">
    ${pie(19, 16.5, 17.25, 1)}${pie(21, 23.5, 22.75, -1)}
    <rect x="12" y="29.5" width="13" height="5" rx="1.5" fill="#D9C79E" stroke="#1B211D" stroke-width=".4"/>
    <path d="M13 19h11a3 3 0 0 1 3 3v9H10v-9a3 3 0 0 1 3-3z" fill="#3FA7B5" stroke="#1B211D" stroke-width=".5"/>
    <circle cx="13.6" cy="23" r="1.1" fill="#F4D35E"/><circle cx="21" cy="27.4" r="1.1" fill="#E86A5A"/><circle cx="24" cy="21.6" r=".9" fill="#F4D35E"/><circle cx="14.8" cy="28.6" r=".9" fill="#E86A5A"/>
    <path d="M14.5 19.5L17 24M22.5 19.5L20.5 24" stroke="#1B211D" stroke-width=".6"/>
    <rect x="16.2" y="23.6" width="5" height="3.4" rx=".7" fill="#2A2A2A"/><circle cx="18.7" cy="25.3" r="1.1" fill="#555" stroke="#AAA" stroke-width=".3"/>
    ${cara(18.5, 12, { piel: "#F2B8A0", normal: "alegre", pose: "sorpresa", mejillas: true })}
    <g class="gafas"><ellipse cx="16.5" cy="11.8" rx="1.8" ry="1.3" fill="#1B211D"/><ellipse cx="20.5" cy="11.8" rx="1.8" ry="1.3" fill="#1B211D"/><path d="M18.3 11.6h.4" stroke="#1B211D" stroke-width=".6"/></g>
    <path d="M12 8.6Q12.8 3.6 18.5 3.6 24.2 3.6 25 8.6Z" fill="#E6D9A8"/>
    <path d="M10.2 8.9Q18.5 6.8 26.8 8.9 18.5 10.4 10.2 8.9Z" fill="#D8C98E"/>
    <g class="mapa vb" style="transform-origin:29px 21px">
      <rect x="23.5" y="16.5" width="11.5" height="9" fill="#F2EAD3" stroke="#8A7A55" stroke-width=".5"/>
      <path d="M27.3 16.5v9M31.2 16.5v9" stroke="#CDBF98" stroke-width=".4"/>
      <path d="M24.8 23.5q3-4 5-1t4.5-3" stroke="#D9773B" stroke-width=".6" stroke-dasharray="1 .7" fill="none"/>
      <path d="M32.6 17.6h2l-1 2.6z" fill="#D23B3B"/>
      <text x="28.4" y="25.3" font-size="2.4" font-weight="700" fill="#1B211D" text-anchor="middle" transform="rotate(180 28.4 24.5)" font-family="Arial, sans-serif">MAP</text>
      <circle cx="23.8" cy="21.4" r="1.1" fill="#F2B8A0"/><circle cx="34.9" cy="21" r="1.1" fill="#F2B8A0"/>
    </g>
    <line x1="23" y1="23.4" x2="23.7" y2="21.8" stroke="#3FA7B5" stroke-width="2.4" stroke-linecap="round"/>
    <g class="solo-pose"><g class="pop"><text x="27" y="6.5" font-size="6" font-weight="800" fill="#D9773B" font-family="Georgia, serif">?</text><text x="32" y="3.5" font-size="4.5" font-weight="800" fill="#3E6E85" font-family="Georgia, serif">?</text></g></g></g>`;
  },

  botafumeiro: () => `<g>
    <line x1="20" y1="-7" x2="20" y2="0" stroke="#8A5A34" stroke-width="1.4"/>
    <g class="pendulo vb" style="transform-origin:20px 0px">
      <line x1="20" y1="0" x2="20" y2="11" stroke="#8A5A34" stroke-width="1.4"/>
      <circle cx="20" cy="11" r="1" fill="none" stroke="#8A8F96" stroke-width=".6"/>
      <path d="M20 11.5L15.3 17M20 11.5L24.7 17" stroke="#9AA0A7" stroke-width=".7"/>
      <circle class="humito" cx="15" cy="19" r="1.5" fill="#CFCFCF"/>
      <circle class="humito" style="animation-delay:.7s" cx="25" cy="19" r="1.5" fill="#CFCFCF"/>
      <g class="emisor">
        <path d="M15 17.2h10l-1.6-3h-6.8z" fill="#D5D9DE" stroke="#7A7F86" stroke-width=".5"/>
        <circle cx="20" cy="13.8" r=".9" fill="#C9A24B"/>
        <path d="M13.2 18h13.6l-.8 9q-6 7-12 0z" fill="#C9CDD2" stroke="#7A7F86" stroke-width=".6"/>
        <path d="M15.2 18.6l.6 7.6" stroke="#fff" stroke-width="1" opacity=".6"/>
        <line x1="13.4" y1="20.2" x2="26.6" y2="20.2" stroke="#C9A24B" stroke-width="1.4"/>
        <circle cx="15.8" cy="22.4" r=".45" fill="#6A6F76"/><circle cx="24.2" cy="22.4" r=".45" fill="#6A6F76"/>
        <g class="solo-normal"><circle cx="18" cy="24" r=".85" fill="#333"/><circle cx="22" cy="24" r=".85" fill="#333"/><path d="M18.4 26.4q1.6 1.2 3.2 0" stroke="#333" stroke-width=".8" fill="none" stroke-linecap="round"/></g>
        <g class="solo-pose"><path d="M17 24.4q1-1.4 2 0M21 24.4q1-1.4 2 0" stroke="#333" stroke-width=".8" fill="none" stroke-linecap="round"/><path d="M18 26q2 2.8 4 0z" fill="#7A2A2A"/></g>
        <path d="M17.6 32.4h4.8l1 2.2h-6.8z" fill="#C9A24B" stroke="#8A6A2E" stroke-width=".4"/>
      </g>
    </g></g>`,

  flecha: () => `<g class="bob">
    ${pierna(12, 27, 10.5, 43.5, "#2A2A2A", 2.4, 1)}${pierna(17, 27, 18.5, 43.5, "#2A2A2A", 2.4, -1)}
    <g class="solo-pose"><path d="M-1 16.5h-3.5M-.5 23h-5M-1 29.5h-3.5" stroke="#E0A800" stroke-width="1" stroke-linecap="round"/></g>
    <g class="apunta vb" style="transform-origin:6px 23px">
      <path d="M5 18.5H22.5V11L36.5 23 22.5 35V27.5H5Q3.5 27.5 3.5 26V20Q3.5 18.5 5 18.5Z" fill="#F4C21F" stroke="#B88A00" stroke-width=".6" stroke-linejoin="round"/>
      <path d="M5.5 20.6H21M6 25.4h12.6M24.2 15.2l6.4 6M24.2 30.8l6.4-6" stroke="#FFE07A" stroke-width=".8" stroke-linecap="round" opacity=".85"/>
      <path d="M9 27.5v1.5M20.5 27.5v2" stroke="#E0A800" stroke-width="1" stroke-linecap="round"/>
      <circle cx="20.5" cy="30.1" r=".65" fill="#E0A800"/><circle cx="9" cy="29.6" r=".5" fill="#E0A800"/>
      ${gesto(26.5, 22.2, .78, "alegre", "grito")}
      ${mofletes(24, 29, 24.2, .8)}
    </g>
    <g class="brocha vb" style="transform-origin:19px 26px">
      <line x1="19" y1="26" x2="23" y2="32.6" stroke="#2A2A2A" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="21.6" y1="30.6" x2="25.8" y2="38" stroke="#8A5A34" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="23.2" cy="33" r="1.1" fill="#E9C9A8"/>
      <path d="M25 37.4l2.4-1.2 1.6 3.4-2.6.9z" fill="#F4C21F" stroke="#B88A00" stroke-width=".4" stroke-linejoin="round"/>
      <path class="cae" d="M27.4 40.6q.7 1 0 1.6-.7-.6 0-1.6z" fill="#F4C21F"/>
    </g></g>`,

  mojon: () => `<g>
    ${pierna(16.5, 41, 15.5, 45, "#5E5D57", 2.8, 1, true)}${pierna(23.5, 41, 24.5, 45, "#5E5D57", 2.8, -1, true)}
    <g class="bloque vb" style="transform-origin:20px 42px">
      <path d="M10 42V12.5Q10 6.5 20 6.5T30 12.5V42Z" fill="#AEADA5" stroke="#6E6D66" stroke-width=".6"/>
      <path d="M26.6 8.2Q30 9.6 30 12.5V42h-3.4Z" fill="#8F8E86" opacity=".55"/>
      <g fill="#7E7D76"><circle cx="12.2" cy="28" r=".35"/><circle cx="27.6" cy="24" r=".3"/><circle cx="13" cy="39" r=".4"/><circle cx="25" cy="39.6" r=".3"/><circle cx="16" cy="8.6" r=".3"/></g>
      <g fill="#D2D1CA"><circle cx="11.6" cy="22" r=".35"/><circle cx="21" cy="38.6" r=".4"/><circle cx="28.4" cy="31" r=".3"/><circle cx="24" cy="8.4" r=".3"/></g>
      <rect x="12.4" y="9.6" width="13.2" height="10.4" rx="1" fill="#1F4E9C" stroke="#163A75" stroke-width=".4"/>
      <path d="M19 18.4L13.8 12.4M19 18.4L16 11.2M19 18.4L19.4 10.8M19 18.4L22.6 11.4M19 18.4L24.6 13.2M19 18.4L24.4 16.2" stroke="#F4C21F" stroke-width="1" stroke-linecap="round"/>
      ${gesto(20, 24.2, .8, "normal", "grito")}
      ${mofletes(16.6, 23.4, 25.8, .75)}
      <rect x="13.2" y="30" width="13.6" height="6.4" rx=".8" fill="#E9E4D4" stroke="#6E6D66" stroke-width=".45"/>
      <text class="km-num" x="19.4" y="35.2" font-size="4.4" font-weight="800" text-anchor="middle" fill="#1B211D" font-family="Arial, sans-serif">${KM_INICIAL_MOJON}</text>
      <text x="24.9" y="35" font-size="1.7" font-weight="700" text-anchor="middle" fill="#6E6D66" font-family="Arial, sans-serif">km</text>
      <path d="M10.2 42q1-2.6 2.4-.6.8-1.8 2 0M29.8 42q-1-2.2-2.2-.4" fill="#6E8B4A" stroke="#6E8B4A" stroke-width=".6" stroke-linejoin="round"/>
      <g class="piedrita fb"><ellipse cx="21.5" cy="5.6" rx="2" ry="1.1" fill="#8F8E86" stroke="#6E6D66" stroke-width=".3"/></g>
    </g>
    <g class="solo-pose">${destello(6, 10, .9, "#F4C21F")}${destello(34, 8, 1, "#F4C21F")}${destello(4, 22, .6, "#1F4E9C")}</g></g>`,

  caracol: () => `<g class="ondula vb" style="transform-origin:4px 44px">
    <path d="M2.5 44.2Q2.5 40.6 7 40.2H30.5Q36 40.4 37.2 44.2Z" fill="#CDB98F" stroke="#8E7A55" stroke-width=".5"/>
    <path d="M5 42.6H33" stroke="#B9A57A" stroke-width=".5" stroke-dasharray="1.4 1"/>
    <g transform="rotate(-10 16 39)">
      <path d="M12.3 40.2h7.4l-.9-2.4h-5.6z" fill="#E9C28A" stroke="#A8743A" stroke-width=".45"/>
      <path d="M16 38.6L5.4 25.4Q16 12.6 26.6 25.4Z" fill="#F6DDB0" stroke="#A8743A" stroke-width=".7" stroke-linejoin="round"/>
      <path d="M16 38.6L7.8 23.4M16 38.6L10.6 20.8M16 38.6L13.3 19.6M16 38.6V19.2M16 38.6L18.7 19.6M16 38.6L21.4 20.8M16 38.6L24.2 23.4" stroke="#D98A4A" stroke-width=".8"/>
      <path d="M8.6 22.6q1-1.6 2-1.8M12 20q1.4-.8 2.6-.7" stroke="#fff" stroke-width=".7" stroke-linecap="round" opacity=".8"/>
    </g>
    <path d="M27.4 41V33.2Q27.4 27.6 31.6 27.6T35.8 33.2V41Z" fill="#CDB98F" stroke="#8E7A55" stroke-width=".5"/>
    <g class="antenas vb" style="transform-origin:31.6px 28.5px">
      <path d="M30.2 28.6L28.8 21.8M33 28.6L34.8 21.8" stroke="#BCA77B" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="28.7" cy="21" r="1.6" fill="#fff" stroke="#8E7A55" stroke-width=".35"/><circle cx="34.9" cy="21" r="1.6" fill="#fff" stroke="#8E7A55" stroke-width=".35"/>
      <circle cx="29.2" cy="21.2" r=".8" fill="#1B211D"/><circle cx="35.4" cy="21.2" r=".8" fill="#1B211D"/>
      <path class="solo-pose" d="M27 19.1l2.8.9M36.6 19.1l-2.8.9" stroke="#1B211D" stroke-width=".7" stroke-linecap="round"/>
    </g>
    ${mofletes(29.6, 34.6, 34.8, .75)}
    <path class="solo-normal" d="M30.8 33.4q1.4 1.1 2.8 0" stroke="#5A3A22" stroke-width=".6" fill="none" stroke-linecap="round"/>
    <ellipse class="solo-pose" cx="32.2" cy="34" rx=".9" ry="1.1" fill="#5A1E1E"/>
    ${destello(2.6, 41.2, .45, "#9FD3E6")}
    <g class="solo-pose"><path class="cae" d="M37.2 28.4q.7 1 0 1.6-.7-.6 0-1.6z" fill="#8EC3E0"/></g></g>`,

  sello: () => `<g class="solo-pose"><path d="M4.6 44.6l-3.4-1.4M35.4 44.6l3.4-1.4M6 41.2l-2.6-2.8M34 41.2l2.6-2.8" stroke="#B8323A" stroke-width=".9" stroke-linecap="round"/></g>
    <g class="salta vb" style="transform-origin:20px 44px">
      <circle cx="20" cy="11.5" r="4.4" fill="#8A5A34" stroke="#5B3A22" stroke-width=".5"/>
      <circle cx="18.6" cy="10.1" r="1.3" fill="#B98A5A" opacity=".8"/>
      <rect x="18.2" y="15.4" width="3.6" height="5" fill="#7A4E2A"/>
      <path d="M13.5 26Q13.5 21 18.2 20.2H21.8Q26.5 21 26.5 26Z" fill="#9A6B3E" stroke="#5B3A22" stroke-width=".5"/>
      <line x1="8.6" y1="31" x2="4.8" y2="35.4" stroke="#5B3A22" stroke-width="1.6" stroke-linecap="round"/><circle cx="4.6" cy="35.7" r="1" fill="#E9C9A8"/>
      <line x1="31.4" y1="31" x2="35.2" y2="27" stroke="#5B3A22" stroke-width="1.6" stroke-linecap="round"/><circle cx="35.4" cy="26.7" r="1" fill="#E9C9A8"/>
      <rect x="8" y="26" width="24" height="15" rx="2" fill="#C08A52" stroke="#5B3A22" stroke-width=".6"/>
      <path d="M10.5 28.6q3 1 6 0M23.5 37.6q3 1 6 0" stroke="#A8743E" stroke-width=".5" fill="none"/>
      <path d="M8.6 38.8h22.8" stroke="#9A6B3E" stroke-width=".6"/>
      ${gesto(20, 31.6, .9, "alegre", "enfado")}
      ${mofletes(15.8, 24.2, 33.6, .9)}
      <rect x="8.6" y="41" width="22.8" height="3" rx=".8" fill="#B8323A" stroke="#7E1E24" stroke-width=".4"/>
    </g>`,

  pimiento: () => `<g class="bob"><g class="agita-p">
    ${pierna(17.5, 35, 16, 44, "#2F6B24", 2.2, 1)}${pierna(20.5, 35, 22, 44, "#2F6B24", 2.2, -1)}
    <line x1="13.6" y1="21" x2="9.8" y2="26" stroke="#2F6B24" stroke-width="1.5" stroke-linecap="round"/>
    <path class="pim" d="M13.2 11.6Q13.4 8.6 16.4 9.2Q20 7.8 23.8 9.2Q27.4 8.6 27.2 12Q28 21 25.4 29Q23.2 36 19.4 38.4Q16.4 39.2 15.6 35.6Q13.8 29.4 13.3 21.6Q12.9 15.6 13.2 11.6Z" fill="#4E9A3A" stroke="#2F6B24" stroke-width=".6"/>
    <path class="arruga" d="M16.8 11q-1.6 9 .4 22M23.4 11.4q1.4 7-.6 15" stroke="#3C7F2C" stroke-width=".7" fill="none" opacity=".7" style="transition:stroke .3s"/>
    <path class="brillo" d="M15 13.4q-.8 5 0 9" stroke="#9CD27E" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".8" style="transition:stroke .3s"/>
    <path d="M16 9.6q4-2.6 8 0-4 1.4-8 0z" fill="#3C7F2C"/>
    <path d="M20 8.6q-.4-3.4 2.6-5.4" stroke="#6B7A2E" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    ${gesto(21, 16.4, .8, "alegre", "grito")}
    ${mofletes(17.8, 24.4, 18.4, .8)}
    <circle cx="9.6" cy="26.3" r="1" fill="#4E9A3A"/>
    <line x1="26.8" y1="20.4" x2="30" y2="25" stroke="#2F6B24" stroke-width="1.5" stroke-linecap="round"/><circle cx="30.2" cy="25.3" r="1" fill="#4E9A3A"/>
    <g class="llama"><g class="fuego vb" style="transform-origin:22.6px 19px">
      <path d="M22.6 19Q27.5 14 33 16.2 31 17.2 36.4 18.8 31 20.4 34 23 28 24.6 22.6 19Z" fill="#F28A1F"/>
      <path d="M23.8 19.2Q27.8 16.8 31 17.8 29.6 18.8 32.2 19.6 29 20.8 30.4 22 27 22.2 23.8 19.2Z" fill="#FFD84A"/>
    </g></g>
    ${vapor(14.5, 25.5, 5)}
  </g></g>`,

  tarta: () => `<g class="bob">
    ${pierna(15, 36, 13.5, 44.5, "#8A5A2E", 2.4, 1)}${pierna(23, 36, 24.5, 44.5, "#8A5A2E", 2.4, -1)}
    <ellipse cx="19" cy="33" rx="16" ry="5.6" fill="#FFFFFF" stroke="#D9D2C0" stroke-width=".6" stroke-dasharray="1 .7"/>
    <line x1="5.2" y1="25" x2="1.8" y2="29.4" stroke="#8A5A2E" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M5 17V32A14 5 0 0 0 33 32V17Z" fill="#D9A45A" stroke="#8A5A2E" stroke-width=".5"/>
    <path d="M5 30A14 5 0 0 0 33 30V32A14 5 0 0 1 5 32Z" fill="#B87A3A"/>
    <g fill="#EBC486"><ellipse cx="8.4" cy="26" rx=".8" ry=".4"/><ellipse cx="29.6" cy="27.4" rx=".8" ry=".4"/><ellipse cx="11" cy="32" rx=".7" ry=".35"/><ellipse cx="27" cy="33" rx=".7" ry=".35"/></g>
    <line x1="32.8" y1="25" x2="35.8" y2="21.4" stroke="#8A5A2E" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M36.4 21.8V15.4M35.4 15.4v-2.4M36.4 15.4v-2.6M37.4 15.4v-2.4M35.4 15.4h2" stroke="#9AA0A7" stroke-width=".6" stroke-linecap="round"/>
    <circle cx="35.9" cy="21.2" r="1" fill="#E9C9A8"/><circle cx="1.6" cy="29.7" r="1" fill="#E9C9A8"/>
    <ellipse cx="19" cy="17" rx="14" ry="5" fill="#FBF7EE" stroke="#D9CBAE" stroke-width=".5"/>
    <g transform="translate(19 17) scale(1 .36)">
      <path d="M0 -9.5V8M-8 -2.5H8" stroke="#C98A3E" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M-1.3 7L0 12 1.3 7Z" fill="#C98A3E"/>
      <g fill="#C98A3E"><circle cx="0" cy="-10.6" r="1.7"/><circle cx="-9.1" cy="-2.5" r="1.7"/><circle cx="9.1" cy="-2.5" r="1.7"/><circle cx="-1.6" cy="-9.4" r="1"/><circle cx="1.6" cy="-9.4" r="1"/><circle cx="-8" cy="-4.1" r="1"/><circle cx="-8" cy="-.9" r="1"/><circle cx="8" cy="-4.1" r="1"/><circle cx="8" cy="-.9" r="1"/></g>
    </g>
    <g fill="#fff" stroke="#E4DCC8" stroke-width=".2"><circle cx="9" cy="16" r=".5"/><circle cx="28" cy="18.4" r=".45"/><circle cx="24.4" cy="14" r=".4"/><circle cx="12.6" cy="19.6" r=".4"/></g>
    ${gesto(19, 26.6, .8, "alegre", "enfado")}
    ${mofletes(15.4, 22.6, 28.2, .85)}
    <circle class="cae" cx="5.6" cy="22" r=".6" fill="#fff" stroke="#CFC7B4" stroke-width=".25"/>
    <circle class="cae" style="animation-delay:.35s" cx="32.6" cy="23" r=".55" fill="#fff" stroke="#CFC7B4" stroke-width=".25"/>
    <circle class="cae" style="animation-delay:.2s" cx="7.4" cy="36" r=".5" fill="#fff" stroke="#CFC7B4" stroke-width=".25"/>
    <g class="solo-pose"><g class="pop" fill="#fff" stroke="#DCD3BE" stroke-width=".4">
      <circle cx="8" cy="9" r="3"/><circle cx="13.6" cy="6.6" r="3.4"/><circle cx="20" cy="5.6" r="3.6"/><circle cx="26.4" cy="6.8" r="3.2"/><circle cx="31.4" cy="9.6" r="2.6"/>
    </g></g></g>`,

  tortilla: () => `<g class="solo-pose"><ellipse cx="20" cy="45" rx="12" ry="1.8" fill="#2A2A2A"/><path d="M8.4 44.6L1 41.6" stroke="#5B3A22" stroke-width="2.2" stroke-linecap="round"/></g>
    <g class="voltea vb" style="transform-origin:20px 31px">
      ${pierna(17, 35.5, 15.5, 44.5, "#6B3A1E", 2.3, 1)}${pierna(23, 35.5, 24.5, 44.5, "#6B3A1E", 2.3, -1)}
      <line x1="8.8" y1="26" x2="5" y2="30.5" stroke="#6B3A1E" stroke-width="1.6" stroke-linecap="round"/><circle cx="4.8" cy="30.8" r="1" fill="#E9C9A8"/>
      <line x1="31.2" y1="26" x2="35" y2="21.5" stroke="#6B3A1E" stroke-width="1.6" stroke-linecap="round"/><circle cx="35.2" cy="21.2" r="1" fill="#E9C9A8"/>
      <circle cx="20" cy="25" r="11.6" fill="#E3A845" stroke="#9A6424" stroke-width=".6"/>
      <circle cx="20" cy="25" r="9.8" fill="#F6CF6A"/>
      <g fill="#FBE3A2"><path d="M12.6 20.6l3-1.2 1.4 2.6-3 1.1z"/><path d="M24.4 29.4l2.8-.6.6 2.6-2.9.5z"/><path d="M13.4 28.6l2.2-.4.4 2-2.3.4z"/><path d="M25.6 18.8l2.2.3-.3 2.1-2.2-.3z"/></g>
      <g fill="#C98A3E"><circle cx="14.4" cy="31.6" r=".9"/><circle cx="27.4" cy="22.8" r=".7"/><circle cx="22.4" cy="17" r=".6"/><circle cx="11.6" cy="24.8" r=".6"/><circle cx="29" cy="28.6" r=".5"/></g>
      ${gesto(20, 24.2, .9, "alegre", "grito")}
      ${mofletes(16.2, 23.8, 26.2, .95)}
    </g>
    <g class="solo-pose"><g class="pop"><circle cx="34" cy="8" r="2.8" fill="none" stroke="#D9C7E6" stroke-width="1.2"/><circle cx="34" cy="8" r="1.4" fill="none" stroke="#C3A6D8" stroke-width=".8"/>
      <text x="27.6" y="7" font-size="6" font-weight="800" fill="#D9773B" font-family="Georgia, serif">?</text></g></g>`,

  horreo: () => {
    const tablas = (x0: number, x1: number) => { let s = ""; for (let x = x0 + .35; x < x1 - .6; x += 1.55) s += `<rect x="${n2(x)}" y="14.6" width="1.05" height="11.6" fill="#9A6536"/>`; return s; };
    const grano = (x: number, d: number) => `<circle class="cae" style="animation-delay:${d}s" cx="${x}" cy="30.4" r=".7" fill="#F2C230" stroke="#B88A00" stroke-width=".2"/>`;
    return `<g class="bob">
    ${pierna(12, 37, 11, 44.5, "#4A4038", 2, 1)}${pierna(28, 37, 29, 44.5, "#4A4038", 2, -1)}
    <path d="M10 37.2h4l-.6-6h-2.8zM26 37.2h4l-.6-6h-2.8z" fill="#A9A79F" stroke="#6E6D66" stroke-width=".4"/>
    <rect x="8.5" y="29.4" width="7" height="1.8" rx=".9" fill="#BDBBB3" stroke="#6E6D66" stroke-width=".4"/>
    <rect x="24.5" y="29.4" width="7" height="1.8" rx=".9" fill="#BDBBB3" stroke="#6E6D66" stroke-width=".4"/>
    ${grano(18.2, 0)}${grano(20.6, .25)}${grano(22.4, .5)}
    <g class="solo-pose">${grano(17, .1)}${grano(19.4, .4)}${grano(23.2, .15)}</g>
    <rect x="4.6" y="27.4" width="30.8" height="2.2" rx=".4" fill="#B5B3AB" stroke="#6E6D66" stroke-width=".4"/>
    <rect x="8.5" y="14.6" width="8.5" height="11.6" fill="#F2C230"/><rect x="23" y="14.6" width="8.5" height="11.6" fill="#F2C230"/>
    ${tablas(8.5, 17)}${tablas(23, 31.5)}
    <path d="M6 13h28v14.4H6zM8.5 14.6h8.5v11.6H8.5zM23 14.6h8.5v11.6H23z" fill="#B8B6AE" fill-rule="evenodd" stroke="#6E6D66" stroke-width=".45"/>
    ${gesto(20, 19, .7, "normal", "grito")}
    ${mofletes(17.9, 22.1, 20.6, .6)}
    <g class="tejado vb">
      <path d="M3.5 13.4L7.5 8.2H32.5L36.5 13.4Z" fill="#B5553A" stroke="#7A3424" stroke-width=".5" stroke-linejoin="round"/>
      <path d="M4.8 11.7H35.2M6.1 10H33.9" stroke="#8E3A28" stroke-width=".4"/>
      <line x1="7.5" y1="8.2" x2="32.5" y2="8.2" stroke="#9C9A92" stroke-width="1" stroke-linecap="round"/>
      <path d="M32 8.2V2.2M30.2 4.2H33.8" stroke="#8E8C84" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M7.5 8.2L8.6 3.6 9.7 8.2Z" fill="#8E8C84"/><circle cx="8.6" cy="3.2" r=".8" fill="#8E8C84"/>
    </g>
    <g class="solo-pose"><g class="pop">
      <ellipse cx="37" cy="17.4" rx="1.8" ry="3.6" fill="#F2C230" stroke="#B88A00" stroke-width=".4" transform="rotate(25 37 17.4)"/>
      <path d="M35.4 20.6q-1.8 1.4-3 .2M36 21q-.4 2-2 2.2" stroke="#7FA24A" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M2 20q-1 1.2 0 2.4M3.4 19.4q-1.4 1.8 0 3.6" stroke="#8A6A3E" stroke-width=".6" fill="none" stroke-linecap="round"/>
    </g></g></g>`;
  },

  roncador: () => `<g class="repta vb" style="transform-origin:31px 44px">
    <g class="respira vb" style="transform-origin:16px 44px">
      <path d="M4 44.4Q1.5 44.4 1.5 40.8 1.5 36.4 5 35.8L26 33.6Q30 33.2 31 36.2V44.4Z" fill="#3E6E85" stroke="#23465A" stroke-width=".6"/>
      <path d="M8 35.4v9M13 34.9v9.5M18 34.4v10M23 33.9v10.5" stroke="#2D5568" stroke-width=".6"/>
      <path d="M4 39.8H29" stroke="#C9A24B" stroke-width=".5" stroke-dasharray=".8 .5"/>
    </g>
    <g class="incorpora vb" style="transform-origin:28px 42px">
      <ellipse cx="32.2" cy="38.4" rx="6.4" ry="6.1" fill="#3E6E85" stroke="#23465A" stroke-width=".6"/>
      ${cara(32.6, 37.6, { r: 4.6, normal: "dormido", pose: "enfado" })}
      <path d="M28.6 35.2Q29.6 31.2 33.4 31.6 37.2 32.2 36.8 35.4Z" fill="#B8323A"/>
      <path d="M28.4 35.3Q32.6 34.2 36.9 35.5" stroke="#F4ECDD" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M30.2 32.6Q26.6 28.6 23.2 31.2" stroke="#B8323A" stroke-width="2.3" fill="none" stroke-linecap="round"/>
      <circle cx="22.9" cy="31.4" r="1.6" fill="#F4ECDD" stroke="#CFC7B4" stroke-width=".3"/>
      <circle class="solo-normal moco fb" cx="37.9" cy="38.8" r="1.3" fill="#BFE3F0" stroke="#8FBCD0" stroke-width=".3" opacity=".8"/>
      <circle class="emisor" cx="35" cy="30" r=".8" fill="transparent"/>
    </g></g>
    <g class="solo-normal"><text class="sube" x="37" y="31" font-size="3.6" font-weight="800" fill="#3E6E85" font-family="Georgia, serif">z</text><text class="sube" style="animation-delay:.5s" x="38.6" y="27" font-size="2.8" font-weight="800" fill="#3E6E85" font-family="Georgia, serif">z</text></g>
    <g class="solo-pose"><g class="pop">
      <path d="M31 18.4l-1.6-1.2M39 18.4l1.6-1.2M35 14.6v-2M30.6 22.6h-1.8M39.4 22.6h1.8" stroke="#E0A800" stroke-width=".7" stroke-linecap="round"/>
      <circle cx="35" cy="21" r="3" fill="#FFE08A" stroke="#C9A24B" stroke-width=".5"/>
      <path d="M34 22q1-1.6 2 0" stroke="#C9A24B" stroke-width=".4" fill="none"/>
      <rect x="33.8" y="23.8" width="2.4" height="1.8" rx=".3" fill="#9AA0A7"/>
    </g></g>`,

  perro: () => {
    const pata = (x: number, c: string, lado: number) => `<g class="${lado > 0 ? "pa" : "pb"}"><line x1="${x}" y1="30" x2="${x}" y2="42.6" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="${x + .5}" cy="43.6" rx="1.6" ry="1" fill="#F1E2C8"/></g>`;
    return `<g class="bob">
    <g class="rabo-p vb" style="transform-origin:8px 25.6px"><path d="M8 25.6Q3.4 23.8 4 18.4" stroke="#B9824A" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="4.1" cy="18.2" r=".9" fill="#F1E2C8"/></g>
    ${pata(11, "#9E6A38", -1)}${pata(24, "#9E6A38", 1)}
    <ellipse cx="17.5" cy="27.5" rx="10.5" ry="6" fill="#C98F55"/>
    <ellipse cx="18" cy="31" rx="7" ry="2.2" fill="#F1E2C8"/>
    ${pata(14, "#C98F55", 1)}${pata(26.6, "#C98F55", -1)}
    <path d="M12.6 22.4Q17.5 20.8 22.4 22.4" stroke="#6B4A2E" stroke-width="1" fill="none"/>
    <rect x="12.6" y="22.8" width="9.4" height="7.2" rx="1.6" fill="#2F5D50" stroke="#1B211D" stroke-width=".4"/>
    <path d="M12.6 25.2h9.4" stroke="#24493F" stroke-width=".6"/>
    ${vieira(17.3, 27.6, .34)}
    <g class="cabeza-p vb" style="transform-origin:26px 24px">
      <path d="M24.4 26Q24.8 19.6 28 17.4" stroke="#C98F55" stroke-width="5" stroke-linecap="round"/>
      <circle cx="29.6" cy="18.6" r="5.2" fill="#C98F55"/>
      <ellipse cx="33.8" cy="21" rx="3.6" ry="2.6" fill="#F1E2C8"/>
      <ellipse cx="36.9" cy="19.9" rx="1.25" ry=".95" fill="#1B211D"/>
      <circle cx="36.5" cy="19.6" r=".3" fill="#fff" opacity=".7"/>
      <g class="solo-normal"><circle cx="31" cy="17.2" r="1" fill="#1B211D"/><circle cx="31.3" cy="16.9" r=".3" fill="#fff"/></g>
      <path class="solo-pose" d="M30 17.6q1-1.4 2 0" stroke="#1B211D" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M29.8 15.2q1.2-.6 2.4 0" stroke="#8E5A2E" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <path class="solo-normal" d="M33 22.9q1.7 1.1 3.4 0" stroke="#5A3A22" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <ellipse class="solo-normal lengua" cx="34.8" cy="24.1" rx=".9" ry="1.2" fill="#E8828A"/>
      <path class="solo-pose" d="M32.2 22.6q2.6 4 5.2 0z" fill="#5A1E1E"/>
      <ellipse class="solo-pose" cx="34.6" cy="24.2" rx="1" ry=".7" fill="#E8828A"/>
      <path class="oreja vb" style="transform-origin:27.4px 14.8px" d="M27.4 14.4Q23.6 14.6 24.4 21.2 27 20.6 28.6 15.8Z" fill="#8E5A2E"/>
      <path class="solo-pose" d="M39 17l2-1.5M39.6 20.2h2.4M39 23.4l2 1.5" stroke="#D9773B" stroke-width=".8" stroke-linecap="round"/>
    </g>
    <path d="M24.6 22.2q2.6 2.2 5.6 1.2" stroke="#B8323A" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <g class="credencial vb" style="transform-origin:27.2px 23.4px">
      <line x1="27.2" y1="23.4" x2="27.2" y2="25" stroke="#6B4A2E" stroke-width=".4"/>
      <rect x="25.4" y="25" width="3.6" height="4.6" rx=".4" fill="#F4ECDD" stroke="#8A6A2E" stroke-width=".35"/>
      <path d="M26.1 26.4h2.2M26.1 27.5h2.2" stroke="#B8323A" stroke-width=".35"/>
      <circle cx="27.2" cy="28.7" r=".45" fill="#2E4F9A"/>
    </g></g>`;
  },
};

/**
 * Convierte un id de React (useId: "_r_1_", "«r1»", ":r1:") en un fragmento
 * válido para id/url() de SVG: solo [a-z0-9-]. Cada carácter fuera de [a-z0-9]
 * se codifica con ancho fijo para que dos ids distintos no colisionen (p. ej.
 * "_R_1_" y "_r_1_").
 */
export function uidSvgSeguro(id: string): string {
  const cuerpo = Array.from(id)
    .map((c) => (/[a-z0-9]/.test(c) ? c : "-" + c.charCodeAt(0).toString(36).padStart(4, "0")))
    .join("");
  return "m" + cuerpo;
}

/** <svg> completo de la figura, decorativo (aria-hidden): la etiqueta va en el botón que lo envuelve. */
export function svgFigura(id: IdMonigote, uid: string, tam: number): string {
  return `<svg class="mono m-${id}" width="${tam}" height="${tam}" viewBox="0 0 40 48" fill="none" overflow="visible" aria-hidden="true" focusable="false">${FIGURAS[id](uid)}</svg>`;
}
