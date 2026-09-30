# Tarea en curso — Endurecimiento pre-reto

> El contenido anterior (FP3c, configuración por reto) se archivó en
> `docs/tareas/historico/2026-09-30-fp3c-config-por-reto.md`.

## Prompt clarificado (aprobado por el orquestador)

Lote de endurecimiento antes del reto:

0. **Ya resuelto por el orquestador (solo documentar):** el proyecto Supabase de la plataforma no tenía el bucket `minuto-a-minuto` (lo creaba `0002`, del proyecto original; `0007` no lo incluía) y toda subida de foto fallaba. `0013_bucket_fotos.sql` lo crea (aplicada y verificada: público, 4 MB, jpeg/png/webp).
1. **Idempotencia de `crearMinutoAMinuto`** con `clave_envio` (UUID del cliente, estable entre reintentos), columna + índice único parcial (`0014`), comprobación previa a la subida y 23505 ⇒ éxito borrando la foto.
2. **Límites de tiempo del composer:** `cargarImagen` rechaza a los 10 s (degrada al original); aviso "Sigue subiendo, no cierres la página" pasados 15 s de envío, sin abortar (composer, y si es trivial ModalFinalizar y FotoQuienCaminaForm).
3. **El muro muestra el comentario público recién enviado** (recarga de la página 0, sin polling nuevo).
4. **Error de consola `<circle> attribute r: Expected length, "undefined"`** en `/santi-ago`: identificar y corregir sin cambiar la animación.
5. **Limpieza de `DEBT.md`** (migraciones verificadas en BD por el orquestador y entradas ya resueltas en código).

## Decisión técnica

**DT-033** (`docs/tecnico/decisiones-tecnicas.md`) para la idempotencia y los límites de tiempo. Nota en DT-013 remitiendo a `0013`.

## Archivos creados/modificados (Implementador)

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0014_mam_clave_envio.sql` | Creado (aplicado por el orquestador, según el encargo de revisión) |
| `lib/types.ts` | `MinutoAMinuto.clave_envio: string \| null` |
| `lib/supabase/admin.ts` | `clave_envio` opcional en el `Insert` de `minuto_a_minuto`; comentarios obsoletos de `intenciones`/`visitas_web` |
| `lib/supabase/storage.ts` (+ `.test.ts`) | `rutaObjetoMinutoAMinuto` (pura) y extracción común de la ruta; cabecera remite a `0013` |
| `app/[slug]/admin/actions.ts` (+ `.test.ts`) | `crearMinutoAMinuto` idempotente (zod uuid opcional, comprobación previa, 23505 ⇒ éxito, borra la foto sin fila); intento activo resuelto antes de subir |
| `components/admin/ComposerMinutoAMinuto.tsx` | `clave_envio` en ref (estable en reintentos; nueva tras éxito o al tocar texto/foto) + aviso de envío lento |
| `components/admin/ModalFinalizar.tsx`, `FotoQuienCaminaForm.tsx` | Aviso de envío lento |
| `lib/envio/aviso-envio-lento.ts` (+ `.test.ts`) | Creado: `avisarSiTarda`, umbral 15 s, mensaje |
| `lib/imagen/preparar-foto.ts` (+ `.test.ts`) | `cargarImagen` con `Promise.race` 10 s (`LIMITE_DECODIFICACION_MS`, `ErrorDecodificacionAgotada`), limpia temporizador y URL; tests con `<img>` falso y fake timers |
| `components/publico/ComentariosConMuro.tsx` | Creado: form + muro; recarga del muro solo con comentario público |
| `components/publico/ComentarioForm.tsx` | `onEnviado(visibilidad)` |
| `components/publico/MuroComentarios.tsx` | `ref` con `recargar()` (`useImperativeHandle`) |
| `components/publico/ModoDurante.tsx`, `ModoDuranteLibre.tsx`, `ModoLlegada.tsx`, `ModoLlegadaLibre.tsx` | Usan `ComentariosConMuro` |
| `components/publico/PeregrinoLibre.tsx` | `initial={{ r: 6.5 }}` en la cabeza del peregrino |
| `components/admin/EnlacePaginacion.tsx` | Comentario de cabecera corregido |
| `docs/tecnico/decisiones-tecnicas.md` (DT-033, nota DT-013), `modelo-datos.md`, `arquitectura.md` | Actualizados |
| `CHANGELOG.md`, `DEBT.md` | Actualizados (12 entradas cerradas, 1 nueva) |

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores, 0 warnings
- `pnpm test`: 526 tests en verde (46 ficheros)
- `pnpm build`: OK

## Decisiones de implementación (bloqueos menores resueltos) — revisar

1. **Clave conservada tras un error** si no se toca nada: si el primer envío sí llegó, el reenvío manual tampoco duplica. Se descarta al cambiar texto o foto (ya es otra entrada).
2. **Intento activo antes de la subida:** necesario para comprobar la clave antes de subir; además, sin intento ya no queda foto huérfana.
3. **Borrado de la foto en cualquier fallo del `INSERT`**, no solo en el 23505 (ninguna fila la referencia). Recogido en la nota de cierre de DT-033.
4. **Clave inválida (no UUID) ⇒ error** sin subir ni escribir; clave vacía ⇒ sin clave.
5. **Muro:** primero se probó un contador + `useEffect`; el lint (`react-hooks/set-state-in-effect`) lo rechaza, así que la recarga se pide desde el evento de envío con un handle imperativo (`ref` + `useImperativeHandle`, React 19 sin `forwardRef`). La recarga sustituye las páginas cargadas por la página 0.
6. **Aviso lento** con un helper puro (`avisarSiTarda`) en vez de un `useEffect` por componente: cubre la espera completa, reintentos incluidos, y se limpia en `finally`.
7. **`<circle>`:** la cabeza de `PeregrinoAndando` es un `motion.circle` sin `r` ni `initial`; motion toma como origen `getAttribute("r")` (null, ver `SVGVisualElement.readValueFromInstance` de motion-dom 12.43) y escribe `r="undefined"`. El `<animate attributeName="r">` de `Mapa.tsx` tiene `values` válidos y no es la causa.

## Verificación en navegador

- **No se pudo hacer contra `/santi-ago`:** no hay `.env` local con las credenciales de Supabase, así que en `pnpm dev` la home sale vacía y `/santi-ago` da 404. No tengo herramienta de navegador en este entorno.
- **Lo que sí se comprobó:** con `renderToString` de `motion/react`, un `motion.circle` sin `initial` se renderiza sin `r` (`<circle cx="18.5" cy="12">`) y con `initial={{ r: 6.5 }}` sale `r="6.5"`.
- **Pendiente en preview:** consola limpia en `/santi-ago` (fase "antes") y al pinchar el peregrino (animación de enfado igual que antes); enviar un comentario público ⇒ aparece en el muro sin recargar (uno privado no recarga); publicar en el minuto a minuto con y sin foto (y con red lenta: aviso a los 15 s); el modal "Finalizar" y la foto de quién camina siguen funcionando.
- Nota: `next dev` reescribe `AGENTS.md` (bloque `nextjs-agent-rules`); no es un cambio de esta tarea.

## Trabajos añadidos al mismo lote (documentados por el Reviewer)

Se unieron a este lote sin pasar por CURRENT.md. Se documentan en CHANGELOG (3 entradas), en las notas posteriores de DT-027, DT-030 y DT-031 y en la nota de DT-029 sobre `editarReto`.

| Trabajo | Archivos |
|---|---|
| Superadmin: acciones con resultado + `useActionState`, estados pendientes, mensajes, conservar valores, enlaces "Ver web" / "Panel admin" / "Ver portada" | `app/superadmin/(panel)/{actions,resultado-accion}.ts` (+ tests), `page.tsx`, `BotonEliminarReto.tsx`, `CamposReto.tsx` (nuevo), `FormularioCrearReto.tsx` (nuevo), `FormularioEditarReto.tsx` (nuevo); `app/[slug]/admin/page.tsx` ("Ver web") |
| Admin: comentarios en Públicos / Privados / Ocultos; privados solo se eliminan | `lib/admin/navegacion.ts` (+ test), `lib/comentarios/hilos.ts` (+ test), `components/admin/{FiltroComentarios,SeccionComentarios,AccionesComentario,FormRespuestaAdmin}.tsx` |
| Web: "Responder" bajo cada respuesta + "Respondiendo a {nombre}"; cabecera del minuto a minuto en acordeón | `components/publico/{HiloComentario,RespuestaForm,MinutoAMinuto}.tsx`, `lib/textos/{defaults,bloques}.ts` |

DEBT cerradas por estos trabajos: "Panel superadmin: mensajes de error…", "Mensajes de error de la contraseña de admin…", "Minuto a minuto plegable: botón y aviso sin contexto…" y el punto (5) de las recomendaciones de FP3a.

**Quality gates:** las de arriba son del trabajo 1. Hay que volver a ejecutar `pnpm typecheck && pnpm lint && pnpm test && pnpm build` sobre el lote completo; el Reviewer no tenía shell para hacerlo.

## Historial de revisión

### Revisión 1 — 2026-09-30 (lote combinado) — BLOQUEANTE

1. `components/publico/HiloComentario.tsx:31,48-49`: `respondiendoA` guarda el **nombre** y no el comentario. Cuando varias respuestas son del mismo autor (lo normal: el caminante contesta varias veces con el mismo nombre), todos sus botones "Responder" se marcan `aria-expanded="true"` a la vez. Además, pulsar "Responder" bajo otra respuesta del mismo autor **cierra** el formulario en vez de mantenerlo abierto. **Fix:** guardar `{ id: number; nombre: string } | null`, comparar por `id` en el toggle y en `aria-expanded`, y pasar `respondiendoA.nombre` a `RespuestaForm`. `botonResponder` recibe el comentario, no el nombre.

Recomendaciones registradas en `DEBT.md` ("Recomendaciones de la revisión del lote pre-reto…").

### Revisión 2 — 2026-09-30 — APROBADO

- El bloqueante está resuelto: `respondiendoA` es `{ id, nombre } | null` y se compara por `id`.
- También aplicadas la recomendación 1 (en parte: `autoFocus` en el nombre) y la 3 (sin texto `sr-only`, y eliminadas las claves `minuto_a_minuto_boton_mostrar`/`_ocultar`).
- Gates del lote completo según el orquestador: typecheck 0, lint 0, 581/581 tests, build OK.
- Siguiente paso: Seguridad.

## Pendiente operativo tras el merge

- Aplicar `0014_mam_clave_envio.sql` y verificar:
  ```sql
  select column_name, data_type, is_nullable from information_schema.columns
   where table_name = 'minuto_a_minuto' and column_name = 'clave_envio';   -- uuid, YES
  select indexdef from pg_indexes where indexname = 'minuto_a_minuto_clave_envio_idx';
   -- CREATE UNIQUE INDEX … (clave_envio) WHERE (clave_envio IS NOT NULL)
  ```
- Desplegar el código **después** de aplicar `0014`: el `INSERT` ya envía `clave_envio` (con o sin valor) y fallaría con la columna inexistente.
