// Sección "Minuto a minuto": composer (texto + foto opcional) + lista de
// entradas del intento activo, ordenadas por created_at desc. Mismo patrón
// que SeccionComentarios.tsx (Server Component que pide sus propios datos).
// Con la sección apagada en Configuración (FP3c, DT-032) se puede seguir
// publicando, pero se avisa de que no se ve en la web.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { soloIntentoActivoDelReto } from "@/lib/supabase/intentos";
import { configDelReto } from "@/lib/retos/config";
import type { Reto } from "@/lib/types";
import ComposerMinutoAMinuto from "@/components/admin/ComposerMinutoAMinuto";
import EntradaMinutoAMinuto from "@/components/admin/EntradaMinutoAMinuto";

const C = { muted: "#4A5450", aviso: "#8A6D1F" };

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
      {!configDelReto(reto).seccion_minuto_a_minuto && (
        <p
          role="status"
          className="rounded-lg px-3 py-2 text-[13px] leading-snug"
          style={{ background: "#C9A24B1F", color: C.aviso }}
        >
          La sección «Minuto a minuto» está apagada: publicas, pero no se ve en
          la web hasta que la enciendas en la pestaña Configuración.
        </p>
      )}

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
