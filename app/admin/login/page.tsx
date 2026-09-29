// Login del panel admin de un reto (FP2.6, DT-029): un solo campo de
// contraseña, la del reto. El reto sale de `returnTo` (`/<slug>/admin...`),
// que es a donde redirigen el proxy y la página del panel sin sesión. La
// validación de `returnTo` con la regex evita open redirects: solo rutas
// internas de un panel admin. Sin `returnTo` válido no se sabe a qué reto
// autenticar, así que el formulario queda desactivado (no hay reto por defecto).

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

const C = { paper: "#F4F3EF", ink: "#1B211D", eucalipto: "#2F5D50", error: "#B03A2E", gris: "#6B7280" };

const PATRON_RETURN_TO = /^\/([a-z0-9-]+)\/admin(\/.*)?$/;

interface DestinoLogin {
  slug: string;
  returnTo: string;
}

function resolverDestino(returnTo: string | null): DestinoLogin | null {
  if (!returnTo) return null;
  const coincidencia = PATRON_RETURN_TO.exec(returnTo);
  if (!coincidencia) return null;
  return { slug: coincidencia[1], returnTo };
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destino = resolverDestino(searchParams.get("returnTo"));

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!destino || password.length === 0 || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: destino.slug, password }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Demasiados intentos. Espera unos minutos y vuelve a probar."
            : "Contraseña incorrecta o panel sin contraseña configurada (la fija el organizador)."
        );
        return;
      }
      router.push(destino.returnTo);
      router.refresh();
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center" style={{ background: C.paper, color: C.ink }}>
      <form
        onSubmit={enviar}
        className="w-full max-w-sm space-y-4 rounded-2xl border p-6"
        style={{ borderColor: "#00000012", background: "white" }}
      >
        <h1 className="[font-family:var(--font-fraunces)] text-[22px] font-semibold">Panel admin</h1>
        {destino ? (
          <p className="font-mono text-[13px]" style={{ color: C.gris }}>
            /{destino.slug}
          </p>
        ) : (
          <p className="text-[13px]" style={{ color: C.gris }}>
            Entra desde la dirección del panel de tu reto (/&lt;reto&gt;/admin).
          </p>
        )}
        <input
          type="password"
          autoFocus={destino !== null}
          autoComplete="current-password"
          disabled={!destino}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none disabled:opacity-50"
          style={{ borderColor: "#00000015" }}
        />
        {error && (
          <p className="text-[13px]" style={{ color: C.error }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!destino || password.length === 0 || enviando}
          className="w-full rounded-full px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-50"
          style={{ background: C.eucalipto }}
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
