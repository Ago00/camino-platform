/**
 * Formateo de fechas para mostrar, siempre en hora peninsular española.
 *
 * Sin zona fija, los Server Components (Vercel corre en UTC) pintan las horas
 * 2 h por detrás, y un Client Component renderizado primero en el servidor
 * produce un texto distinto al hidratar en el navegador (error de React #418).
 */

export const ZONA_HORARIA = "Europe/Madrid";

const FORMATO_HORA = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: ZONA_HORARIA,
});

const FORMATO_PARTES_HORA = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ZONA_HORARIA,
});

function aFecha(valor: Date | string): Date {
  return typeof valor === "string" ? new Date(valor) : valor;
}

/** "07:41" */
export function formatearHora(valor: Date | string): string {
  return FORMATO_HORA.format(aFecha(valor));
}

/** "30/9/26, 7:41:05" */
export function formatearFechaHora(valor: Date | string): string {
  return FORMATO_FECHA_HORA.format(aFecha(valor));
}

/** Minutos transcurridos desde la medianoche en hora española (0–1439). */
export function minutosDelDiaEnEspana(fecha: Date): number {
  const partes = FORMATO_PARTES_HORA.formatToParts(fecha);
  const horas = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const minutos = Number(partes.find((p) => p.type === "minute")?.value ?? 0);
  return horas * 60 + minutos;
}
