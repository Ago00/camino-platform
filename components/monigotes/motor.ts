/**
 * Motor de los monigotes en el navegador (DT-036): el monigote suelto que
 * deambula por la web pública, el grito a pantalla completa y las figuras
 * del selector del admin. Port fiel de las clases Suelto/Tarjeta y de
 * lanzarGrito del catálogo aprobado (design-sandbox/public/monigotes-tematicos.html).
 *
 * DOM imperativo a propósito: el monigote se mueve en cada frame y deja
 * decenas de marcas animadas; con estado de React serían renders por frame.
 * Los componentes React solo crean las capas y llaman a estas funciones en un
 * efecto, con limpieza completa al desmontar.
 *
 * Seguridad: innerHTML SOLO con strings de FIGURAS/MARCAS/particulaSvg (datos
 * del catálogo y un uid saneado). El grito y el bocadillo van siempre por
 * textContent.
 */

import type { DefMonigote } from "@/lib/monigotes/catalogo";
import { svgFigura } from "@/lib/monigotes/figuras";
import { bajarKmMojon, gritoEfectivo, KM_INICIAL_MOJON, partirGrito } from "@/lib/monigotes/grito";
import { MARCAS, particulaSvg } from "@/lib/monigotes/marcas";
import { tocarSonido } from "@/components/monigotes/sonidos";

const FUENTES_GRITO = {
  serif: 'var(--font-fraunces), Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
} as const;

/** Tamaño de la figura suelta en la web (px). */
const TAM_SUELTO = 42;
/**
 * Zona superior que el suelto evita. El catálogo usaba el borde de su propia
 * barra; la web no tiene barra fija y se mantiene el margen del peregrino
 * animado al que sustituye (DT-034).
 */
const MARGEN_SUPERIOR = 64;
const DURACION_POSE_MS = 3000;
const DURACION_GRITO_MS = 1500;
const PARTICULAS_POR_GRITO = 12;
/** Partículas que suben (humo, notas…) o caen (gotas, granos…) en vez de abrirse en círculo. */
const PARTICULAS_QUE_SUBEN = new Set(["burbuja", "humo", "nota", "zeta", "llama"]);
const PARTICULAS_QUE_CAEN = new Set(["gota", "maiz", "azucar", "patata"]);

const esMovimientoReducido = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------------
// Kilómetros del mojón: bajan uno por pinchazo, compartidos por todas las
// figuras del documento (como en el catálogo).
// ---------------------------------------------------------------------------

let kmMojon = KM_INICIAL_MOJON;

function pintarKm(raiz: ParentNode): void {
  raiz.querySelectorAll(".km-num").forEach((t) => {
    t.textContent = String(kmMojon);
  });
}

function bajarKm(): void {
  kmMojon = bajarKmMojon(kmMojon);
  document.querySelectorAll(".mng .km-num").forEach((t) => {
    t.textContent = String(kmMojon);
    t.classList.remove("cambia");
    // Fuerza el reflow para que la animación "cambia" vuelva a empezar.
    t.getBoundingClientRect();
    t.classList.add("cambia");
  });
}

// ---------------------------------------------------------------------------
// Grito a pantalla completa
// ---------------------------------------------------------------------------

const temporizadoresGrito = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function tamanoGrito(longitud: number): string {
  if (longitud <= 10) return "clamp(44px,13vw,128px)";
  if (longitud <= 18) return "clamp(36px,10.5vw,104px)";
  return "clamp(28px,7.5vw,78px)";
}

/** Lanza el grito `texto` con el estilo del monigote en `capa` (capa fija a pantalla completa). */
export function lanzarGrito(capa: HTMLElement, def: DefMonigote, texto: string): void {
  limpiarGritos(capa);
  const e = def.estilo;
  const tam = tamanoGrito(texto.length);
  const grito = document.createElement("div");
  grito.className = "grito";
  const caja = document.createElement("div");
  caja.className = "grito-txt e-" + e.entrada;
  partirGrito(texto).forEach((linea, i) => {
    const [color, borde] = e.lineas[i % e.lineas.length];
    const span = document.createElement("span");
    span.textContent = e.mayus ? linea.toUpperCase() : linea;
    span.style.fontFamily = FUENTES_GRITO[e.fuente];
    span.style.fontStyle = e.italica ? "italic" : "normal";
    span.style.fontWeight = String(e.peso);
    span.style.fontSize = tam;
    span.style.color = color;
    span.style.setProperty("-webkit-text-stroke", `${e.trazo}px ${borde}`);
    caja.appendChild(span);
  });
  grito.appendChild(caja);

  if (e.particula && !esMovimientoReducido()) {
    const { tipo, colores } = e.particula;
    for (let i = 0; i < PARTICULAS_POR_GRITO; i++) {
      const p = document.createElement("div");
      p.className = "particula";
      p.innerHTML = particulaSvg(tipo, colores[i % colores.length]);
      grito.appendChild(p);
      const ang = (i / PARTICULAS_POR_GRITO) * Math.PI * 2 + (i % 3) * 0.35;
      const dist = Math.min(window.innerWidth, 900) * (0.28 + ((i * 37) % 40) / 160);
      const x = Math.cos(ang) * dist;
      let y = Math.sin(ang) * dist * 0.6;
      if (PARTICULAS_QUE_SUBEN.has(tipo)) y -= 120;
      if (PARTICULAS_QUE_CAEN.has(tipo)) y = Math.abs(y) + 120;
      p.animate(
        [
          { transform: "translate(-50%,-50%) scale(.3)", opacity: 0 },
          { opacity: 1, offset: 0.2 },
          {
            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1.1) rotate(${(i % 2 ? 1 : -1) * 25}deg)`,
            opacity: 0,
          },
        ],
        { duration: 1300, delay: (i % 4) * 40, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" }
      );
    }
  }

  capa.appendChild(grito);
  temporizadoresGrito.set(
    capa,
    setTimeout(() => grito.remove(), DURACION_GRITO_MS)
  );
}

export function limpiarGritos(capa: HTMLElement): void {
  const pendiente = temporizadoresGrito.get(capa);
  if (pendiente !== undefined) clearTimeout(pendiente);
  temporizadoresGrito.delete(capa);
  capa.textContent = "";
}

/** Lo común a pinchar el suelto y a "Probar" en el admin: km del mojón, grito y sonido. */
function pincharComun(capaGritos: HTMLElement, def: DefMonigote, grito: string | null, sonido: boolean): void {
  if (def.gritoVivo) bajarKm();
  lanzarGrito(capaGritos, def, gritoEfectivo(def, grito, kmMojon));
  if (sonido) tocarSonido(def.sonido);
}

// ---------------------------------------------------------------------------
// Piezas compartidas por el suelto y la tarjeta
// ---------------------------------------------------------------------------

function crearBocadillo(def: DefMonigote): HTMLSpanElement {
  const boca = document.createElement("span");
  boca.className = "bocadillo";
  boca.textContent = def.boca;
  return boca;
}

/** Inserta la figura en `contenedor` y devuelve su <svg>. */
function insertarFigura(contenedor: HTMLElement, def: DefMonigote, uid: string, tam: number): SVGSVGElement {
  contenedor.innerHTML = svgFigura(def.id, uid, tam);
  const svg = contenedor.querySelector<SVGSVGElement>("svg.mono");
  if (!svg) throw new Error(`Figura sin <svg>: ${def.id}`);
  pintarKm(contenedor);
  return svg;
}

function crearMarca(def: DefMonigote, v: number, caliente: boolean): HTMLDivElement {
  const marca = document.createElement("div");
  marca.className = "marca";
  marca.innerHTML = MARCAS[def.rastro.marca](v, caliente);
  return marca;
}

/** Reinicia la animación de hipo (borrachillo). */
function hipar(svg: SVGSVGElement, boca: HTMLElement): void {
  boca.textContent = "¡hic!";
  boca.classList.add("ver");
  svg.classList.remove("hic");
  svg.getBoundingClientRect();
  svg.classList.add("hic");
}

interface EstadoArrebato {
  def: DefMonigote;
  svg: SVGSVGElement;
  boca: HTMLElement;
  enPose: () => boolean;
  activo: () => boolean;
}

/**
 * Arrebatos aleatorios (pimiento que de pronto pica). Nunca suenan: solo el
 * clic suena. Devuelve la función que cancela todos sus temporizadores.
 */
function programarArrebatos(estado: EstadoArrebato): () => void {
  const arrebato = estado.def.arrebato;
  if (!arrebato) return () => undefined;
  let siguiente: ReturnType<typeof setTimeout> | undefined;
  let fin: ReturnType<typeof setTimeout> | undefined;
  let cancelado = false;
  const programar = () => {
    siguiente = setTimeout(() => {
      if (cancelado) return;
      if (estado.activo() && !estado.enPose() && !esMovimientoReducido() && !document.hidden) {
        estado.svg.classList.add(arrebato.clase);
        estado.boca.textContent = arrebato.boca;
        estado.boca.classList.add("ver");
        clearTimeout(fin);
        fin = setTimeout(() => {
          estado.svg.classList.remove(arrebato.clase);
          if (!estado.enPose()) estado.boca.classList.remove("ver");
        }, arrebato.dura);
      }
      programar();
    }, arrebato.cada[0] + Math.random() * arrebato.cada[1]);
  };
  programar();
  return () => {
    cancelado = true;
    clearTimeout(siguiente);
    clearTimeout(fin);
  };
}

// ---------------------------------------------------------------------------
// Suelto: deambula libre por toda la pantalla
// ---------------------------------------------------------------------------

export interface CapasMonigote {
  rastros: HTMLElement;
  suelto: HTMLElement;
  gritos: HTMLElement;
}

export interface OpcionesMonigote {
  /** Fragmento único y saneado ([a-z0-9-]) para los id internos del SVG. */
  uid: string;
  /** Grito personalizado del reto (null = el del catálogo). */
  grito: string | null;
  sonido: boolean;
}

export interface ControlSuelto {
  destruir(): void;
  pinchar(): void;
}

interface Punto {
  x: number;
  y: number;
}

function crearSueltoUnaVez(capas: CapasMonigote, def: DefMonigote, opciones: OpcionesMonigote): ControlSuelto {
  const quieto = esMovimientoReducido();
  const el = document.createElement("div");
  el.className = "suelto" + (quieto ? " quieto" : "");
  const boca = crearBocadillo(def);
  const giro = document.createElement("div");
  giro.className = "giro-cara";
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "mono-btn";
  boton.setAttribute("aria-label", `${def.nombre} paseando. Púlsalo para que grite`);
  const svg = insertarFigura(boton, def, opciones.uid, TAM_SUELTO);
  giro.appendChild(boton);
  el.append(boca, giro);
  capas.suelto.appendChild(el);

  let pose = false;
  let tPose: ReturnType<typeof setTimeout> | undefined;
  let raf = 0;
  let pos: Punto = { x: window.innerWidth * 0.25, y: window.innerHeight * 0.6 };
  let desde: Punto = { ...pos };
  let hasta: Punto = { ...pos };
  let t0 = performance.now();
  let dur = 400;
  let pausaHasta = 0;
  let enPausa = false;
  let ultimo: Punto | null = null;
  let lado = 1;

  const cancelarArrebatos = programarArrebatos({
    def,
    svg,
    boca,
    enPose: () => pose,
    activo: () => el.isConnected,
  });

  function destino(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const top = MARGEN_SUPERIOR;
    let x = 10 + Math.random() * Math.max(20, w - TAM_SUELTO - 20);
    let y = top + Math.random() * Math.max(20, h - TAM_SUELTO - top - 16);
    if (def.radio) {
      // Los lentos (caracol, roncador) solo van a sitios cercanos.
      const a = Math.random() * Math.PI * 2;
      const d0 = def.radio * (0.4 + Math.random() * 0.6);
      x = Math.min(Math.max(10, pos.x + Math.cos(a) * d0), Math.max(10, w - TAM_SUELTO - 10));
      y = Math.min(Math.max(top, pos.y + Math.sin(a) * d0), Math.max(top, h - TAM_SUELTO - 16));
    }
    const d = Math.hypot(x - pos.x, y - pos.y);
    desde = { ...pos };
    hasta = { x, y };
    t0 = performance.now();
    dur = (pose ? Math.max(0.7, Math.min(4, d / (def.vel * def.mult))) : Math.max(3, Math.min(18, d / def.vel))) * 1000;
    const mira = x >= pos.x ? 1 : -1;
    giro.style.transform = `scaleX(${mira})`;
  }

  function pintar(now: number): void {
    const t = now / 1000;
    let ox = 0;
    let oy = 0;
    let rot = 0;
    if (def.mov === "zigzag" && !enPausa) {
      ox = Math.sin(t * 4.6) * 10;
      oy = Math.sin(t * 2.9) * 4;
      rot = Math.sin(t * 4.6 + 0.6) * 9;
    }
    if (def.mov === "vuelo") {
      oy = Math.sin(t * 3.4) * 5;
      rot = Math.sin(t * 1.7) * 3;
    }
    el.style.transform = `translate3d(${pos.x + ox}px, ${pos.y + oy}px, 0) rotate(${rot}deg)`;
  }

  function dejarRastro(): void {
    const r = def.rastro;
    const emisor = svg.querySelector(".emisor");
    const b = (emisor ?? svg).getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = emisor ? b.top + b.height / 2 : b.top + b.height * 0.9;
    if (!ultimo) {
      ultimo = { x: cx, y: cy };
      return;
    }
    const dx = cx - ultimo.x;
    const dy = cy - ultimo.y;
    if (Math.hypot(dx, dy) < r.min) return;
    if (r.nopose && pose) {
      ultimo = { x: cx, y: cy };
      return;
    }
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const perp = ((ang + 90) * Math.PI) / 180;
    const ladoMarca = r.alterna ? lado : 0;
    lado = -lado;
    let x = cx + Math.cos(perp) * r.sep * ladoMarca;
    let y = cy + Math.sin(perp) * r.sep * ladoMarca;
    if (r.disperso) {
      x += (Math.random() - 0.5) * r.disperso;
      y += (Math.random() - 0.5) * r.disperso;
    }
    const rot = r.rotar ? ang + 90 + (r.jitter ? (Math.random() - 0.5) * 2 * r.jitter : 0) : 0;
    const marca = crearMarca(def, Math.random(), pose || svg.classList.contains("pica"));
    marca.style.left = x + "px";
    marca.style.top = y + "px";
    capas.rastros.appendChild(marca);
    const animacion = marca.animate(
      [
        {
          transform: `translate(-50%,-50%) translate(0,0) rotate(${rot}deg) scale(${r.flotar ? 0.6 : 1})`,
          opacity: r.flotar ? 0.95 : 0.5,
        },
        {
          transform: `translate(-50%,-50%) translate(0,${r.flotar ? r.flotar[0] : 0}px) rotate(${rot}deg) scale(${r.flotar ? r.flotar[1] : 1})`,
          opacity: 0,
        },
      ],
      { duration: r.vida, easing: r.flotar ? "ease-out" : "linear", fill: "forwards" }
    );
    animacion.onfinish = () => marca.remove();
    ultimo = { x: cx, y: cy };
  }

  function tick(now: number): void {
    raf = requestAnimationFrame(tick);
    if (enPausa) {
      if (now < pausaHasta) {
        pintar(now);
        return;
      }
      enPausa = false;
      boca.classList.remove("ver");
      destino();
    }
    const p = Math.min(1, (now - t0) / dur);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    pos = { x: desde.x + (hasta.x - desde.x) * e, y: desde.y + (hasta.y - desde.y) * e };
    pintar(now);
    dejarRastro();
    if (p >= 1) {
      if (def.mov === "zigzag" && !pose && Math.random() < 0.45) {
        enPausa = true;
        pausaHasta = now + 1300;
        hipar(svg, boca);
      } else {
        destino();
      }
    }
  }

  // Al volver a la pestaña: rAF estuvo parado, así que se retoma desde donde
  // está con un destino nuevo (sin saltos ni un rastro de golpe).
  function alCambiarVisibilidad(): void {
    if (document.hidden || !raf) return;
    enPausa = false;
    ultimo = null;
    destino();
  }

  function pinchar(): void {
    pose = true;
    svg.classList.add("pose");
    boca.textContent = def.boca;
    boca.classList.add("ver");
    clearTimeout(tPose);
    tPose = setTimeout(() => {
      pose = false;
      svg.classList.remove("pose");
      boca.classList.remove("ver");
    }, DURACION_POSE_MS);
    if (raf) {
      enPausa = false;
      destino();
    }
    pincharComun(capas.gritos, def, opciones.grito, opciones.sonido);
  }

  boton.addEventListener("click", pinchar);
  if (!quieto) {
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    raf = requestAnimationFrame(tick);
  }

  return {
    pinchar,
    destruir() {
      cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(tPose);
      cancelarArrebatos();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      boton.removeEventListener("click", pinchar);
      el.remove();
      capas.rastros.textContent = "";
      limpiarGritos(capas.gritos);
    },
  };
}

/**
 * Suelta el monigote por la pantalla. Con movimiento reducido se queda
 * quieto en la esquina inferior izquierda (se puede pinchar igual); si la
 * preferencia cambia con la página abierta, se vuelve a crear.
 */
export function crearSuelto(capas: CapasMonigote, def: DefMonigote, opciones: OpcionesMonigote): ControlSuelto {
  let actual = crearSueltoUnaVez(capas, def, opciones);
  const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
  const alCambiarPreferencia = () => {
    actual.destruir();
    actual = crearSueltoUnaVez(capas, def, opciones);
  };
  consulta.addEventListener("change", alCambiarPreferencia);
  return {
    pinchar: () => actual.pinchar(),
    destruir() {
      consulta.removeEventListener("change", alCambiarPreferencia);
      actual.destruir();
    },
  };
}

// ---------------------------------------------------------------------------
// Tarjeta del selector del admin: la figura anda en su sitio, sin rastro
// ---------------------------------------------------------------------------

export interface ControlTarjeta {
  /** Pose 3 s + bocadillo + grito a pantalla completa (+ sonido si `sonido`). */
  probar(grito: string | null, sonido: boolean): void;
  /** Fuera de pantalla se pausan las animaciones y los arrebatos. */
  ponerVisible(visible: boolean): void;
  destruir(): void;
}

export function montarTarjeta(
  contenedor: HTMLElement,
  capaGritos: HTMLElement,
  def: DefMonigote,
  uid: string,
  tam: number
): ControlTarjeta {
  const figura = document.createElement("div");
  figura.className = "mng-figura";
  const boca = crearBocadillo(def);
  const lienzo = document.createElement("div");
  const svg = insertarFigura(lienzo, def, uid, tam);
  figura.append(boca, lienzo);
  contenedor.appendChild(figura);

  let visible = false;
  let pose = false;
  let tPose: ReturnType<typeof setTimeout> | undefined;
  let tHipo: ReturnType<typeof setTimeout> | undefined;
  let tHipoFin: ReturnType<typeof setTimeout> | undefined;
  contenedor.classList.add("mng-pausado");

  const cancelarArrebatos = programarArrebatos({ def, svg, boca, enPose: () => pose, activo: () => visible });

  const programarHipo = () => {
    tHipo = setTimeout(() => {
      if (visible && !pose && !esMovimientoReducido()) {
        hipar(svg, boca);
        clearTimeout(tHipoFin);
        tHipoFin = setTimeout(() => {
          if (!pose) boca.classList.remove("ver");
        }, 1100);
      }
      programarHipo();
    }, 3500 + Math.random() * 3000);
  };
  if (def.mov === "zigzag") programarHipo();

  return {
    probar(grito, sonido) {
      pose = true;
      svg.classList.add("pose");
      boca.textContent = def.boca;
      boca.classList.add("ver");
      clearTimeout(tPose);
      tPose = setTimeout(() => {
        pose = false;
        svg.classList.remove("pose");
        boca.classList.remove("ver");
      }, DURACION_POSE_MS);
      pincharComun(capaGritos, def, grito, sonido);
    },
    ponerVisible(valor) {
      visible = valor;
      contenedor.classList.toggle("mng-pausado", !valor);
    },
    destruir() {
      clearTimeout(tPose);
      clearTimeout(tHipo);
      clearTimeout(tHipoFin);
      cancelarArrebatos();
      contenedor.classList.remove("mng-pausado");
      figura.remove();
    },
  };
}
