// Login del panel superadmin: un solo campo de contraseña. Tras un login
// exitoso, redirige a `returnTo` (query param) si está presente y apunta a
// una ruta interna de superadmin — por defecto /superadmin.
// La validación de `returnTo` evita open redirects.

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

const C = { paper: "#F4F3EF", ink: "#1B211D", eucalipto: "#2F5D50", error: "#B03A2E" };

function SuperadminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resolverReturnTo(): string {
    const returnTo = searchParams.get("returnTo");
    if (returnTo && /^\/superadmin(\/.*)?$/.test(returnTo) && returnTo !== "/superadmin/login") {
      return returnTo;
    }
    return "/superadmin";
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (password.length === 0 || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const response = await fetch("/api/superadmin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError("Contraseña incorrecta.");
        return;
      }
      router.push(resolverReturnTo());
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
        <h1 className="[font-family:var(--font-fraunces)] text-[22px] font-semibold">Panel superadmin</h1>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
          style={{ borderColor: "#00000015" }}
        />
        {error && (
          <p className="text-[13px]" style={{ color: C.error }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={password.length === 0 || enviando}
          className="w-full rounded-full px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-50"
          style={{ background: C.eucalipto }}
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function SuperadminLoginPage() {
  return (
    <Suspense>
      <SuperadminLoginForm />
    </Suspense>
  );
}
