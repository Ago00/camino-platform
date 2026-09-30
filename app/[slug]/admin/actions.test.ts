/**
 * Tests del aislamiento por reto de las server actions del panel admin
 * (FP2.5, DT-028), con el cliente Supabase mockado.
 *
 * El builder falso registra cada llamada encadenada (tabla, método,
 * argumentos) para poder comprobar que las escrituras quedan acotadas al
 * reto del slug: filas con `reto_id` propio se filtran por él además de por
 * `id`, y las que cuelgan de un intento se filtran por el intento activo del
 * reto. Reto, hash de la credencial, cookies y `revalidatePath` se mockean;
 * la sesión se firma y verifica con el código real (FP2.6, DT-029) para
 * comprobar que una sesión de otro reto o de una contraseña anterior no
 * llega a escribir nada.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reto } from "@/lib/types";

const RETO: Reto = {
  id: 3,
  slug: "reto-de-prueba",
  nombre: "Reto de prueba",
  descripcion: null,
  ruta_tipo: "predefinida",
  ruta_id: "portuguesa-110",
  activo: true,
  seccion_intenciones: true,
  seccion_comentarios: true,
  seccion_minuto_a_minuto: true,
  seccion_instagram: true,
  respuestas_visitantes: true,
  peregrino_animado: true,
  quien_camina_foto_url: null,
  created_at: "2026-09-01T00:00:00.000Z",
};

interface LlamadaBuilder {
  tabla: string;
  metodo: string;
  args: unknown[];
}

let llamadas: LlamadaBuilder[] = [];
let intentoActivoMock: { id: number; fase?: "antes" | "durante" | "llegada" } | null = null;
let padreMock: { reto_id: number; parent_id: number | null; visibilidad: "publico" | "privado"; oculto: boolean } | null =
  null;
let nombreCaminanteMock = "Santi";
/** Entrada del minuto a minuto ya publicada con la clave consultada (DT-033). */
let entradaConClaveMock: { id: number } | null = null;
/** Error con el que resuelve cualquier consulta awaited (no `maybeSingle`). */
let errorAlResolverMock: { message: string; code?: string } | null = null;
/** Filas con las que resuelve cualquier consulta awaited (p. ej. `update(...).select("id")`). */
let filasAlResolverMock: { id: number }[] | null = null;
const RETO_B: Reto = { ...RETO, id: 4, slug: "otro-reto" };
const RETOS_POR_SLUG = new Map([RETO, RETO_B].map((reto) => [reto.slug, reto]));
// Solo se usa su huella: no hace falta un hash scrypt real.
const HASH_RETO = "scrypt$16384$8$1$saltDeTest$hashDeTestDelReto";
const HASH_RETO_B = "scrypt$16384$8$1$saltDeTest$hashDeTestDelRetoB";

let cookieMock: string | undefined;
let hashesMock: Map<number, string>;

/**
 * Builder encadenable que registra todas las llamadas. `maybeSingle()` sobre
 * `intentos` devuelve el intento activo simulado; cualquier otra consulta,
 * al hacer `await`, resuelve sin error.
 */
function crearConsulta(tabla: string) {
  const consulta = {
    select: (...args: unknown[]) => registrar("select", args),
    update: (...args: unknown[]) => registrar("update", args),
    delete: (...args: unknown[]) => registrar("delete", args),
    upsert: (...args: unknown[]) => registrar("upsert", args),
    insert: (...args: unknown[]) => registrar("insert", args),
    eq: (...args: unknown[]) => registrar("eq", args),
    maybeSingle: () => {
      llamadas.push({ tabla, metodo: "maybeSingle", args: [] });
      const datosPorTabla: Record<string, unknown> = {
        intentos: intentoActivoMock,
        comentarios: padreMock,
        minuto_a_minuto: entradaConClaveMock,
      };
      return Promise.resolve({ data: datosPorTabla[tabla] ?? null, error: null });
    },
    then: (
      resolver: (valor: { data: { id: number }[] | null; error: { message: string; code?: string } | null }) => void
    ) => resolver({ data: filasAlResolverMock, error: errorAlResolverMock }),
  };
  function registrar(metodo: string, args: unknown[]) {
    llamadas.push({ tabla, metodo, args });
    return consulta;
  }
  return consulta;
}

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: (tabla: string) => crearConsulta(tabla) }),
}));

vi.mock("@/lib/supabase/retos", () => ({
  obtenerRetoPorSlug: async (slug: string) => RETOS_POR_SLUG.get(slug) ?? null,
}));

vi.mock("@/lib/supabase/credenciales-admin", () => ({
  obtenerHashAdmin: async (retoId: number) => hashesMock.get(retoId) ?? null,
}));

const asignarTokenGpsNuevoSpy = vi.fn<(retoId: number) => Promise<boolean>>();
vi.mock("@/lib/supabase/credenciales-gps", () => ({
  asignarTokenGpsNuevo: (retoId: number) => asignarTokenGpsNuevoSpy(retoId),
}));

vi.mock("@/lib/textos/obtener-textos", () => ({
  obtenerTextos: async () => ({ quien_camina_nombre: nombreCaminanteMock }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieMock === undefined ? undefined : { value: cookieMock }),
    delete: () => undefined,
  }),
}));

const revalidatePathSpy = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (ruta: string) => revalidatePathSpy(ruta),
}));

// Subida y borrado simulados; `rutaObjetoDelReto` es la real (es la guarda
// que decide qué se borra, y es justo lo que hay que comprobar).
const subirFotoQuienCaminaSpy = vi.fn();
const subirFotoMinutoAMinutoSpy = vi.fn();
const borrarObjetoSpy = vi.fn();
vi.mock("@/lib/supabase/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/supabase/storage")>();
  return {
    ...real,
    subirFotoQuienCamina: (foto: File, retoId: number) => subirFotoQuienCaminaSpy(foto, retoId),
    subirFotoMinutoAMinuto: (foto: File) => subirFotoMinutoAMinutoSpy(foto),
    borrarObjeto: (ruta: string) => borrarObjetoSpy(ruta),
  };
});

// crearMinutoAMinuto toma la última posición del progreso; aquí da igual cuál.
vi.mock("@/lib/traza/progreso-actual", () => ({
  calcularProgresoActual: async () => ({ ultimaPosicion: null }),
}));

// La sesión se firma y verifica con el código real (admin-session +
// huellaCredencial): así los tests cubren el cruce de retos y el cambio de
// contraseña de extremo a extremo dentro de la acción.
const { crearSesion } = await import("@/lib/auth/admin-session");
const { huellaCredencial } = await import("@/lib/auth/password");

const {
  crearMinutoAMinuto,
  descartarPosicion,
  eliminarComentario,
  eliminarIntencion,
  eliminarMinutoAMinuto,
  guardarConfiguracion,
  guardarFotoQuienCamina,
  guardarInstagram,
  guardarTexto,
  iniciarReto,
  mostrarComentario,
  ocultarComentario,
  regenerarTokenGps,
  resetearContadorTrafico,
  responderComentario,
} = await import("@/app/[slug]/admin/actions");

function llamadasA(tabla: string, metodo: string): unknown[][] {
  return llamadas.filter((l) => l.tabla === tabla && l.metodo === metodo).map((l) => l.args);
}

function escriturasEnBd(): LlamadaBuilder[] {
  return llamadas.filter((l) => ["update", "delete", "upsert", "insert"].includes(l.metodo));
}

beforeEach(() => {
  vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-de-sesion-de-test-largo");
  llamadas = [];
  intentoActivoMock = null;
  padreMock = { reto_id: RETO.id, parent_id: null, visibilidad: "publico", oculto: false };
  nombreCaminanteMock = "Santi";
  entradaConClaveMock = null;
  errorAlResolverMock = null;
  filasAlResolverMock = null;
  hashesMock = new Map([
    [RETO.id, HASH_RETO],
    [RETO_B.id, HASH_RETO_B],
  ]);
  cookieMock = crearSesion(RETO, huellaCredencial(HASH_RETO));
  revalidatePathSpy.mockClear();
  subirFotoQuienCaminaSpy.mockReset();
  subirFotoMinutoAMinutoSpy.mockReset();
  borrarObjetoSpy.mockReset();
  asignarTokenGpsNuevoSpy.mockReset().mockResolvedValue(true);
});

describe("requerirSesion — la sesión debe ser del reto del slug y de su contraseña vigente", () => {
  it("la sesión del reto A no permite actuar sobre el reto B y no escribe nada", async () => {
    await expect(eliminarComentario(RETO_B.slug, 55)).rejects.toThrow(/Sesión de admin/);
    await expect(resetearContadorTrafico(RETO_B.slug)).rejects.toThrow(/Sesión de admin/);
    await expect(guardarTexto(RETO_B.slug, "reto_titulo", "x")).rejects.toThrow(/Sesión de admin/);
    expect(escriturasEnBd()).toEqual([]);
  });

  it("una sesión con la huella de la contraseña anterior se rechaza tras cambiarla", async () => {
    hashesMock.set(RETO.id, "scrypt$16384$8$1$saltNuevo$hashTrasCambiarLaContrasena");

    await expect(eliminarComentario(RETO.slug, 55)).rejects.toThrow(/Sesión de admin/);
    expect(escriturasEnBd()).toEqual([]);
  });

  it("se rechaza si el reto ya no tiene contraseña configurada", async () => {
    hashesMock.delete(RETO.id);

    await expect(eliminarIntencion(RETO.slug, 8)).rejects.toThrow(/Sesión de admin/);
    expect(escriturasEnBd()).toEqual([]);
  });

  it("se rechaza sin cookie", async () => {
    cookieMock = undefined;

    await expect(eliminarIntencion(RETO.slug, 8)).rejects.toThrow(/Sesión de admin/);
    expect(escriturasEnBd()).toEqual([]);
  });

  it("las acciones que devuelven resultado informan de sesión caducada en vez de lanzar, sin escribir", async () => {
    const formData = new FormData();
    formData.set("texto", "hola");

    await expect(crearMinutoAMinuto(RETO_B.slug, formData)).resolves.toEqual({
      ok: false,
      mensaje: expect.stringMatching(/sesión/),
    });
    expect(escriturasEnBd()).toEqual([]);
  });
});

describe("acciones de comentarios e intenciones — filtran por reto_id", () => {
  it("eliminarComentario borra filtrando por id y por el reto del slug", async () => {
    await eliminarComentario(RETO.slug, 55);

    expect(llamadasA("comentarios", "delete")).toHaveLength(1);
    expect(llamadasA("comentarios", "eq")).toEqual([
      ["id", 55],
      ["reto_id", RETO.id],
    ]);
  });

  it("ocultarComentario actualiza filtrando por id, por el reto del slug y solo si es público", async () => {
    filasAlResolverMock = [{ id: 55 }];

    await ocultarComentario(RETO.slug, 55);

    expect(llamadasA("comentarios", "update")).toEqual([[{ oculto: true }]]);
    expect(llamadasA("comentarios", "eq")).toEqual([
      ["id", 55],
      ["reto_id", RETO.id],
      ["visibilidad", "publico"],
    ]);
    expect(revalidatePathSpy).toHaveBeenCalledWith(`/${RETO.slug}/admin`);
  });

  it("mostrarComentario actualiza con los mismos filtros", async () => {
    filasAlResolverMock = [{ id: 55 }];

    await mostrarComentario(RETO.slug, 55);

    expect(llamadasA("comentarios", "update")).toEqual([[{ oculto: false }]]);
    expect(llamadasA("comentarios", "eq")).toContainEqual(["visibilidad", "publico"]);
  });

  it("ocultar o mostrar un privado (ninguna fila pública afectada) falla con mensaje claro y no revalida", async () => {
    filasAlResolverMock = [];

    await expect(ocultarComentario(RETO.slug, 56)).rejects.toThrow("No se puede ocultar un mensaje privado.");
    await expect(mostrarComentario(RETO.slug, 56)).rejects.toThrow("No se puede mostrar un mensaje privado.");
    expect(revalidatePathSpy).not.toHaveBeenCalled();
  });

  it("si falla el update de ocultar, lanza el error de BD y no el de privado", async () => {
    errorAlResolverMock = { message: "fallo" };

    await expect(ocultarComentario(RETO.slug, 55)).rejects.toThrow("No se pudo ocultar el comentario.");
  });

  it("eliminarIntencion borra filtrando por id y por el reto del slug", async () => {
    await eliminarIntencion(RETO.slug, 8);

    expect(llamadasA("intenciones", "eq")).toEqual([
      ["id", 8],
      ["reto_id", RETO.id],
    ]);
  });

  it("no toca la BD si el reto del slug no existe", async () => {
    await expect(eliminarComentario("reto-inexistente", 55)).rejects.toThrow();
    expect(llamadasA("comentarios", "delete")).toHaveLength(0);
  });
});

describe("acciones sobre filas hijas de intento — acotadas al intento activo del reto", () => {
  it("descartarPosicion busca el intento activo del reto y filtra la posición por ese intento", async () => {
    intentoActivoMock = { id: 21 };

    await descartarPosicion(RETO.slug, 400);

    expect(llamadasA("intentos", "eq")).toEqual([
      ["reto_id", RETO.id],
      ["cerrado", false],
    ]);
    expect(llamadasA("posiciones", "eq")).toEqual([
      ["id", 400],
      ["intento_id", 21],
    ]);
  });

  it("descartarPosicion falla sin tocar posiciones si el reto no tiene intento activo", async () => {
    intentoActivoMock = null;

    await expect(descartarPosicion(RETO.slug, 400)).rejects.toThrow();
    expect(llamadasA("posiciones", "update")).toHaveLength(0);
  });

  it("eliminarMinutoAMinuto filtra la entrada por el intento activo del reto", async () => {
    intentoActivoMock = { id: 21 };

    await eliminarMinutoAMinuto(RETO.slug, 9);

    expect(llamadasA("minuto_a_minuto", "eq")).toEqual([
      ["id", 9],
      ["intento_id", 21],
    ]);
  });
});

describe("iniciarReto — modo guiado solo con ruta", () => {
  const RETO_SIN_RUTA: Reto = { ...RETO, ruta_tipo: "libre", ruta_id: null };

  async function conRetoSinRuta(accion: () => Promise<unknown>) {
    RETOS_POR_SLUG.set(RETO.slug, RETO_SIN_RUTA);
    try {
      await accion();
    } finally {
      RETOS_POR_SLUG.set(RETO.slug, RETO);
    }
  }

  beforeEach(() => {
    intentoActivoMock = { id: 21, fase: "antes" };
  });

  it("un reto sin ruta rechaza el modo guiado con mensaje claro, sin escribir", async () => {
    await conRetoSinRuta(async () => {
      await expect(iniciarReto(RETO.slug, { modo: "guiado" })).rejects.toThrow(/no tiene ruta.*modo libre/);
    });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("un reto sin ruta sí se inicia en modo libre con destino", async () => {
    await conRetoSinRuta(() => iniciarReto(RETO.slug, { modo: "libre", destinoLat: 42.88, destinoLon: -8.54 }));

    const [[cambios]] = llamadasA("intentos", "update");
    expect(cambios).toMatchObject({ fase: "durante", modo: "libre", destino_lat: 42.88, destino_lon: -8.54 });
  });

  it("un reto con ruta sigue iniciándose en modo guiado", async () => {
    await iniciarReto(RETO.slug, { modo: "guiado" });

    const [[cambios]] = llamadasA("intentos", "update");
    expect(cambios).toMatchObject({ fase: "durante" });
    expect(cambios).not.toHaveProperty("modo");
  });
});

describe("resetearContadorTrafico — upsert por reto_id", () => {
  it("hace upsert de cuenta_desde con el reto del slug y onConflict reto_id", async () => {
    await resetearContadorTrafico(RETO.slug);

    const upserts = llamadasA("config_trafico", "upsert");
    expect(upserts).toHaveLength(1);
    const [fila, opciones] = upserts[0];
    expect(fila).toEqual({ reto_id: RETO.id, cuenta_desde: expect.any(String) });
    expect(opciones).toEqual({ onConflict: "reto_id" });
    expect(llamadasA("config_trafico", "eq")).toHaveLength(0);
  });
});

describe("responderComentario — respuesta del caminante (FP3a, DT-030)", () => {
  it("lee el padre filtrando por id y reto_id e inserta la respuesta con es_autor true y el nombre del caminante", async () => {
    const resultado = await responderComentario(RETO.slug, 55, "  ¡Gracias por el ánimo!  ");

    expect(resultado).toEqual({ ok: true });
    expect(llamadasA("comentarios", "eq")).toEqual([
      ["id", 55],
      ["reto_id", RETO.id],
    ]);
    expect(llamadasA("comentarios", "insert")).toEqual([
      [
        {
          reto_id: RETO.id,
          parent_id: 55,
          nombre: "Santi",
          texto: "¡Gracias por el ánimo!",
          visibilidad: "publico",
          es_autor: true,
        },
      ],
    ]);
  });

  it("usa el nombre del reto, recortado a 80, si quien_camina_nombre está vacío", async () => {
    nombreCaminanteMock = "   ";
    const retoNombreLargo = { ...RETO, nombre: "x".repeat(100) };
    RETOS_POR_SLUG.set(RETO.slug, retoNombreLargo);
    try {
      await responderComentario(RETO.slug, 55, "hola");
    } finally {
      RETOS_POR_SLUG.set(RETO.slug, RETO);
    }

    const [[fila]] = llamadasA("comentarios", "insert");
    expect(fila).toMatchObject({ nombre: "x".repeat(80) });
  });

  it("sin sesión no escribe y devuelve sesión caducada", async () => {
    cookieMock = undefined;

    await expect(responderComentario(RETO.slug, 55, "hola")).resolves.toEqual({
      ok: false,
      mensaje: expect.stringMatching(/sesión/),
    });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("con la sesión de otro reto no escribe", async () => {
    await expect(responderComentario(RETO_B.slug, 55, "hola")).resolves.toMatchObject({ ok: false });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("un padre de otro reto (no encontrado al filtrar por reto_id) no se responde", async () => {
    padreMock = null;

    await expect(responderComentario(RETO.slug, 55, "hola")).resolves.toMatchObject({ ok: false });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("no responde a una respuesta, a un comentario oculto ni a uno privado", async () => {
    for (const padre of [
      { reto_id: RETO.id, parent_id: 9, visibilidad: "publico" as const, oculto: false },
      { reto_id: RETO.id, parent_id: null, visibilidad: "publico" as const, oculto: true },
      { reto_id: RETO.id, parent_id: null, visibilidad: "privado" as const, oculto: false },
    ]) {
      padreMock = padre;
      await expect(responderComentario(RETO.slug, 55, "hola")).resolves.toMatchObject({ ok: false });
    }
    expect(escriturasEnBd()).toEqual([]);
  });

  it("rechaza un texto vacío o de más de 1000 caracteres sin tocar la BD", async () => {
    await expect(responderComentario(RETO.slug, 55, "   ")).resolves.toMatchObject({ ok: false });
    await expect(responderComentario(RETO.slug, 55, "a".repeat(1001))).resolves.toMatchObject({ ok: false });
    expect(llamadas.filter((l) => l.tabla === "comentarios")).toEqual([]);
  });
});

describe("guardarConfiguracion — interruptores de la web pública (FP3c, DT-032)", () => {
  const CONFIG = {
    seccion_intenciones: false,
    seccion_comentarios: true,
    seccion_minuto_a_minuto: false,
    seccion_instagram: true,
    respuestas_visitantes: false,
    peregrino_animado: false,
  };

  it("actualiza solo el reto del slug con los interruptores y revalida la web y el panel", async () => {
    await expect(guardarConfiguracion(RETO.slug, CONFIG)).resolves.toEqual({ ok: true });

    expect(llamadasA("retos", "update")).toEqual([[CONFIG]]);
    expect(llamadasA("retos", "eq")).toEqual([["id", RETO.id]]);
    expect(revalidatePathSpy).toHaveBeenCalledWith(`/${RETO.slug}`);
    expect(revalidatePathSpy).toHaveBeenCalledWith(`/${RETO.slug}/admin`);
  });

  it("con la sesión de otro reto devuelve sesión caducada sin escribir", async () => {
    await expect(guardarConfiguracion(RETO_B.slug, CONFIG)).resolves.toEqual({
      ok: false,
      mensaje: expect.stringMatching(/sesión/),
    });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("sin cookie devuelve sesión caducada sin escribir", async () => {
    cookieMock = undefined;

    await expect(guardarConfiguracion(RETO.slug, CONFIG)).resolves.toMatchObject({ ok: false });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("rechaza campos que no son interruptores (p. ej. activo o la foto) sin escribir", async () => {
    const conActivo = { ...CONFIG, activo: false };
    const conFoto = { ...CONFIG, quien_camina_foto_url: "https://evil.example/x.jpg" };

    await expect(guardarConfiguracion(RETO.slug, conActivo)).resolves.toMatchObject({ ok: false });
    await expect(guardarConfiguracion(RETO.slug, conFoto)).resolves.toMatchObject({ ok: false });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("rechaza valores no booleanos o campos ausentes sin escribir", async () => {
    const conTexto = { ...CONFIG, seccion_comentarios: "false" };
    const incompleta = { ...CONFIG };
    Reflect.deleteProperty(incompleta, "seccion_instagram");

    await expect(guardarConfiguracion(RETO.slug, conTexto)).resolves.toMatchObject({
      ok: false,
    });
    await expect(guardarConfiguracion(RETO.slug, incompleta)).resolves.toMatchObject({
      ok: false,
    });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("si falla el update devuelve error y no revalida", async () => {
    errorAlResolverMock = { message: "fallo" };

    await expect(guardarConfiguracion(RETO.slug, CONFIG)).resolves.toMatchObject({ ok: false });
    expect(revalidatePathSpy).not.toHaveBeenCalled();
  });

  it("exige peregrino_animado (DT-034): sin él o no booleano se rechaza sin escribir", async () => {
    const sinPeregrino = { ...CONFIG };
    Reflect.deleteProperty(sinPeregrino, "peregrino_animado");

    await expect(guardarConfiguracion(RETO.slug, sinPeregrino)).resolves.toMatchObject({ ok: false });
    await expect(guardarConfiguracion(RETO.slug, { ...CONFIG, peregrino_animado: "si" })).resolves.toMatchObject({
      ok: false,
    });
    expect(escriturasEnBd()).toEqual([]);
  });
});

describe("guardarTexto — claves gestionadas en Configuración (DT-034)", () => {
  it("rechaza la URL de Instagram sin escribir, para que no se salte la normalización", async () => {
    await expect(guardarTexto(RETO.slug, "cierre_antes_instagram_url", "javascript:alert(1)")).rejects.toThrow(
      /Configuración/
    );
    expect(escriturasEnBd()).toEqual([]);
  });

  it("sigue guardando cualquier otra clave con upsert por reto y clave", async () => {
    await guardarTexto(RETO.slug, "reto_titulo", "Mi reto");

    expect(llamadasA("textos", "upsert")).toEqual([
      [{ reto_id: RETO.id, clave: "reto_titulo", valor: "Mi reto" }, { onConflict: "reto_id,clave" }],
    ]);
  });
});

describe("guardarInstagram — perfil de Instagram del reto (DT-034)", () => {
  it("normaliza el perfil, lo guarda en la fila de textos del reto y revalida la web y el panel", async () => {
    await expect(guardarInstagram(RETO.slug, " @santi.ago ")).resolves.toEqual({ ok: true });

    expect(llamadasA("textos", "upsert")).toEqual([
      [
        { reto_id: RETO.id, clave: "cierre_antes_instagram_url", valor: "https://instagram.com/santi.ago" },
        { onConflict: "reto_id,clave" },
      ],
    ]);
    expect(revalidatePathSpy).toHaveBeenCalledWith(`/${RETO.slug}`);
    expect(revalidatePathSpy).toHaveBeenCalledWith(`/${RETO.slug}/admin`);
  });

  it("vacío guarda cadena vacía (sin enlace)", async () => {
    await expect(guardarInstagram(RETO.slug, "")).resolves.toEqual({ ok: true });

    const [[fila]] = llamadasA("textos", "upsert");
    expect(fila).toMatchObject({ valor: "" });
  });

  it("rechaza valores que no son un perfil de Instagram sin escribir", async () => {
    for (const valor of ["javascript:alert(1)", "https://evil.example/santi", "instagram.com/p/abc", 42, null]) {
      await expect(guardarInstagram(RETO.slug, valor)).resolves.toMatchObject({ ok: false });
    }
    expect(escriturasEnBd()).toEqual([]);
  });

  it("con la sesión de otro reto devuelve sesión caducada sin escribir", async () => {
    await expect(guardarInstagram(RETO_B.slug, "@santi")).resolves.toEqual({
      ok: false,
      mensaje: expect.stringMatching(/sesión/),
    });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("si falla el upsert devuelve error y no revalida", async () => {
    errorAlResolverMock = { message: "fallo" };

    await expect(guardarInstagram(RETO.slug, "@santi")).resolves.toMatchObject({ ok: false });
    expect(revalidatePathSpy).not.toHaveBeenCalled();
  });
});

describe("guardarFotoQuienCamina — subir, sustituir y quitar (FP3c, DT-032)", () => {
  const BASE = "https://x.supabase.co/storage/v1/object/public/minuto-a-minuto/";
  const NOMBRE = "1727700000000-3f2b8c1e-0a1b-4c2d-9e8f-123456789abc.jpg";
  const URL_NUEVA = `${BASE}${RETO.id}/quien-camina-1727800000000-aaaaaaaa-0a1b-4c2d-9e8f-123456789abc.jpg`;

  function conFoto(): FormData {
    const formData = new FormData();
    formData.set("foto", new File([new Uint8Array(10)], "f.jpg", { type: "image/jpeg" }));
    return formData;
  }

  async function conFotoAnterior(url: string | null, accion: () => Promise<unknown>) {
    RETOS_POR_SLUG.set(RETO.slug, { ...RETO, quien_camina_foto_url: url });
    try {
      await accion();
    } finally {
      RETOS_POR_SLUG.set(RETO.slug, RETO);
    }
  }

  it("sube la foto con el id del reto y guarda su URL en el reto del slug", async () => {
    subirFotoQuienCaminaSpy.mockResolvedValue(URL_NUEVA);

    await expect(guardarFotoQuienCamina(RETO.slug, conFoto())).resolves.toEqual({ ok: true });

    expect(subirFotoQuienCaminaSpy).toHaveBeenCalledWith(expect.any(File), RETO.id);
    expect(llamadasA("retos", "update")).toEqual([[{ quien_camina_foto_url: URL_NUEVA }]]);
    expect(llamadasA("retos", "eq")).toEqual([["id", RETO.id]]);
    expect(revalidatePathSpy).toHaveBeenCalledWith(`/${RETO.slug}`);
  });

  it("al sustituir borra la anterior si es un objeto de este reto", async () => {
    subirFotoQuienCaminaSpy.mockResolvedValue(URL_NUEVA);
    const anterior = `${BASE}${RETO.id}/quien-camina-${NOMBRE}`;

    await conFotoAnterior(anterior, () => guardarFotoQuienCamina(RETO.slug, conFoto()));

    expect(borrarObjetoSpy).toHaveBeenCalledWith(`${RETO.id}/quien-camina-${NOMBRE}`);
  });

  it("no borra la anterior si es /santi.jpg o un objeto de otro reto", async () => {
    subirFotoQuienCaminaSpy.mockResolvedValue(URL_NUEVA);

    await conFotoAnterior("/santi.jpg", () => guardarFotoQuienCamina(RETO.slug, conFoto()));
    await conFotoAnterior(`${BASE}${RETO_B.id}/quien-camina-${NOMBRE}`, () =>
      guardarFotoQuienCamina(RETO.slug, conFoto())
    );

    expect(borrarObjetoSpy).not.toHaveBeenCalled();
  });

  it("quitarFoto pone la URL a null sin subir nada y borra la anterior del reto", async () => {
    const formData = new FormData();
    formData.set("quitarFoto", "true");
    const anterior = `${BASE}${RETO.id}/quien-camina-${NOMBRE}`;

    await conFotoAnterior(anterior, async () => {
      await expect(guardarFotoQuienCamina(RETO.slug, formData)).resolves.toEqual({ ok: true });
    });

    expect(subirFotoQuienCaminaSpy).not.toHaveBeenCalled();
    expect(llamadasA("retos", "update")).toEqual([[{ quien_camina_foto_url: null }]]);
    expect(borrarObjetoSpy).toHaveBeenCalledWith(`${RETO.id}/quien-camina-${NOMBRE}`);
  });

  it("sin foto ni quitarFoto no escribe nada", async () => {
    await expect(guardarFotoQuienCamina(RETO.slug, new FormData())).resolves.toMatchObject({ ok: false });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("con la sesión de otro reto no sube ni escribe", async () => {
    await expect(guardarFotoQuienCamina(RETO_B.slug, conFoto())).resolves.toMatchObject({ ok: false });
    expect(subirFotoQuienCaminaSpy).not.toHaveBeenCalled();
    expect(escriturasEnBd()).toEqual([]);
  });

  it("muestra el motivo de un ErrorDeSubidaDeFoto y no escribe", async () => {
    const { ErrorDeSubidaDeFoto } = await import("@/lib/supabase/storage");
    subirFotoQuienCaminaSpy.mockRejectedValue(new ErrorDeSubidaDeFoto("Formato de imagen no permitido"));

    await expect(guardarFotoQuienCamina(RETO.slug, conFoto())).resolves.toEqual({
      ok: false,
      mensaje: "Formato de imagen no permitido",
    });
    expect(escriturasEnBd()).toEqual([]);
  });

  it("si falla el update borra la foto recién subida y conserva la anterior", async () => {
    subirFotoQuienCaminaSpy.mockResolvedValue(URL_NUEVA);
    errorAlResolverMock = { message: "fallo" };
    const anterior = `${BASE}${RETO.id}/quien-camina-${NOMBRE}`;

    await conFotoAnterior(anterior, async () => {
      await expect(guardarFotoQuienCamina(RETO.slug, conFoto())).resolves.toMatchObject({ ok: false });
    });

    expect(borrarObjetoSpy).toHaveBeenCalledTimes(1);
    expect(borrarObjetoSpy).toHaveBeenCalledWith(URL_NUEVA.slice(BASE.length));
  });
});

describe("crearMinutoAMinuto — idempotencia por clave_envio (DT-033)", () => {
  const BASE = "https://x.supabase.co/storage/v1/object/public/minuto-a-minuto/";
  const NOMBRE_FOTO = "1727700000000-3f2b8c1e-0a1b-4c2d-9e8f-123456789abc.jpg";
  const CLAVE = "5d3c1c2e-8a4b-4f6e-9d7a-0b1c2d3e4f5a";

  function envio(opciones: { clave?: string; conFoto?: boolean } = {}): FormData {
    const formData = new FormData();
    formData.set("texto", "Llegando a Tui");
    if (opciones.clave !== undefined) formData.set("clave_envio", opciones.clave);
    if (opciones.conFoto) {
      formData.set("foto", new File([new Uint8Array(10)], "f.jpg", { type: "image/jpeg" }));
    }
    return formData;
  }

  beforeEach(() => {
    intentoActivoMock = { id: 21 };
    subirFotoMinutoAMinutoSpy.mockResolvedValue(`${BASE}${NOMBRE_FOTO}`);
  });

  it("un reintento con la misma clave, ya publicada, no vuelve a subir la foto ni a insertar", async () => {
    await expect(crearMinutoAMinuto(RETO.slug, envio({ clave: CLAVE, conFoto: true }))).resolves.toEqual({ ok: true });
    // La primera llegó al servidor; lo que se perdió fue la respuesta.
    entradaConClaveMock = { id: 77 };
    await expect(crearMinutoAMinuto(RETO.slug, envio({ clave: CLAVE, conFoto: true }))).resolves.toEqual({ ok: true });

    expect(subirFotoMinutoAMinutoSpy).toHaveBeenCalledTimes(1);
    expect(llamadasA("minuto_a_minuto", "insert")).toHaveLength(1);
    expect(borrarObjetoSpy).not.toHaveBeenCalled();
  });

  it("busca la clave dentro del intento activo del reto e inserta la entrada con ella", async () => {
    await crearMinutoAMinuto(RETO.slug, envio({ clave: CLAVE }));

    expect(llamadasA("minuto_a_minuto", "eq")).toEqual([
      ["intento_id", 21],
      ["clave_envio", CLAVE],
    ]);
    const [[fila]] = llamadasA("minuto_a_minuto", "insert");
    expect(fila).toMatchObject({ intento_id: 21, texto: "Llegando a Tui", clave_envio: CLAVE });
  });

  it("si la inserción choca con el índice único (23505) devuelve éxito y borra la foto recién subida", async () => {
    errorAlResolverMock = { message: "duplicate key value violates unique constraint", code: "23505" };

    await expect(crearMinutoAMinuto(RETO.slug, envio({ clave: CLAVE, conFoto: true }))).resolves.toEqual({ ok: true });

    expect(borrarObjetoSpy).toHaveBeenCalledTimes(1);
    expect(borrarObjetoSpy).toHaveBeenCalledWith(NOMBRE_FOTO);
  });

  it("un fallo de inserción que no es de unicidad devuelve error y tampoco deja la foto huérfana", async () => {
    errorAlResolverMock = { message: "fallo", code: "08006" };

    await expect(crearMinutoAMinuto(RETO.slug, envio({ clave: CLAVE, conFoto: true }))).resolves.toMatchObject({
      ok: false,
    });
    expect(borrarObjetoSpy).toHaveBeenCalledWith(NOMBRE_FOTO);
  });

  it("un 23505 sin clave de envío no se trata como éxito", async () => {
    errorAlResolverMock = { message: "duplicate key", code: "23505" };

    await expect(crearMinutoAMinuto(RETO.slug, envio())).resolves.toMatchObject({ ok: false });
  });

  it("sin clave sigue publicando como antes: sin consultar la clave y con clave_envio null", async () => {
    await expect(crearMinutoAMinuto(RETO.slug, envio({ conFoto: true }))).resolves.toEqual({ ok: true });

    expect(llamadasA("minuto_a_minuto", "maybeSingle")).toHaveLength(0);
    expect(subirFotoMinutoAMinutoSpy).toHaveBeenCalledTimes(1);
    const [[fila]] = llamadasA("minuto_a_minuto", "insert");
    expect(fila).toMatchObject({ foto_url: `${BASE}${NOMBRE_FOTO}`, clave_envio: null });
  });

  it("una clave vacía cuenta como sin clave", async () => {
    await expect(crearMinutoAMinuto(RETO.slug, envio({ clave: "" }))).resolves.toEqual({ ok: true });

    const [[fila]] = llamadasA("minuto_a_minuto", "insert");
    expect(fila).toMatchObject({ clave_envio: null });
  });

  it("rechaza una clave que no es un UUID sin subir la foto ni escribir", async () => {
    await expect(
      crearMinutoAMinuto(RETO.slug, envio({ clave: "no-es-un-uuid", conFoto: true }))
    ).resolves.toMatchObject({ ok: false });

    expect(subirFotoMinutoAMinutoSpy).not.toHaveBeenCalled();
    expect(escriturasEnBd()).toEqual([]);
  });

  it("sin intento activo devuelve error sin subir la foto", async () => {
    intentoActivoMock = null;

    await expect(crearMinutoAMinuto(RETO.slug, envio({ clave: CLAVE, conFoto: true }))).resolves.toMatchObject({
      ok: false,
    });
    expect(subirFotoMinutoAMinutoSpy).not.toHaveBeenCalled();
    expect(escriturasEnBd()).toEqual([]);
  });
});

describe("regenerarTokenGps — token del GPS del reto (DT-035)", () => {
  it("genera un token nuevo para el reto del slug, revalida el panel y no devuelve el token", async () => {
    const resultado = await regenerarTokenGps(RETO.slug);

    expect(resultado).toEqual({ ok: true });
    expect(asignarTokenGpsNuevoSpy).toHaveBeenCalledWith(RETO.id);
    expect(revalidatePathSpy).toHaveBeenCalledWith(`/${RETO.slug}/admin`);
  });

  it("con la sesión de otro reto no regenera el token de ese reto", async () => {
    await expect(regenerarTokenGps(RETO_B.slug)).resolves.toEqual({
      ok: false,
      mensaje: expect.stringMatching(/sesión/),
    });
    expect(asignarTokenGpsNuevoSpy).not.toHaveBeenCalled();
  });

  it("sin cookie no regenera nada", async () => {
    cookieMock = undefined;

    await expect(regenerarTokenGps(RETO.slug)).resolves.toMatchObject({ ok: false });
    expect(asignarTokenGpsNuevoSpy).not.toHaveBeenCalled();
  });

  it("si no se puede guardar el token devuelve el error y no revalida", async () => {
    asignarTokenGpsNuevoSpy.mockResolvedValue(false);

    await expect(regenerarTokenGps(RETO.slug)).resolves.toEqual({
      ok: false,
      mensaje: expect.stringMatching(/token del GPS/),
    });
    expect(revalidatePathSpy).not.toHaveBeenCalled();
  });
});
