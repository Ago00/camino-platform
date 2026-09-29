/**
 * Proxy multi-tenant (DT-026, FP1): captura todas las rutas excepto las de
 * infraestructura (`api`, `_next/*`, `favicon.ico`, worker de MapLibre).
 *
 * Bifurcación por `pathname`:
 * - `/` → pass-through; Next.js hace el redirect a `/portuguesa-110`.
 * - `/:slug/admin/*` → proxyAdmin (protege el panel con sesión).
 * - Todo lo demás → proxyPublico (captura visita para la pestaña "Tráfico").
 *
 * Las dos responsabilidades (sesión de admin y captura de visitas) se
 * mantienen igual que en la versión anterior; solo cambia el matcher y
 * la forma en que se extrae el slug para registrarVisita.
 *
 * IMPORTANTE: esto NO es la única defensa de `/:slug/admin/*`. Las Server
 * Actions de `app/[slug]/admin/actions.ts` verifican la sesión por sí mismas.
 */

import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { crearSesion, NOMBRE_COOKIE_SESION, verificarSesion } from "@/lib/auth/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|maplibre-gl-worker).*)"],
};

const TTL_COOKIE_SESION_SEGUNDOS = 7 * 24 * 60 * 60;

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Raíz → pass-through (redirect estático en app/page.tsx).
  if (pathname === "/") {
    return NextResponse.next();
  }

  if (pathname.match(/^\/[^/]+\/admin/)) {
    return proxyAdmin(request);
  }

  return proxyPublico(request);
}

// ---------------------------------------------------------------------------
// /:slug/admin/* — sesión (DT-010, sin cambios de comportamiento)
// ---------------------------------------------------------------------------

function proxyAdmin(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const cookieSesion = request.cookies.get(NOMBRE_COOKIE_SESION)?.value;

  if (!verificarSesion(cookieSesion)) {
    // returnTo incluye el slug para que login redirija al panel correcto.
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.cookies.set(NOMBRE_COOKIE_SESION, crearSesion(), {
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
