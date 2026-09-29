/**
 * calcularProgresoActual(reto): calcula el `ProgresoPublico` del intento
 * activo DE ESE RETO en este preciso momento (FP2.5, DT-028: filtra por
 * `reto.id` y usa la traza de `reto.ruta_id`; si el reto no tiene ruta, el
 * progreso se mide como modo libre) — consulta el intento activo (con compatibilidad
 * temporal si la migración `0003_modo_intento.sql` todavía no está aplicada,
 * ver `DEBT.md`), trae el histórico completo de posiciones (paginado, DT-018;
 * ambos modos desde CURRENT.md/DT-020 — ver nota de cierre de DT-018 en
 * docs/tecnico/decisiones-tecnicas.md) y delega el cálculo de dominio a
 * `calcularProgreso`/`calcularProgresoLibre`.
 *
 * Extraída de `app/api/progreso/route.ts` (DT-019,
 * docs/tecnico/decisiones-tecnicas.md) para que `GET /api/progreso` y
 * `crearMinutoAMinuto` (`app/admin/actions.ts`) compartan exactamente la
 * misma lógica sin duplicarla. `route.ts` no cambia de comportamiento — solo
 * pasa a importar esta función en vez de definirla. `crearMinutoAMinuto` la
 * usa como camino de respaldo cuando la caché compartida
 * (`lib/progreso-cache.ts`, DT-007/DT-014) está vacía en la instancia
 * serverless que atiende la publicación: en vez de guardar `lat`/`lon` a
 * `null` directamente, recalcula con esta misma función — así la posición
 * guardada en el feed coincide siempre con "la última posición enviada y
 * pintada" (el mismo objetivo de DT-014), incluso en el camino de respaldo,
 * nunca con una lectura en bruto de `posiciones` que podría no ser la que el
 * dominio considera válida (en modo guiado, `calcularProgreso` puede
 * descartar el último punto por velocidad implícita imposible).
 *
 * Sin caché propia: no lee ni escribe `lib/progreso-cache.ts` — eso lo
 * decide quien llama (`route.ts` siempre; `crearMinutoAMinuto` solo si la
 * caché estaba vacía).
 */

import { getSupabasePublic } from "@/lib/supabase/public";
import { obtenerTodasLasFilas } from "@/lib/supabase/paginacion";
import { cargarTrazaDeCalculo } from "@/lib/traza/cargar-traza";
import { calcularProgreso } from "@/lib/traza/proyeccion";
import { aProgresoPublico } from "@/lib/traza/progreso-publico";
import { calcularProgresoLibre } from "@/lib/traza/progreso-libre";
import { soloIntentoActivoDelReto } from "@/lib/supabase/intentos";
import type { Posicion, ProgresoPublico, Reto } from "@/lib/types";

interface IntentoActivoConModo {
  id: number;
  modo: "guiado" | "libre";
  destino_lat: number | null;
  destino_lon: number | null;
}

/**
 * Compatibilidad temporal con la migración sin aplicar (ver DEBT.md,
 * "recordatorio: aplicar supabase/migrations/0003_modo_intento.sql"): si las
 * columnas modo/destino_lat/destino_lon todavía no existen en la BD real, la
 * consulta del intento activo falla. Sin manejo explícito, ese error se leía
 * como "sin intento activo" (progresoVacio()) y la web pública mostraba la
 * fase "antes" aunque el intento real estuviera en "durante"/"llegada". En
 * ese caso se reintenta con el select mínimo (solo `id`) y se trata el
 * intento como modo 'guiado', el comportamiento exacto que este endpoint ya
 * tenía antes de DT-016.
 *
 * Histórico de posiciones (DT-018, docs/tecnico/decisiones-tecnicas.md):
 * ambos modos necesitan el histórico COMPLETO, paginado con
 * `obtenerTodasLasFilas` (lib/supabase/paginacion.ts, tope de seguridad de
 * 50.000 filas), sin el corte a 1000 filas de PostgREST.
 * - Modo guiado: `calcularProgreso` lo necesitaba desde siempre — el
 *   odómetro suma distancia real entre cada par consecutivo, y el máximo
 *   monótono se calcula sobre toda la secuencia. La proyección en sí usa
 *   ventana deslizante (lib/traza/proyeccion.ts) para que traer el
 *   histórico completo siga siendo rápido a escala de un día entero de reto.
 * - Modo libre: hasta CURRENT.md/DT-020, `calcularProgresoLibre` solo usaba
 *   la posición más reciente, así que este endpoint (con polling cada 30 s)
 *   pedía únicamente esa fila (`order(ts desc).limit(1)`) — optimización de
 *   DT-018. Desde que `calcularProgresoLibre` también calcula `odometroKm`
 *   (suma de tramos entre posiciones consecutivas), esa premisa dejó de ser
 *   cierta: con un histórico de una sola fila el odómetro devuelto en cada
 *   poll era siempre 0, aunque la carga inicial de página (con el histórico
 *   completo, `app/page.tsx`) mostrara el valor correcto — revertido a pedir
 *   el histórico completo, igual que modo guiado. Ver la nota de cierre de
 *   DT-018 en docs/tecnico/decisiones-tecnicas.md: el coste adicional es
 *   solo de lectura/paginación (no hay ventana deslizante ni proyección
 *   sobre traza en modo libre — `calcularProgresoLibre` es O(n) trivial,
 *   sin relación con el vector de denegación de servicio que motivó S1/S2),
 *   y queda acotado por el mismo tope de `obtenerTodasLasFilas` y por la
 *   misma caché compartida TTL 20 s que ya paga modo guiado
 *   (`lib/progreso-cache.ts`, DT-007).
 */
export async function calcularProgresoActual(
  reto: Pick<Reto, "id" | "ruta_id">
): Promise<ProgresoPublico> {
  const supabase = getSupabasePublic();

  const { data: intentoActivo, error: errorIntento } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id, modo, destino_lat, destino_lon"),
    reto.id
  ).maybeSingle();

  const intento: IntentoActivoConModo | null = errorIntento
    ? await obtenerIntentoActivoModoGuiado(supabase, reto.id)
    : intentoActivo;

  if (!intento) {
    return progresoVacio(reto.ruta_id);
  }

  const historico = await obtenerHistoricoCompleto(supabase, intento.id);

  // Un reto sin ruta (ruta libre, `ruta_id` null) no tiene traza sobre la que
  // proyectar: aunque el intento se iniciara en modo "guiado" (el default de
  // BD), solo se puede medir como modo libre.
  if (intento.modo === "libre" || reto.ruta_id === null) {
    const destino =
      intento.destino_lat !== null && intento.destino_lon !== null
        ? { lat: intento.destino_lat, lon: intento.destino_lon }
        : null;
    return calcularProgresoLibre(historico, destino);
  }

  const traza = cargarTrazaDeCalculo(reto.ruta_id);
  const progreso = calcularProgreso(historico, traza);

  return aProgresoPublico(progreso);
}

/**
 * Histórico completo de posiciones no descartadas del intento, ascendente
 * por `ts` (DT-018) — usado por ambos modos desde CURRENT.md/DT-020 (antes,
 * modo libre solo pedía la última posición; ver docstring de arriba y la
 * nota de cierre de DT-018).
 *
 * Exportada (DT-021): `lib/traza/datos-mapa-admin.ts` la reutiliza con
 * `getSupabaseAdmin()` en vez de `getSupabasePublic()` — ambos clientes
 * comparten exactamente el mismo tipo `SupabaseClient<BaseDeDatos>`
 * (lib/supabase/admin.ts), así que la función acepta cualquiera de los dos
 * sin necesitar una segunda implementación ni una duplicación con `fs`.
 */
export async function obtenerHistoricoCompleto(
  supabase: ReturnType<typeof getSupabasePublic>,
  intentoId: number
): Promise<Posicion[]> {
  return obtenerTodasLasFilas<Posicion>((desde, hasta) =>
    supabase
      .from("posiciones")
      .select("*")
      .eq("intento_id", intentoId)
      .eq("descartado", false)
      .order("ts", { ascending: true })
      .range(desde, hasta)
  );
}

/**
 * Compatibilidad temporal: reintenta con el select mínimo (solo `id`) cuando
 * la consulta con `modo`/`destino_lat`/`destino_lon` falla por columnas
 * inexistentes, y trata el intento como modo 'guiado' sin destino.
 */
async function obtenerIntentoActivoModoGuiado(
  supabase: ReturnType<typeof getSupabasePublic>,
  retoId: number
): Promise<IntentoActivoConModo | null> {
  const { data } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id"),
    retoId
  ).maybeSingle();

  return data ? { id: data.id, modo: "guiado", destino_lat: null, destino_lon: null } : null;
}

/** Progreso en cero; en modo libre si el reto no tiene ruta (no hay traza). */
function progresoVacio(rutaId: string | null): ProgresoPublico {
  if (rutaId === null) {
    return calcularProgresoLibre([], null);
  }
  const traza = cargarTrazaDeCalculo(rutaId);
  return aProgresoPublico(calcularProgreso([], traza));
}
