// Sección "Minuto a minuto": composer (texto + foto opcional) + lista de
// entradas del intento activo, ordenadas por created_at desc. Mismo patrón
// que SeccionComentarios.tsx (Server Component que pide sus propios datos).

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { soloIntentoActivoDelReto } from "@/lib/supabase/intentos";
import type { Reto } from "@/lib/types";
import ComposerMinutoAMinuto from "@/components/admin/ComposerMinutoAMinuto";
import EntradaMinutoAMinuto from "@/components/admin/EntradaMinutoAMinuto";

const C = { muted: "#4A5450" };

export default async function SeccionMinutoAMinuto({ reto, slug }: { reto: Reto; slug: string }) {
  const supabase = getSupabaseAdmin();

  const { data: intentoActivo } = await soloIntentoActivoDelReto(
    supabase.from("intentos").select("id"),
    reto.id
  ).maybeSingle();

  const entradas = intentoActivo
    ? ((
        await supabase
          .from("minuto_a_minuto")
          .select("*")
          .eq("intento_id", intentoActivo.id)
          .order("created_at", { ascending: false })
      ).data ?? [])
    : [];

  return (
    <div className="space-y-4">
      {!intentoActivo && (
        <p className="text-[14px]" style={{ color: C.muted }}>
          No hay ningún intento activo. Crea o inicia un intento en la pestaña
          Actividad antes de publicar.
        </p>
      )}

      <ComposerMinutoAMinuto slug={slug} />

      {entradas.length === 0 ? (
        <p className="text-[14px]" style={{ color: C.muted }}>
          Todavía no has publicado ninguna entrada.
        </p>
      ) : (
        <div className="space-y-3">
          {entradas.map((entrada) => (
            <EntradaMinutoAMinuto
              key={entrada.id}
              id={entrada.id}
              texto={entrada.texto}
              fotoUrl={entrada.foto_url}
              createdAt={entrada.created_at}
              slug={slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
