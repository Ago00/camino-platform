// Página principal: listado dinámico de retos activos.
// Server Component — sin redirección estática ni "use client".

import { listarRetosActivos } from "@/lib/supabase/retos";

export const dynamic = "force-dynamic";

export default async function Home() {
  const retos = await listarRetosActivos();

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>Retos activos</h1>
      {retos.length === 0 ? (
        <p style={{ color: "#6B7280" }}>No hay retos activos en este momento.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {retos.map((reto) => (
            <li key={reto.id}>
              <a
                href={`/${reto.slug}`}
                style={{ textDecoration: "none", color: "#2F5D50", fontWeight: 500 }}
              >
                {reto.nombre}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
