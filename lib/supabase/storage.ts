/**
 * Subida de fotos a Supabase Storage: las del feed "minuto a minuto"
 * (`subirFotoMinutoAMinuto`), la foto opcional de la pantalla de llegada
 * (`subirFotoLlegada`, DT-024) y la foto de "quién camina" de cada reto
 * (`subirFotoQuienCamina`, FP3c/DT-032) — todas al mismo bucket público
 * `minuto-a-minuto` (en la plataforma lo crea supabase/migrations/0013_bucket_fotos.sql),
 * con un prefijo distinto en el nombre del objeto para no colisionar.
 *
 * Solo se llama desde Server Actions (app/admin/actions.ts) con el cliente
 * service role, que bypassa RLS de Storage igual que bypassa RLS de BD — no
 * hace falta ninguna política de Storage para `insert`. Validación de tipo
 * MIME y tamaño aquí, en el borde del sistema, antes de que cualquier byte
 * llegue a Storage.
 *
 * Los límites (formatos y tamaño máximo) viven en `lib/imagen/limites-subida.ts`
 * porque el navegador aplica exactamente los mismos antes de enviar (DT-017):
 * si cada lado tuviera su propia constante, el cliente podría acabar mandando
 * fotos que este módulo rechaza.
 */

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  TAMANO_MAXIMO_FOTO_BYTES,
  esMimePermitido,
  formatearMegabytes,
  type TipoMimePermitido,
} from "@/lib/imagen/limites-subida";

const BUCKET = "minuto-a-minuto";

const EXTENSION_POR_MIME: Record<TipoMimePermitido, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Fallo cuyo mensaje está redactado para enseñárselo al usuario tal cual.
 * Lo que no sea de este tipo no se muestra: podría filtrar detalles internos
 * (nombres de variables de entorno, rutas, respuestas de Supabase).
 */
export class ErrorDeSubidaDeFoto extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeSubidaDeFoto";
  }
}

/**
 * Sube una foto al bucket público `minuto-a-minuto` y devuelve su URL pública.
 * Lanza `ErrorDeSubidaDeFoto` si el fichero no cumple el tipo MIME o el tamaño
 * máximo permitidos — quien la llama (Server Action) es responsable de
 * convertir esa excepción en un mensaje de error visible, nunca en un crash
 * sin contexto.
 */
export async function subirFotoMinutoAMinuto(foto: File): Promise<string> {
  return subirFotoAlBucket(foto, "");
}

/**
 * Sube la foto opcional de la pantalla de llegada (DT-024) al MISMO bucket
 * público `minuto-a-minuto` — no se crea un bucket nuevo, eso exige
 * configuración manual en el dashboard de Supabase — con el prefijo
 * `llegada-` en el nombre del objeto para no colisionar con las fotos del
 * feed. Mismas reglas de validación (tipo MIME, tamaño) y mismo tipo de
 * error que `subirFotoMinutoAMinuto`.
 */
export async function subirFotoLlegada(foto: File): Promise<string> {
  return subirFotoAlBucket(foto, "llegada-");
}

/**
 * Sube la foto de "quién camina" del reto (FP3c, DT-032) al mismo bucket, bajo
 * `<retoId>/quien-camina-…`. La carpeta por reto es lo que permite a
 * `rutaObjetoDelReto` reconocer, al sustituirla, que la foto anterior es de
 * ESTE reto y se puede borrar. Mismas validaciones que el resto de fotos.
 */
export async function subirFotoQuienCamina(foto: File, retoId: number): Promise<string> {
  return subirFotoAlBucket(foto, prefijoQuienCamina(retoId));
}

function prefijoQuienCamina(retoId: number): string {
  return `${retoId}/quien-camina-`;
}

const MARCA_URL_PUBLICA_BUCKET = `/storage/v1/object/public/${BUCKET}/`;

/** Forma exacta del nombre que genera `subirFotoAlBucket` tras el prefijo. */
const NOMBRE_GENERADO = /^\d+-[0-9a-f-]+\.(jpg|png|webp)$/;

/**
 * Ruta del objeto en el bucket si `url` es una foto de "quién camina" subida
 * para `retoId`; null en cualquier otro caso (ruta de `/public` como
 * `/santi.jpg`, objeto de otro reto, foto del feed, URL mal formada).
 *
 * Es la guarda que impide que sustituir la foto de un reto borre un objeto que
 * no le pertenece: solo se borra lo que devuelve esta función. El nombre debe
 * tener exactamente la forma que genera `subirFotoAlBucket` (sin subcarpetas
 * ni `..`), así una URL manipulada no puede apuntar fuera de la carpeta.
 */
export function rutaObjetoDelReto(url: string, retoId: number): string | null {
  const ruta = rutaDecodificadaEnElBucket(url);
  if (ruta === null) return null;

  const prefijo = prefijoQuienCamina(retoId);
  if (!ruta.startsWith(prefijo)) return null;
  return NOMBRE_GENERADO.test(ruta.slice(prefijo.length)) ? ruta : null;
}

/**
 * Ruta del objeto si `url` es una foto del feed "minuto a minuto" (sin
 * prefijo, en la raíz del bucket, con el nombre que genera
 * `subirFotoAlBucket`); null en cualquier otro caso. La usa
 * `crearMinutoAMinuto` para borrar la foto que acaba de subir cuando la
 * entrada resulta ser un reintento duplicado (DT-033).
 */
export function rutaObjetoMinutoAMinuto(url: string): string | null {
  const ruta = rutaDecodificadaEnElBucket(url);
  if (ruta === null) return null;
  return NOMBRE_GENERADO.test(ruta) ? ruta : null;
}

function rutaDecodificadaEnElBucket(url: string): string | null {
  const inicio = url.indexOf(MARCA_URL_PUBLICA_BUCKET);
  if (inicio === -1) return null;

  const rutaCodificada = url.slice(inicio + MARCA_URL_PUBLICA_BUCKET.length).split(/[?#]/)[0];
  try {
    return decodeURIComponent(rutaCodificada);
  } catch {
    return null;
  }
}

/**
 * Borra un objeto del bucket. No lanza: una foto huérfana en Storage es
 * preferible a que falle una acción que ya guardó el cambio en BD.
 */
export async function borrarObjeto(ruta: string): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin().storage.from(BUCKET).remove([ruta]);
    if (error) console.error("No se pudo borrar el objeto de Storage", ruta, error.message);
  } catch (error) {
    console.error("Fallo inesperado al borrar el objeto de Storage", ruta, error);
  }
}

/**
 * Lógica compartida entre `subirFotoMinutoAMinuto`, `subirFotoLlegada` y
 * `subirFotoQuienCamina`: solo cambia el prefijo del nombre del objeto en
 * Storage — todas suben al mismo bucket, con las mismas reglas de validación.
 */
async function subirFotoAlBucket(foto: File, prefijoNombre: string): Promise<string> {
  if (!esMimePermitido(foto.type)) {
    throw new ErrorDeSubidaDeFoto(
      `Formato de imagen no permitido (${foto.type || "desconocido"}). Usa JPEG, PNG o WebP.`
    );
  }

  if (foto.size > TAMANO_MAXIMO_FOTO_BYTES) {
    throw new ErrorDeSubidaDeFoto(
      `La foto pesa ${formatearMegabytes(foto.size)} y el máximo son ${formatearMegabytes(
        TAMANO_MAXIMO_FOTO_BYTES
      )}.`
    );
  }

  const extension = EXTENSION_POR_MIME[foto.type];
  const nombreUnico = `${prefijoNombre}${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(nombreUnico, foto, {
    contentType: foto.type,
  });

  if (error) {
    throw new ErrorDeSubidaDeFoto("No se pudo subir la foto a Storage.");
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombreUnico);
  return data.publicUrl;
}
