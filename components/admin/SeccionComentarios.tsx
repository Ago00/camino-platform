// Sección "Comentarios": sub-pestañas Públicos / Privados / Ocultos.
// - Públicos y Ocultos: hilos (raíz + respuestas, FP3a/DT-030) con ocultar,
//   mostrar (revertir), eliminar (hard delete, con confirmación; borrar una
//   raíz borra sus respuestas) y "Responder" como caminante en las raíces que
//   lo admiten (`puedeResponder`).
// - Privados: lista plana de los mensajes escritos solo para quien camina. No
//   se publican ni se pueden contestar, así que solo admiten Eliminar.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  agruparHilosAdmin,
  contarComentariosAdmin,
  listarPrivadosAdmin,
  puedeResponder,
  type HiloAdmin,
} from "@/lib/comentarios/hilos";
import { filtroComentarioDesdeQuery } from "@/lib/admin/navegacion";
import type { Comentario, Reto } from "@/lib/types";
import FiltroComentarios from "@/components/admin/FiltroComentarios";
import AccionesComentario from "@/components/admin/AccionesComentario";
import FormRespuestaAdmin from "@/components/admin/FormRespuestaAdmin";
import { formatearFechaHora } from "@/lib/fechas";

const C = { ink: "#1B211D", muted: "#4A5450", eucalipto: "#2F5D50" };

export default async function SeccionComentarios({
  reto,
  filtro: filtroQuery,
  slug,
}: {
  reto: Reto;
  /** Valor de ?filtroComentarios=; se normaliza aquí (URLs antiguas con "todos" → default). */
  filtro: string | undefined;
  slug: string;
}) {
  const filtro = filtroComentarioDesdeQuery(filtroQuery);

  // Sin filtro en BD: el filtro se aplica al agrupar, porque un hilo se
  // muestra (con su raíz como contexto) si solo una respuesta lo cumple, y
  // los contadores de las sub-pestañas salen de las mismas filas.
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("comentarios")
    .select("*")
    .eq("reto_id", reto.id)
    .order("created_at", { ascending: false });
  const filas = data ?? [];

  return (
    <div className="space-y-4">
      <FiltroComentarios activo={filtro} slug={slug} contadores={contarComentariosAdmin(filas)} />

      {filtro === "privados" ? (
        <ListaPrivados privados={listarPrivadosAdmin(filas)} slug={slug} />
      ) : (
        <ListaHilos hilos={agruparHilosAdmin(filas, filtro)} slug={slug} />
      )}
    </div>
  );
}

function SinComentarios() {
  return (
    <p className="text-[14px]" style={{ color: C.muted }}>
      No hay comentarios que mostrar.
    </p>
  );
}

function ListaPrivados({ privados, slug }: { privados: Comentario[]; slug: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[13px]" style={{ color: C.muted }}>
        Mensajes que solo ves tú; no se publican ni se pueden contestar.
      </p>
      {privados.length === 0 ? (
        <SinComentarios />
      ) : (
        privados.map((privado) => (
          <div
            key={privado.id}
            className="rounded-xl border bg-white px-4 py-3"
            style={{ borderColor: "#00000010" }}
          >
            <FilaComentario comentario={privado} slug={slug} numRespuestas={0} atenuado={false} ocultable={false} />
          </div>
        ))
      )}
    </div>
  );
}

function ListaHilos({ hilos, slug }: { hilos: HiloAdmin[]; slug: string }) {
  if (hilos.length === 0) return <SinComentarios />;
  return (
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
            ocultable
          />
          {puedeResponder(hilo.raiz) && <FormRespuestaAdmin slug={slug} parentId={hilo.raiz.id} />}

          {hilo.respuestas.length > 0 && (
            <div className="mt-3 space-y-2 border-l-2 pl-3" style={{ borderColor: "#2F5D5022" }}>
              {hilo.respuestas.map((respuesta) => (
                <div
                  key={respuesta.id}
                  className="rounded-lg px-2 py-1.5"
                  style={{ background: respuesta.oculto ? "#00000006" : "transparent" }}
                >
                  <FilaComentario comentario={respuesta} slug={slug} numRespuestas={0} atenuado={false} ocultable />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FilaComentario({
  comentario,
  slug,
  numRespuestas,
  atenuado,
  ocultable,
}: {
  comentario: Comentario;
  slug: string;
  numRespuestas: number;
  atenuado: boolean;
  ocultable: boolean;
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
          )}
          {ocultable &&
            comentario.oculto &&
            (comentario.parent_id === null ? " · oculto (con todo su hilo)" : " · oculto")}{" "}
          · {formatearFechaHora(comentario.created_at)}
          {atenuado && " · (contexto)"}
        </div>
        <div className="mt-0.5 text-[14px]" style={{ color: C.ink }}>
          {comentario.texto}
        </div>
      </div>
      <AccionesComentario
        id={comentario.id}
        oculto={comentario.oculto}
        slug={slug}
        numRespuestas={numRespuestas}
        ocultable={ocultable}
      />
    </div>
  );
}
