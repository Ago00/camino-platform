/**
 * Piezas SVG comunes de las figuras de los monigotes (DT-036), portadas tal
 * cual del catálogo aprobado. Coordenadas en el viewBox 0 0 40 48, mirando a
 * la derecha. Devuelven strings de marcado: solo se componen con números y
 * colores del propio catálogo, nunca con texto que venga de fuera (el grito y
 * el bocadillo se pintan siempre con textContent/JSX).
 */

/** Redondeo a 2 decimales (el catálogo usa `+v.toFixed(2)`). */
export const n2 = (v: number): number => +v.toFixed(2);

export const ESTRELLA = "M0 -2L.5 -.5 2 0 .5 .5 0 2-.5 .5-2 0-.5-.5Z";

/**
 * Pierna que oscila al andar. `lado` > 0 arranca hacia delante; `corta` usa
 * el balanceo corto (abuelo, mojón).
 */
export function pierna(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  ancho: number,
  lado: number,
  corta = false
): string {
  const clase = corta ? (lado > 0 ? "pac" : "pbc") : lado > 0 ? "pa" : "pb";
  return `<line class="${clase}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round"/>`;
}

export function vieira(x: number, y: number, s = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 4.2L-5 -1.6Q0 -7 5 -1.6Z" fill="#FFF8E6" stroke="#8A6A2E" stroke-width=".7" stroke-linejoin="round"/><path d="M0 4.2L-2.6 -4.6M0 4.2L0 -5.2M0 4.2L2.6 -4.6" stroke="#8A6A2E" stroke-width=".55"/></g>`;
}

export function vapor(a: number, b: number, y: number): string {
  return `<g class="solo-pose vapor"><circle cx="${a}" cy="${y}" r="1.4" fill="#AEB6BE"/><circle cx="${b}" cy="${y}" r="1.3" fill="#AEB6BE"/></g>`;
}

export function destello(x: number, y: number, s = 1, color = "#C9A24B"): string {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path class="destello" d="${ESTRELLA}" fill="${color}"/></g>`;
}

export function notaSvg(x: number, y: number, s: number, color: string): string {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="3.2" cy="11" rx="2.6" ry="1.9" transform="rotate(-20 3.2 11)" fill="${color}"/><path d="M5.5 11V1.5q3.6 1.2 3.2 5" stroke="${color}" stroke-width="1.1" fill="none" stroke-linecap="round"/></g>`;
}

export type Expresion =
  | "normal"
  | "enfado"
  | "alegre"
  | "achispado"
  | "dormido"
  | "dolor"
  | "grito"
  | "sorpresa"
  | "neutro";

/** Ojos, cejas y boca de una expresión, centrados en (cx, cy) con escala k. */
export function expr(cx: number, cy: number, k: number, e: Expresion): string {
  const f = n2;
  const ex = 2 * k;
  const a = cx - ex;
  const b = cx + ex;
  const L = (d: string, w = 0.85) =>
    `<path d="${d}" stroke="#333" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  let s = "";
  if (e === "alegre") {
    s += L(
      `M${f(a - 1.1 * k)} ${f(cy + 0.4 * k)}q${f(1.1 * k)} ${f(-1.5 * k)} ${f(2.2 * k)} 0M${f(b - 1.1 * k)} ${f(cy + 0.4 * k)}q${f(1.1 * k)} ${f(-1.5 * k)} ${f(2.2 * k)} 0`
    );
  } else if (e === "achispado" || e === "dormido") {
    s += L(
      `M${f(a - 1.1 * k)} ${f(cy)}q${f(1.1 * k)} ${f(0.9 * k)} ${f(2.2 * k)} 0M${f(b - 1.1 * k)} ${f(cy)}q${f(1.1 * k)} ${f(0.9 * k)} ${f(2.2 * k)} 0`
    );
  } else if (e === "dolor") {
    s += L(
      `M${f(a - k)} ${f(cy - 0.9 * k)}l${f(1.4 * k)} ${f(0.9 * k)}l${f(-1.4 * k)} ${f(0.9 * k)}M${f(b + k)} ${f(cy - 0.9 * k)}l${f(-1.4 * k)} ${f(0.9 * k)}l${f(1.4 * k)} ${f(0.9 * k)}`
    );
  } else {
    const r = e === "sorpresa" ? 1.15 * k : 0.9 * k;
    s += `<circle cx="${f(a)}" cy="${f(cy)}" r="${f(r)}" fill="#333"/><circle cx="${f(b)}" cy="${f(cy)}" r="${f(r)}" fill="#333"/>`;
  }
  if (e === "enfado") {
    s += L(
      `M${f(cx - 3.7 * k)} ${f(cy - 1.8 * k)}l${f(2.4 * k)} ${f(1.1 * k)}M${f(cx + 3.7 * k)} ${f(cy - 1.8 * k)}l${f(-2.4 * k)} ${f(1.1 * k)}`,
      0.9
    );
  }
  if (e === "neutro" || e === "sorpresa") {
    s += L(
      `M${f(a - k)} ${f(cy - 2.4 * k)}q${f(k)} ${f(-0.7 * k)} ${f(2 * k)} 0M${f(b - k)} ${f(cy - 2.4 * k)}q${f(k)} ${f(-0.7 * k)} ${f(2 * k)} 0`,
      0.7
    );
  }
  if (e === "dolor") {
    s += L(
      `M${f(a - k)} ${f(cy - 2.2 * k)}l${f(2 * k)} ${f(-0.6 * k)}M${f(b + k)} ${f(cy - 2.2 * k)}l${f(-2 * k)} ${f(-0.6 * k)}`,
      0.7
    );
  }
  switch (e) {
    case "enfado":
      s +=
        L(`M${f(cx - 2 * k)} ${f(cy + 3 * k)}q${f(2 * k)} ${f(-1.3 * k)} ${f(4 * k)} 0`, 0.9) +
        `<path d="M${f(cx + 4.9 * k)} ${f(cy - 5.7 * k)}l${f(1.8 * k)} ${f(1.8 * k)}M${f(cx + 6.7 * k)} ${f(cy - 5.7 * k)}l${f(-1.8 * k)} ${f(1.8 * k)}" stroke="#D23B3B" stroke-width="1" stroke-linecap="round"/>`;
      break;
    case "alegre":
      s += `<path d="M${f(cx - 2.3 * k)} ${f(cy + 2.1 * k)}q${f(2.3 * k)} ${f(3 * k)} ${f(4.6 * k)} 0z" fill="#7A2A2A"/>`;
      break;
    case "grito":
      s += `<ellipse cx="${f(cx)}" cy="${f(cy + 3 * k)}" rx="${f(1.5 * k)}" ry="${f(1.9 * k)}" fill="#5A1E1E"/>`;
      break;
    case "dolor":
      s += L(
        `M${f(cx - 2.2 * k)} ${f(cy + 3 * k)}q${f(0.55 * k)} ${f(-0.8 * k)} ${f(1.1 * k)} 0t${f(1.1 * k)} 0t${f(1.1 * k)} 0t${f(1.1 * k)} 0`,
        0.8
      );
      break;
    case "achispado":
      s += L(`M${f(cx - 2 * k)} ${f(cy + 2.2 * k)}q${f(2.4 * k)} ${f(2 * k)} ${f(4.2 * k)} ${f(-0.6 * k)}`, 0.8);
      break;
    case "sorpresa":
      s += `<circle cx="${f(cx)}" cy="${f(cy + 3 * k)}" r="${f(0.95 * k)}" fill="#5A1E1E"/>`;
      break;
    case "neutro":
      s += L(`M${f(cx - 1.6 * k)} ${f(cy + 2.9 * k)}h${f(3.2 * k)}`, 0.8);
      break;
    case "dormido":
      s += `<ellipse cx="${f(cx + 0.3 * k)}" cy="${f(cy + 2.9 * k)}" rx="${f(0.75 * k)}" ry="${f(0.95 * k)}" fill="#5A1E1E"/>`;
      break;
    default:
      s += L(`M${f(cx - 2 * k)} ${f(cy + 2.4 * k)}q${f(2 * k)} ${f(1.4 * k)} ${f(4 * k)} 0`, 0.8);
  }
  return s;
}

interface OpcionesCara {
  r?: number;
  piel?: string;
  pose?: Expresion;
  normal?: Expresion;
  mejillas?: boolean;
}

/** Cabeza redonda con la expresión normal y la de pose (se alternan por CSS). */
export function cara(cx: number, cy: number, o: OpcionesCara = {}): string {
  const r = o.r ?? 6.5;
  const k = r / 6.5;
  const piel = o.piel ?? "#E9C9A8";
  const pose = o.pose ?? "enfado";
  const enf = pose === "enfado";
  let s = `<circle class="piel${enf ? " piel-enf" : ""}" cx="${cx}" cy="${cy}" r="${r}" fill="${piel}" stroke="#00000022"/>`;
  if (o.mejillas) {
    s += `<g${enf ? ' class="solo-normal"' : ""}><circle cx="${n2(cx - 3.8 * k)}" cy="${n2(cy + 1.9 * k)}" r="${n2(1.1 * k)}" fill="#E58C7C" opacity=".6"/><circle cx="${n2(cx + 3.8 * k)}" cy="${n2(cy + 1.9 * k)}" r="${n2(1.1 * k)}" fill="#E58C7C" opacity=".6"/></g>`;
  }
  s += `<g class="solo-normal">${expr(cx, cy, k, o.normal ?? "normal")}</g><g class="solo-pose">${expr(cx, cy, k, pose)}</g>`;
  return s;
}

/** Gesto sin círculo de piel (para objetos: flecha, mojón, tarta…). */
export function gesto(cx: number, cy: number, k: number, normal: Expresion = "normal", pose: Expresion = "enfado"): string {
  return `<g class="solo-normal">${expr(cx, cy, k, normal)}</g><g class="solo-pose">${expr(cx, cy, k, pose)}</g>`;
}

export function mofletes(a: number, b: number, y: number, r = 0.85): string {
  return `<circle cx="${a}" cy="${y}" r="${r}" fill="#E58C7C" opacity=".55"/><circle cx="${b}" cy="${y}" r="${r}" fill="#E58C7C" opacity=".55"/>`;
}
