/**
 * Filtro del intento activo (cerrado = false) de un reto concreto (FP2.5,
 * DT-028).
 *
 * Con multi-tenant, "el intento activo" solo tiene sentido dentro de un reto:
 * la BD garantiza como mucho un intento abierto por reto
 * (`intentos_abierto_por_reto`, migración 0009), no uno en todo el sistema.
 * Una consulta `.eq("cerrado", false).maybeSingle()` sin `reto_id` devolvería
 * el intento de otro reto, o fallaría por varias filas, en cuanto haya dos
 * retos con intento abierto — por eso toda búsqueda del intento activo pasa
 * por aquí, que añade siempre los dos filtros juntos.
 *
 * Recibe el builder ya con su `select(...)` en vez de las columnas como
 * string: un helper genérico sobre `select<Columnas>()` obliga a TypeScript a
 * instanciar en diferido el parser de columnas de PostgREST y `tsc` agota la
 * memoria (comprobado). Así el caller conserva el `{ data, error }` tipado
 * según las columnas pedidas y puede aplicar su propio fallback de
 * compatibilidad (p. ej. con la migración 0003 sin aplicar) volviendo a
 * llamar con un select más pequeño.
 *
 * Uso: `await soloIntentoActivoDelReto(supabase.from("intentos").select("id"), reto.id).maybeSingle()`
 */

interface ConsultaFiltrablePorIntento {
  eq(columna: "reto_id", valor: number): this;
  eq(columna: "cerrado", valor: boolean): this;
}

export function soloIntentoActivoDelReto<Consulta extends ConsultaFiltrablePorIntento>(
  consulta: Consulta,
  retoId: number
): Consulta {
  return consulta.eq("reto_id", retoId).eq("cerrado", false);
}
