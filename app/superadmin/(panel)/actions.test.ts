/**
 * Tests de las acciones del superadmin: devuelven un resultado con mensaje
 * claro en vez de lanzar (Next redacta los errores lanzados en producción),
 * editar y eliminar redirigen al panel con el aviso cuando terminan bien, y
 * la contraseña de admin por reto (FP2.6, DT-029) es obligatoria al crear,
 * opcional al editar y se guarda siempre como hash scrypt — nunca aparece en
 * texto plano ni en lo guardado ni en el resultado.
 *
 * Supabase se mockea con un builder que registra las llamadas y responde lo
 * configurado por tabla y operación; la persistencia de la credencial
 * (`guardarHashAdmin`) se sustituye por un espía.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface LlamadaBuilder {
  tabla: string;
  metodo: string;
  args: unknown[];
}

interface RespuestaSupabase {
  data: unknown;
  error: { code?: string; message: string } | null;
}

type Operacion = "insert" | "update" | "delete";

const ID_RETO_CREADO = 7;
let llamadas: LlamadaBuilder[] = [];
let respuestas: Record<string, RespuestaSupabase> = {};
let sesionValida = true;
const guardarHashAdminSpy = vi.fn<(retoId: number, hash: string) => Promise<void>>();

function respuestasPorDefecto(): Record<string, RespuestaSupabase> {
  return {
    "retos.insert": { data: { id: ID_RETO_CREADO }, error: null },
    "retos.update": { data: [{ id: 3 }], error: null },
    "retos.delete": { data: [{ slug: "reto-borrado" }], error: null },
    "intentos.insert": { data: null, error: null },
  };
}

function crearConsulta(tabla: string) {
  let operacion: Operacion | null = null;
  const responder = (): RespuestaSupabase =>
    respuestas[`${tabla}.${operacion}`] ?? { data: null, error: null };
  const consulta = {
    insert: (...args: unknown[]) => iniciar("insert", args),
    update: (...args: unknown[]) => iniciar("update", args),
    delete: (...args: unknown[]) => iniciar("delete", args),
    select: (...args: unknown[]) => registrar("select", args),
    eq: (...args: unknown[]) => registrar("eq", args),
    single: () => Promise.resolve(responder()),
    then: (resolver: (valor: RespuestaSupabase) => void) => resolver(responder()),
  };
  function iniciar(metodo: Operacion, args: unknown[]) {
    operacion = metodo;
    return registrar(metodo, args);
  }
  function registrar(metodo: string, args: unknown[]) {
    llamadas.push({ tabla, metodo, args });
    return consulta;
  }
  return consulta;
}

class RedireccionSimulada extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: (tabla: string) => crearConsulta(tabla) }),
}));

vi.mock("@/lib/supabase/credenciales-admin", () => ({
  guardarHashAdmin: (retoId: number, hash: string) => guardarHashAdminSpy(retoId, hash),
}));

const asignarTokenGpsNuevoSpy = vi.fn<(retoId: number) => Promise<boolean>>();
vi.mock("@/lib/supabase/credenciales-gps", () => ({
  asignarTokenGpsNuevo: (retoId: number) => asignarTokenGpsNuevoSpy(retoId),
}));

vi.mock("@/lib/auth/superadmin-session", () => ({
  NOMBRE_COOKIE_SUPERADMIN_SESION: "superadmin_session",
  verificarSesionSuperadmin: () => sesionValida,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "cookie-valida" }), delete: () => undefined }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedireccionSimulada(url);
  },
}));

const { crearReto, editarReto, eliminarReto, regenerarTokenGpsReto } = await import("@/app/superadmin/(panel)/actions");
const { verificarPassword } = await import("@/lib/auth/password");

function formularioReto(campos: Record<string, string>): FormData {
  const formData = new FormData();
  formData.set("nombre", "Reto nuevo");
  formData.set("descripcion", "");
  formData.set("ruta_tipo", "libre");
  for (const [clave, valor] of Object.entries(campos)) formData.set(clave, valor);
  return formData;
}

function llamadasA(tabla: string, metodo: string): unknown[][] {
  return llamadas.filter((l) => l.tabla === tabla && l.metodo === metodo).map((l) => l.args);
}

beforeEach(() => {
  llamadas = [];
  respuestas = respuestasPorDefecto();
  sesionValida = true;
  guardarHashAdminSpy.mockReset();
  guardarHashAdminSpy.mockResolvedValue(undefined);
  asignarTokenGpsNuevoSpy.mockReset().mockResolvedValue(true);
});

describe("crearReto — resultado", () => {
  it("con datos válidos devuelve ok:true con mensaje y el slug normalizado para enlazar al reto", async () => {
    const resultado = await crearReto(
      null,
      formularioReto({ slug: "reto-nuevo", nombre: "Mi reto", password_admin: "contraseña-valida" })
    );

    expect(resultado).toEqual({ ok: true, mensaje: "Reto «Mi reto» creado.", slug: "reto-nuevo" });
  });

  it("si el slug ya existe (23505) devuelve ok:false con 'Ya existe un reto con…' y no guarda credencial", async () => {
    respuestas["retos.insert"] = {
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    };

    const resultado = await crearReto(null, formularioReto({ slug: "repetido", password_admin: "contraseña-valida" }));

    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/^Ya existe un reto con el slug «repetido»/);
    expect(llamadasA("intentos", "insert")).toHaveLength(0);
    expect(guardarHashAdminSpy).not.toHaveBeenCalled();
  });

  it("otro error de BD devuelve un mensaje genérico sin detalles internos", async () => {
    respuestas["retos.insert"] = { data: null, error: { code: "08006", message: "connection failure at 10.0.0.1" } };

    const resultado = await crearReto(null, formularioReto({ slug: "reto-nuevo", password_admin: "contraseña-valida" }));

    expect(resultado).toEqual({ ok: false, mensaje: "No se pudo crear el reto. Inténtalo de nuevo." });
  });

  it("con datos inválidos devuelve ok:false con el primer mensaje de validación, sin insertar", async () => {
    const resultado = await crearReto(
      null,
      formularioReto({ slug: "reto-nuevo", nombre: "", password_admin: "contraseña-valida" })
    );

    expect(resultado).toEqual({ ok: false, mensaje: "El nombre es obligatorio." });
    expect(llamadasA("retos", "insert")).toHaveLength(0);
  });

  it("con un tipo de ruta desconocido responde en español", async () => {
    const resultado = await crearReto(
      null,
      formularioReto({ slug: "reto-nuevo", ruta_tipo: "otra", password_admin: "contraseña-valida" })
    );

    expect(resultado).toEqual({ ok: false, mensaje: "Elige un tipo de ruta válido." });
  });

  it("con la sesión caducada no hace nada y pide volver a iniciar sesión", async () => {
    sesionValida = false;

    const resultado = await crearReto(null, formularioReto({ slug: "reto-nuevo", password_admin: "contraseña-valida" }));

    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/sesión/);
    expect(llamadas).toHaveLength(0);
  });

  it("si falla sembrar el intento avisa de que el reto existe y aun así guarda la contraseña", async () => {
    respuestas["intentos.insert"] = { data: null, error: { message: "fallo" } };

    const resultado = await crearReto(
      null,
      formularioReto({ slug: "reto-nuevo", nombre: "Mi reto", password_admin: "contraseña-valida" })
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/«Mi reto» se creó.*primer intento/);
    expect(guardarHashAdminSpy).toHaveBeenCalledTimes(1);
  });
});

describe("crearReto — normalización del slug", () => {
  it("pasa a minúsculas y recorta espacios antes de validar", async () => {
    await crearReto(null, formularioReto({ slug: "  Prueba ", password_admin: "contraseña-valida" }));
    const [[fila]] = llamadasA("retos", "insert") as [[{ slug: string }]];
    expect(fila.slug).toBe("prueba");
  });

  it("sigue rechazando espacios intermedios y no crea el reto", async () => {
    const resultado = await crearReto(null, formularioReto({ slug: "mi reto", password_admin: "contraseña-valida" }));
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/slug/);
    expect(llamadasA("retos", "insert")).toHaveLength(0);
  });
});

describe("crearReto — contraseña de admin obligatoria", () => {
  it("rechaza sin contraseña y no crea el reto", async () => {
    const resultado = await crearReto(null, formularioReto({ slug: "reto-nuevo" }));
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/al menos 8/);
    expect(llamadasA("retos", "insert")).toHaveLength(0);
    expect(guardarHashAdminSpy).not.toHaveBeenCalled();
  });

  it("rechaza una contraseña de menos de 8 caracteres sin repetirla en el mensaje", async () => {
    const resultado = await crearReto(null, formularioReto({ slug: "reto-nuevo", password_admin: "1234567" }));
    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/al menos 8/);
    expect(JSON.stringify(resultado)).not.toContain("1234567");
    expect(llamadasA("retos", "insert")).toHaveLength(0);
  });

  it("guarda para el reto creado un hash scrypt que verifica la contraseña, nunca el texto plano", async () => {
    const password = "contraseña-del-reto-nuevo";

    const resultado = await crearReto(null, formularioReto({ slug: "reto-nuevo", password_admin: password }));

    expect(guardarHashAdminSpy).toHaveBeenCalledTimes(1);
    const [retoId, hashGuardado] = guardarHashAdminSpy.mock.calls[0];
    expect(retoId).toBe(ID_RETO_CREADO);
    expect(hashGuardado).toMatch(/^scrypt\$/);
    expect(hashGuardado).not.toContain(password);
    await expect(verificarPassword(password, hashGuardado)).resolves.toBe(true);
    expect(JSON.stringify(llamadas)).not.toContain(password);
    expect(JSON.stringify(resultado)).not.toContain(password);
  });

  it("si falla guardar la credencial, avisa de que el reto se creó y hay que fijarla editándolo", async () => {
    const password = "contraseña-valida";
    guardarHashAdminSpy.mockRejectedValueOnce(new Error(`fallo de BD con ${password}`));

    const resultado = await crearReto(
      null,
      formularioReto({ slug: "reto-nuevo", nombre: "Mi reto", password_admin: password })
    );

    expect(resultado).toEqual({
      ok: false,
      mensaje: "El reto «Mi reto» se creó, pero no se pudo guardar la contraseña: fíjala editándolo.",
    });
    expect(llamadasA("retos", "insert")).toHaveLength(1);
  });
});

describe("editarReto — resultado", () => {
  it("si guarda bien redirige al panel con el aviso de guardado de ese reto", async () => {
    await expect(editarReto(3, null, formularioReto({ activo: "true" }))).rejects.toMatchObject({
      url: "/superadmin?guardado=3",
    });
    expect(llamadasA("retos", "update")).toHaveLength(1);
  });

  it("con datos inválidos devuelve ok:false con el mensaje y no actualiza", async () => {
    const resultado = await editarReto(3, null, formularioReto({ activo: "true", nombre: "" }));

    expect(resultado).toEqual({ ok: false, mensaje: "El nombre es obligatorio." });
    expect(llamadasA("retos", "update")).toHaveLength(0);
  });

  it("si la BD falla devuelve ok:false con un mensaje claro", async () => {
    respuestas["retos.update"] = { data: null, error: { message: "fallo" } };

    const resultado = await editarReto(3, null, formularioReto({ activo: "true" }));

    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/^No se pudieron guardar los cambios/);
  });

  it("si el reto ya no existe lo dice en vez de fingir que guardó", async () => {
    respuestas["retos.update"] = { data: [], error: null };

    const resultado = await editarReto(3, null, formularioReto({ activo: "true" }));

    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/ya no existe/);
  });

  it("con la sesión caducada no actualiza nada", async () => {
    sesionValida = false;

    const resultado = await editarReto(3, null, formularioReto({ activo: "true" }));

    expect(resultado.ok).toBe(false);
    expect(llamadas).toHaveLength(0);
  });
});

describe("editarReto — contraseña de admin opcional", () => {
  it("con el campo vacío actualiza el reto sin tocar la credencial", async () => {
    await expect(editarReto(3, null, formularioReto({ activo: "true", password_admin: "" }))).rejects.toBeInstanceOf(
      RedireccionSimulada
    );

    expect(llamadasA("retos", "update")).toHaveLength(1);
    expect(guardarHashAdminSpy).not.toHaveBeenCalled();
  });

  it("sin el campo en el formulario tampoco toca la credencial", async () => {
    await expect(editarReto(3, null, formularioReto({ activo: "true" }))).rejects.toBeInstanceOf(RedireccionSimulada);

    expect(guardarHashAdminSpy).not.toHaveBeenCalled();
  });

  it("con una contraseña nueva válida guarda su hash scrypt para ese reto", async () => {
    await expect(
      editarReto(3, null, formularioReto({ activo: "true", password_admin: "otra-contraseña-nueva" }))
    ).rejects.toBeInstanceOf(RedireccionSimulada);

    expect(guardarHashAdminSpy).toHaveBeenCalledTimes(1);
    const [retoId, hashGuardado] = guardarHashAdminSpy.mock.calls[0];
    expect(retoId).toBe(3);
    expect(hashGuardado).toMatch(/^scrypt\$/);
    await expect(verificarPassword("otra-contraseña-nueva", hashGuardado)).resolves.toBe(true);
  });

  it("con una contraseña nueva de menos de 8 caracteres falla sin actualizar nada ni repetirla", async () => {
    const resultado = await editarReto(3, null, formularioReto({ activo: "true", password_admin: "corta" }));

    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/al menos 8/);
    expect(resultado.mensaje).not.toContain("corta");
    expect(llamadasA("retos", "update")).toHaveLength(0);
    expect(guardarHashAdminSpy).not.toHaveBeenCalled();
  });

  it("si falla guardar la contraseña nueva avisa de que el resto sí se guardó, sin redirigir", async () => {
    const password = "otra-contraseña-nueva";
    guardarHashAdminSpy.mockRejectedValueOnce(new Error("fallo"));

    const resultado = await editarReto(3, null, formularioReto({ activo: "true", password_admin: password }));

    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/se guardaron, pero no se pudo cambiar la contraseña/);
    expect(JSON.stringify(resultado)).not.toContain(password);
  });
});

describe("eliminarReto", () => {
  it("si elimina bien redirige al panel con el slug del reto eliminado", async () => {
    await expect(eliminarReto(3)).rejects.toMatchObject({ url: "/superadmin?eliminado=reto-borrado" });
    expect(llamadasA("retos", "delete")).toHaveLength(1);
  });

  it("si la BD falla devuelve ok:false con un mensaje claro", async () => {
    respuestas["retos.delete"] = { data: null, error: { message: "fallo" } };

    await expect(eliminarReto(3)).resolves.toEqual({
      ok: false,
      mensaje: "No se pudo eliminar el reto. Inténtalo de nuevo.",
    });
  });

  it("si el reto ya no existía lo dice en vez de redirigir", async () => {
    respuestas["retos.delete"] = { data: [], error: null };

    const resultado = await eliminarReto(3);

    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/ya no existe/);
  });

  it("rechaza un id no válido sin tocar la BD", async () => {
    const resultado = await eliminarReto(Number.NaN);

    expect(resultado.ok).toBe(false);
    expect(llamadas).toHaveLength(0);
  });

  it("con la sesión caducada no elimina nada", async () => {
    sesionValida = false;

    const resultado = await eliminarReto(3);

    expect(resultado.ok).toBe(false);
    expect(llamadas).toHaveLength(0);
  });
});

describe("crearReto — token del GPS (DT-035)", () => {
  it("genera el token del GPS del reto recién creado", async () => {
    await crearReto(null, formularioReto({ slug: "reto-nuevo", password_admin: "contraseña-valida" }));

    expect(asignarTokenGpsNuevoSpy).toHaveBeenCalledWith(ID_RETO_CREADO);
  });

  it("si falla el token, el reto se crea igual y avisa de que se puede generar desde su tarjeta", async () => {
    asignarTokenGpsNuevoSpy.mockResolvedValue(false);

    const resultado = await crearReto(
      null,
      formularioReto({ slug: "reto-nuevo", nombre: "Mi reto", password_admin: "contraseña-valida" })
    );

    expect(resultado.ok).toBe(true);
    expect(resultado.mensaje).toMatch(/Reto «Mi reto» creado..*token del GPS.*«Generar»/);
  });

  it("no genera token si el reto no llega a crearse", async () => {
    respuestas["retos.insert"] = { data: null, error: { code: "23505", message: "duplicate" } };

    await crearReto(null, formularioReto({ slug: "repetido", password_admin: "contraseña-valida" }));

    expect(asignarTokenGpsNuevoSpy).not.toHaveBeenCalled();
  });
});

describe("regenerarTokenGpsReto (DT-035)", () => {
  it("genera un token nuevo para el reto y no lo incluye en el resultado", async () => {
    const resultado = await regenerarTokenGpsReto(3);

    expect(resultado.ok).toBe(true);
    expect(asignarTokenGpsNuevoSpy).toHaveBeenCalledWith(3);
    expect(Object.keys(resultado).sort()).toEqual(["mensaje", "ok"]);
  });

  it("con la sesión caducada no genera nada", async () => {
    sesionValida = false;

    const resultado = await regenerarTokenGpsReto(3);

    expect(resultado.ok).toBe(false);
    expect(resultado.mensaje).toMatch(/sesión/);
    expect(asignarTokenGpsNuevoSpy).not.toHaveBeenCalled();
  });

  it("rechaza un id no válido sin tocar la BD", async () => {
    const resultado = await regenerarTokenGpsReto(-1);

    expect(resultado.ok).toBe(false);
    expect(asignarTokenGpsNuevoSpy).not.toHaveBeenCalled();
  });

  it("si no se puede guardar devuelve un mensaje claro", async () => {
    asignarTokenGpsNuevoSpy.mockResolvedValue(false);

    await expect(regenerarTokenGpsReto(3)).resolves.toEqual({
      ok: false,
      mensaje: "No se pudo generar el token del GPS. Inténtalo de nuevo.",
    });
  });
});
