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
  quien_camina_foto_url: null,
  created_at: "2026-09-01T00:00:00.000Z",
};

interface LlamadaBuilder {
  tabla: string;
  metodo: string;
  args: unknown[];
}

let llamadas: LlamadaBuilder[] = [];
let intentoActivoMock: { id: number } | null = null;
let padreMock: { reto_id: number; parent_id: number | null; visibilidad: "publico" | "privado"; oculto: boolean } | null =
  null;
let nombreCaminanteMock = "Santi";
/** Error con el que resuelve cualquier consulta awaited (no `maybeSingle`). */
let errorAlResolverMock: { message: string } | null = null;
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
      const datos = tabla === "intentos" ? intentoActivoMock : tabla === "comentarios" ? padreMock : null;
      return Promise.resolve({ data: datos, error: null });
    },
    then: (resolver: (valor: { data: null; error: { message: string } | null }) => void) =>
      resolver({ data: null, error: errorAlResolverMock }),
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
const borrarObjetoSpy = vi.fn();
vi.mock("@/lib/supabase/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/supabase/storage")>();
  return {
    ...real,
    subirFotoQuienCamina: (foto: File, retoId: number) => subirFotoQuienCaminaSpy(foto, retoId),
    borrarObjeto: (ruta: string) => borrarObjetoSpy(ruta),
  };
});

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
  guardarTexto,
  ocultarComentario,
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
  errorAlResolverMock = null;
  hashesMock = new Map([
    [RETO.id, HASH_RETO],
    [RETO_B.id, HASH_RETO_B],
  ]);
  cookieMock = crearSesion(RETO, huellaCredencial(HASH_RETO));
  revalidatePathSpy.mockClear();
  subirFotoQuienCaminaSpy.mockReset();
  borrarObjetoSpy.mockReset();
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

  it("ocultarComentario actualiza filtrando por id y por el reto del slug", async () => {
    await ocultarComentario(RETO.slug, 55);

    expect(llamadasA("comentarios", "update")).toEqual([[{ oculto: true }]]);
    expect(llamadasA("comentarios", "eq")).toContainEqual(["reto_id", RETO.id]);
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
  };

  it("actualiza solo el reto del slug con los cinco booleanos y revalida la web y el panel", async () => {
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
