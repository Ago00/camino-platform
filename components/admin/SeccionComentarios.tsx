// Sección "Comentarios": hilos (raíz + respuestas, FP3a/DT-030) con filtro
// todos/públicos/ocultos, ocultar, mostrar (revertir), eliminar (hard delete,
// con confirmación; borrar una raíz borra sus respuestas) y "Responder" como
// caminante en las raíces públicas no ocultas.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { agruparHilosAdmin } from "@/lib/comentarios/hilos";
import type { FiltroComentario } from "@/lib/admin/navegacion";
import type { Comentario, Reto } from "@/lib/types";
import FiltroComentarios from "@/components/admin/FiltroComentarios";
import AccionesComentario from "@/components/admin/AccionesComentario";
import FormRespuestaAdmin from "@/components/admin/FormRespuestaAdmin";

const C = { ink: "#1B211D", muted: "#4A5450", eucalipto: "#2F5D50" };

export default async function SeccionComentarios({
  reto,
  filtro,
  slug,
}: {
  reto: Reto;
  filtro: FiltroComentario;
  slug: string;
}) {
  // Sin filtro en BD: el filtro se aplica al agrupar, porque un hilo se
  // muestra (con su raíz como contexto) si solo una respuesta lo cumple.
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("comentarios")
    .select("*")
    .eq("reto_id", reto.id)
    .order("created_at", { ascending: false });

  const hilos = agruparHilosAdmin(data ?? [], filtro);

  return (
    <div className="space-y-4">
      <FiltroComentarios activo={filtro} slug={slug} />

      {hilos.length === 0 ? (
        <p className="text-[14px]" style={{ color: C.muted }}>
          No hay comentarios que mostrar.
        </p>
      ) : (
        <div className="space-y-3">
          {hilos.map((hilo) => (
            <div
              key={hilo.raiz.id}
              className="rounded-xl border px-4 py-3"
              style={{ borderColor: "#00000010", background: hilo.raiz.oculto ? "#00000006" : "white" }}
            >
              <FilaComentario
                comentario={hilo.raiz}
                slug={slug}
                numRespuestas={hilo.totalRespuestas}
                atenuado={hilo.raizEsContexto}
              />
              {!hilo.raiz.oculto && hilo.raiz.visibilidad === "publico" && (
                <FormRespuestaAdmin slug={slug} parentId={hilo.raiz.id} />
              )}

              {hilo.respuestas.length > 0 && (
                <div className="mt-3 space-y-2 border-l-2 pl-3" style={{ borderColor: "#2F5D5022" }}>
                  {hilo.respuestas.map((respuesta) => (
                    <div
                      key={respuesta.id}
                      className="rounded-lg px-2 py-1.5"
                      style={{ background: respuesta.oculto ? "#00000006" : "transparent" }}
                    >
                      <FilaComentario comentario={respuesta} slug={slug} numRespuestas={0} atenuado={false} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilaComentario({
  comentario,
  slug,
  numRespuestas,
  atenuado,
}: {
  comentario: Comentario;
  slug: string;
  numRespuestas: number;
  atenuado: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3" style={{ opacity: atenuado ? 0.55 : 1 }}>
      <div>
        <div className="text-[12.5px] font-medium" style={{ color: C.muted }}>
          {comentario.nombre}
          {comentario.es_autor && (
            <span className="font-semibold" style={{ color: C.eucalipto }}>
              {" "}
              · Caminante
            </span>
          )}{" "}
          · {comentario.visibilidad}
          {comentario.oculto && (comentario.parent_id === null ? " · oculto (con todo su hilo)" : " · oculto")} ·{" "}
          {new Date(comentario.created_at).toLocaleString("es-ES")}
          {atenuado && " · (contexto)"}
        </div>
        <div className="mt-0.5 text-[14px]" style={{ color: C.ink }}>
          {comentario.texto}
        </div>
      </div>
      <AccionesComentario id={comentario.id} oculto={comentario.oculto} slug={slug} numRespuestas={numRespuestas} />
    </div>
  );
}
