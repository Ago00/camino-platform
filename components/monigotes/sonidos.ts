/**
 * Sonidos de los monigotes (DT-036): Web Audio sintetizado, sin ficheros.
 * Port fiel del módulo `Sonido` del catálogo aprobado, en su versión mejorada
 * para iPhone. Solo se llama desde un clic del usuario (pinchar al monigote o
 * "Probar" en el admin); nunca suena solo.
 *
 * Solo navegador. Importarlo en el servidor es inocuo: nada toca `window`
 * hasta la primera llamada a `tocarSonido`.
 */

import type { IdSonido } from "@/lib/monigotes/catalogo";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
  interface Navigator {
    /** Audio Session API (Safari 16.4+). */
    audioSession?: { type: string };
  }
}

export interface MotorAudio {
  ctx: AudioContext;
  salida: GainNode;
  ruido: AudioBuffer | null;
}

let motor: MotorAudio | null = null;

function obtenerMotor(): MotorAudio | null {
  if (motor) return motor;
  // iPhone en silencio: sin esto Safari calla el Web Audio aunque haya volumen.
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch {
    // no soportado
  }
  const Contexto = window.AudioContext ?? window.webkitAudioContext;
  if (!Contexto) return null;
  const ctx = new Contexto();
  const compresor = ctx.createDynamicsCompressor();
  const salida = ctx.createGain();
  salida.gain.value = 0.6;
  salida.connect(compresor);
  compresor.connect(ctx.destination);
  // Buffer mudo dentro del propio clic: desbloquea el audio en iOS.
  const mudo = ctx.createBufferSource();
  mudo.buffer = ctx.createBuffer(1, 1, 22050);
  mudo.connect(ctx.destination);
  mudo.start(0);
  motor = { ctx, salida, ruido: null };
  return motor;
}

function envolvente(g: GainNode, t: number, ataque: number, pico: number, dur: number, sost?: boolean): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + ataque);
  if (sost) {
    const rel = Math.min(0.09, dur * 0.3);
    g.gain.setValueAtTime(pico, t + Math.max(ataque, dur - rel));
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function filtro(m: MotorAudio, tipo: BiquadFilterType, f: number, q = 1, destino: AudioNode = m.salida): BiquadFilterNode {
  const b = m.ctx.createBiquadFilter();
  b.type = tipo;
  b.frequency.value = f;
  b.Q.value = q;
  b.connect(destino);
  return b;
}

interface OpcionesTono {
  tipo?: OscillatorType;
  f: number;
  fFin?: number;
  /** Rampas lineales de frecuencia: [segundos desde t, hercios]. */
  puntos?: readonly (readonly [number, number])[];
  t: number;
  dur: number;
  vol?: number;
  ataque?: number;
  sost?: boolean;
  destino?: AudioNode;
  /** Vibrato: [frecuencia, profundidad]. */
  vib?: readonly [number, number];
}

function tono(m: MotorAudio, o: OpcionesTono): OscillatorNode {
  const { ctx } = m;
  const os = ctx.createOscillator();
  os.type = o.tipo ?? "sine";
  os.frequency.setValueAtTime(o.f, o.t);
  if (o.fFin) os.frequency.exponentialRampToValueAtTime(o.fFin, o.t + o.dur);
  if (o.puntos) o.puntos.forEach(([dt, f]) => os.frequency.linearRampToValueAtTime(f, o.t + dt));
  const g = ctx.createGain();
  envolvente(g, o.t, o.ataque ?? 0.01, o.vol ?? 0.3, o.dur, o.sost);
  os.connect(g);
  g.connect(o.destino ?? m.salida);
  if (o.vib) {
    const lfo = ctx.createOscillator();
    const lfoGanancia = ctx.createGain();
    lfo.frequency.value = o.vib[0];
    lfoGanancia.gain.value = o.vib[1];
    lfo.connect(lfoGanancia);
    lfoGanancia.connect(os.frequency);
    lfo.start(o.t);
    lfo.stop(o.t + o.dur + 0.05);
  }
  os.start(o.t);
  os.stop(o.t + o.dur + 0.05);
  return os;
}

interface OpcionesRuido {
  t: number;
  dur: number;
  vol?: number;
  ataque?: number;
  sost?: boolean;
  destino?: AudioNode;
}

function ruido(m: MotorAudio, o: OpcionesRuido): void {
  const { ctx } = m;
  if (!m.ruido) {
    m.ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const datos = m.ruido.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = m.ruido;
  const g = ctx.createGain();
  envolvente(g, o.t, o.ataque ?? 0.005, o.vol ?? 0.2, o.dur, o.sost);
  s.connect(g);
  g.connect(o.destino ?? m.salida);
  s.start(o.t, Math.random() * 0.3);
  s.stop(o.t + o.dur + 0.05);
}

function campana(m: MotorAudio, f: number, t: number, dur = 1.8, vol = 1): void {
  const parciales: [number, number, number][] = [
    [1, 0.24, 1],
    [2, 0.11, 0.7],
    [2.76, 0.08, 0.5],
    [5.4, 0.035, 0.3],
  ];
  parciales.forEach(([mult, v, d]) => tono(m, { f: f * mult, t, dur: dur * d, vol: v * vol, ataque: 0.004 }));
}

/** Un sintetizador por sonido del catálogo; `t` es el instante de inicio en el reloj del contexto. */
export const SINTETIZADORES: Record<IdSonido, (m: MotorAudio, t: number) => void> = {
  bocina(m, t) {
    const lp = filtro(m, "lowpass", 2200, 0.7);
    const toques: [number, number][] = [
      [0, 0.16],
      [0.22, 0.16],
      [0.44, 0.55],
    ];
    toques.forEach(([dt, d]) =>
      [311, 392, 466].forEach((f) =>
        tono(m, { tipo: "sawtooth", f, t: t + dt, dur: d, vol: 0.085, ataque: 0.02, sost: true, destino: lp })
      )
    );
  },
  campanas(m, t) {
    campana(m, 784, t);
    campana(m, 587, t + 0.4);
  },
  eructo(m, t) {
    const { ctx } = m;
    const lp = filtro(m, "lowpass", 520, 5);
    const os = ctx.createOscillator();
    os.type = "sawtooth";
    os.frequency.setValueAtTime(96, t);
    os.frequency.linearRampToValueAtTime(70, t + 0.35);
    os.frequency.linearRampToValueAtTime(52, t + 0.8);
    const am = ctx.createGain();
    am.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 23;
    const lfoGanancia = ctx.createGain();
    lfoGanancia.gain.value = 0.45;
    lfo.connect(lfoGanancia);
    lfoGanancia.connect(am.gain);
    const g = ctx.createGain();
    envolvente(g, t, 0.04, 0.9, 0.85, true);
    os.connect(am);
    am.connect(g);
    g.connect(lp);
    os.start(t);
    lfo.start(t);
    os.stop(t + 0.9);
    lfo.stop(t + 0.9);
    ruido(m, { t, dur: 0.7, vol: 0.06, destino: filtro(m, "lowpass", 320, 1), sost: true, ataque: 0.03 });
  },
  bloop(m, t) {
    [0, 0.17, 0.34].forEach((dt, i) =>
      tono(m, { f: 150 + i * 30, fFin: 780 + i * 120, t: t + dt, dur: 0.13, vol: 0.32, ataque: 0.005 })
    );
    tono(m, { f: 220, fFin: 90, t: t + 0.55, dur: 0.18, vol: 0.25 });
  },
  magia(m, t) {
    [1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) =>
      tono(m, { tipo: "triangle", f, t: t + i * 0.055, dur: 0.4, vol: 0.12 })
    );
    tono(m, { f: 4186, t: t + 0.35, dur: 0.5, vol: 0.04, vib: [12, 60] });
    const bp = filtro(m, "bandpass", 1400, 2);
    [0, 1, 2, 3].forEach((i) =>
      tono(m, { tipo: "square", f: 540 - i * 20, fFin: 380, t: t + 0.6 + i * 0.11, dur: 0.08, vol: 0.06, destino: bp })
    );
  },
  gaita(m, t) {
    const lpDron = filtro(m, "lowpass", 850, 0.8);
    tono(m, { tipo: "sawtooth", f: 110, t, dur: 1.8, vol: 0.07, ataque: 0.12, sost: true, destino: lpDron });
    tono(m, { tipo: "sawtooth", f: 220.8, t, dur: 1.8, vol: 0.04, ataque: 0.12, sost: true, destino: lpDron });
    const bp = filtro(m, "bandpass", 1700, 0.9);
    tono(m, { tipo: "sawtooth", f: 1480, fFin: 880, t, dur: 0.18, vol: 0.1, destino: bp, sost: true });
    let tt = t + 0.18;
    const melodia: [number, number][] = [
      [880, 0.15],
      [988, 0.15],
      [1109, 0.3],
      [988, 0.15],
      [880, 0.15],
      [740, 0.15],
      [880, 0.5],
    ];
    melodia.forEach(([f, d]) => {
      tono(m, { tipo: "sawtooth", f, t: tt, dur: d, vol: 0.1, ataque: 0.012, sost: true, destino: bp, vib: [6.5, 9] });
      tt += d;
    });
  },
  muu(m, t) {
    const lp = m.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 7;
    lp.frequency.setValueAtTime(260, t);
    lp.frequency.linearRampToValueAtTime(900, t + 0.35);
    lp.frequency.linearRampToValueAtTime(620, t + 1);
    lp.frequency.linearRampToValueAtTime(300, t + 1.3);
    lp.connect(m.salida);
    tono(m, {
      tipo: "sawtooth",
      f: 150,
      puntos: [
        [0.25, 165],
        [1.3, 118],
      ],
      t,
      dur: 1.35,
      vol: 0.35,
      ataque: 0.15,
      sost: true,
      destino: lp,
      vib: [5, 3],
    });
    tono(m, {
      tipo: "triangle",
      f: 300,
      puntos: [
        [0.25, 330],
        [1.3, 236],
      ],
      t,
      dur: 1.35,
      vol: 0.06,
      ataque: 0.15,
      sost: true,
      destino: lp,
    });
  },
  lluvia(m, t) {
    ruido(m, { t, dur: 1.6, vol: 0.1, destino: filtro(m, "bandpass", 2600, 0.6), sost: true, ataque: 0.2 });
    for (let i = 0; i < 9; i++) {
      const f = 1800 + Math.random() * 1400;
      tono(m, { f, fFin: f * 0.6, t: t + Math.random() * 1.4, dur: 0.04, vol: 0.05 });
    }
    const lp = filtro(m, "lowpass", 700, 1);
    tono(m, { tipo: "triangle", f: 220, puntos: [[0.3, 196]], t: t + 0.3, dur: 0.35, vol: 0.18, sost: true, destino: lp });
    tono(m, { tipo: "triangle", f: 196, puntos: [[0.4, 165]], t: t + 0.78, dur: 0.45, vol: 0.16, sost: true, destino: lp });
  },
  ay(m, t) {
    const bp = filtro(m, "bandpass", 1100, 1.2);
    tono(m, {
      tipo: "sawtooth",
      f: 620,
      puntos: [
        [0.08, 700],
        [0.32, 380],
      ],
      t,
      dur: 0.34,
      vol: 0.2,
      sost: true,
      destino: bp,
      vib: [8, 12],
    });
    tono(m, {
      tipo: "sawtooth",
      f: 720,
      puntos: [
        [0.08, 820],
        [0.4, 420],
      ],
      t: t + 0.44,
      dur: 0.42,
      vol: 0.2,
      sost: true,
      destino: bp,
      vib: [8, 14],
    });
  },
  baston(m, t) {
    [0, 0.26, 0.52].forEach((dt) => {
      tono(m, { f: 230, fFin: 90, t: t + dt, dur: 0.12, vol: 0.45, ataque: 0.002 });
      ruido(m, { t: t + dt, dur: 0.03, vol: 0.12, destino: filtro(m, "bandpass", 2000, 1) });
    });
    tono(m, {
      tipo: "sawtooth",
      f: 110,
      puntos: [
        [0.2, 95],
        [0.4, 105],
        [0.7, 85],
      ],
      t: t + 0.85,
      dur: 0.75,
      vol: 0.12,
      sost: true,
      destino: filtro(m, "lowpass", 450, 1),
      vib: [9, 6],
    });
  },
  chanclas(m, t) {
    const hp = filtro(m, "highpass", 900, 0.7);
    [0, 0.2, 0.4, 0.6].forEach((dt) => ruido(m, { t: t + dt, dur: 0.07, vol: 0.38, destino: hp, ataque: 0.002 }));
    tono(m, { f: 300, puntos: [[0.3, 540]], t: t + 0.85, dur: 0.32, vol: 0.2, sost: true });
  },
  botafumeiro(m, t) {
    const bp = m.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.linearRampToValueAtTime(1400, t + 0.65);
    bp.frequency.linearRampToValueAtTime(300, t + 1.3);
    bp.connect(m.salida);
    ruido(m, { t, dur: 1.3, vol: 0.28, destino: bp, sost: true, ataque: 0.3 });
    campana(m, 196, t + 0.1, 2.6, 0.9);
  },
  // silbido «¡fiu-fiuuu!» + brochazo
  flecha(m, t) {
    tono(m, { f: 1100, puntos: [[0.12, 1750]], t, dur: 0.16, vol: 0.15, sost: true });
    tono(m, {
      f: 1000,
      puntos: [
        [0.1, 1900],
        [0.45, 1450],
      ],
      t: t + 0.24,
      dur: 0.5,
      vol: 0.15,
      sost: true,
      vib: [7, 22],
    });
    ruido(m, { t: t + 0.82, dur: 0.22, vol: 0.12, destino: filtro(m, "bandpass", 3000, 1.5), ataque: 0.06 });
  },
  // golpe de granito + cuenta atrás
  mojon(m, t) {
    tono(m, { tipo: "triangle", f: 140, fFin: 55, t, dur: 0.3, vol: 0.5, ataque: 0.003 });
    ruido(m, { t, dur: 0.08, vol: 0.18, destino: filtro(m, "lowpass", 900, 1) });
    const lp = filtro(m, "lowpass", 2500, 0.7);
    [0, 1, 2].forEach((i) =>
      tono(m, { tipo: "square", f: 880 - i * 110, t: t + 0.4 + i * 0.16, dur: 0.1, vol: 0.07, destino: lp })
    );
  },
  // glissando lentísimo y viscoso
  caracol(m, t) {
    tono(m, { f: 700, puntos: [[1.6, 180]], t, dur: 1.7, vol: 0.17, ataque: 0.2, sost: true, vib: [3, 25] });
    ruido(m, { t: t + 0.1, dur: 1.4, vol: 0.07, destino: filtro(m, "bandpass", 600, 3), ataque: 0.3, sost: true });
    [0.5, 1.1].forEach((dt) => tono(m, { f: 240, fFin: 120, t: t + dt, dur: 0.12, vol: 0.14 }));
  },
  // ¡pum, pum! + ding
  sello(m, t) {
    const bp = filtro(m, "bandpass", 1200, 0.8);
    [0, 0.3].forEach((dt) => {
      tono(m, { tipo: "triangle", f: 160, fFin: 60, t: t + dt, dur: 0.14, vol: 0.5, ataque: 0.002 });
      ruido(m, { t: t + dt, dur: 0.05, vol: 0.25, destino: bp, ataque: 0.001 });
    });
    campana(m, 1318, t + 0.66, 0.9, 0.7);
  },
  // chisporroteo + llamarada + «¡ay!»
  pimiento(m, t) {
    ruido(m, { t, dur: 0.9, vol: 0.06, destino: filtro(m, "highpass", 4000, 0.7), sost: true, ataque: 0.02 });
    const hp = filtro(m, "highpass", 2500, 1);
    for (let i = 0; i < 10; i++) ruido(m, { t: t + Math.random() * 0.8, dur: 0.012, vol: 0.12, destino: hp, ataque: 0.001 });
    const bp = m.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t + 0.2);
    bp.frequency.exponentialRampToValueAtTime(2200, t + 0.8);
    bp.connect(m.salida);
    ruido(m, { t: t + 0.2, dur: 0.8, vol: 0.35, destino: bp, ataque: 0.08, sost: true });
    tono(m, {
      tipo: "sawtooth",
      f: 900,
      puntos: [
        [0.15, 1400],
        [0.35, 700],
      ],
      t: t + 0.95,
      dur: 0.38,
      vol: 0.09,
      sost: true,
      destino: filtro(m, "bandpass", 1500, 1.5),
      vib: [10, 30],
    });
  },
  // espolvoreo de azúcar + «mmm»
  tarta(m, t) {
    [2637, 2349, 2093, 1760, 1568, 1319].forEach((f, i) =>
      tono(m, { f, t: t + i * 0.07 + Math.random() * 0.02, dur: 0.25, vol: 0.06 })
    );
    ruido(m, { t, dur: 0.6, vol: 0.05, destino: filtro(m, "highpass", 6000, 0.7), ataque: 0.05 });
    tono(m, {
      tipo: "triangle",
      f: 196,
      puntos: [
        [0.25, 220],
        [0.6, 185],
      ],
      t: t + 0.55,
      dur: 0.65,
      vol: 0.16,
      ataque: 0.06,
      sost: true,
      destino: filtro(m, "lowpass", 600, 1),
      vib: [5, 4],
    });
  },
  // chisporroteo, ¡zas! y plaf
  tortilla(m, t) {
    ruido(m, { t, dur: 0.5, vol: 0.06, destino: filtro(m, "highpass", 3500, 0.7), sost: true });
    const bp = m.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(400, t + 0.35);
    bp.frequency.exponentialRampToValueAtTime(2500, t + 0.6);
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.85);
    bp.connect(m.salida);
    ruido(m, { t: t + 0.35, dur: 0.5, vol: 0.3, destino: bp, ataque: 0.1 });
    tono(m, { f: 180, fFin: 70, t: t + 0.95, dur: 0.16, vol: 0.45, ataque: 0.003 });
    ruido(m, { t: t + 0.95, dur: 0.09, vol: 0.2, destino: filtro(m, "lowpass", 1200, 1) });
  },
  // lluvia de granos + tripas
  horreo(m, t) {
    const bp = filtro(m, "bandpass", 3200, 2);
    for (let i = 0; i < 18; i++) {
      ruido(m, {
        t: t + Math.pow(Math.random(), 0.7) * 0.9,
        dur: 0.015,
        vol: 0.15 + Math.random() * 0.1,
        destino: bp,
        ataque: 0.001,
      });
    }
    tono(m, {
      tipo: "sawtooth",
      f: 70,
      puntos: [
        [0.4, 95],
        [0.9, 60],
      ],
      t: t + 0.85,
      dur: 1,
      vol: 0.35,
      ataque: 0.1,
      sost: true,
      destino: filtro(m, "lowpass", 260, 4),
      vib: [11, 18],
    });
  },
  // ronquido + sobresalto «¡¿eh?!»
  roncador(m, t) {
    tono(m, {
      tipo: "sawtooth",
      f: 58,
      puntos: [[0.9, 52]],
      t,
      dur: 1,
      vol: 0.35,
      ataque: 0.25,
      sost: true,
      destino: filtro(m, "lowpass", 380, 3),
      vib: [26, 6],
    });
    ruido(m, { t, dur: 1, vol: 0.08, destino: filtro(m, "lowpass", 700, 1), ataque: 0.3, sost: true });
    ruido(m, { t: t + 1.05, dur: 0.35, vol: 0.06, destino: filtro(m, "bandpass", 2400, 1), ataque: 0.15 });
    tono(m, {
      tipo: "sawtooth",
      f: 320,
      puntos: [[0.18, 900]],
      t: t + 1.45,
      dur: 0.3,
      vol: 0.12,
      sost: true,
      destino: filtro(m, "bandpass", 1300, 1.3),
    });
  },
  // dos ladridos
  perro(m, t) {
    [0, 0.26].forEach((dt) => {
      tono(m, {
        tipo: "sawtooth",
        f: 520,
        puntos: [
          [0.03, 600],
          [0.14, 300],
        ],
        t: t + dt,
        dur: 0.16,
        vol: 0.35,
        ataque: 0.005,
        destino: filtro(m, "bandpass", 900, 1.4),
      });
      ruido(m, { t: t + dt, dur: 0.1, vol: 0.16, destino: filtro(m, "bandpass", 1500, 1), ataque: 0.003 });
    });
  },
};

/**
 * Toca el sonido indicado. Si el contexto sigue dormido (primer clic), se
 * programa al despertar: si no, el primer sonido se perdía. Cualquier fallo
 * del audio se ignora: el sonido es un adorno.
 */
export function tocarSonido(id: IdSonido): void {
  try {
    const m = obtenerMotor();
    if (!m) return;
    const sonar = () => {
      try {
        SINTETIZADORES[id](m, m.ctx.currentTime + 0.03);
      } catch {
        // sin audio
      }
    };
    if (m.ctx.state === "running") sonar();
    else m.ctx.resume().then(sonar, () => undefined);
  } catch {
    // sin audio
  }
}
