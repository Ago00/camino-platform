import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  crearSesion,
  renovarSesion,
  verificarSesion,
  verificarSesionEnProxy,
} from "@/lib/auth/admin-session";

const RETO_A = { id: 1, slug: "reto-a" };
const RETO_B = { id: 2, slug: "reto-b" };
const HUELLA_A = "huellaDelRetoA01";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-08-01T10:00:00Z");

function decodificarPayload(cookie: string): unknown {
  const [payload] = cookie.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function firmaDe(cookie: string): string {
  return cookie.split(".")[1];
}

function payloadEnBase64(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

describe("admin-session — verificación completa (verificarSesion)", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-de-test-suficientemente-largo");
  });

  it("acepta una cookie recién creada para el mismo reto y la misma huella", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    expect(verificarSesion(cookie, RETO_A, HUELLA_A, AHORA)).toBe(true);
  });

  it("rechaza la sesión del reto A en el reto B", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    expect(verificarSesion(cookie, RETO_B, HUELLA_A, AHORA)).toBe(false);
  });

  it("rechaza si coincide el slug pero no el id del reto (reto borrado y recreado con el mismo slug)", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    expect(verificarSesion(cookie, { id: 99, slug: RETO_A.slug }, HUELLA_A, AHORA)).toBe(false);
  });

  it("rechaza si la huella de la credencial ha cambiado (contraseña cambiada)", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    expect(verificarSesion(cookie, RETO_A, "huellaNuevaDistint", AHORA)).toBe(false);
  });

  it("rechaza siempre si el reto no tiene credencial (huellaActual null)", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    expect(verificarSesion(cookie, RETO_A, null, AHORA)).toBe(false);
  });

  it("sigue siendo válida justo antes de cumplir el TTL de 7 días", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    const justoAntes = new Date(AHORA.getTime() + TTL_MS - 1000);
    expect(verificarSesion(cookie, RETO_A, HUELLA_A, justoAntes)).toBe(true);
  });

  it("expira pasados los 7 días de TTL", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    const despues = new Date(AHORA.getTime() + TTL_MS + 1000);
    expect(verificarSesion(cookie, RETO_A, HUELLA_A, despues)).toBe(false);
  });

  it("rechaza una cookie con la firma alterada", () => {
    const [payload] = crearSesion(RETO_A, HUELLA_A, AHORA).split(".");
    const manipulada = `${payload}.firmafalsaquenocoincide00000000000000000`;
    expect(verificarSesion(manipulada, RETO_A, HUELLA_A, AHORA)).toBe(false);
  });

  it("rechaza un payload alterado (otro reto) aunque reutilice la firma original", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    const payloadFalso = payloadEnBase64({ r: RETO_B.id, s: RETO_B.slug, v: HUELLA_A, exp: AHORA.getTime() + TTL_MS });
    expect(verificarSesion(`${payloadFalso}.${firmaDe(cookie)}`, RETO_B, HUELLA_A, AHORA)).toBe(false);
  });

  it("rechaza una cookie firmada con un secreto distinto (tras rotar ADMIN_SESSION_SECRET)", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    vi.stubEnv("ADMIN_SESSION_SECRET", "otro-secreto-completamente-distinto");
    expect(verificarSesion(cookie, RETO_A, HUELLA_A, AHORA)).toBe(false);
  });

  it("rechaza una cookie con el formato antiguo `{exp}` aunque esté bien firmada", () => {
    const payloadAntiguo = payloadEnBase64({ exp: AHORA.getTime() + TTL_MS });
    const firma = createHmacBase64Url(payloadAntiguo, "secreto-de-test-suficientemente-largo");
    expect(verificarSesion(`${payloadAntiguo}.${firma}`, RETO_A, HUELLA_A, AHORA)).toBe(false);
    expect(verificarSesionEnProxy(`${payloadAntiguo}.${firma}`, RETO_A.slug, AHORA)).toBeNull();
  });

  it("rechaza valores sin el formato payload.firma, null y undefined sin lanzar", () => {
    for (const valor of ["valor-sin-punto", "a.b.c", "", null, undefined]) {
      expect(verificarSesion(valor, RETO_A, HUELLA_A, AHORA)).toBe(false);
    }
  });

  it("lanza al crear una sesión si falta ADMIN_SESSION_SECRET", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect(() => crearSesion(RETO_A, HUELLA_A, AHORA)).toThrow(/ADMIN_SESSION_SECRET/);
  });

  it("verificarSesion devuelve false (no lanza) si falta ADMIN_SESSION_SECRET", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect(verificarSesion(cookie, RETO_A, HUELLA_A, AHORA)).toBe(false);
  });
});

describe("admin-session — verificación en proxy (verificarSesionEnProxy)", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-de-test-suficientemente-largo");
  });

  it("devuelve el payload si la cookie es del slug de la URL", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    expect(verificarSesionEnProxy(cookie, RETO_A.slug, AHORA)).toEqual({
      r: RETO_A.id,
      s: RETO_A.slug,
      v: HUELLA_A,
      exp: AHORA.getTime() + TTL_MS,
    });
  });

  it("rechaza la sesión del reto A en la URL del reto B", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    expect(verificarSesionEnProxy(cookie, RETO_B.slug, AHORA)).toBeNull();
  });

  it("rechaza cookies caducadas o manipuladas", () => {
    const cookie = crearSesion(RETO_A, HUELLA_A, AHORA);
    expect(verificarSesionEnProxy(cookie, RETO_A.slug, new Date(AHORA.getTime() + TTL_MS + 1))).toBeNull();
    expect(verificarSesionEnProxy("x.y", RETO_A.slug, AHORA)).toBeNull();
  });
});

describe("admin-session — renovarSesion", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "secreto-de-test-suficientemente-largo");
  });

  it("conserva r/s/v y reinicia la caducidad desde el nuevo instante", () => {
    const original = crearSesion(RETO_A, HUELLA_A, AHORA);
    const payload = verificarSesionEnProxy(original, RETO_A.slug, AHORA);
    if (!payload) throw new Error("la sesión original debería ser válida");

    const masTarde = new Date(AHORA.getTime() + 6 * 24 * 60 * 60 * 1000);
    const renovada = renovarSesion(payload, masTarde);

    expect(decodificarPayload(renovada)).toEqual({
      r: RETO_A.id,
      s: RETO_A.slug,
      v: HUELLA_A,
      exp: masTarde.getTime() + TTL_MS,
    });
    const pasadoElTtlOriginal = new Date(AHORA.getTime() + TTL_MS + 1000);
    expect(verificarSesion(renovada, RETO_A, HUELLA_A, pasadoElTtlOriginal)).toBe(true);
    expect(verificarSesion(renovada, RETO_A, "otraHuella000000", pasadoElTtlOriginal)).toBe(false);
  });
});

function createHmacBase64Url(payload: string, secreto: string): string {
  return createHmac("sha256", secreto).update(payload).digest("base64url");
}
