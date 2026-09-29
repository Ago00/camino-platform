# Tarea en curso — FP2.5: Aislamiento de datos por reto

> La tarea anterior (FP2, superadmin) estaba cerrada y sin archivar en este
> fichero; el Implementador la copió tal cual a
> `docs/tareas/historico/2026-09-29-fp2-superadmin.md` antes de sobrescribir.

## Decisión técnica

**DT-028** (`docs/tecnico/decisiones-tecnicas.md`). Todas las lecturas y escrituras de la web pública, el panel admin, sus APIs y `/api/track` quedan acotadas al reto del slug. Migración `0009` (un intento abierto por reto), helper del intento activo por reto, cachés por reto, `/api/track?reto=<slug>` (opción B elegida por el usuario) y URL del GPS en el panel superadmin.

## Problema

Las tablas tienen `reto_id` (o cuelgan de `intentos`), pero muchas consultas no filtraban por reto: `.from("intentos")...eq("cerrado", false).maybeSingle()` sin `reto_id`, textos/comentarios/intenciones/visitas sin filtro, borrados solo por id, cachés de un único hueco, `"portuguesa-110"` hardcodeado. En BD, `intentos_activo_unico ON intentos ((true)) WHERE NOT cerrado` limitaba a un intento abierto en todo el sistema.

## Decisiones aprobadas

1. Migración `supabase/migrations/0009_intento_abierto_por_reto.sql`: `drop index if exists intentos_activo_unico; create unique index intentos_abierto_por_reto on intentos (reto_id) where not cerrado;` (sin índice global de "durante").
2. `/api/track?reto=<slug>`: TRACK_TOKEN global; slug validado (`^[a-z0-9-]+$`), resuelto con `obtenerRetoPorSlug`, intento activo de ESE reto, traza de su `ruta_id` (sin filtro si null). Sin reto o inexistente → `respuestaVacia()` sin guardar.
3. Panel superadmin: URL del GPS por reto (`<origen>/api/track?reto=<slug>`), solo lectura, seleccionable.

## Archivos creados/modificados (Implementador)

| Archivo | Estado |
|---|---|
| `supabase/migrations/0009_intento_abierto_por_reto.sql` | Creado (NO aplicado — lo aplica el orquestador) |
| `lib/supabase/intentos.ts` | Creado: `soloIntentoActivoDelReto(consulta, retoId)` |
| `lib/fase-actual.ts` | `obtenerFaseActual(retoId)` |
| `lib/fase-actual.test.ts` | Creado (3 tests) |
| `lib/progreso-cache.ts`, `lib/historico-cache.ts` | `Map<retoId, Entrada>`; `obtener/guardar(retoId, …)`, `limpiar(retoId?)` |
| `lib/progreso-cache.test.ts`, `lib/historico-cache.test.ts` | Adaptados + tests de aislamiento |
| `lib/textos/obtener-textos.ts` (+ test) | `obtenerTextos(retoId)` con `.eq("reto_id")`; test de colisión de clave entre retos |
| `lib/traza/progreso-actual.ts` (+ test) | `calcularProgresoActual(reto)`; traza de `reto.ruta_id`; sin ruta → libre |
| `lib/traza/datos-mapa-admin.ts` (+ test) | `obtenerDatosMapaAdmin(reto)`; ídem |
| `lib/types.ts` | Invariante "un intento abierto por reto" |
| `app/api/track/route.ts` (+ test) | `?reto=<slug>`; test multi-reto, sin reto, slug inválido/inexistente |
| `app/[slug]/page.tsx` | Reto → intento/textos/cachés por reto; `notFound()` sin reto; sin traza si `ruta_id` null |
| `app/[slug]/admin/page.tsx` | Resuelve el reto y lo pasa como prop a cada sección |
| `app/[slug]/admin/actions.ts` | Reto al inicio; filtros por `reto_id` / intento activo del reto; upsert `config_trafico` por `reto_id` |
| `app/[slug]/admin/actions.test.ts` | Creado (8 tests) |
| `app/[slug]/api/fase/route.ts`, `progreso/route.ts`, `minuto-a-minuto/route.ts` | Resuelven reto (404); fase/progreso/feed del reto |
| `components/admin/Seccion{Actividad,Textos,Posicion,MinutoAMinuto,Comentarios,Intenciones,Mapa,Trafico}.tsx` | Reciben `reto` y filtran por él |
| `components/admin/SeccionActividad.test.ts` | Adaptado + test de filtro por reto |
| `app/superadmin/(panel)/page.tsx` | URL del GPS por reto en cada tarjeta |
| `docs/tecnico/decisiones-tecnicas.md` | DT-028 (con notas de cierre de las desviaciones) |
| `docs/tecnico/modelo-datos.md`, `docs/tecnico/arquitectura.md` | Invariante del intento abierto por reto |
| `CHANGELOG.md`, `DEBT.md` | Actualizados |

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores
- `pnpm test`: 372 tests en verde (35 ficheros)
- `pnpm build`: OK
- Migración `0009`: creada, **pendiente de aplicar** en Supabase (orquestador)

## Decisiones de implementación (bloqueos menores resueltos) — revisar

1. **Helper con otra forma:** `soloIntentoActivoDelReto(consulta, retoId)` en vez de `obtenerIntentoActivoDelReto(supabase, retoId, columnas)`. El genérico sobre `select<Columnas>()` hacía que `tsc` agotara la memoria (OOM reproducido). Mismo objetivo, tipado estricto. Documentado en DT-028.
2. **Reto sin ruta con intento "guiado":** se mide y se muestra como libre (progreso, web pública, mapa admin; sin filtro geográfico en track). Documentado en DT-028; deuda de validar en `iniciarReto` registrada.
3. **`notFound()`** en `app/[slug]/page.tsx` y `app/[slug]/admin/page.tsx` si el reto no se resuelve (antes la pública caía a `"portuguesa-110"`).
4. **Caché de histórico** también se invalida en `descartarPosicion` y `reiniciarReto` (antes solo la de progreso).
5. **`/[slug]/api/minuto-a-minuto`** devuelve 500 si falla la consulta del intento activo, y feed vacío si el reto no tiene intento activo.
6. **Superadmin:** se muestra la URL sin el token, con una nota "añade `&t=` + `TRACK_TOKEN`" (el token es secreto y no debe renderizarse).
7. **Acciones de minuto a minuto / posiciones:** si el reto no tiene intento activo, `editar/eliminarMinutoAMinuto` y `descartarPosicion` lanzan error sin tocar BD (solo se pueden gestionar filas del intento activo, que es lo único que muestran las pestañas).

## Pendiente operativo tras el merge

- Aplicar `0009` en Supabase y verificar el índice.
- Reconfigurar OwnTracks con la URL del panel superadmin + `&t=<TRACK_TOKEN>` (sin `?reto=` los puntos se descartan en silencio).

## Historial de revisión

### Reviewer — 2026-09-29 — APROBADO (pasa a Seguridad)

Sin bloqueantes. Grep completo de `comentarios/intenciones/textos/intentos/posiciones/minuto_a_minuto/visitas_web/config_trafico` en `app/`, `components/`, `lib/` y `proxy.ts`: toda lectura/escritura filtra por `reto_id` o por el intento activo del reto (las consultas por `intento_id` usan ids obtenidos del intento activo del reto). Cachés por reto correctas; sin estado de módulo compartido salvo rate-limit (ya en DEBT). Migración 0009 correcta. Desviaciones 1–7 aceptadas.

Recomendaciones (registradas en DEBT.md): invalidar cachés del reto en `iniciarReto` y `editarReto` (superadmin); ampliar `actions.test.ts` (mostrarComentario, editarMinutoAMinuto, guardarTexto, transiciones, invalidación de caché solo del reto propio); comentario obsoleto en `lib/supabase/admin.ts:75-76`.
