# Tarea en curso — FP3c: Configuración por reto desde el panel admin

> El contenido anterior (FP3b, "minuto a minuto" plegable) se archivó en
> `docs/tareas/historico/2026-09-30-fp3b-mam-plegable.md`.

## Prompt clarificado (producto cerrado)

El admin de CADA reto lo configura en `/<slug>/admin`:

1. Encender/apagar secciones públicas: intenciones, comentarios (muro + formulario), minuto a minuto, Instagram. Por defecto encendidas.
2. Respuestas de visitantes en comentarios (FP3a) on/off. Apagadas: sin botón "Responder", POST de respuesta rechazado; las existentes siguen visibles; el caminante puede seguir respondiendo desde el admin.
3. Foto de "quién camina": subir/cambiar/quitar (sustituye la constante `FOTO_SANTI` de `ModoAntes.tsx`).
4. Pestaña Textos agrupada por bloques.

## Decisión técnica

**DT-032** (`docs/tecnico/decisiones-tecnicas.md`). Columnas en `retos` + RLS de INSERT de `comentarios` (migración `0012_config_reto.sql`), dominio puro `lib/retos/config.ts`, 403 en las APIs, secciones apagadas sin renderizar, pestaña "Configuración", foto en Storage bajo `<retoId>/quien-camina-…`, textos por bloques.

## Archivos creados/modificados (Implementador)

| Archivo | Estado |
|---|---|
| `supabase/migrations/0012_config_reto.sql` | Creado (NO aplicado: lo aplica el orquestador) |
| `lib/types.ts` | `Reto` + 5 booleanos + `quien_camina_foto_url` |
| `lib/supabase/admin.ts` | Esos campos opcionales en el `Insert` de `retos` (crearReto del superadmin intacto) |
| `lib/retos/config.ts` (+ `.test.ts`) | Creado: `configDelReto`, `fotoQuienCaminaDelReto`, `urlInstagramVisible` |
| `lib/supabase/storage.ts` (+ `.test.ts`) | `subirFotoQuienCamina`, `rutaObjetoDelReto`, `borrarObjeto` |
| `app/[slug]/admin/actions.ts` (+ `.test.ts`) | `guardarConfiguracion`, `guardarFotoQuienCamina` |
| `app/[slug]/api/comentarios/route.ts` (+ `.test.ts`) | 403 con sección/respuestas apagadas; 42501 ⇒ 403 |
| `app/[slug]/api/intenciones/route.ts` + `route.test.ts` | 403 con sección apagada; test creado |
| `app/[slug]/api/minuto-a-minuto/route.ts` + `route.test.ts` | 403 con sección apagada; test creado |
| `lib/textos/bloques.ts` (+ `.test.ts`) | Creado: `BLOQUES_TEXTOS` (11 bloques) + exhaustividad en tipos |
| `lib/admin/navegacion.ts` (+ `.test.ts`) | Pestaña `configuracion` |
| `app/[slug]/admin/page.tsx` | Renderiza `SeccionConfiguracion` |
| `components/admin/SeccionConfiguracion.tsx`, `FormConfiguracion.tsx`, `FotoQuienCaminaForm.tsx` | Creados |
| `components/admin/SeccionTextos.tsx` | Índice de anclas + `<details>` por bloque, etiqueta "sección apagada" |
| `components/admin/SeccionMinutoAMinuto.tsx` | Aviso si la sección está apagada |
| `app/[slug]/page.tsx` | `config` a todos los modos, `fotoQuienCamina` a `ModoAntes`; sin carga de entradas del MAM apagado |
| `components/publico/ModoAntes.tsx` | Secciones según config; foto del reto o silueta; `FOTO_SANTI` eliminada |
| `components/publico/ModoDurante.tsx`, `ModoDuranteLibre.tsx`, `ModoLlegada.tsx`, `ModoLlegadaLibre.tsx` | Secciones según config (MAM apagado no se monta ni hace polling) |
| `components/publico/MuroComentarios.tsx`, `HiloComentario.tsx` | Prop `permitirRespuestas` |
| `app/api/track/route.test.ts`, `app/api/admin/login/route.test.ts` | Fixtures de `Reto` con los campos nuevos |
| `docs/tecnico/decisiones-tecnicas.md` (DT-032), `modelo-datos.md`, `arquitectura.md` | Actualizados |
| `CHANGELOG.md`, `DEBT.md` | Actualizados |

## Quality gates

- `pnpm typecheck`: 0 errores
- `pnpm lint`: 0 errores, 0 warnings
- `pnpm test`: 506 tests en verde (45 ficheros)
- `pnpm build`: OK
- **Verificación visual pendiente** (LESSONS: UI): no la ha hecho el Implementador. Comprobar en navegador: pestaña Configuración (interruptores con teclado, guardar, aviso "Sin efecto" de respuestas con comentarios apagados); subir/cambiar/quitar foto y verla en la fase "antes"; cada sección apagada desaparece en antes/durante/llegada (guiado y libre) y el MAM apagado no hace peticiones a `/api/minuto-a-minuto`; muro sin "Responder" con respuestas apagadas; pestaña Textos por bloques con anclas y etiqueta "sección apagada"; aviso en la pestaña Minuto a minuto.

## Checklist SQL post-migración (lo ejecuta el orquestador tras aplicar 0012)

1. Columnas y foto del reto original:
   ```sql
   select slug, seccion_intenciones, seccion_comentarios, seccion_minuto_a_minuto,
          seccion_instagram, respuestas_visitantes, quien_camina_foto_url
   from retos order by id;
   -- esperado: todo true; santi-ago con quien_camina_foto_url = '/santi.jpg'
   ```
2. Insert anon con la sección de comentarios apagada ⇒ rechazado (42501):
   ```sql
   update retos set seccion_comentarios = false where slug = 'santi-ago';
   begin; set local role anon;
   insert into comentarios (reto_id, nombre, texto, visibilidad)
     values ((select id from retos where slug = 'santi-ago'), 'test', 'test', 'publico');
   rollback;  -- debe fallar con "new row violates row-level security policy"
   update retos set seccion_comentarios = true where slug = 'santi-ago';
   ```
   (Como `anon` no ve `retos` inactivos, el subselect del id puede sustituirse por el id literal.)
3. Respuesta anon con respuestas de visitantes apagadas ⇒ rechazada; raíz aceptada:
   ```sql
   update retos set respuestas_visitantes = false where slug = 'santi-ago';
   begin; set local role anon;
   insert into comentarios (reto_id, parent_id, nombre, texto, visibilidad)
     values (<id reto>, <id raíz pública visible>, 'test', 'test', 'publico');  -- debe fallar (42501)
   rollback;
   begin; set local role anon;
   insert into comentarios (reto_id, nombre, texto, visibilidad)
     values (<id reto>, 'test', 'test', 'publico');  -- debe funcionar
   rollback;
   update retos set respuestas_visitantes = true where slug = 'santi-ago';
   ```
4. Permisos de la función: `select has_function_privilege('authenticated', 'comentarios_insert_permitido(bigint, boolean)', 'execute');` ⇒ `false`; para `anon` ⇒ `true`.
5. El panel admin (service role) sigue pudiendo responder con respuestas de visitantes apagadas (probar "Responder" desde la pestaña Comentarios).

## Decisiones de implementación (bloqueos menores resueltos) — revisar

1. **`guardarConfiguracion(slug, config: unknown)`** en vez de `ConfigReto`: la Server Action es un endpoint público; el esquema zod (`satisfies z.ZodType<ConfigReto>`) da el tipo. Permite testear entradas inválidas sin `as`.
2. **`urlInstagramVisible`** en `lib/retos/config.ts` (pura, con test) para no repetir en tres componentes la regla "interruptor + URL no vacía".
3. **Bloque "Instagram" propio** (1 clave) para poder marcarlo como "sección apagada"; 11 bloques en total. El orden sigue el recorrido de `ModoAntes` (recorrido antes que quién camina).
4. **Rollback de foto**: si falla el update de `retos` tras subir, se borra la foto recién subida (solo si `rutaObjetoDelReto` la reconoce).
5. **`rutaObjetoDelReto`** exige la forma exacta del nombre generado (`<ts>-<uuid>.<jpg|png|webp>`) tras `<retoId>/quien-camina-`, además de decodificar la URL: una URL con `..` o `%2F` no pasa.
6. **"Respuestas de visitantes"** se atenúa con aviso cuando los comentarios están apagados, conservando su valor.
7. **Guardado conjunto** de los interruptores (un botón) en lugar de guardar al pulsar cada uno: apagar varias secciones es un único cambio en la web.

## Pendiente operativo tras el merge

- Aplicar `0012_config_reto.sql` y ejecutar el checklist SQL.
- Verificación visual en preview.
- Invocar al Agente de Producto para `docs/producto/` (registrado en DEBT).

## Historial de revisión

### Reviewer — ciclo 1 (2026-09-30): APROBADO, pasa a Seguridad

- Sin bloqueantes. Todas las fases/modos (antes, durante guiado/libre, llegada guiado/libre) condicionan intenciones, comentarios, MAM e Instagram; el MAM apagado no se monta (sin polling) y en llegada no se cargan sus entradas. APIs: 403 tras resolver el reto y antes de cualquier consulta (respuestas apagadas: antes de leer el padre); 42501 ⇒ 403. Foto: sube bajo `<retoId>/quien-camina-`, solo borra lo que reconoce `rutaObjetoDelReto`, rollback si falla el update. Exhaustividad de bloques en tipos + test. Interruptores `role="switch"` accesibles.
- Recomendación registrada en `DEBT.md`: polling del MAM tras apagarlo en clientes con la página abierta.
- Pendiente (no de código): verificación visual y checklist SQL tras aplicar 0012.
