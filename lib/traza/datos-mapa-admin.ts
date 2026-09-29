/**
 * Datos server-side para la pestaña "Mapa" del panel admin (DT-021,
 * docs/tecnico/decisiones-tecnicas.md).
 *
 * A diferencia de la web pública (que solo recibe `ProgresoPublico` vía
 * `aProgresoPublico`/`calcularProgresoLibre`), el admin necesita el
 * `Progreso` crudo del modo guiado para poder exponer `puntoProyectado` — el
 * punto real de la traza oficial que usa el cálculo de `kmRestantes`, nunca
 * expuesto al público (ver lib/traza/progreso-publico.ts). Por eso este
 * módulo llama a `calcularProgreso` directamente, sin pasar por
 * `aProgresoPublico`.
 *
 * Unión discriminada por `modo`, con un tercer caso "sin-intento" (además de
 * "guiado"/"libre" de `ModoIntento`) para cuando no hay ningún intento activo
 * — mismo criterio que ya usa `SeccionPosicion.tsx` ("No hay ningún intento
 * activo."), aquí como valor tipado en vez de JSX condicional.
 *
 * Opera sobre el reto del panel (FP2.5, DT-028): intento activo filtrado por
 * `reto.id` y trazas de `reto.ruta_id`.
 */

import { getSupabaseAdmin, type BaseDeDatos } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { obtenerHistoricoCompleto } from "@/lib/traza/progreso-actual";
import { cargarTrazaDeCalculo } from "@/lib/traza/cargar-traza";
import { cargarTrazaDeMapa } from "@/lib/traza/cargar-traza-mapa";
import { calcularProgreso } from "@/lib/traza/proyeccion";
import { calcularProgresoLibre } from "@/lib/traza/progreso-libre";
import { soloIntentoActivoDelReto } from "@/lib/supabase/intentos";
import type { ModoIntento, Reto } from "@/lib/types";

interface PuntoLatLon {
  lat: number;
  lon: number;
}

export type DatosMapaAdmin =
  | {
      modo: "guiado";
      trazaOficial: [number, number][];
      trazaReal: PuntoLatLon[];
      posicionActual: PuntoLatLon | null;
      puntoReferencia: PuntoLatLon | null;
    }
  | {
      modo: "libre";
      trazaReal: PuntoLatLon[];
      posicionActual: PuntoLatLon | null;
    }
  | { modo: "sin-intento" };

interface IntentoActivoConModo {
  id: number;
  modo: ModoIntento;
}

/**
 * Compatibilidad temporal con la migración `supabase/migrations/0003_modo_intento.sql`
 * sin aplicar todavía en el entorno real (ver DEBT.md, "recordatorio: aplicar
 * 0003_modo_intento.sql"): si la consulta con `modo` falla (columna
 * inexistente), reintenta con el select mínimo y trata el intento como modo
 * 'guiado' — mismo patrón ya usado en `app/page.tsx` y
 * `lib/traza/progreso-actual.ts`.
 */
export async function obtenerDatosMapaAdmin(
  reto: Pick<Reto, "id" | "ruta_id">
): Promise<DatosMapaAdmin> {
  const supabase = getSupabaseAdmin();

  const { data: intentoActivo, error } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id, modo"),
    reto.id
  ).maybeSingle();

  const intento: IntentoActivoConModo | null = error
    ? await obtenerIntentoActivoModoGuiado(supabase, reto.id)
    : intentoActivo;

  if (!intento) {
    return { modo: "sin-intento" };
  }

  const historico = await obtenerHistoricoCompleto(supabase, intento.id);
  const trazaReal: PuntoLatLon[] = historico.map((p) => ({ lat: p.lat, lon: p.lon }));

  // Sin ruta en el reto no hay traza oficial que pintar ni sobre la que
  // proyectar: se muestra como modo libre (mismo criterio que
  // `calcularProgresoActual`).
  if (intento.modo === "libre" || reto.ruta_id === null) {
    const progresoLibre = calcularProgresoLibre(historico, null);
    return {
      modo: "libre",
      trazaReal,
      posicionActual: progresoLibre.ultimaPosicion
        ? { lat: progresoLibre.ultimaPosicion.lat, lon: progresoLibre.ultimaPosicion.lon }
        : null,
    };
  }

  const traza = cargarTrazaDeCalculo(reto.ruta_id);
  const progreso = calcularProgreso(historico, traza);

  return {
    modo: "guiado",
    trazaOficial: cargarTrazaDeMapa(reto.ruta_id),
    trazaReal,
    posicionActual: progreso.ultimaPosicion
      ? { lat: progreso.ultimaPosicion.lat, lon: progreso.ultimaPosicion.lon }
      : null,
    puntoReferencia: progreso.puntoProyectado,
  };
}

async function obtenerIntentoActivoModoGuiado(
  supabase: SupabaseClient<BaseDeDatos>,
  retoId: number
): Promise<IntentoActivoConModo | null> {
  const { data } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id"),
    retoId
  ).maybeSingle();

  return data ? { id: data.id, modo: "guiado" } : null;
}
