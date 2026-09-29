/**
 * Tests de la contraseña de admin por reto en las acciones del superadmin
 * (FP2.6, DT-029): obligatoria y validada al crear, opcional al editar
 * (vacío = no tocar), y lo que se guarda es siempre un hash scrypt, nunca el
 * texto plano.
 *
 * Supabase se mockea con un builder que registra inserts/updates; la
 * persistencia de la credencial (`guardarHashAdmin`) se sustituye por un
 * espía para inspeccionar exactamente qué valor se habría guardado.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface LlamadaBuilder {
  tabla: string;
  metodo: string;
  args: unknown[];
}

const ID_RETO_CREADO = 7;
let llamadas: LlamadaBuilder[] = [];
const guardarHashAdminSpy = vi.fn<(retoId: number, hash: string) => Promise<void>>();

function crearConsulta(tabla: string) {
  const consulta = {
    insert: (...args: unknown[]) => registrar("insert", args),
    update: (...args: unknown[]) => registrar("update", args),
    select: (...args: unknown[]) => registrar("select", args),
    eq: (...args: unknown[]) => registrar("eq", args),
    single: () => Promise.resolve({ data: { id: ID_RETO_CREADO }, error: null }),
    then: (resolver: (valor: { data: null; error: null }) => void) => resolver({ data: null, error: null }),
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

vi.mock("@/lib/supabase/credenciales-admin", () => ({
  guardarHashAdmin: (retoId: number, hash: string) => guardarHashAdminSpy(retoId, hash),
}));

vi.mock("@/lib/auth/superadmin-session", () => ({
  NOMBRE_COOKIE_SUPERADMIN_SESION: "superadmin_session",
  verificarSesionSuperadmin: () => true,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "cookie-valida" }), delete: () => undefined }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

const { crearReto, editarReto } = await import("@/app/superadmin/(panel)/actions");
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
  guardarHashAdminSpy.mockReset();
  guardarHashAdminSpy.mockResolvedValue(undefined);
});

describe("crearReto — contraseña de admin obligatoria", () => {
  it("rechaza sin contraseña y no crea el reto", async () => {
    await expect(crearReto(formularioReto({ slug: "reto-nuevo" }))).rejects.toThrow(/al menos 8/);
    expect(llamadasA("retos", "insert")).toHaveLength(0);
    expect(guardarHashAdminSpy).not.toHaveBeenCalled();
  });

  it("rechaza una contraseña de menos de 8 caracteres y no crea el reto", async () => {
    await expect(crearReto(formularioReto({ slug: "reto-nuevo", password_admin: "1234567" }))).rejects.toThrow(
      /al menos 8/
    );
    expect(llamadasA("retos", "insert")).toHaveLength(0);
  });

  it("guarda para el reto creado un hash scrypt que verifica la contraseña, nunca el texto plano", async () => {
    const password = "contraseña-del-reto-nuevo";

    await crearReto(formularioReto({ slug: "reto-nuevo", password_admin: password }));

    expect(guardarHashAdminSpy).toHaveBeenCalledTimes(1);
    const [retoId, hashGuardado] = guardarHashAdminSpy.mock.calls[0];
    expect(retoId).toBe(ID_RETO_CREADO);
    expect(hashGuardado).toMatch(/^scrypt\$/);
    expect(hashGuardado).not.toContain(password);
    await expect(verificarPassword(password, hashGuardado)).resolves.toBe(true);
    expect(JSON.stringify(llamadas)).not.toContain(password);
  });

  it("si falla guardar la credencial, avisa de que el reto se creó y hay que fijarla editándolo", async () => {
    guardarHashAdminSpy.mockRejectedValueOnce(new Error("fallo de BD"));

    await expect(
      crearReto(formularioReto({ slug: "reto-nuevo", password_admin: "contraseña-valida" }))
    ).rejects.toThrow("Reto creado; fija la contraseña editándolo.");
    expect(llamadasA("retos", "insert")).toHaveLength(1);
  });
});

describe("editarReto — contraseña de admin opcional", () => {
  it("con el campo vacío actualiza el reto sin tocar la credencial", async () => {
    await editarReto(3, formularioReto({ activo: "true", password_admin: "" }));

    expect(llamadasA("retos", "update")).toHaveLength(1);
    expect(guardarHashAdminSpy).not.toHaveBeenCalled();
  });

  it("sin el campo en el formulario tampoco toca la credencial", async () => {
    await editarReto(3, formularioReto({ activo: "true" }));

    expect(guardarHashAdminSpy).not.toHaveBeenCalled();
  });

  it("con una contraseña nueva válida guarda su hash scrypt para ese reto", async () => {
    await editarReto(3, formularioReto({ activo: "true", password_admin: "otra-contraseña-nueva" }));

    expect(guardarHashAdminSpy).toHaveBeenCalledTimes(1);
    const [retoId, hashGuardado] = guardarHashAdminSpy.mock.calls[0];
    expect(retoId).toBe(3);
    expect(hashGuardado).toMatch(/^scrypt\$/);
    await expect(verificarPassword("otra-contraseña-nueva", hashGuardado)).resolves.toBe(true);
  });

  it("con una contraseña nueva de menos de 8 caracteres falla sin actualizar nada", async () => {
    await expect(editarReto(3, formularioReto({ activo: "true", password_admin: "corta" }))).rejects.toThrow(
      /al menos 8/
    );
    expect(llamadasA("retos", "update")).toHaveLength(0);
    expect(guardarHashAdminSpy).not.toHaveBeenCalled();
  });
});
