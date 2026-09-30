// Web pública del reto. Server Component mínimo: resuelve el reto, su intento
// activo (sin intento, fase "antes"), los textos y la traza de pintado, y
// delega toda la composición en WebReto (compartida con la vista previa del
// admin, DT-034). La historia de la composición está en WebReto.tsx.

import { notFound } from "next/navigation";
import { obtenerTextos } from "@/lib/textos/obtener-textos";
import { obtenerRetoPorSlug } from "@/lib/supabase/retos";
import { cargarTrazaDeMapa } from "@/lib/traza/cargar-traza-mapa";
import { configDelReto } from "@/lib/retos/config";
import WebReto, { obtenerIntentoActivo } from "@/components/publico/WebReto";

// La fase y el progreso se leen de Supabase en cada petición: sin esto,
// Next.js prerenderizaría la ruta una vez en build y el HTML quedaría
// congelado para siempre en producción.
export const dynamic = "force-dynamic";

// Constante de módulo (no literal inline): referencia estable como prop de
// componentes cliente con efectos (ver docs/LESSONS.md).
const SIN_TRAZA: [number, number][] = [];

interface SlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SlugPage({ params }: SlugPageProps) {
  const { slug } = await params;
  // El layout ya validó que el reto existe (misma consulta deduplicada con
  // React.cache); sin reto no hay datos que filtrar, así que 404 igual que
  // el layout en vez de adivinar uno.
  const reto = await obtenerRetoPorSlug(slug);
  if (!reto) notFound();

  const [intentoActivo, textos] = await Promise.all([obtenerIntentoActivo(reto.id), obtenerTextos(reto.id)]);

  return (
    <WebReto
      reto={reto}
      config={configDelReto(reto)}
      textos={textos}
      // Un reto de ruta libre no tiene traza oficial que pintar.
      trazaCoords={reto.ruta_id !== null ? cargarTrazaDeMapa(reto.ruta_id) : SIN_TRAZA}
      fase={intentoActivo?.fase ?? "antes"}
      fuente={{ tipo: "real", intento: intentoActivo }}
      vistaPrevia={false}
    />
  );
}
