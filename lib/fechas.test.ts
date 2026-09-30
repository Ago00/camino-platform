import { describe, expect, it } from "vitest";
import { formatearFechaHora, formatearHora, minutosDelDiaEnEspana } from "@/lib/fechas";

describe("fechas en hora española", () => {
  it("formatea la hora en Europe/Madrid, no en la zona del proceso (verano, UTC+2)", () => {
    expect(formatearHora("2026-09-30T05:41:00Z")).toBe("07:41");
  });

  it("aplica el horario de invierno (UTC+1)", () => {
    expect(formatearHora("2026-01-15T05:41:00Z")).toBe("06:41");
  });

  it("acepta Date además de ISO", () => {
    expect(formatearHora(new Date("2026-09-30T21:05:00Z"))).toBe("23:05");
  });

  it("la fecha completa también va en hora española (cambio de día incluido)", () => {
    expect(formatearFechaHora("2026-09-30T22:30:00Z")).toContain("1/10/26");
  });

  it("minutosDelDiaEnEspana usa la hora española", () => {
    expect(minutosDelDiaEnEspana(new Date("2026-09-30T05:41:00Z"))).toBe(7 * 60 + 41);
    expect(minutosDelDiaEnEspana(new Date("2026-09-30T22:30:00Z"))).toBe(30);
  });
});
