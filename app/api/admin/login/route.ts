/**
 * POST /api/admin/login — autenticación del admin de UN reto (FP2.6, DT-029).
 *
 * Recibe `{ slug, password }`, verifica la contraseña contra el hash scrypt
 * guardado para ese reto en `retos_admin` y, si coincide, fija la cookie de
 * sesión HttpOnly ligada a ese reto y a la huella de su credencial
 * (DT-010). La env var `ADMIN_PASSWORD` ya no se lee.
 *
 * Anti-enumeración: reto inexistente, reto sin contraseña configurada y
 * contraseña errónea responden exactamente igual (`401 {error:"credenciales
 * incorrectas"}`), y `verificarPassword` se ejecuta SIEMPRE (contra
 * `HASH_SENTINELA` si no hay hash), para que el tiempo de respuesta tampoco
 * revele qué retos existen o tienen contraseña.
 *
 * Rate limiting por IP (DT-011): 10 intentos / 15 min, antes de cualquier
 * otra cosa. Responde 429 sin cuerpo al exceder el límite.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { crearSesion, NOMBRE_COOKIE_SESION } from "@/lib/auth/admin-session";
import { HASH_SENTINELA, huellaCredencial, verificarPassword } from "@/lib/auth/password";
import { consumir, obtenerIpCliente } from "@/lib/rate-limit";
import { obtenerHashAdmin } from "@/lib/supabase/credenciales-admin";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";

export const runtime = "nodejs";

const TTL_COOKIE_SEGUNDOS = 7 * 24 * 60 * 60;
const LIMITE_INTENTOS = 10;
const VENTANA_MS = 15 * 60_000;

const cuerpoLogin = z.object({
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  password: z.string().min(1).max(200),
});

function credencialesIncorrectas(): NextResponse {
  return NextResponse.json({ error: "credenciales incorrectas" }, { status: 401 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!consumir(obtenerIpCliente(request), LIMITE_INTENTOS, VENTANA_MS)) {
    return new NextResponse(null, { status: 429 });
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "cuerpo de la petición inválido" }, { status: 400 });
  }

  const parsed = cuerpoLogin.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "reto y contraseña requeridos" }, { status: 400 });
  }

  const reto = await obtenerRetoPorSlug(parsed.data.slug);
  const hash = reto ? await obtenerHashAdmin(reto.id) : null;
  const passwordCorrecta = await verificarPassword(parsed.data.password, hash ?? HASH_SENTINELA);

  if (!reto || hash === null || !passwordCorrecta) {
    return credencialesIncorrectas();
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(NOMBRE_COOKIE_SESION, crearSesion(reto, huellaCredencial(hash)), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_COOKIE_SEGUNDOS,
  });
  return response;
}
