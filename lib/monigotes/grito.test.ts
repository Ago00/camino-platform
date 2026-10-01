import { describe, expect, it } from "vitest";
import { MONIGOTES } from "@/lib/monigotes/catalogo";
import {
  KM_INICIAL_MOJON,
  bajarKmMojon,
  gritoEfectivo,
  longitudGrito,
  normalizarGritoMonigote,
  partirGrito,
} from "@/lib/monigotes/grito";

const POR_DEFECTO = "¡AUPA ATLETI!";

describe("normalizarGritoMonigote — anchura cero", () => {
  it("un grito hecho solo de caracteres invisibles cuenta como sin personalizar", () => {
    expect(normalizarGritoMonigote("​‎⁠﻿", POR_DEFECTO)).toBeNull();
  });

  it("quita los invisibles intercalados pero conserva el ZWJ de los emoji compuestos", () => {
    expect(normalizarGritoMonigote("¡Ho​la!", POR_DEFECTO)).toBe("¡Hola!");
    expect(normalizarGritoMonigote("¡Vamos 👨‍👩!", POR_DEFECTO)).toBe("¡Vamos 👨‍👩!");
  });
});

describe("normalizarGritoMonigote", () => {
  it("recorta y colapsa espacios, tabuladores y saltos de línea", () => {
    expect(normalizarGritoMonigote("  ¡Vamos   Santi!  ", POR_DEFECTO)).toBe("¡Vamos Santi!");
    expect(normalizarGritoMonigote("¡Vamos\n\tSanti!", POR_DEFECTO)).toBe("¡Vamos Santi!");
  });

  it("quita caracteres de control y marcas bidi invisibles", () => {
    expect(normalizarGritoMonigote("¡Ho\u0000la\u0007!", POR_DEFECTO)).toBe("¡Hola!");
    expect(normalizarGritoMonigote("‮¡Hola!‬", POR_DEFECTO)).toBe("¡Hola!");
    expect(normalizarGritoMonigote("a \u0001 b", POR_DEFECTO)).toBe("a b");
  });

  it("conserva los emoji compuestos (ZWJ)", () => {
    expect(normalizarGritoMonigote("¡Vamos 👨‍👩‍👧!", POR_DEFECTO)).toBe("¡Vamos 👨‍👩‍👧!");
  });

  it("vacío, solo espacios o solo controles ⇒ null (sin personalizar)", () => {
    expect(normalizarGritoMonigote("", POR_DEFECTO)).toBeNull();
    expect(normalizarGritoMonigote("   \n ", POR_DEFECTO)).toBeNull();
    expect(normalizarGritoMonigote("\u0000\u0007", POR_DEFECTO)).toBeNull();
  });

  it("igual al grito por defecto (tras normalizar) ⇒ null", () => {
    expect(normalizarGritoMonigote(POR_DEFECTO, POR_DEFECTO)).toBeNull();
    expect(normalizarGritoMonigote("  ¡AUPA   ATLETI!  ", POR_DEFECTO)).toBeNull();
  });

  it("no recorta a 48: la longitud la valida quien llama", () => {
    expect(normalizarGritoMonigote("a".repeat(49), POR_DEFECTO)).toHaveLength(49);
  });
});

describe("longitudGrito", () => {
  it("cuenta por caracteres como char_length de Postgres: un emoji cuenta 1", () => {
    expect(longitudGrito("😀")).toBe(1);
    expect(longitudGrito("¡Ánimo! 😀")).toBe(9);
    expect(longitudGrito("a".repeat(49))).toBe(49);
  });
});

describe("gritoEfectivo", () => {
  const atleti = MONIGOTES.atleti;
  const mojon = MONIGOTES.mojon;

  it("sin personalizar, el grito del catálogo", () => {
    expect(gritoEfectivo(atleti, null, 100)).toBe("¡AUPA ATLETI!");
  });

  it("personalizado ⇒ el personalizado, normalizado", () => {
    expect(gritoEfectivo(atleti, "  ¡Vamos  Santi! ", 100)).toBe("¡Vamos Santi!");
  });

  it("personalizado vacío ⇒ el del catálogo", () => {
    expect(gritoEfectivo(atleti, "   ", 100)).toBe("¡AUPA ATLETI!");
  });

  it("mojón sin personalizar canta los km de su placa", () => {
    expect(gritoEfectivo(mojon, null, 87)).toBe("¡Quedan 87!");
    expect(gritoEfectivo(mojon, "", 0)).toBe("¡Quedan 0!");
    // Escribir su grito por defecto no lo congela en 100.
    expect(gritoEfectivo(mojon, "¡Quedan 100!", 42)).toBe("¡Quedan 42!");
  });

  it("mojón con grito personalizado ⇒ el personalizado, sin km", () => {
    expect(gritoEfectivo(mojon, "¡Ya casi!", 42)).toBe("¡Ya casi!");
  });
});

describe("bajarKmMojon", () => {
  it("baja uno por pinchazo y al llegar a 0 vuelve a empezar", () => {
    expect(bajarKmMojon(KM_INICIAL_MOJON)).toBe(99);
    expect(bajarKmMojon(1)).toBe(0);
    expect(bajarKmMojon(0)).toBe(KM_INICIAL_MOJON);
  });
});

describe("partirGrito", () => {
  it("una palabra no se parte", () => {
    expect(partirGrito("¡Guau!")).toEqual(["¡Guau!"]);
  });

  it("un grito corto va en dos líneas y uno largo en tres", () => {
    expect(partirGrito("¡AUPA ATLETI!")).toEqual(["¡AUPA", "ATLETI!"]);
    expect(partirGrito("¡En mis tiempos esto se hacía descalzo!")).toHaveLength(3);
  });

  it("no pierde ni reordena palabras", () => {
    const texto = "¡¿Quién ha encendido la luz?!";
    expect(partirGrito(texto).join(" ")).toBe(texto);
  });

  it("vacío ⇒ «¡Ánimo!»", () => {
    expect(partirGrito("   ")).toEqual(["¡Ánimo!"]);
  });
});
