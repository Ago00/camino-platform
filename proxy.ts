/**
 * Proxy multi-tenant (DT-026, FP1 / FP2): captura todas las rutas excepto
 * las de infraestructura (`api`, `_next/*`, `favicon.ico`, worker de MapLibre).
 *
 * Bifurcación por `pathname`:
 * - `/` → pass-through; Next.js hace el redirect si aplica.
 * - `/superadmin` y `/superadmin/*` → proxySuperAdmin (FP2).
 * - `/:slug/admin/*` → proxyAdmin (protege el panel con la sesión de ESE reto, sin BD).
 * - Todo lo demás → proxyPublico (captura visita para la pestaña "Tráfico").
 *
 * IMPORTANTE: esto NO es la única defensa de cada panel. Las Server Actions
 * y layouts verifican la sesión por sí mismos.
 */

import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { NOMBRE_COOKIE_SESION, renovarSesion, verificarSesionEnProxy } from "@/lib/auth/admin-session";
import { crearSesionSuperadmin, NOMBRE_COOKIE_SUPERADMIN_SESION, verificarSesionSuperadmin } from "@/lib/auth/superadmin-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|maplibre-gl-worker).*)"],
};

const TTL_COOKIE_SESION_SEGUNDOS = 7 * 24 * 60 * 60;

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Raíz → pass-through.
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Superadmin: protege /superadmin y /superadmin/* (excepto /superadmin/login
  // para evitar bucle de redirección infinita).
  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) {
    return proxySuperAdmin(request);
  }

  if (pathname.match(/^\/[^/]+\/admin/)) {
    return proxyAdmin(request);
  }

  // Las APIs del reto (/:slug/api/*) no son visitas: el matcher solo excluye
  // /api raíz, y sin esto el polling de la web contaba como tráfico.
  if (/^\/[^/]+\/api(\/|$)/.test(pathname)) {
    return NextResponse.next();
  }

  return proxyPublico(request);
}

// ---------------------------------------------------------------------------
// /superadmin/* — sesión del superadmin (FP2)
// ---------------------------------------------------------------------------

/**
 * Protege /superadmin y /superadmin/* con la cookie `superadmin_session`.
 * La página /superadmin/login pasa sin verificar para evitar bucle de
 * redirección: si la sesión es inválida, se redirige a login, que NO
 * está protegida aquí.
 * No registra visita (uso interno, no público).
 */
function proxySuperAdmin(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // La página de login no está protegida: si la verificáramos aquí,
  // habría un bucle de redirección al acceder sin sesión.
  if (pathname === "/superadmin/login") {
    return NextResponse.next();
  }

  const cookieSesion = request.cookies.get(NOMBRE_COOKIE_SUPERADMIN_SESION)?.value;

  if (!verificarSesionSuperadmin(cookieSesion)) {
    const loginUrl = new URL("/superadmin/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.cookies.set(NOMBRE_COOKIE_SUPERADMIN_SESION, crearSesionSuperadmin(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: TTL_COOKIE_SESION_SEGUNDOS,
  });
  return response;
}

// ---------------------------------------------------------------------------
// /:slug/admin/* — sesión ligada al reto (DT-010, DT-029)
// ---------------------------------------------------------------------------

/**
 * Primera línea: firma, caducidad y que la sesión es del slug de la URL. No
 * consulta BD (corre en cada navegación del panel), así que no detecta un
 * cambio de contraseña: eso lo verifican la página y cada Server Action con
 * `resolverRetoConSesion` (lib/auth/sesion-admin-servidor.ts).
 */
function proxyAdmin(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const slug = pathname.split("/")[1];
  const cookieSesion = request.cookies.get(NOMBRE_COOKIE_SESION)?.value;

  const payload = verificarSesionEnProxy(cookieSesion, slug);
  if (!payload) {
    // returnTo incluye el slug para que login sepa a qué reto autenticar.
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.cookies.set(NOMBRE_COOKIE_SESION, renovarSesion(payload), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_COOKIE_SESION_SEGUNDOS,
  });
  return response;
}

// ---------------------------------------------------------------------------
// /:slug/* — captura de visitas (DT-022)
// ---------------------------------------------------------------------------

export const NOMBRE_COOKIE_VISITANTE = "visitante_id";

/** ~1 año — cookie funcional, no de sesión: se reutiliza entre visitas. */
const TTL_COOKIE_VISITANTE_SEGUNDOS = 400 * 24 * 60 * 60;

async function proxyPublico(request: NextRequest): Promise<NextResponse> {
  const cookieVisitanteExistente = request.cookies.get(NOMBRE_COOKIE_VISITANTE)?.value;
  const visitanteId = cookieVisitanteExistente ?? randomUUID();

  await registrarVisita(request, visitanteId);

  const response = NextResponse.next();
  if (!cookieVisitanteExistente) {
    response.cookies.set(NOMBRE_COOKIE_VISITANTE, visitanteId, {
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: TTL_COOKIE_VISITANTE_SEGUNDOS,
    });
  }
  return response;
}

/**
 * Inserta la visita en `visitas_web`. El slug se extrae de la URL para
 * resolver el reto_id. Nunca lanza: cualquier fallo se ignora en silencio.
 */
async function registrarVisita(request: NextRequest, visitanteId: string): Promise<void> {
  try {
    const { pathname } = request.nextUrl;
    // pathname comienza con /; el segundo segmento es el slug.
    const slug = pathname.split("/")[1];
    if (!slug) return;

    const reto = await obtenerRetoPorSlug(slug);
    if (!reto) return;

    const supabase = getSupabaseAdmin();
    await supabase.from("visitas_web").insert({
      reto_id: reto.id,
      ruta: pathname,
      ts: new Date().toISOString(),
      visitante_id: visitanteId,
      referer: request.headers.get("referer"),
    });
  } catch {
    // Ver comentario de cabecera: nunca debe romper la petición del visitante real.
  }
}
