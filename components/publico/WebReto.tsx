// Composición de la web pública de un reto (Server Component). La usan la web
// pública (app/[slug]/page.tsx) y la vista previa del admin
// (app/[slug]/admin/vista-previa/page.tsx, DT-034), así que las dos pintan
// exactamente lo mismo.
//
// Historia de la composición (antes vivía en app/[slug]/page.tsx):
// - F3: modo antes/durante/llegada según la fase del intento activo; sin
//   intento, "antes".
// - FP1 (DT-026): el `slug` viaja a los componentes cliente que hacen fetch.
// - FP2.5 (DT-028): todo se lee del reto — intento filtrado por `reto_id`,
//   cachés de progreso/histórico por reto. Sin `ruta_id` (ruta libre) no hay
//   traza y el intento se muestra en modo libre.
// - FP3c (DT-032): la configuración del reto viaja a cada modo, que no pinta
//   las secciones apagadas; con el minuto a minuto apagado tampoco se cargan
//   sus entradas en "llegada".
// - DT-034: `fuente` decide si "durante"/"llegada" se pintan con el intento
//   real (cargando sus datos aquí) o con datos de ejemplo ya calculados. Con
//   `vistaPrevia` los formularios no envían, no hay polling y no se monta
//   RefrescoAlCambiarFase (consulta /api/fase y, como la fase previsualizada
//   no tiene por qué coincidir con la real, recargaría el iframe sin parar).

import { getSupabasePublic } from "@/lib/supabase/public";
import { soloIntentoActivoDelReto } from "@/lib/supabase/intentos";
import { obtenerTodasLasFilas } from "@/lib/supabase/paginacion";
import { CACHE_TTL_MS, guardarCacheProgreso, obtenerCacheProgreso } from "@/lib/progreso-cache";
import { guardarCacheHistorico, obtenerCacheHistorico } from "@/lib/historico-cache";
import { cargarTrazaDeCalculo } from "@/lib/traza/cargar-traza";
import { calcularProgreso } from "@/lib/traza/proyeccion";
import { aProgresoPublico } from "@/lib/traza/progreso-publico";
import { calcularProgresoLibre } from "@/lib/traza/progreso-libre";
import type { Textos } from "@/lib/textos/obtener-textos";
import { TEXTOS_POR_DEFECTO } from "@/lib/textos/defaults";
import { calcularRitmoMedioIntento } from "@/lib/ritmo";
import { fotoQuienCaminaDelReto, type ConfigReto } from "@/lib/retos/config";
import type { DatosEjemplo } from "@/lib/vista-previa/datos-ejemplo";
import type {
  EntradaMinutoAMinutoPublica,
  Fase,
  ModoIntento,
  Posicion,
  ProgresoPublicoGuiado,
  ProgresoPublicoLibre,
  Reto,
} from "@/lib/types";
import PeregrinoLibre from "@/components/publico/PeregrinoLibre";
import ModoAntes from "@/components/publico/ModoAntes";
import ModoDurante from "@/components/publico/ModoDurante";
import ModoDuranteLibre from "@/components/publico/ModoDuranteLibre";
import ModoLlegada from "@/components/publico/ModoLlegada";
import ModoLlegadaLibre from "@/components/publico/ModoLlegadaLibre";
import RefrescoAlCambiarFase from "@/components/publico/RefrescoAlCambiarFase";
import { VistaPreviaProvider } from "@/components/publico/VistaPrevia";

const C = { paper: "#F4F3EF", ink: "#1B211D" };

// Constante de módulo (no literal inline): referencia estable como prop de
// componentes cliente con efectos (ver docs/LESSONS.md).
const SIN_ENTRADAS: EntradaMinutoAMinutoPublica[] = [];

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

/** De dónde salen los datos de "durante"/"llegada" (DT-034). */
export type FuenteDatosWeb =
  | { tipo: "real"; intento: IntentoActivo | null }
  | { tipo: "ejemplo"; datos: DatosEjemplo };

interface WebRetoProps {
  reto: Reto;
  config: ConfigReto;
  textos: Textos;
  /** Traza de PINTADO (vacía en un reto sin ruta). */
  trazaCoords: [number, number][];
  fase: Fase;
  fuente: FuenteDatosWeb;
  vistaPrevia: boolean;
}

export default function WebReto({ reto, config, textos, trazaCoords, fase, fuente, vistaPrevia }: WebRetoProps) {
  const slug = reto.slug;

  return (
    <VistaPreviaProvider activa={vistaPrevia}>
      <div className="min-h-dvh w-full" style={{ background: C.paper, color: C.ink }}>
        {!vistaPrevia && <RefrescoAlCambiarFase faseActual={fase} slug={slug} />}
        {config.peregrino_animado && <PeregrinoLibre />}
        <div className="mx-auto w-full max-w-[480px] px-5 pb-28">
          {fase === "antes" && (
            <ModoAntes
              textos={textos}
              trazaCoords={trazaCoords}
              slug={slug}
              config={config}
              fotoQuienCamina={fotoQuienCaminaDelReto(reto)}
            />
          )}
          {fase !== "antes" && fuente.tipo === "real" && fuente.intento && (
            <FaseConIntentoReal
              reto={reto}
              intento={fuente.intento}
              fase={fase}
              trazaCoords={trazaCoords}
              textos={textos}
              config={config}
            />
          )}
          {fase !== "antes" && fuente.tipo === "ejemplo" && (
            <FaseConDatosEjemplo
              datos={fuente.datos}
              fase={fase}
              trazaCoords={trazaCoords}
              textos={textos}
              slug={slug}
              config={config}
            />
          )}
        </div>
      </div>
    </VistaPreviaProvider>
  );
}

/**
 * "durante"/"llegada" con el intento activo. Sin ruta no hay traza sobre la
 * que proyectar un progreso guiado, así que el intento se muestra como libre
 * aunque su `modo` sea "guiado" (el default de BD) — mismo criterio que
 * `calcularProgresoActual`.
 */
function FaseConIntentoReal({
  reto,
  intento,
  fase,
  trazaCoords,
  textos,
  config,
}: {
  reto: Reto;
  intento: IntentoActivo;
  fase: Exclude<Fase, "antes">;
  trazaCoords: [number, number][];
  textos: Textos;
  config: ConfigReto;
}) {
  const rutaId = reto.ruta_id;
  const slug = reto.slug;
  const comunes = { retoId: reto.id, intentoId: intento.id, textos, slug, config };

  if (fase === "durante") {
    return intento.modo === "libre" || rutaId === null ? (
      <ModoDuranteLibreConectado {...comunes} destino={destinoDelIntento(intento)} startedAt={intento.started_at} />
    ) : (
      <ModoDuranteConectado {...comunes} startedAt={intento.started_at} trazaCoords={trazaCoords} rutaId={rutaId} />
    );
  }

  return intento.modo === "libre" || rutaId === null ? (
    <ModoLlegadaLibreConectado
      {...comunes}
      destino={destinoDelIntento(intento)}
      mensajeLlegada={intento.mensaje_llegada}
      startedAt={intento.started_at}
      endedAt={intento.ended_at}
    />
  ) : (
    <ModoLlegadaConectado
      {...comunes}
      startedAt={intento.started_at}
      endedAt={intento.ended_at}
      mensajeLlegada={intento.mensaje_llegada}
      trazaCoords={trazaCoords}
      rutaId={rutaId}
    />
  );
}

/** "durante"/"llegada" con datos de ejemplo ya calculados (vista previa, DT-034). Sin I/O. */
function FaseConDatosEjemplo({
  datos,
  fase,
  trazaCoords,
  textos,
  slug,
  config,
}: {
  datos: DatosEjemplo;
  fase: Exclude<Fase, "antes">;
  trazaCoords: [number, number][];
  textos: Textos;
  slug: string;
  config: ConfigReto;
}) {
  const entradas = config.seccion_minuto_a_minuto ? datos.entradasMinutoAMinuto : SIN_ENTRADAS;
  const mensajeLlegada = datos.mensajeLlegada ?? TEXTOS_POR_DEFECTO.mensaje_llegada_default;

  if (datos.modo === "guiado") {
    return fase === "durante" ? (
      <ModoDurante
        progresoInicial={datos.progreso}
        iniciadoEn={datos.startedAt}
        trazaCoords={trazaCoords}
        puntosGpsIniciales={datos.puntosGps}
        textos={textos}
        slug={slug}
        config={config}
        entradasMinutoAMinutoIniciales={entradas}
      />
    ) : (
      <ModoLlegada
        progreso={datos.progreso}
        mensajeLlegada={mensajeLlegada}
        tiempoTotal={formatearTiempoTotal(datos.startedAt, datos.endedAt) ?? "—"}
        ritmoMedio={calcularRitmoMedioIntento(datos.progreso.odometroKm, datos.startedAt, datos.endedAt)}
        puntosGps={datos.puntosGps}
        trazaCoords={trazaCoords}
        entradasMinutoAMinuto={entradas}
        textos={textos}
        fotoLlegadaUrl={datos.fotoLlegadaUrl}
        slug={slug}
        config={config}
      />
    );
  }

  return fase === "durante" ? (
    <ModoDuranteLibre
      progresoInicial={datos.progreso}
      puntosGpsIniciales={datos.puntosGps}
      startedAt={datos.startedAt}
      textos={textos}
      slug={slug}
      config={config}
      entradasMinutoAMinutoIniciales={entradas}
    />
  ) : (
    <ModoLlegadaLibre
      progreso={datos.progreso}
      mensajeLlegada={mensajeLlegada}
      puntosGps={datos.puntosGps}
      entradasMinutoAMinuto={entradas}
      startedAt={datos.startedAt}
      endedAt={datos.endedAt}
      textos={textos}
      slug={slug}
      config={config}
    />
  );
}

interface PropsConectado {
  retoId: number;
  intentoId: number;
  textos: Textos;
  slug: string;
  config: ConfigReto;
}

async function ModoDuranteConectado({
  retoId,
  intentoId,
  startedAt,
  trazaCoords,
  textos,
  rutaId,
  slug,
  config,
}: PropsConectado & {
  startedAt: string | null;
  trazaCoords: [number, number][];
  rutaId: string;
}) {
  const [progresoInicial, historico] = await Promise.all([
    calcularProgresoDelIntento(retoId, intentoId, rutaId),
    obtenerHistoricoPosicionesCacheado(retoId, intentoId),
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
      config={config}
    />
  );
}

async function ModoLlegadaConectado({
  retoId,
  intentoId,
  startedAt,
  endedAt,
  mensajeLlegada,
  trazaCoords,
  textos,
  rutaId,
  slug,
  config,
}: PropsConectado & {
  startedAt: string | null;
  endedAt: string | null;
  mensajeLlegada: string | null;
  trazaCoords: [number, number][];
  rutaId: string;
}) {
  const [progreso, entradasMinutoAMinuto, historico, fotoLlegadaUrl] = await Promise.all([
    calcularProgresoDelIntento(retoId, intentoId, rutaId),
    config.seccion_minuto_a_minuto ? cargarEntradasMinutoAMinuto(intentoId) : SIN_ENTRADAS,
    obtenerHistoricoPosicionesCacheado(retoId, intentoId),
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
      config={config}
    />
  );
}

/**
 * Foto opcional de llegada (DT-024). Consulta separada del resto de columnas
 * para no acoplar la migración 0006 con la 0003 en el mismo select.
 */
async function obtenerFotoLlegadaUrl(intentoId: number): Promise<string | null> {
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
  retoId,
  intentoId,
  destino,
  startedAt,
  textos,
  slug,
  config,
}: PropsConectado & {
  destino: { lat: number; lon: number } | null;
  startedAt: string | null;
}) {
  const { progreso, puntosGps } = await calcularProgresoLibreDelIntento(retoId, intentoId, destino);
  return (
    <ModoDuranteLibre
      progresoInicial={progreso}
      puntosGpsIniciales={puntosGps}
      startedAt={startedAt}
      textos={textos}
      slug={slug}
      config={config}
    />
  );
}

async function ModoLlegadaLibreConectado({
  retoId,
  intentoId,
  destino,
  mensajeLlegada,
  startedAt,
  endedAt,
  textos,
  slug,
  config,
}: PropsConectado & {
  destino: { lat: number; lon: number } | null;
  mensajeLlegada: string | null;
  startedAt: string | null;
  endedAt: string | null;
}) {
  const [{ progreso, puntosGps }, entradasMinutoAMinuto] = await Promise.all([
    calcularProgresoLibreDelIntento(retoId, intentoId, destino),
    config.seccion_minuto_a_minuto ? cargarEntradasMinutoAMinuto(intentoId) : SIN_ENTRADAS,
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
      config={config}
    />
  );
}

async function cargarEntradasMinutoAMinuto(intentoId: number): Promise<EntradaMinutoAMinutoPublica[]> {
  const supabase = getSupabasePublic();
  const { data } = await supabase
    .from("minuto_a_minuto")
    .select("id, texto, foto_url, lat, lon, created_at")
    .eq("intento_id", intentoId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

/**
 * Intento activo del reto indicado (FP2.5, DT-028).
 *
 * Compatibilidad temporal con la migración 0003 sin aplicar. Si la consulta
 * con `modo`/`destino_lat`/`destino_lon` falla, reintenta con el select mínimo
 * y trata el intento como modo guiado.
 */
export async function obtenerIntentoActivo(retoId: number): Promise<IntentoActivo | null> {
  try {
    const supabase = getSupabasePublic();
    const { data, error } = await soloIntentoActivoDelReto(
      supabase
        .from("intentos")
        .select("id, fase, modo, destino_lat, destino_lon, started_at, ended_at, mensaje_llegada"),
      retoId
    ).maybeSingle();

    if (!error) return data;

    const { data: dataMinima } = await soloIntentoActivoDelReto(
      supabase.from("intentos").select("id, fase, started_at, ended_at, mensaje_llegada"),
      retoId
    ).maybeSingle();

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
 * paginado en cada visita. Caché por reto (FP2.5, DT-028).
 */
async function obtenerHistoricoPosicionesCacheado(retoId: number, intentoId: number): Promise<Posicion[]> {
  const cache = obtenerCacheHistorico(retoId);
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.valor;
  }

  const historico = await obtenerHistoricoPosiciones(intentoId);
  guardarCacheHistorico(retoId, historico);
  return historico;
}

/**
 * S2 (DT-018): reutiliza la caché compartida de /api/progreso (por reto,
 * FP2.5). `rutaId` es la ruta del reto.
 */
async function calcularProgresoDelIntento(
  retoId: number,
  intentoId: number,
  rutaId: string
): Promise<ProgresoPublicoGuiado> {
  const cache = obtenerCacheProgreso(retoId);
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS && cache.valor.modo === "guiado") {
    return cache.valor;
  }

  const historico = await obtenerHistoricoPosicionesCacheado(retoId, intentoId);
  const traza = cargarTrazaDeCalculo(rutaId);
  const progreso = aProgresoPublico(calcularProgreso(historico, traza));

  guardarCacheProgreso(retoId, progreso);

  return progreso;
}

/**
 * Progreso + puntos GPS del modo libre (DT-016). Caché por reto (FP2.5).
 */
async function calcularProgresoLibreDelIntento(
  retoId: number,
  intentoId: number,
  destino: { lat: number; lon: number } | null
): Promise<{ progreso: ProgresoPublicoLibre; puntosGps: { lat: number; lon: number }[] }> {
  const cache = obtenerCacheProgreso(retoId);
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS && cache.valor.modo === "libre") {
    const historico = await obtenerHistoricoPosicionesCacheado(retoId, intentoId);
    return { progreso: cache.valor, puntosGps: historico.map((p) => ({ lat: p.lat, lon: p.lon })) };
  }

  const historico = await obtenerHistoricoPosicionesCacheado(retoId, intentoId);
  const puntosGps = historico.map((p) => ({ lat: p.lat, lon: p.lon }));

  const progreso: ProgresoPublicoLibre = {
    ...calcularProgresoLibre(historico, destino),
    modo: "libre",
  };

  guardarCacheProgreso(retoId, progreso);

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
