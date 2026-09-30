// Panel superadmin: CRUD de retos. Server Component.
// Listado de todos los retos (activos e inactivos) + formulario de creación.
// Edición inline: pasar ?edit=<id> en la URL muestra el formulario de edición
// para ese reto. Los formularios son componentes cliente con `useActionState`
// (estado pendiente y resultado visibles); editar y eliminar redirigen aquí
// con el aviso en la query (?guardado=<id> / ?eliminado=<slug>).
// Cada tarjeta muestra la configuración del GPS del reto (DT-035: URL con su
// token propio y QR de OwnTracks, ocultos hasta pulsar "Mostrar", y botón
// para regenerar el token), si tiene contraseña de admin configurada (FP2.6,
// DT-029) y enlaces a su web y a su panel admin.

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RUTAS_PREDEFINIDAS } from "@/lib/rutas/catalogo";
import ConfigGps from "@/components/gps/ConfigGps";
import { obtenerOrigenTracker, prepararDatosConfigGps, type DatosConfigGps } from "@/lib/gps/config-gps-servidor";
import { listarRetosConCredencial } from "@/lib/supabase/credenciales-admin";
import { listarCredencialesGps } from "@/lib/supabase/credenciales-gps";
import { listarTodosLosRetos } from "@/lib/supabase/retos";
import { NOMBRE_COOKIE_SUPERADMIN_SESION, verificarSesionSuperadmin } from "@/lib/auth/superadmin-session";
import { editarReto, eliminarReto, cerrarSesionSuperadmin, regenerarTokenGpsReto } from "./actions";
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
  // Esta página envía al navegador el token del GPS de cada reto (DT-035): la
  // sesión se comprueba aquí mismo y no solo en el layout, que no impide que
  // la página se renderice ni que su contenido viaje en el payload RSC (guía
  // de autenticación de Next 16, "Layouts and auth checks").
  const almacenCookies = await cookies();
  if (!verificarSesionSuperadmin(almacenCookies.get(NOMBRE_COOKIE_SUPERADMIN_SESION)?.value)) {
    redirect("/superadmin/login");
  }

  const sp = await searchParams;
  const editarId = sp.edit ? Number(sp.edit) : null;
  const aviso = leerAvisoPanel(sp);

  const [retos, origen, retosConCredencial, credencialesGps] = await Promise.all([
    listarTodosLosRetos(),
    obtenerOrigenTracker(),
    listarRetosConCredencial(),
    listarCredencialesGps(),
  ]);
  const datosGpsPorReto = new Map(
    await Promise.all(
      retos.map(async (reto): Promise<[number, DatosConfigGps | null]> => {
        const credencial = credencialesGps.get(reto.id);
        return [reto.id, credencial ? await prepararDatosConfigGps(reto.slug, credencial, origen) : null];
      })
    )
  );

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
                  datosGps={datosGpsPorReto.get(reto.id) ?? null}
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
// Componente de tarjeta de reto
// ---------------------------------------------------------------------------

function RetoCard({
  reto,
  modoEdicion,
  recienGuardado,
  datosGps,
  tieneCredencial,
}: {
  reto: Reto;
  modoEdicion: boolean;
  recienGuardado: boolean;
  /** null si el reto no tiene token del GPS. */
  datosGps: DatosConfigGps | null;
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

      {/* GPS del reto: URL, QR de OwnTracks y regenerar (DT-035) */}
      <div className="mt-2">
        <p className="mb-1 text-[12px] font-medium" style={{ color: C.gris }}>
          GPS (OwnTracks)
        </p>
        <ConfigGps datos={datosGps} accionRegenerar={regenerarTokenGpsReto.bind(null, reto.id)} />
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
