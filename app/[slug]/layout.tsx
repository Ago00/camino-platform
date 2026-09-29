/**
 * Layout de slug — valida que el slug exista en la tabla `retos` antes de
 * renderizar cualquier página bajo `/:slug/`. Si el slug es desconocido,
 * responde con un 404 (Next.js notFound()).
 *
 * React.cache() en `obtenerRetoPorSlug` asegura que la consulta a BD se
 * deduplica entre este layout y los page.tsx que llaman a la misma función
 * con el mismo slug en el mismo request (DT-026).
 */

import { notFound } from "next/navigation";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";

interface SlugLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SlugLayout({ children, params }: SlugLayoutProps) {
  const { slug } = await params;
  const reto = await obtenerRetoPorSlug(slug);

  if (!reto) {
    notFound();
  }

  return <>{children}</>;
}
