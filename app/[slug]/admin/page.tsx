// Panel admin bajo ruta dinámica /:slug/admin (DT-026, FP1).
// Idéntico en UI al panel anterior (app/admin/page.tsx), pero recibe el
// slug desde los params y lo pasa a todas las secciones para que puedan
// usarlo en sus Server Actions. Desde FP2.5 (DT-028) también les pasa el
// `reto` resuelto para que cada sección lea solo los datos de ese reto.

import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";
import {
  esFaseTraficoValida,
  esFiltroComentarioValido,
  esGranularidadValida,
  esTabValida,
  type TabAdmin,
} from "@/lib/admin/navegacion";
import { verificarSesion, NOMBRE_COOKIE_SESION } from "@/lib/auth/admin-session";
import TabsAdmin from "@/components/admin/TabsAdmin";
import BotonCerrarSesion from "@/components/admin/BotonCerrarSesion";
import SeccionActividad from "@/components/admin/SeccionActividad";
import SeccionPosicion from "@/components/admin/SeccionPosicion";
import SeccionMapa from "@/components/admin/SeccionMapa";
import SeccionIntenciones from "@/components/admin/SeccionIntenciones";
import SeccionComentarios from "@/components/admin/SeccionComentarios";
import SeccionMinutoAMinuto from "@/components/admin/SeccionMinutoAMinuto";
import SeccionTrafico from "@/components/admin/SeccionTrafico";
import SeccionTextos from "@/components/admin/SeccionTextos";

export const dynamic = "force-dynamic";

const C = { paper: "#F4F3EF", ink: "#1B211D" };

interface SlugAdminPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function SlugAdminPage({ params, searchParams }: SlugAdminPageProps) {
  const { slug } = await params;

  const almacenCookies = await cookies();
  const cookieSesion = almacenCookies.get(NOMBRE_COOKIE_SESION)?.value;
  if (!verificarSesion(cookieSesion)) {
    redirect(`/admin/login?returnTo=/${slug}/admin`);
  }

  // El layout ya validó el slug (consulta deduplicada con React.cache). Cada
  // sección recibe el reto resuelto y filtra sus datos por él (FP2.5, DT-028).
  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) notFound();

  const sp = await searchParams;
  const tab: TabAdmin = esTabValida(sp.tab ?? null) ? (sp.tab as TabAdmin) : "actividad";
  const posOffset = numeroDesdeQuery(sp.posOffset);
  const intOffset = numeroDesdeQuery(sp.intOffset);
  const filtroComentarios = esFiltroComentarioValido(sp.filtroComentarios)
    ? sp.filtroComentarios
    : "todos";
  const granularidad = esGranularidadValida(sp.gran) ? sp.gran : "30m";
  const faseTraficoQuery = esFaseTraficoValida(sp.fase) ? sp.fase : undefined;

  return (
    <div className="min-h-dvh w-full" style={{ background: C.paper, color: C.ink }}>
      <div className="mx-auto w-full max-w-[720px] px-5 py-6">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="[font-family:var(--font-fraunces)] text-[24px] font-semibold">Panel admin</h1>
          <BotonCerrarSesion slug={slug} />
        </header>

        <TabsAdmin activa={tab} />

        <main className="mt-5">
          {tab === "actividad" && <SeccionActividad reto={reto} slug={slug} />}
          {tab === "posicion" && <SeccionPosicion reto={reto} offset={posOffset} slug={slug} />}
          {tab === "mapa" && <SeccionMapa reto={reto} />}
          {tab === "intenciones" && <SeccionIntenciones reto={reto} offset={intOffset} slug={slug} />}
          {tab === "comentarios" && <SeccionComentarios reto={reto} filtro={filtroComentarios} slug={slug} />}
          {tab === "minutoaminuto" && <SeccionMinutoAMinuto reto={reto} slug={slug} />}
          {tab === "trafico" && <SeccionTrafico reto={reto} granularidad={granularidad} faseQuery={faseTraficoQuery} slug={slug} />}
          {tab === "textos" && <SeccionTextos reto={reto} slug={slug} />}
        </main>
      </div>
    </div>
  );
}

function numeroDesdeQuery(valor: string | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
