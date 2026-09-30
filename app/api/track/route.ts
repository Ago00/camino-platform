/**
 * Ingesta de posiciones GPS desde OwnTracks (modo HTTP).
 *
 * Verificado contra Supabase real desde F2 (ver docs/bugs/BUGS.md); los tests
 * de route.test.ts usan el cliente mockado.
 *
 * URL: `/api/track?reto=<slug>&t=<token del reto>`. Desde DT-035 cada reto
 * tiene su propio token (`retos_gps`, lib/supabase/credenciales-gps.ts), que el
 * admin del reto y el superadmin ven, copian o escanean como QR y pueden
 * regenerar. Ya no existe un TRACK_TOKEN global.
 *
 * Orden de las defensas:
 *   1. Rate limit por IP (120/min), antes de tocar BD: acota a quien prueba
 *      tokens o slugs a ciegas.
 *   2. Formato del slug (zod) y, en una sola consulta, el reto con su token.
 *   3. Comparación del token en tiempo constante (ver `tokenEsValido`), contra
 *      un valor ficticio si no hay reto o token, para que ese caso cueste lo
 *      mismo. Slug mal formado, reto inexistente, reto sin token y token
 *      incorrecto dan todos el mismo `401 {"error":"unauthorized"}`: desde
 *      fuera no se distingue qué falló. (Hasta DT-035 un reto inexistente
 *      daba `200 []`, DT-028; con token por reto ya no hay token válido que
 *      proteger en ese caso, así que se unifica con el 401.)
 *   4. Rate limit por reto (40/min, DT-011), tras autenticar: el cupo de un
 *      reto no lo gasta nadie sin su token, ni lo comparte con otros retos.
 *   5. Payload OwnTracks (zod), intento activo del reto y filtro de
 *      plausibilidad geográfica (DT-006, solo modo guiado con ruta, DT-016).
 *
 * Desde el paso 5, cualquier descarte responde `200 []`: OwnTracks no
 * reintenta un punto que nunca se va a guardar, y el remitente no recibe
 * pistas del motivo (payload inválido, sin intento activo, fuera de rango).
 *
 * Compatibilidad con la migración 0003 sin aplicar (ver DEBT.md): si la
 * columna `modo` no existe, la consulta del intento falla; se reintenta con el
 * select mínimo (solo `id`) y se trata el intento como 'guiado' (con filtro
 * geográfico), el comportamiento anterior a DT-016.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumir, obtenerIpCliente } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { obtenerTokenGpsPorSlug } from "@/lib/supabase/credenciales-gps";
import { soloIntentoActivoDelReto } from "@/lib/supabase/intentos";
import { cargarTrazaDeCalculo } from "@/lib/traza/cargar-traza";
import { separacionDeTrazaM } from "@/lib/traza/proyeccion";
import { SEPARACION_TRAZA_MAX_KM } from "@/lib/traza/umbrales";

export const runtime = "nodejs";

const LIMITE_POR_IP_POR_MINUTO = 120;
const LIMITE_POR_RETO_POR_MINUTO = 40;
const VENTANA_MS = 60_000;

// Prefijos propios: `lib/rate-limit.ts` comparte un único Map con las demás
// rutas, que usan la IP a secas como clave.
const PREFIJO_CLAVE_IP = "track:ip:";
const PREFIJO_CLAVE_RETO = "track:reto:";

/**
 * Valor con el que se compara cuando el reto no existe o no tiene token:
 * aleatorio por instancia, así que ningún token recibido puede coincidir.
 */
const TOKEN_FICTICIO = randomBytes(32).toString("base64url");

// ---------------------------------------------------------------------------
// Validación de la entrada
// ---------------------------------------------------------------------------

const payloadOwnTracks = z.object({
  _type: z.literal("location"),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  // Un timestamp Unix no puede ser negativo. Sin cota superior: evita tener
  // que mantener una fecha mágica de "futuro máximo plausible".
  tst: z.number().positive(),
  batt: z.number().nullable().optional(),
  acc: z.number().nullable().optional(),
});

/**
 * Slug del reto al que pertenece el tracker (`?reto=<slug>`). Mismo formato
 * que el slug validado al crear retos en el panel superadmin.
 */
const slugRetoTracker = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/);

/** Respuesta vacía OwnTracks-compatible. Nunca da pistas sobre el motivo. */
function respuestaVacia(): NextResponse {
  return NextResponse.json([], { status: 200 });
}

function respuestaNoAutorizada(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// ---------------------------------------------------------------------------
// Comparación de token en tiempo constante
// ---------------------------------------------------------------------------

/**
 * Compara el token recibido contra el del reto sin filtrar información por
 * timing ni por longitud.
 *
 * `crypto.timingSafeEqual` exige que ambos buffers tengan la MISMA longitud
 * — si no, lanza síncronamente. Comparar longitudes antes (`if (a.length !==
 * b.length) return false`) reintroduce exactamente el timing leak que
 * `timingSafeEqual` existe para evitar. Hashear ambos valores con SHA-256
 * da siempre 32 bytes, sin ninguna rama dependiente del input.
 */
function tokenEsValido(tokenRecibido: string, tokenEsperado: string): boolean {
  const hashRecibido = createHash("sha256").update(tokenRecibido).digest();
  const hashEsperado = createHash("sha256").update(tokenEsperado).digest();
  return timingSafeEqual(hashRecibido, hashEsperado);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Rate limit por IP, antes de tocar BD.
  if (!consumir(`${PREFIJO_CLAVE_IP}${obtenerIpCliente(request)}`, LIMITE_POR_IP_POR_MINUTO, VENTANA_MS)) {
    return new NextResponse(null, { status: 429 });
  }

  // 2. Reto de la URL con su token. Un slug mal formado no llega a BD.
  const tokenRecibido = request.nextUrl.searchParams.get("t") ?? "";
  const slugReto = slugRetoTracker.safeParse(request.nextUrl.searchParams.get("reto"));
  if (!slugReto.success) {
    return respuestaNoAutorizada();
  }
  const retoConToken = await obtenerTokenGpsPorSlug(slugReto.data);

  // 3. Token del reto en tiempo constante (ficticio si no hay reto o token).
  const tokenValido = tokenEsValido(tokenRecibido, retoConToken?.token ?? TOKEN_FICTICIO);
  if (!retoConToken || !tokenValido) {
    return respuestaNoAutorizada();
  }

  // 4. Rate limit por reto (DT-011), tras autenticar.
  if (!consumir(`${PREFIJO_CLAVE_RETO}${retoConToken.retoId}`, LIMITE_POR_RETO_POR_MINUTO, VENTANA_MS)) {
    return new NextResponse(null, { status: 429 });
  }

  // 5. Payload OwnTracks.
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return respuestaVacia();
  }

  const payload = payloadOwnTracks.safeParse(bodyJson);
  if (!payload.success) {
    // _type !== "location", o lat/lon no numéricos: se ignora sin dar pistas.
    return respuestaVacia();
  }

  const { lat, lon, tst, batt, acc } = payload.data;

  // 6. Intento activo DE ESE RETO y su modo — se resuelve ANTES de decidir si
  // se aplica el filtro geográfico (DT-016).
  const supabase = getSupabaseAdmin();
  const { data: intentoActivo, error: errorIntento } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id, modo"),
    retoConToken.retoId
  ).maybeSingle();

  let intentoId: number;
  let modoIntento: "guiado" | "libre";

  if (errorIntento) {
    // Compatibilidad temporal con la migración 0003 sin aplicar (cabecera).
    const { data: intentoActivoMinimo, error: errorIntentoMinimo } = await soloIntentoActivoDelReto(
      supabase.from("intentos").select("id"),
      retoConToken.retoId
    ).maybeSingle();

    if (errorIntentoMinimo || !intentoActivoMinimo) {
      return respuestaVacia();
    }

    intentoId = intentoActivoMinimo.id;
    modoIntento = "guiado";
  } else {
    if (!intentoActivo) {
      return respuestaVacia();
    }
    intentoId = intentoActivo.id;
    modoIntento = intentoActivo.modo;
  }

  // 7. Filtro de plausibilidad geográfica (DT-006) — solo modo 'guiado'
  // (DT-016) y solo si el reto tiene ruta: sin ruta no hay traza con la que
  // comparar, igual que en modo libre.
  if (modoIntento === "guiado" && retoConToken.rutaId !== null) {
    const traza = cargarTrazaDeCalculo(retoConToken.rutaId);
    const separacionM = separacionDeTrazaM(lat, lon, traza);
    if (separacionM > SEPARACION_TRAZA_MAX_KM * 1000) {
      return respuestaVacia();
    }
  }

  // 8. Insertar la posición. La velocidad imposible la descarta
  // calcularProgreso() en el dominio, no la ingesta.
  await supabase.from("posiciones").insert({
    intento_id: intentoId,
    lat,
    lon,
    ts: new Date(tst * 1000).toISOString(),
    batt: batt ?? null,
    acc: acc ?? null,
    fuente: "app",
  });

  return respuestaVacia();
}
