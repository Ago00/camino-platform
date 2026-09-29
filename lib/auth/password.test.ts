import { describe, expect, it } from "vitest";
import { HASH_SENTINELA, hashearPassword, huellaCredencial, verificarPassword } from "@/lib/auth/password";

describe("hashearPassword / verificarPassword", () => {
  it("verifica la misma contraseña contra su hash", async () => {
    const hash = await hashearPassword("contraseña-del-reto");
    await expect(verificarPassword("contraseña-del-reto", hash)).resolves.toBe(true);
  });

  it("rechaza una contraseña distinta", async () => {
    const hash = await hashearPassword("contraseña-del-reto");
    await expect(verificarPassword("contraseña-del-retO", hash)).resolves.toBe(false);
    await expect(verificarPassword("", hash)).resolves.toBe(false);
  });

  it("genera el formato scrypt$N$r$p$salt$hash sin contener la contraseña en claro", async () => {
    const hash = await hashearPassword("texto-plano-visible");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain("texto-plano-visible");
  });

  it("dos hashes de la misma contraseña son distintos (salt nuevo) y ambos verifican", async () => {
    const primero = await hashearPassword("misma");
    const segundo = await hashearPassword("misma");
    expect(primero).not.toBe(segundo);
    await expect(verificarPassword("misma", primero)).resolves.toBe(true);
    await expect(verificarPassword("misma", segundo)).resolves.toBe(true);
  });

  it("devuelve false sin lanzar ante hashes corruptos o con parámetros fuera de rango", async () => {
    const valido = await hashearPassword("x");
    const [, , , , salt, clave] = valido.split("$");
    const corruptos = [
      "",
      "texto-plano",
      "scrypt$",
      "bcrypt$16384$8$1$" + salt + "$" + clave,
      "scrypt$abc$8$1$" + salt + "$" + clave,
      "scrypt$1000$8$1$" + salt + "$" + clave, // N no potencia de 2
      `scrypt$${1 << 20}$8$1$${salt}$${clave}`, // N desorbitado
      "scrypt$16384$8$1$" + salt + "$" + clave.slice(0, 10), // clave truncada
      "scrypt$16384$8$1$$" + clave, // sin salt
      valido + "$extra",
    ];
    for (const guardado of corruptos) {
      await expect(verificarPassword("x", guardado)).resolves.toBe(false);
    }
  });

  it("HASH_SENTINELA es un hash con formato válido que no verifica contraseñas habituales", async () => {
    await expect(verificarPassword("", HASH_SENTINELA)).resolves.toBe(false);
    await expect(verificarPassword("admin", HASH_SENTINELA)).resolves.toBe(false);
    expect(HASH_SENTINELA.split("$")).toHaveLength(6);
  });
});

describe("huellaCredencial", () => {
  it("es determinista, de 16 caracteres y cambia al cambiar el hash", async () => {
    const hashA = await hashearPassword("misma");
    const hashB = await hashearPassword("misma");
    expect(huellaCredencial(hashA)).toBe(huellaCredencial(hashA));
    expect(huellaCredencial(hashA)).toHaveLength(16);
    expect(huellaCredencial(hashA)).not.toBe(huellaCredencial(hashB));
  });
});
