// Web pública del reto (F3). Server Component: lee el intento activo (fase
// antes/durante/llegada), el progreso inicial y los textos, y renderiza el
// modo correspondiente. Sin intento activo en BD, se trata como fase "antes".
//
// FP1 (DT-026): ruta dinámica `/:slug/`. El slug se resuelve a un `Reto`
// (validado en el layout) y su `ruta_id` se usa para cargar la traza correcta.
// El `slug` se pasa como prop a los componentes cliente que hacen fetch.

import { getSupabasePublic } from "@/lib/supabase/public";
import { obtenerTodasLasFilas } from "@/lib/supabase/paginacion";
import { CACHE_TTL_MS, guardarCacheProgreso, obtenerCacheProgreso } from "@/lib/progreso-cache";
import { guardarCacheHistorico, obtenerCacheHistorico } from "@/lib/historico-cache";
import { cargarTrazaDeCalculo } from "@/lib/traza/cargar-traza";
import { cargarTrazaDeMapa } from "@/lib/traza/cargar-traza-mapa";
import { calcularProgreso } from "@/lib/traza/proyeccion";
import { aProgresoPublico } from "@/lib/traza/progreso-publico";
import { calcularProgresoLibre } from "@/lib/traza/progreso-libre";
import { obtenerTextos, type Textos } from "@/lib/textos/obtener-textos";
import { TEXTOS_POR_DEFECTO } from "@/lib/textos/defaults";
import { calcularRitmoMedioIntento } from "@/lib/ritmo";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";
import type { Fase, ModoIntento, Posicion, ProgresoPublicoGuiado, ProgresoPublicoLibre } from "@/lib/types";
import PeregrinoLibre from "@/components/publico/PeregrinoLibre";
import ModoAntes from "@/components/publico/ModoAntes";
import ModoDurante from "@/components/publico/ModoDurante";
import ModoDuranteLibre from "@/components/publico/ModoDuranteLibre";
import ModoLlegada from "@/components/publico/ModoLlegada";
import ModoLlegadaLibre from "@/components/publico/ModoLlegadaLibre";
import type { EntradaMinutoAMinutoPublica } from "@/components/publico/MinutoAMinuto";
import RefrescoAlCambiarFase from "@/components/publico/RefrescoAlCambiarFase";

// La fase y el progreso se leen de Supabase en cada petición: sin esto,
// Next.js prerenderizaría la ruta una vez en build y el HTML quedaría
// congelado para siempre en producción.
export const dynamic = "force-dynamic";

const C = { paper: "#F4F3EF", ink: "#1B211D" };

interface SlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SlugPage({ params }: SlugPageProps) {
  const { slug } = await params;
  // El layout ya validó que el reto existe; null solo si hay un error de BD
  // puntual — se degradaa fase "antes" como en el resto de fallos.
  const reto = await obtenerRetoPorSlug(slug);
  const rutaId = reto?.ruta_id ?? "portuguesa-110";

  const [intentoActivo, textos] = await Promise.all([obtenerIntentoActivo(), obtenerTextos()]);
  const trazaCoords = cargarTrazaDeMapa(rutaId);
  const fase = intentoActivo?.fase ?? "antes";

  return (
    <div className="min-h-dvh w-full" style={{ background: C.paper, color: C.ink }}>
      <RefrescoAlCambiarFase faseActual={fase} slug={slug} />
      <PeregrinoLibre />
      <div className="mx-auto w-full max-w-[480px] px-5 pb-28">
        {fase === "antes" && <ModoAntes textos={textos} trazaCoords={trazaCoords} slug={slug} />}
        {fase === "durante" && intentoActivo && (
          intentoActivo.modo === "libre" ? (
            <ModoDuranteLibreConectado
              intentoId={intentoActivo.id}
              destino={destinoDelIntento(intentoActivo)}
              startedAt={intentoActivo.started_at}
              textos={textos}
              slug={slug}
            />
          ) : (
            <ModoDuranteConectado
              intentoId={intentoActivo.id}
              startedAt={intentoActivo.started_at}
              trazaCoords={trazaCoords}
              textos={textos}
              rutaId={rutaId}
              slug={slug}
            />
          )
        )}
        {fase === "llegada" && intentoActivo && (
          intentoActivo.modo === "libre" ? (
            <ModoLlegadaLibreConectado
              intentoId={intentoActivo.id}
              destino={destinoDelIntento(intentoActivo)}
              mensajeLlegada={intentoActivo.mensaje_llegada}
              startedAt={intentoActivo.started_at}
              endedAt={intentoActivo.ended_at}
              textos={textos}
              slug={slug}
            />
          ) : (
            <ModoLlegadaConectado
              intentoId={intentoActivo.id}
              startedAt={intentoActivo.started_at}
              endedAt={intentoActivo.ended_at}
              mensajeLlegada={intentoActivo.mensaje_llegada}
              trazaCoords={trazaCoords}
              textos={textos}
              rutaId={rutaId}
              slug={slug}
            />
          )
        )}
      </div>
    </div>
  );
}

async function ModoDuranteConectado({
  intentoId,
  startedAt,
  trazaCoords,
  textos,
  rutaId,
  slug,
}: {
  intentoId: number;
  startedAt: string | null;
  trazaCoords: [number, number][];
  textos: Textos;
  rutaId: string;
  slug: string;
}) {
  const [progresoInicial, historico] = await Promise.all([
    calcularProgresoDelIntento(intentoId, rutaId),
    obtenerHistoricoPosicionesCacheado(intentoId),
  ]);
  const puntosGpsIniciales = historico.map((p) => ({ lat: p.lat, lon: p.lon }));
  return (
    <ModoDurante
      progresoInicial={progresoInicial}
      iniciadoEn={startedAt}
      trazaCoords={trazaCoords}
      puntosGpsIniciales={puntosGpsIniciales}
      textos={textos}
      slug={slug}
    />
  );
}

async function ModoLlegadaConectado({
  intentoId,
  startedAt,
  endedAt,
  mensajeLlegada,
  trazaCoords,
  textos,
  rutaId,
  slug,
}: {
  intentoId: number;
  startedAt: string | null;
  endedAt: string | null;
  mensajeLlegada: string | null;
  trazaCoords: [number, number][];
  textos: Textos;
  rutaId: string;
  slug: string;
}) {
  const [progreso, entradasMinutoAMinuto, historico, fotoLlegadaUrl] = await Promise.all([
    calcularProgresoDelIntento(intentoId, rutaId),
    cargarEntradasMinutoAMinuto(intentoId),
    obtenerHistoricoPosicionesCacheado(intentoId),
    obtenerFotoLlegadaUrl(intentoId),
  ]);
  const tiempoTotal = formatearTiempoTotal(startedAt, endedAt) ?? "—";
  const ritmoMedio = calcularRitmoMedioIntento(progreso.odometroKm, startedAt, endedAt);
  const puntosGps = historico.map((p) => ({ lat: p.lat, lon: p.lon }));

  return (
    <ModoLlegada
      progreso={progreso}
      mensajeLlegada={mensajeLlegada ?? TEXTOS_POR_DEFECTO.mensaje_llegada_default}
      tiempoTotal={tiempoTotal}
      puntosGps={puntosGps}
      ritmoMedio={ritmoMedio}
      trazaCoords={trazaCoords}
      entradasMinutoAMinuto={entradasMinutoAMinuto}
      textos={textos}
      fotoLlegadaUrl={fotoLlegadaUrl}
      slug={slug}
    />
  );
}

/**
 * Foto opcional de llegada (DT-024). Consulta separada del resto de columnas
 * para no acoplar la migración 0006 con la 0003 en el mismo select.
 */
export async function obtenerFotoLlegadaUrl(intentoId: number): Promise<string | null> {
  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase
      .from("intentos")
      .select("foto_llegada_url")
      .eq("id", intentoId)
      .maybeSingle();

    if (error || !data) return null;
    return data.foto_llegada_url;
  } catch {
    return null;
  }
}

async function ModoDuranteLibreConectado({
  intentoId,
  destino,
  startedAt,
  textos,
  slug,
}: {
  intentoId: number;
  destino: { lat: number; lon: number } | null;
  startedAt: string | null;
  textos: Textos;
  slug: string;
}) {
  const { progreso, puntosGps } = await calcularProgresoLibreDelIntento(intentoId, destino);
  return (
    <ModoDuranteLibre
      progresoInicial={progreso}
      puntosGpsIniciales={puntosGps}
      startedAt={startedAt}
      textos={textos}
      slug={slug}
    />
  );
}

async function ModoLlegadaLibreConectado({
  intentoId,
  destino,
  mensajeLlegada,
  startedAt,
  endedAt,
  textos,
  slug,
}: {
  intentoId: number;
  destino: { lat: number; lon: number } | null;
  mensajeLlegada: string | null;
  startedAt: string | null;
  endedAt: string | null;
  textos: Textos;
  slug: string;
}) {
  const [{ progreso, puntosGps }, entradasMinutoAMinuto] = await Promise.all([
    calcularProgresoLibreDelIntento(intentoId, destino),
    cargarEntradasMinutoAMinuto(intentoId),
  ]);

  return (
    <ModoLlegadaLibre
      progreso={progreso}
      mensajeLlegada={mensajeLlegada ?? TEXTOS_POR_DEFECTO.mensaje_llegada_default}
      puntosGps={puntosGps}
      entradasMinutoAMinuto={entradasMinutoAMinuto}
      startedAt={startedAt}
      endedAt={endedAt}
      textos={textos}
      slug={slug}
    />
  );
}

async function cargarEntradasMinutoAMinuto(
  intentoId: number
): Promise<EntradaMinutoAMinutoPublica[]> {
  const supabase = getSupabasePublic();
  const { data } = await supabase
    .from("minuto_a_minuto")
    .select("id, texto, foto_url, lat, lon, created_at")
    .eq("intento_id", intentoId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export interface IntentoActivo {
  id: number;
  fase: Fase;
  modo: ModoIntento;
  destino_lat: number | null;
  destino_lon: number | null;
  started_at: string | null;
  ended_at: string | null;
  mensaje_llegada: string | null;
}

/**
 * Compatibilidad temporal con la migración 0003 sin aplicar. Si la consulta
 * con `modo`/`destino_lat`/`destino_lon` falla, reintenta con el select mínimo
 * y trata el intento como modo guiado.
 */
export async function obtenerIntentoActivo(): Promise<IntentoActivo | null> {
  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase
      .from("intentos")
      .select("id, fase, modo, destino_lat, destino_lon, started_at, ended_at, mensaje_llegada")
      .eq("cerrado", false)
      .maybeSingle();

    if (!error) return data;

    const { data: dataMinima } = await supabase
      .from("intentos")
      .select("id, fase, started_at, ended_at, mensaje_llegada")
      .eq("cerrado", false)
      .maybeSingle();

    return dataMinima ? { ...dataMinima, modo: "guiado", destino_lat: null, destino_lon: null } : null;
  } catch {
    return null;
  }
}

/** Destino del modo libre, o null si el intento no tiene ninguno fijado. */
function destinoDelIntento(intento: IntentoActivo): { lat: number; lon: number } | null {
  return intento.destino_lat !== null && intento.destino_lon !== null
    ? { lat: intento.destino_lat, lon: intento.destino_lon }
    : null;
}

/**
 * Histórico completo paginado (DT-018): sin esto PostgREST corta a 1000 filas.
 */
async function obtenerHistoricoPosiciones(intentoId: number): Promise<Posicion[]> {
  const supabase = getSupabasePublic();
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
 * Fix S2 (DT-021): reutiliza la misma caché compartida para no pagar el fetch
 * paginado en cada visita.
 */
export async function obtenerHistoricoPosicionesCacheado(intentoId: number): Promise<Posicion[]> {
  const cache = obtenerCacheHistorico();
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.valor;
  }

  const historico = await obtenerHistoricoPosiciones(intentoId);
  guardarCacheHistorico(historico);
  return historico;
}

/**
 * S2 (DT-018): reutiliza la caché compartida de /api/progreso. `rutaId` viene
 * del reto activo en vez de estar hardcodeado.
 */
export async function calcularProgresoDelIntento(
  intentoId: number,
  rutaId: string
): Promise<ProgresoPublicoGuiado> {
  const cache = obtenerCacheProgreso();
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS && cache.valor.modo === "guiado") {
    return cache.valor;
  }

  const historico = await obtenerHistoricoPosicionesCacheado(intentoId);
  const traza = cargarTrazaDeCalculo(rutaId);
  const progreso = aProgresoPublico(calcularProgreso(historico, traza));

  guardarCacheProgreso(progreso);

  return progreso;
}

/**
 * Progreso + puntos GPS del modo libre (DT-016).
 */
export async function calcularProgresoLibreDelIntento(
  intentoId: number,
  destino: { lat: number; lon: number } | null
): Promise<{ progreso: ProgresoPublicoLibre; puntosGps: { lat: number; lon: number }[] }> {
  const cache = obtenerCacheProgreso();
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS && cache.valor.modo === "libre") {
    const historico = await obtenerHistoricoPosicionesCacheado(intentoId);
    return { progreso: cache.valor, puntosGps: historico.map((p) => ({ lat: p.lat, lon: p.lon })) };
  }

  const historico = await obtenerHistoricoPosicionesCacheado(intentoId);
  const puntosGps = historico.map((p) => ({ lat: p.lat, lon: p.lon }));

  const progreso: ProgresoPublicoLibre = {
    ...calcularProgresoLibre(historico, destino),
    modo: "libre",
  };

  guardarCacheProgreso(progreso);

  return { progreso, puntosGps };
}

function formatearTiempoTotal(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return null;
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  return `${horas}h ${minutos}min`;
}
