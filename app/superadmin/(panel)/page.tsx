// Panel superadmin: CRUD de retos. Server Component.
// Listado de todos los retos (activos e inactivos) + formulario de creación.
// Edición inline: pasar ?edit=<id> en la URL muestra el formulario de edición
// para ese reto. Los formularios son componentes cliente con `useActionState`
// (estado pendiente y resultado visibles); editar y eliminar redirigen aquí
// con el aviso en la query (?guardado=<id> / ?eliminado=<slug>).
// Cada tarjeta muestra la URL del tracker GPS del reto (FP2.5, DT-028), si
// tiene contraseña de admin configurada (FP2.6, DT-029) y enlaces a su web y
// a su panel admin.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RUTAS_PREDEFINIDAS } from "@/lib/rutas/catalogo";
import { listarRetosConCredencial } from "@/lib/supabase/credenciales-admin";
import { listarTodosLosRetos } from "@/lib/supabase/retos";
import { editarReto, eliminarReto, cerrarSesionSuperadmin } from "./actions";
import BotonEliminarReto from "./BotonEliminarReto";
import { COLORES_SUPERADMIN as C, EnlacesReto, MensajeResultado } from "./CamposReto";
import FormularioCrearReto from "./FormularioCrearReto";
import FormularioEditarReto from "./FormularioEditarReto";
import { leerAvisoPanel } from "./resultado-accion";
import type { Reto } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SuperadminPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function SuperadminPage({ searchParams }: SuperadminPageProps) {
  const sp = await searchParams;
  const editarId = sp.edit ? Number(sp.edit) : null;
  const aviso = leerAvisoPanel(sp);

  const [retos, origen, retosConCredencial] = await Promise.all([
    listarTodosLosRetos(),
    obtenerOrigenPeticion(),
    listarRetosConCredencial(),
  ]);

  // Acción de logout: redirige al login tras borrar la cookie.
  async function logout() {
    "use server";
    await cerrarSesionSuperadmin();
    redirect("/superadmin/login");
  }

  return (
    <div className="min-h-dvh w-full" style={{ background: C.paper, color: C.ink }}>
      <div className="mx-auto w-full max-w-[720px] px-5 py-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h1 className="[font-family:var(--font-fraunces)] text-[24px] font-semibold">Panel superadmin</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border px-4 py-2 text-[13px] font-medium"
              style={{ borderColor: "#00000018" }}
            >
              Ver portada
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border px-4 py-2 text-[13px] font-medium"
                style={{ borderColor: "#00000018" }}
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </header>

        {/* Lista de retos */}
        <section className="mb-8">
          <h2 className="mb-3 text-[16px] font-semibold">Retos</h2>
          {aviso?.tipo === "eliminado" && (
            <div className="mb-3">
              <MensajeResultado ok>
                Reto <span className="font-mono">/{aviso.slug}</span> eliminado.
              </MensajeResultado>
            </div>
          )}
          {retos.length === 0 ? (
            <p className="text-[14px]" style={{ color: C.gris }}>
              No hay retos todavía.
            </p>
          ) : (
            <div className="space-y-3">
              {retos.map((reto) => (
                <RetoCard
                  key={reto.id}
                  reto={reto}
                  modoEdicion={editarId === reto.id}
                  recienGuardado={aviso?.tipo === "guardado" && aviso.retoId === reto.id}
                  urlTracker={urlTrackerDelReto(origen, reto.slug)}
                  tieneCredencial={retosConCredencial.has(reto.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Formulario de creación */}
        <section>
          <h2 className="mb-3 text-[16px] font-semibold">Crear reto nuevo</h2>
          <FormularioCrearReto />
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// URL del tracker GPS (FP2.5, DT-028)
// ---------------------------------------------------------------------------

/**
 * Origen (`https://host`) de la petición actual, para mostrar la URL completa
 * del tracker. Null si no se puede determinar (sin cabecera Host válida): en
 * ese caso se muestra la ruta relativa. Solo se usa para mostrar texto en un
 * panel autenticado, nunca para redirigir ni construir enlaces.
 */
async function obtenerOrigenPeticion(): Promise<string | null> {
  const cabeceras = await headers();
  const host = cabeceras.get("x-forwarded-host") ?? cabeceras.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const protocolo = cabeceras.get("x-forwarded-proto") === "http" ? "http" : "https";
  return `${protocolo}://${host}`;
}

/**
 * URL que hay que configurar en OwnTracks para el reto: `/api/track` con el
 * slug en `?reto=`. El token (`t=`) no se muestra: es un secreto global que
 * vive en la env var `TRACK_TOKEN`.
 */
function urlTrackerDelReto(origen: string | null, slug: string): string {
  return `${origen ?? ""}/api/track?reto=${encodeURIComponent(slug)}`;
}

// ---------------------------------------------------------------------------
// Componente de tarjeta de reto
// ---------------------------------------------------------------------------

function RetoCard({
  reto,
  modoEdicion,
  recienGuardado,
  urlTracker,
  tieneCredencial,
}: {
  reto: Reto;
  modoEdicion: boolean;
  recienGuardado: boolean;
  urlTracker: string;
  tieneCredencial: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: recienGuardado ? `${C.eucalipto}60` : "#00000012", background: "white" }}
    >
      {/* Cabecera del reto */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="font-mono text-[13px]" style={{ color: C.gris }}>
            /{reto.slug}
          </span>
          <p className="text-[15px] font-medium">{reto.nombre}</p>
          <p className="text-[13px]" style={{ color: C.gris }}>
            {reto.ruta_tipo === "predefinida"
              ? `predefinida · ${RUTAS_PREDEFINIDAS.find((r) => r.id === reto.ruta_id)?.nombre ?? reto.ruta_id}`
              : "libre"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ background: reto.activo ? C.eucalipto : C.gris }}
          >
            {reto.activo ? "activo" : "inactivo"}
          </span>
        </div>
      </div>

      {recienGuardado && !modoEdicion && (
        <div className="my-2">
          <MensajeResultado ok>Cambios guardados.</MensajeResultado>
        </div>
      )}

      {/* URL del GPS para OwnTracks (solo lectura) */}
      <div className="mt-2">
        <p className="text-[12px] font-medium" style={{ color: C.gris }}>
          URL del GPS (OwnTracks)
        </p>
        <code
          className="mt-0.5 block select-all break-all rounded-md px-2 py-1 font-mono text-[12.5px]"
          style={{ background: C.paper }}
        >
          {urlTracker}
        </code>
        <p className="mt-0.5 text-[12px]" style={{ color: C.gris }}>
          Añade <span className="font-mono">&amp;t=</span> seguido del valor de{" "}
          <span className="font-mono">TRACK_TOKEN</span>.
        </p>
      </div>

      {/* Estado de la contraseña del panel admin del reto (FP2.6, DT-029) */}
      <p className="mt-2 text-[12.5px]">
        <span className="font-medium" style={{ color: C.gris }}>
          Contraseña admin:
        </span>{" "}
        <span style={{ color: tieneCredencial ? C.eucalipto : C.rojo }}>
          {tieneCredencial ? "configurada" : "sin configurar"}
        </span>
      </p>

      {/* Acciones */}
      {!modoEdicion && (
        <div className="mt-3 flex flex-wrap gap-2">
          <EnlacesReto slug={reto.slug} />
          <Link
            href={`/superadmin?edit=${reto.id}`}
            className="rounded-lg border px-3 py-1.5 text-[13px] font-medium"
            style={{ borderColor: "#00000018" }}
          >
            Editar
          </Link>
          <BotonEliminarReto nombre={reto.nombre} accion={eliminarReto.bind(null, reto.id)} />
        </div>
      )}

      {/* Formulario de edición inline */}
      {modoEdicion && <FormularioEditarReto reto={reto} accion={editarReto.bind(null, reto.id)} />}
    </div>
  );
}
