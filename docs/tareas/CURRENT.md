# Tarea en curso — FP3a: Respuestas en hilo en los comentarios

> El contenido anterior (FP2.6, contraseña de admin por reto) se archivó en
> `docs/tareas/historico/2026-09-29-fp2-6-password-por-reto.md`.

## Decisión técnica

**DT-030** (`docs/tecnico/decisiones-tecnicas.md`). Un solo nivel de respuestas, reglas en BD (migración 0011: `es_autor`, FK cascade, check de respuesta pública, trigger `comentarios_validar_respuesta`, RLS con `comentario_raiz_visible`), dominio puro `lib/comentarios/hilos.ts`, API que pagina raíces y trae respuestas por ids, Server Action `responderComentario` (es_autor) y UI de hilos en muro y panel. Sin fase de diseño (estilos del muro).

## Archivos creados/modificados (Implementador)

| Archivo | Estado |
|---|---|
| `supabase/migrations/0011_hilos_comentarios.sql` | Creado (**NO aplicado**) |
| `lib/types.ts` | `Comentario.es_autor`; `ComentarioPublico`, `HiloPublico`, `RespuestaMuro`; fuera el aviso "Dormido hasta FP3" |
| `lib/supabase/admin.ts` | `es_autor` opcional en `comentarios.Insert`; fuera el comentario "FP3 usará" |
| `lib/comentarios/hilos.ts` (+ `hilos.test.ts`) | Creado: `motivoRechazoPadre`, `agruparHilos`, `agruparHilosAdmin` |
| `app/[slug]/api/comentarios/route.ts` (+ `route.test.ts` nuevo) | GET por raíces + respuestas; POST raíz/respuesta con `z.union` de esquemas `.strict()` |
| `app/[slug]/admin/actions.ts` (+ test ampliado) | `responderComentario(slug, parentId, texto)` |
| `lib/textos/defaults.ts` | 6 claves nuevas del muro/respuesta |
| `components/publico/MuroComentarios.tsx` | Pinta `HiloComentario` por raíz; tipos de `lib/types.ts` |
| `components/publico/HiloComentario.tsx`, `RespuestaForm.tsx`, `InsigniaCaminante.tsx` | Creados |
| `components/admin/SeccionComentarios.tsx` | Agrupado por hilo con `agruparHilosAdmin`; raíz de contexto atenuada |
| `components/admin/FormRespuestaAdmin.tsx` | Creado |
| `components/admin/AccionesComentario.tsx` | Prop `numRespuestas`; confirm "se borrarán también N respuestas" |
| `components/admin/FiltroComentarios.tsx` | Prop `slug`; navega a `/${slug}/admin?…` (antes `/admin?…`, 404) |
| `components/admin/TabsAdmin.tsx`, `EnlacePaginacion.tsx`, `SeccionTrafico.tsx` | (Orquestador) enlaces a `/admin?…` (404 desde FP1) corregidos: `usePathname` / `/${slug}/admin?…` |
| `docs/tecnico/decisiones-tecnicas.md` | DT-030 con notas de cierre |
| `docs/tecnico/modelo-datos.md`, `docs/tecnico/arquitectura.md` | `es_autor`, invariantes del hilo, RLS, ficheros nuevos |
| `CHANGELOG.md`, `DEBT.md` | Actualizados |

`ocultarComentario`, `mostrarComentario` y `eliminarComentario` ya filtraban por `id` + `reto_id` (comprobado, con test existente).

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores, 0 warnings
- `pnpm test`: 441 tests en verde (39 ficheros)
- `pnpm build`: OK
- Migración `0011`: creada, **pendiente de aplicar** (orquestador). Debe aplicarse ANTES de desplegar: el GET selecciona `es_autor` y sin la columna responde 500.
- **Verificación visual pendiente** (LESSONS: UI y componentes cliente): no hecha por el Implementador. Comprobar en navegador muro con hilo de 1-2 respuestas (desplegado), de 3+ (plegado + toggle), responder como visitante, insignia "Caminante", y la pestaña Comentarios del admin (responder, filtro, raíz de contexto atenuada, confirm de borrado).

## Checklist SQL post-migración (ejecutar tras aplicar 0011)

Usar un reto de pruebas. `<R>` = id de reto, `<A>`/`<B>` = ids devueltos.

1. **Esquema:** `select column_name, data_type, column_default from information_schema.columns where table_name='comentarios' and column_name='es_autor';` → boolean, default false. `select confdeltype from pg_constraint where conname='comentarios_parent_id_fkey';` → `c` (cascade).
2. **Cascade:** como service role, insertar raíz `<A>` pública y una respuesta con `parent_id=<A>`; `delete from comentarios where id=<A>;` → la respuesta desaparece.
3. **Anon no ve respuestas de raíz oculta:** raíz `<A>` pública + respuesta visible; `update comentarios set oculto=true where id=<A>;` y como anon (`set local role anon;` dentro de una transacción) `select id from comentarios where parent_id=<A>;` → 0 filas. Con `oculto=false` → 1 fila.
4. **Anon no puede `es_autor=true`:** `begin; set local role anon; insert into comentarios (reto_id,nombre,texto,visibilidad,parent_id,es_autor) values (<R>,'x','y','publico',<A>,true); rollback;` → error de RLS (new row violates row-level security policy).
5. **Anon no puede responder a una respuesta:** con `<B>` respuesta de `<A>`: `begin; set local role anon; insert into comentarios (reto_id,nombre,texto,visibilidad,parent_id) values (<R>,'x','y','publico',<B>); rollback;` → `respuesta_no_permitida`.
6. **Extras:** respuesta con `visibilidad='privado'` → viola `comentarios_respuesta_publica`; respuesta con `parent_id` de otro reto o de una raíz privada/oculta → `respuesta_no_permitida`; como anon `select comentarios_validar_respuesta();` → permission denied.

## Decisiones de implementación (bloqueos menores resueltos) — revisar

1. **EXECUTE revocado también a `anon`/`authenticated`** (el plan solo revocaba a `public`): Supabase concede EXECUTE por default privileges del schema. Registrado en DT-030.
2. **POST de respuesta devuelve la fila creada** vía `.insert(...).select(...).single()` (id/created_at reales para pintarla en local). Un `check_violation` del trigger (carrera) se traduce a 422.
3. **Lectura del padre en la API filtrada por `id` + `reto_id`** (además de la RLS), igual que en la acción del admin.
4. **`motivoRechazoPadre` devuelve una unión de literales** (`"no_existe" | "otro_reto" | "es_respuesta" | "privado" | "oculto"`) en vez de `string`; la API responde un único mensaje, el admin uno por motivo.
5. **Panel sin filtro en BD:** trae todos los comentarios del reto y filtra al agrupar. Un hilo de raíz oculta muestra "oculto (con todo su hilo)".
6. **Fix relacionado:** `FiltroComentarios` navegaba a `/admin?…` (404 desde FP1). El mismo fallo en `TabsAdmin` y `EnlacePaginacion` (ahora con `usePathname`) y en `SeccionTrafico` (enlaces con `/${slug}/admin?…`) lo corrigió el orquestador en esta misma tarea; ya no queda deuda por ello.
7. **`RespuestaForm` sin zod en cliente**, como el resto de componentes públicos (no se añade zod al bundle del navegador).

## Pendiente operativo tras el merge

- Aplicar `0011` en Supabase (antes del despliegue) y pasar el checklist SQL.
- Verificación visual en preview.
- Invocar al Agente de Producto para `docs/producto/` (registrado en DEBT).

## Historial de revisión

### Reviewer — ciclo 1 (2026-09-29): APROBADO, pasa a Seguridad

Sin bloqueantes. Coincide con DT-030: un nivel (trigger + `motivoRechazoPadre`), `es_autor` solo service role (RLS + `.strict()`), cascade, RLS con `comentario_raiz_visible`, paginación por raíces + respuestas por ids, `reto_id` en todas las consultas nuevas (GET raíces/respuestas, lectura del padre en API y acción, insert). Tests de dominio, API y acción cubren rechazos y aislamiento. Recomendaciones (6) registradas en `DEBT.md` ("Recomendaciones de la revisión de FP3a"). Docs: el Reviewer actualizó CURRENT (decisión 6 y tabla), DT-030 y CHANGELOG para reflejar el fix de navegación del orquestador en `TabsAdmin`/`EnlacePaginacion`/`SeccionTrafico`. Siguen pendientes: aplicar 0011 + checklist SQL y verificación visual.
