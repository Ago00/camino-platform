/**
 * Catálogo de monigotes que pueden pasear por la web pública de un reto
 * (DT-036). Port fiel del catálogo aprobado por el usuario
 * (design-sandbox/public/monigotes-tematicos.html, constante MONIGOTES).
 *
 * Puro y sin DOM: lo usan el servidor (validación de la acción, lectura del
 * reto) y el navegador (motor, selector). El dibujo vive en `figuras.ts`, los
 * rastros en `marcas.ts` y el sonido en components/monigotes/sonidos.ts; aquí
 * solo hay datos.
 */

export const IDS_MONIGOTE = [
  "atleti",
  "peregrino",
  "borrachillo",
  "pulpo",
  "meiga",
  "gaiteiro",
  "vaca",
  "gallego",
  "cojo",
  "abuelo",
  "guiri",
  "botafumeiro",
  "flecha",
  "mojon",
  "caracol",
  "sello",
  "pimiento",
  "tarta",
  "tortilla",
  "horreo",
  "roncador",
  "perro",
] as const;

export type IdMonigote = (typeof IDS_MONIGOTE)[number];

/** Cómo se desplaza el monigote suelto por la pantalla. */
export type MovimientoMonigote = "andar" | "zigzag" | "vuelo" | "reptar" | "saltos" | "voltereta" | "pendulo";

export const ENTRADAS_GRITO = [
  "estallido",
  "tambaleo",
  "remolino",
  "lento",
  "rebote",
  "temblor",
  "pendulo",
  "volteo",
  "desliza",
  "estampa",
] as const;

/** Animación de entrada del grito a pantalla completa (clase `e-<entrada>` del CSS). */
export type EntradaGrito = (typeof ENTRADAS_GRITO)[number];

export type TipoParticula =
  | "burbuja"
  | "estrella"
  | "nota"
  | "gota"
  | "humo"
  | "tinta"
  | "interrogacion"
  | "flecha"
  | "piedra"
  | "sello"
  | "llama"
  | "azucar"
  | "patata"
  | "maiz"
  | "zeta"
  | "huella";

export type IdMarca =
  | "bota"
  | "botaPeregrino"
  | "botaBorracho"
  | "tinta"
  | "estrella"
  | "nota"
  | "pezuna"
  | "charco"
  | "tirita"
  | "abuelo"
  | "chancla"
  | "humo"
  | "flecha"
  | "piedra"
  | "baba"
  | "sello"
  | "pimiento"
  | "azucar"
  | "migas"
  | "maiz"
  | "zeta"
  | "huella";

export type IdSonido =
  | "bocina"
  | "campanas"
  | "eructo"
  | "bloop"
  | "magia"
  | "gaita"
  | "muu"
  | "lluvia"
  | "ay"
  | "baston"
  | "chanclas"
  | "botafumeiro"
  | "flecha"
  | "mojon"
  | "caracol"
  | "sello"
  | "pimiento"
  | "tarta"
  | "tortilla"
  | "horreo"
  | "roncador"
  | "perro";

/**
 * Rastro que deja al andar. Distancias en px de pantalla y tiempos en ms.
 * `flotar`: [desplazamiento vertical, escala final] para rastros que suben o
 * caen (notas, humo, zetas). `nopose`: no deja rastro mientras está enfadado.
 */
export interface RastroMonigote {
  marca: IdMarca;
  rotar: boolean;
  alterna: boolean;
  sep: number;
  min: number;
  vida: number;
  flotar?: readonly [number, number];
  jitter?: number;
  disperso?: number;
  nopose?: boolean;
}

/** Familia tipográfica del grito: serif = Fraunces (next/font), sans = la del sistema. */
export type FuenteGrito = "serif" | "sans";

export interface EstiloGrito {
  /** [color, borde] por línea; si hay más líneas que pares, se repiten en ciclo. */
  lineas: readonly (readonly [string, string])[];
  fuente: FuenteGrito;
  italica: boolean;
  peso: number;
  trazo: number;
  mayus: boolean;
  entrada: EntradaGrito;
  particula: { tipo: TipoParticula; colores: readonly string[] } | null;
}

/** Arrebato espontáneo (el pimiento que de pronto pica). Nunca suena: solo el clic suena. */
export interface ArrebatoMonigote {
  clase: string;
  cada: readonly [number, number];
  dura: number;
  boca: string;
}

export interface DefMonigote {
  id: IdMonigote;
  nombre: string;
  sub: string;
  acento: string;
  /** Grito por defecto a pantalla completa al pincharlo. */
  grito: string;
  /** Texto del bocadillo. */
  boca: string;
  mov: MovimientoMonigote;
  /** Velocidad base en px/s. */
  vel: number;
  /** Multiplicador de velocidad mientras está enfadado. */
  mult: number;
  /** Los lentos (caracol, roncador) solo van a destinos a esta distancia como mucho. */
  radio?: number;
  /** Figura que flota (meiga): en la tarjeta se pinta más alta. */
  alto?: boolean;
  rastro: RastroMonigote;
  estilo: EstiloGrito;
  sonido: IdSonido;
  arrebato?: ArrebatoMonigote;
  /** El grito por defecto sale del contador de kilómetros (mojón): «¡Quedan N!». */
  gritoVivo?: boolean;
}

type OpcionesEstilo = Partial<Omit<EstiloGrito, "lineas">>;

function estilo(lineas: EstiloGrito["lineas"], opciones: OpcionesEstilo = {}): EstiloGrito {
  return {
    lineas,
    fuente: "serif",
    italica: true,
    peso: 800,
    trazo: 2.5,
    mayus: false,
    entrada: "estallido",
    particula: null,
    ...opciones,
  };
}

export const MONIGOTES: Record<IdMonigote, DefMonigote> = {
  atleti: {
    id: "atleti",
    nombre: "Atleti",
    sub: "El actual · rojiblanco",
    acento: "#CE2029",
    grito: "¡AUPA ATLETI!",
    boca: "!",
    mov: "andar",
    vel: 38,
    mult: 3.2,
    sonido: "bocina",
    rastro: { marca: "bota", rotar: true, alterna: true, sep: 4, min: 14, vida: 3200 },
    estilo: estilo([
      ["#CE2029", "#fff"],
      ["#fff", "#CE2029"],
    ]),
  },
  peregrino: {
    id: "peregrino",
    nombre: "Peregrino clásico",
    sub: "Bordón y esclavina",
    acento: "#8A5A34",
    grito: "¡Buen Camino!",
    boca: "¡Ultreia!",
    mov: "andar",
    vel: 34,
    mult: 2.6,
    sonido: "campanas",
    rastro: { marca: "botaPeregrino", rotar: true, alterna: true, sep: 4, min: 14, vida: 3200 },
    estilo: estilo(
      [
        ["#2F5D50", "#fff"],
        ["#C9A24B", "#1B211D"],
      ],
      { trazo: 2.2, particula: { tipo: "estrella", colores: ["#C9A24B", "#D9773B"] } }
    ),
  },
  borrachillo: {
    id: "borrachillo",
    nombre: "Borrachillo",
    sub: "Con bota de vino",
    acento: "#8E2A3E",
    grito: "¡BUUURP!",
    boca: "¡hic!",
    mov: "zigzag",
    vel: 26,
    mult: 3,
    sonido: "eructo",
    rastro: { marca: "botaBorracho", rotar: true, alterna: true, sep: 5, min: 12, vida: 3400, jitter: 40, disperso: 3 },
    estilo: estilo([["#7B1E3A", "#fff"]], {
      fuente: "sans",
      italica: false,
      peso: 900,
      trazo: 3,
      entrada: "tambaleo",
      particula: { tipo: "burbuja", colores: ["#7FB0C6", "#A9CFE0", "#E4C9A0"] },
    }),
  },
  pulpo: {
    id: "pulpo",
    nombre: "Pulpo peregrino",
    sub: "Ocho tentáculos",
    acento: "#C8452F",
    grito: "¡Á feira!",
    boca: "¡Glup!",
    mov: "andar",
    vel: 30,
    mult: 3,
    sonido: "bloop",
    rastro: { marca: "tinta", rotar: false, alterna: true, sep: 4, min: 11, vida: 3800, disperso: 2 },
    estilo: estilo(
      [
        ["#C8452F", "#F7E7C6"],
        ["#F7E7C6", "#C8452F"],
      ],
      { particula: { tipo: "tinta", colores: ["#2B2B3A"] } }
    ),
  },
  meiga: {
    id: "meiga",
    nombre: "Meiga en escoba",
    sub: "Vuela, no anda",
    acento: "#5B3A8C",
    grito: "¡Haberlas, hailas!",
    boca: "¡Je, je!",
    mov: "vuelo",
    vel: 62,
    mult: 2.4,
    alto: true,
    sonido: "magia",
    rastro: { marca: "estrella", rotar: false, alterna: false, sep: 0, min: 8, vida: 1600, flotar: [10, 0.3], disperso: 7 },
    estilo: estilo(
      [
        ["#5B3A8C", "#fff"],
        ["#C9A24B", "#2E1B45"],
      ],
      { peso: 700, entrada: "remolino", particula: { tipo: "estrella", colores: ["#C9A24B", "#B79BE0", "#fff"] } }
    ),
  },
  gaiteiro: {
    id: "gaiteiro",
    nombre: "Gaiteiro",
    sub: "Con monteira",
    acento: "#2F5D50",
    grito: "¡Fiiiiiu!",
    boca: "♪",
    mov: "andar",
    vel: 32,
    mult: 2.6,
    sonido: "gaita",
    rastro: { marca: "nota", rotar: false, alterna: false, sep: 0, min: 16, vida: 2400, flotar: [-26, 1.2], disperso: 8 },
    estilo: estilo([["#2F5D50", "#fff"]], {
      particula: { tipo: "nota", colores: ["#2F5D50", "#D9773B", "#C9A24B"] },
    }),
  },
  vaca: {
    id: "vaca",
    nombre: "Vaca rubia gallega",
    sub: "Con cencerro",
    acento: "#C98A4B",
    grito: "¡Muuu!",
    boca: "¡Mu!",
    mov: "andar",
    vel: 24,
    mult: 3,
    sonido: "muu",
    rastro: { marca: "pezuna", rotar: true, alterna: true, sep: 5, min: 12, vida: 3400 },
    estilo: estilo([["#B8732F", "#fff"]], { fuente: "sans", italica: false, peso: 900, trazo: 3, mayus: true }),
  },
  gallego: {
    id: "gallego",
    nombre: "Gallego con paraguas",
    sub: "Siempre le llueve",
    acento: "#3E6E85",
    grito: "Depende…",
    boca: "…",
    mov: "andar",
    vel: 32,
    mult: 2.6,
    sonido: "lluvia",
    rastro: { marca: "charco", rotar: false, alterna: true, sep: 3, min: 14, vida: 3600 },
    estilo: estilo([["#3E6E85", "#fff"]], {
      peso: 400,
      trazo: 1.5,
      entrada: "lento",
      particula: { tipo: "gota", colores: ["#6F97B4", "#9EC1D9"] },
    }),
  },
  cojo: {
    id: "cojo",
    nombre: "Peregrino con ampollas",
    sub: "A la pata coja",
    acento: "#D9773B",
    grito: "¡Ay mis pies!",
    boca: "¡Ay!",
    mov: "andar",
    vel: 28,
    mult: 2.4,
    sonido: "ay",
    rastro: { marca: "tirita", rotar: true, alterna: false, sep: 0, min: 16, vida: 3200 },
    estilo: estilo(
      [
        ["#D9773B", "#fff"],
        ["#A9521F", "#fff"],
      ],
      { italica: false, entrada: "rebote", particula: { tipo: "gota", colores: ["#8EC3E0"] } }
    ),
  },
  abuelo: {
    id: "abuelo",
    nombre: "Abuelo con boina",
    sub: "Lento pero seguro",
    acento: "#5A4632",
    grito: "¡En mis tiempos esto se hacía descalzo!",
    boca: "¡Hum!",
    mov: "andar",
    vel: 18,
    mult: 1.8,
    sonido: "baston",
    rastro: { marca: "abuelo", rotar: true, alterna: true, sep: 3.5, min: 10, vida: 4200 },
    estilo: estilo(
      [
        ["#5A4632", "#F4ECDD"],
        ["#8A6A2E", "#F4ECDD"],
      ],
      { italica: false, peso: 700, trazo: 2, entrada: "temblor" }
    ),
  },
  guiri: {
    id: "guiri",
    nombre: "Guiri",
    sub: "Chanclas y calcetines",
    acento: "#3FA7B5",
    grito: "Where is the bar?",
    boca: "Sorry?",
    mov: "andar",
    vel: 36,
    mult: 2.8,
    sonido: "chanclas",
    rastro: { marca: "chancla", rotar: true, alterna: true, sep: 4, min: 14, vida: 3200 },
    estilo: estilo(
      [
        ["#1F4E9C", "#fff"],
        ["#E23B3B", "#fff"],
      ],
      { fuente: "sans", peso: 900, entrada: "volteo", particula: { tipo: "interrogacion", colores: ["#1F4E9C", "#E23B3B"] } }
    ),
  },
  botafumeiro: {
    id: "botafumeiro",
    nombre: "Botafumeiro",
    sub: "Péndulo con humo",
    acento: "#C9A24B",
    grito: "¡Ultreia!",
    boca: "¡Suseia!",
    mov: "pendulo",
    vel: 30,
    mult: 2.4,
    sonido: "botafumeiro",
    rastro: { marca: "humo", rotar: false, alterna: false, sep: 0, min: 7, vida: 2200, flotar: [-18, 2.2] },
    estilo: estilo([["#C9A24B", "#1B211D"]], {
      entrada: "pendulo",
      particula: { tipo: "humo", colores: ["#CFCFCF", "#E4E4E4"] },
    }),
  },
  flecha: {
    id: "flecha",
    nombre: "Flecha amarilla",
    sub: "Pintada y con brocha",
    acento: "#E0A800",
    grito: "¡Por aquí!",
    boca: "¡Sígueme!",
    mov: "andar",
    vel: 40,
    mult: 3,
    sonido: "flecha",
    rastro: { marca: "flecha", rotar: true, alterna: false, sep: 0, min: 20, vida: 3400 },
    estilo: estilo([["#F4C21F", "#1B211D"]], {
      fuente: "sans",
      peso: 900,
      trazo: 2.5,
      entrada: "desliza",
      particula: { tipo: "flecha", colores: ["#F4C21F", "#E0A800"] },
    }),
  },
  mojon: {
    id: "mojon",
    nombre: "Mojón",
    sub: "Granito con placa",
    acento: "#1F4E9C",
    grito: "¡Quedan 100!",
    boca: "¡Ánimo!",
    mov: "andar",
    vel: 22,
    mult: 2.4,
    sonido: "mojon",
    gritoVivo: true,
    rastro: { marca: "piedra", rotar: false, alterna: true, sep: 3, min: 13, vida: 3400, disperso: 3 },
    estilo: estilo(
      [
        ["#1F4E9C", "#fff"],
        ["#F4C21F", "#1B211D"],
      ],
      {
        fuente: "sans",
        italica: false,
        peso: 900,
        trazo: 2.5,
        mayus: true,
        entrada: "temblor",
        particula: { tipo: "piedra", colores: ["#AEADA5", "#8F8E86"] },
      }
    ),
  },
  caracol: {
    id: "caracol",
    nombre: "Caracol peregrino",
    sub: "Concha de vieira",
    acento: "#A8743A",
    grito: "¡Sin prisa!",
    boca: "Tranqui…",
    mov: "reptar",
    vel: 7,
    mult: 1.6,
    radio: 120,
    sonido: "caracol",
    rastro: { marca: "baba", rotar: true, alterna: false, sep: 0, min: 3, vida: 7000 },
    estilo: estilo([["#7A9A5A", "#fff"]], {
      peso: 500,
      trazo: 1.5,
      entrada: "lento",
      particula: { tipo: "gota", colores: ["#A9D3E4", "#CFE6D8"] },
    }),
  },
  sello: {
    id: "sello",
    nombre: "Sello de la credencial",
    sub: "A saltos",
    acento: "#B8323A",
    grito: "¡Sellooo!",
    boca: "¡Pum!",
    mov: "saltos",
    vel: 34,
    mult: 2.6,
    sonido: "sello",
    rastro: { marca: "sello", rotar: true, alterna: false, sep: 0, min: 24, vida: 4200, jitter: 30 },
    estilo: estilo(
      [
        ["#B8323A", "#fff"],
        ["#2E4F9A", "#fff"],
      ],
      {
        fuente: "sans",
        italica: false,
        peso: 900,
        trazo: 3,
        mayus: true,
        entrada: "estampa",
        particula: { tipo: "sello", colores: ["#B8323A", "#2E4F9A", "#6B3A8C"] },
      }
    ),
  },
  pimiento: {
    id: "pimiento",
    nombre: "Pimiento de Padrón",
    sub: "Unos pican…",
    acento: "#3E8E3A",
    grito: "¡Unos pican y otros no!",
    boca: "¡Pica!",
    mov: "andar",
    vel: 34,
    mult: 3,
    sonido: "pimiento",
    arrebato: { clase: "pica", cada: [3500, 5000], dura: 1600, boca: "¡Ay, pica!" },
    rastro: { marca: "pimiento", rotar: true, alterna: true, sep: 3.5, min: 12, vida: 3000 },
    estilo: estilo(
      [
        ["#3E8E3A", "#fff"],
        ["#D8322A", "#FFE08A"],
      ],
      { fuente: "sans", peso: 900, particula: { tipo: "llama", colores: ["#F28A1F", "#D8322A"] } }
    ),
  },
  tarta: {
    id: "tarta",
    nombre: "Tarta de Santiago",
    sub: "Con cruz de azúcar",
    acento: "#D29A4E",
    grito: "¡Con azúcar glas!",
    boca: "¡Mmm!",
    mov: "andar",
    vel: 28,
    mult: 2.4,
    sonido: "tarta",
    rastro: { marca: "azucar", rotar: false, alterna: false, sep: 0, min: 8, vida: 3000, disperso: 8 },
    estilo: estilo([["#D9A45A", "#fff"]], {
      peso: 800,
      particula: { tipo: "azucar", colores: ["#FFFFFF", "#FBF7EE"] },
    }),
  },
  tortilla: {
    id: "tortilla",
    nombre: "Tortilla de patatas",
    sub: "Vuelta y vuelta",
    acento: "#E3A845",
    grito: "¿Con cebolla o sin?",
    boca: "¡Hop!",
    mov: "voltereta",
    vel: 32,
    mult: 2.8,
    sonido: "tortilla",
    rastro: { marca: "migas", rotar: false, alterna: false, sep: 0, min: 10, vida: 3200, disperso: 7 },
    estilo: estilo(
      [
        ["#F2C75C", "#6B3A1E"],
        ["#6B3A1E", "#F2C75C"],
      ],
      { entrada: "volteo", particula: { tipo: "patata", colores: ["#F6CF6A", "#E3A845"] } }
    ),
  },
  horreo: {
    id: "horreo",
    nombre: "Hórreo",
    sub: "Con tornarratos",
    acento: "#8A6A3E",
    grito: "¡Qué hambre!",
    boca: "¡Ñam!",
    mov: "andar",
    vel: 20,
    mult: 2.4,
    sonido: "horreo",
    rastro: { marca: "maiz", rotar: false, alterna: false, sep: 0, min: 8, vida: 3400, disperso: 10 },
    estilo: estilo(
      [
        ["#8A6A3E", "#F4ECDD"],
        ["#F2C230", "#5B3A22"],
      ],
      { italica: false, peso: 800, entrada: "rebote", particula: { tipo: "maiz", colores: ["#F2C230", "#E0A800"] } }
    ),
  },
  roncador: {
    id: "roncador",
    nombre: "Roncador de albergue",
    sub: "Saco de dormir",
    acento: "#34405E",
    grito: "¡¿Quién ha encendido la luz?!",
    boca: "¡¿Eh?!",
    mov: "reptar",
    vel: 11,
    mult: 2,
    radio: 160,
    sonido: "roncador",
    rastro: {
      marca: "zeta",
      rotar: false,
      alterna: false,
      sep: 0,
      min: 12,
      vida: 2600,
      flotar: [-24, 1.6],
      disperso: 4,
      nopose: true,
    },
    estilo: estilo(
      [
        ["#34405E", "#fff"],
        ["#F4C21F", "#1B211D"],
      ],
      { fuente: "sans", peso: 900, particula: { tipo: "zeta", colores: ["#3E6E85", "#5B3A8C"] } }
    ),
  },
  perro: {
    id: "perro",
    nombre: "Perro peregrino",
    sub: "Con alforjas",
    acento: "#B9824A",
    grito: "¡Guau!",
    boca: "¡Guau!",
    mov: "andar",
    vel: 44,
    mult: 3.2,
    sonido: "perro",
    rastro: { marca: "huella", rotar: true, alterna: true, sep: 3, min: 11, vida: 3200 },
    estilo: estilo([["#8A5A2E", "#fff"]], {
      fuente: "sans",
      italica: false,
      peso: 900,
      trazo: 3,
      mayus: true,
      entrada: "rebote",
      particula: { tipo: "huella", colores: ["#8E5A2E", "#B9824A"] },
    }),
  },
};

export function esIdMonigote(valor: unknown): valor is IdMonigote {
  return IDS_MONIGOTE.some((id) => id === valor);
}
