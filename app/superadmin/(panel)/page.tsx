// Panel superadmin: CRUD de retos. Server Component.
// Listado de todos los retos (activos e inactivos) + formulario de creación.
// Edición inline: pasar ?edit=<id> en la URL muestra el formulario de edición
// para ese reto; el servidor renderiza el estado sin necesidad de JS de cliente.
// Cada tarjeta muestra la URL del tracker GPS del reto (FP2.5, DT-028).

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RUTAS_PREDEFINIDAS } from "@/lib/rutas/catalogo";
import { listarTodosLosRetos } from "@/lib/supabase/retos";
import { crearReto, editarReto, cerrarSesionSuperadmin } from "./actions";
import BotonEliminarReto from "./BotonEliminarReto";
import type { Reto } from "@/lib/types";

export const dynamic = "force-dynamic";

const C = { paper: "#F4F3EF", ink: "#1B211D", eucalipto: "#2F5D50", rojo: "#B03A2E", gris: "#6B7280" };

interface SuperadminPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function SuperadminPage({ searchParams }: SuperadminPageProps) {
  const sp = await searchParams;
  const editarId = sp.edit ? Number(sp.edit) : null;

  const [retos, origen] = await Promise.all([listarTodosLosRetos(), obtenerOrigenPeticion()]);

  // Acción de logout: redirige al login tras borrar la cookie.
  async function logout() {
    "use server";
    await cerrarSesionSuperadmin();
    redirect("/superadmin/login");
  }

  return (
    <div className="min-h-dvh w-full" style={{ background: C.paper, color: C.ink }}>
      <div className="mx-auto w-full max-w-[720px] px-5 py-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="[font-family:var(--font-fraunces)] text-[24px] font-semibold">Panel superadmin</h1>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-full border px-4 py-2 text-[13px] font-medium"
              style={{ borderColor: "#00000018" }}
            >
              Cerrar sesión
            </button>
          </form>
        </header>

        {/* Lista de retos */}
        <section className="mb-8">
          <h2 className="mb-3 text-[16px] font-semibold">Retos</h2>
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
                  urlTracker={urlTrackerDelReto(origen, reto.slug)}
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
  urlTracker,
}: {
  reto: Reto;
  modoEdicion: boolean;
  urlTracker: string;
}) {
  const editarConId = editarReto.bind(null, reto.id);

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "#00000012", background: "white" }}
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

      {/* Acciones */}
      {!modoEdicion && (
        <div className="mt-3 flex gap-2">
          <Link
            href={`/superadmin?edit=${reto.id}`}
            className="rounded-lg border px-3 py-1.5 text-[13px] font-medium"
            style={{ borderColor: "#00000018" }}
          >
            Editar
          </Link>
          <BotonEliminarReto id={reto.id} nombre={reto.nombre} />
        </div>
      )}

      {/* Formulario de edición inline */}
      {modoEdicion && (
        <form action={editarConId} className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "#00000010" }}>
          <CampoTexto label="Nombre" name="nombre" defaultValue={reto.nombre} required />
          <CampoTexto label="Descripción" name="descripcion" defaultValue={reto.descripcion ?? ""} />
          <div>
            <label className="mb-1 block text-[13px] font-medium">Tipo de ruta</label>
            <select
              name="ruta_tipo"
              defaultValue={reto.ruta_tipo}
              className="w-full rounded-lg border px-3 py-2 text-[14px]"
              style={{ borderColor: "#00000015" }}
            >
              <option value="predefinida">Predefinida</option>
              <option value="libre">Libre</option>
            </select>
          </div>
          <SelectorRuta defaultValue={reto.ruta_id ?? undefined} />
          <div>
            <label className="mb-1 block text-[13px] font-medium">Estado</label>
            <select
              name="activo"
              defaultValue={String(reto.activo)}
              className="w-full rounded-lg border px-3 py-2 text-[14px]"
              style={{ borderColor: "#00000015" }}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-white"
              style={{ background: C.eucalipto }}
            >
              Guardar cambios
            </button>
            <Link
              href="/superadmin"
              className="rounded-full border px-4 py-2 text-[13px] font-medium"
              style={{ borderColor: "#00000018" }}
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Formulario de creación
// ---------------------------------------------------------------------------

function FormularioCrearReto() {
  return (
    <form
      action={crearReto}
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: "#00000012", background: "white" }}
    >
      <CampoTexto label="Slug" name="slug" placeholder="mi-reto-2026" required />
      <CampoTexto label="Nombre" name="nombre" placeholder="Nombre del reto" required />
      <CampoTexto label="Descripción" name="descripcion" placeholder="Descripción opcional" />
      <div>
        <label className="mb-1 block text-[13px] font-medium">Tipo de ruta</label>
        <select
          name="ruta_tipo"
          defaultValue="predefinida"
          className="w-full rounded-lg border px-3 py-2 text-[14px]"
          style={{ borderColor: "#00000015" }}
        >
          <option value="predefinida">Predefinida</option>
          <option value="libre">Libre</option>
        </select>
      </div>
      <SelectorRuta />
      <button
        type="submit"
        className="rounded-full px-4 py-2 text-[13px] font-medium text-white"
        style={{ background: C.eucalipto }}
      >
        Crear reto
      </button>
    </form>
  );
}

// Solo se tiene en cuenta si el tipo de ruta es "predefinida".
function SelectorRuta({ defaultValue }: { defaultValue?: string }) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium">Ruta predefinida</label>
      <select
        name="ruta_id"
        defaultValue={defaultValue ?? RUTAS_PREDEFINIDAS[0]?.id}
        className="w-full rounded-lg border px-3 py-2 text-[14px]"
        style={{ borderColor: "#00000015" }}
      >
        {RUTAS_PREDEFINIDAS.map((ruta) => (
          <option key={ruta.id} value={ruta.id}>
            {ruta.nombre}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[12px]" style={{ color: C.gris }}>
        Se ignora si el tipo de ruta es libre.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campo de texto reutilizable
// ---------------------------------------------------------------------------

function CampoTexto({
  label,
  name,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium">
        {label}
        {required && <span style={{ color: C.rojo }}> *</span>}
      </label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
        style={{ borderColor: "#00000015" }}
      />
    </div>
  );
}
