# Modelo de datos

Esquema Supabase (PostgreSQL) de la plataforma multi-tenant. El SQL ejecutable
completo vive en `supabase/migrations/0007_schema_plataforma.sql` (FP0/DT-025).
Este documento describe las entidades, sus relaciones y los invariantes críticos
que el código debe respetar.

> **Estado (FP0, 2026-09-28):** la migración `0007_schema_plataforma.sql` está
> escrita y revisada pero pendiente de aplicar contra el nuevo proyecto Supabase.
> Santi la aplica manualmente (ver `DEBT.md`). Hasta entonces los endpoints de
> API funcionan solo en local con el schema antiguo.

---

## Entidades

### `retos`

Entidad raíz del modelo multi-tenant (FP0/DT-025). Cada reto tiene sus propios
datos aislados en el resto de tablas top-level vía `reto_id` FK.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint PK | Generado automáticamente |
| `slug` | text UNIQUE | Identificador URL amigable (p. ej. `'portuguesa-110'`) |
| `nombre` | text | Nombre visible (p. ej. `'Camino Portugués 110 km'`) |
| `descripcion` | text | Descripción larga; nullable |
| `ruta_tipo` | text | `'predefinida' \| 'libre'`. Predefinida = existe traza GeoJSON en `lib/rutas/<ruta_id>/` |
| `ruta_id` | text | Mapea a `lib/rutas/<ruta_id>/` en el repo. `null` solo en modo libre (check en BD) |
| `activo` | boolean | `false` = reto archivado, no visible |
| `seccion_intenciones` | boolean | default `true` (FP3c, DT-032, 0012). `false` = sin intenciones en la web; POST ⇒ 403 |
| `seccion_comentarios` | boolean | default `true`. `false` = sin formulario ni muro; API GET/POST ⇒ 403; RLS de INSERT de anon lo rechaza |
| `seccion_minuto_a_minuto` | boolean | default `true`. `false` = el feed no se pinta ni hace polling; API GET ⇒ 403. El admin puede seguir publicando |
| `seccion_instagram` | boolean | default `true`. El enlace se pinta solo si está a `true` y el texto `cierre_antes_instagram_url` no está vacío |
| `respuestas_visitantes` | boolean | default `true`. `false` = sin "Responder" en el muro; POST de respuesta ⇒ 403 y RLS lo rechaza; las respuestas del caminante (service role) siguen permitidas |
| `quien_camina_foto_url` | text | Foto de "quién camina". URL pública del bucket `minuto-a-minuto` (`<reto_id>/quien-camina-…`) o ruta de `/public` heredada (`/santi.jpg` en `santi-ago`). `null` = silueta |
| `created_at` | timestamptz | Automático |

**Configuración (FP3c):** el código lee siempre estas columnas con `configDelReto` (`lib/retos/config.ts`), que trata un campo ausente como `true` por si el código llega antes que la migración 0012. Solo el admin del reto las edita (pestaña "Configuración"); el superadmin crea retos sin fijarlas (defaults).

**Fila inicial:** `portuguesa-110` — el reto del Camino Portugués, `id = 1`.

---

### `retos_admin`

Credencial del panel admin de cada reto (FP2.6, DT-029, migración 0010). Tabla
aparte de `retos` porque `retos` es legible por `anon` (retos activos).

| Campo | Tipo | Notas |
|---|---|---|
| `reto_id` | bigint PK | FK → `retos.id`, `on delete cascade` |
| `password_hash` | text | `scrypt$N$r$p$salt$hash` (`lib/auth/password.ts`); check `like 'scrypt$%'` impide texto plano |
| `updated_at` | timestamptz | Default `now()`; el upsert lo fija al cambiar la contraseña |

Un reto sin fila aquí no tiene panel admin accesible (login responde 401).

---

### `intentos`

Representa un intento de completar el reto. Puede haber N intentos en la BD,
pero solo uno activo a la vez.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint PK | Generado automáticamente |
| `reto_id` | bigint FK | Reto al que pertenece (DT-025) |
| `fase` | text | `'antes' \| 'durante' \| 'llegada'` |
| `modo` | text | `'guiado' \| 'libre'` (DT-016). Default `'guiado'`. Se fija en `iniciarReto()` y es inmutable durante la vida del intento — cambiarlo exige "Reiniciar" |
| `destino_lat` | double precision | Destino del modo libre. `null` en modo guiado (siempre) y en modo libre antes de iniciar |
| `destino_lon` | double precision | Ídem |
| `cerrado` | boolean | `true` cuando se usa "Reiniciar" |
| `started_at` | timestamptz | Se fija al pasar a `durante` |
| `ended_at` | timestamptz | Se fija al pasar a `llegada` |
| `mensaje_llegada` | text | Editable desde el admin antes de finalizar |
| `foto_llegada_url` | text | Foto opcional de llegada (DT-024). URL pública del bucket `minuto-a-minuto` (prefijo `llegada-` en el nombre del objeto). `null` = sin foto |
| `created_at` | timestamptz | Automático |

**Invariante crítico:** `CREATE UNIQUE INDEX intentos_abierto_por_reto ON intentos (reto_id) WHERE NOT cerrado` — como mucho un intento abierto **por reto** (migración `0009_intento_abierto_por_reto.sql`, FP2.5/DT-028; sustituye al antiguo `intentos_activo_unico ON intentos ((true))`, que limitaba a uno en todo el sistema). La BD lo garantiza, no solo el código: toda búsqueda del intento activo filtra por `reto_id` (`lib/supabase/intentos.ts`).

**Invariante de modo (DT-016):** `modo` se escribe una sola vez, en la transición `antes` → `durante` (`iniciarReto()`, `app/admin/actions.ts`). Ningún otro código de la app actualiza esta columna — no hay ninguna vía para cambiar el modo de un intento ya iniciado salvo "Reiniciar" (que cierra el intento actual y abre uno nuevo con `modo` en su default `'guiado'` hasta el siguiente Iniciar). `destino_lat`/`destino_lon` solo se escriben junto con `modo = 'libre'`; en modo guiado la actualización de `iniciarReto()` ni siquiera incluye esas dos columnas en el `UPDATE`, así que quedan en su default de BD (`null`).

### `posiciones`

Una posición GPS recibida de OwnTracks o registrada manualmente.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint PK | Generado automáticamente |
| `intento_id` | bigint FK | Apunta al intento al que pertenece |
| `lat` | double precision | Latitud WGS-84 |
| `lon` | double precision | Longitud WGS-84 |
| `ts` | timestamptz | Marca temporal del dispositivo (no de inserción) |
| `batt` | int | % de batería, puede ser null |
| `acc` | real | Radio de precisión GPS en metros, puede ser null |
| `fuente` | text | `'app' \| 'manual'` |
| `descartado` | boolean | Soft-delete reversible (nunca se borra) |
| `created_at` | timestamptz | Automático |

**Invariante:** el índice `posiciones_intento_ts_idx ON posiciones (intento_id, ts ASC) WHERE NOT descartado` asegura que las consultas de puntos activos ordenadas por tiempo son eficientes.

**Invariante de dominio:** los puntos con `descartado = true` no participan en `calcularProgreso`. Los puntos con `acc > PRECISION_MAX_M` no suman al odómetro.

### `intenciones`

Intención dejada por familia o amigos.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint PK | |
| `reto_id` | bigint FK | Reto al que pertenece (DT-025) |
| `texto` | text | 1-1000 chars (check constraint) |
| `nombre` | text | null = anónima |
| `created_at` | timestamptz | |

**Invariante de privacidad:** no existe ninguna política RLS de `anon` sobre esta tabla. Solo el service role (servidor) puede leer intenciones. Las inserciones van por route handler con validación Zod, nunca por inserción directa del cliente.

### `comentarios`

Comentario público o privado de un seguidor.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint PK | |
| `reto_id` | bigint FK | Reto al que pertenece (DT-025) |
| `parent_id` | bigint FK | Raíz a la que responde (FP3a, DT-030). `null` = comentario raíz. `on delete cascade` (0011) |
| `nombre` | text | 1-80 chars, nunca anónimo |
| `texto` | text | 1-1000 chars |
| `visibilidad` | text | `'publico' \| 'privado'`. Las respuestas, siempre `'publico'` (check `comentarios_respuesta_publica`) |
| `oculto` | boolean | El admin puede ocultar sin borrar |
| `es_autor` | boolean | default `false`. `true` = respuesta del caminante desde el panel (insignia "Caminante"). Solo service role (0011) |
| `created_at` | timestamptz | |

**Invariante de privacidad:** la política RLS de `anon` solo permite SELECT de `visibilidad = 'publico' AND NOT oculto`, y para una respuesta exige además que su raíz siga visible (`comentario_raiz_visible`, security definer: una política no puede consultar su propia tabla sin recursión). El INSERT público no puede fijar `oculto = true` ni `es_autor = true`.

**Invariantes del hilo (FP3a, DT-030, migración 0011):**
- Un solo nivel: el padre de una respuesta es una raíz (`parent_id` null), pública, no oculta y del mismo reto. Lo impone el trigger `comentarios_validar_respuesta` (before insert / update of parent_id; `check_violation` si no se cumple) para cualquier rol.
- Borrar una raíz borra sus respuestas (FK con cascade). Ocultar una raíz no toca las filas de sus respuestas, pero dejan de ser visibles para `anon`.
- Índices: `comentarios_raices_idx (reto_id, created_at desc) where parent_id is null` (paginación del muro) y `comentarios_parent_idx (parent_id) where parent_id is not null`.

**Configuración del reto en el INSERT público (FP3c, DT-032, migración 0012):** la política `comentarios_insert_publico` exige además `comentarios_insert_permitido(reto_id, parent_id is not null)` — función security definer que devuelve `true` solo si el reto tiene `seccion_comentarios` y, para una respuesta, `respuestas_visitantes`. EXECUTE solo para `anon`.

### `textos`

Textos editables de la web desde el panel admin.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint PK | Generado automáticamente (DT-025: `clave` ya no es PK) |
| `reto_id` | bigint FK | Reto al que pertenece (DT-025) |
| `clave` | text | Clave libre (no hay enum en BD). Única por reto: `UNIQUE(reto_id, clave)` |
| `valor` | text | El contenido del texto |
| `updated_at` | timestamptz | |

**Patrón de uso:** el código tiene un valor por defecto en `lib/textos/defaults.ts`. Si existe una fila en esta tabla con la misma clave para el reto activo, ese valor sobreescribe el por defecto. Nunca sale en blanco.

**Invariante:** añadir una clave nueva requiere código (decidir dónde se pinta). Editar un texto existente no requiere código — solo el panel admin.

### `minuto_a_minuto`

Entrada del feed en directo "minuto a minuto" (DT-013): texto corto + foto
opcional, publicada solo por el admin, con snapshot de posición.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint PK | Generado automáticamente |
| `intento_id` | bigint FK | Apunta al intento sobre el que se publicó |
| `texto` | text | 1-500 chars (check constraint) |
| `foto_url` | text | URL pública de Supabase Storage (bucket `minuto-a-minuto`); null = sin foto |
| `lat` | double precision | Snapshot de la última posición conocida al publicar; null si aún no había ninguna |
| `lon` | double precision | Ídem |
| `clave_envio` | uuid | Clave de idempotencia generada por el composer, estable entre reintentos (DT-033, `0014`). Única (índice parcial `where clave_envio is not null`); null en entradas anteriores o sin clave |
| `created_at` | timestamptz | Automático |
| `updated_at` | timestamptz | Se actualiza al editar el texto |

**Invariante de idempotencia (DT-033):** no pueden existir dos entradas con
la misma `clave_envio`; `crearMinutoAMinuto` trata una clave ya publicada (o
el 23505 del índice) como éxito, sin volver a subir ni insertar.

**Invariante de diseño:** `lat`/`lon` son un snapshot fijado en el momento de
publicar, nunca recalculado después — no reflejan la posición actual de
Santi si se consultan más tarde, reflejan dónde estaba al publicar esa
entrada concreta.

**Invariante de edición (DT-013):** editar una entrada solo puede cambiar
`texto` (y `updated_at`). La foto no es editable — si está mal, la solución
es borrar la entrada y publicar una nueva. No hay soft-delete: eliminar es
hard delete, igual que `intenciones`. El objeto de Storage asociado a una
entrada eliminada no se borra (deuda aceptada explícitamente, ver `DEBT.md`).

**Storage:** las fotos viven en el bucket público `minuto-a-minuto` de
Supabase Storage (en el proyecto de la plataforma lo crea `0013_bucket_fotos.sql`:
4 MB, jpeg/png/webp). Todas las subidas pasan por `lib/supabase/storage.ts` con
el cliente `service role` (bypassa RLS de Storage), nunca desde el cliente
directamente.

### `visitas_web`

Una visita a la web pública, capturada server-side en `proxy.ts` (DT-022):
alimenta la pestaña "Tráfico" del panel admin.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | bigint PK | Generado automáticamente |
| `reto_id` | bigint FK | Reto al que corresponde la visita (DT-025) |
| `ruta` | text | Ruta de la petición (hoy siempre `/`, la web pública no tiene más rutas) |
| `ts` | timestamptz | Momento de la visita |
| `visitante_id` | text | Id anónimo de la cookie funcional (`proxy.ts`); sin fingerprinting, sin datos personales |
| `referer` | text | Cabecera `Referer` de la petición; `null` = directo |
| `created_at` | timestamptz | Automático |

**Invariante de privacidad:** igual que `intenciones` — no existe ninguna
política RLS de `anon` sobre esta tabla. Solo el service role (servidor)
lee o escribe. La inserción va siempre desde `proxy.ts` con `getSupabaseAdmin()`,
nunca desde el cliente anon directo.

**Sin FK a `intentos`.** No hay relación explícita: la pestaña "Tráfico"
acota el rango filtrando `ts >= intentos.started_at` del intento activo en
el momento de la consulta, no con una columna `intento_id`. Las visitas
capturadas antes de que exista ningún intento (o entre intentos) quedan en
la tabla sin más — sin política de retención (igual que el resto de tablas
del proyecto), coherente con que tampoco se filtran ni se resetean al
"Reiniciar".

---

## Relaciones

Con multi-tenant (DT-025/FP0), todas las tablas top-level llevan `reto_id`:

```
retos (1) ──< intentos          (N)     reto_id → retos.id
retos (1) ──< intenciones       (N)     reto_id → retos.id
retos (1) ──< comentarios       (N)     reto_id → retos.id
retos (1) ──< textos            (N)     reto_id → retos.id
retos (1) ──< visitas_web       (N)     reto_id → retos.id
retos (1) ──< config_trafico    (1)     reto_id → retos.id (unique)
retos (1) ──  retos_admin       (0..1)  reto_id → retos.id (PK, on delete cascade)

intentos (1) ──< posiciones (N)          intento_id → intentos.id
intentos (1) ──< minuto_a_minuto (N)     intento_id → intentos.id

comentarios (1) ──< comentarios (N)      parent_id → comentarios.id (nullable, un nivel, on delete cascade — FP3a/DT-030)
```

---

## RLS (Row Level Security)

| Tabla | anon (público) | service role (servidor) |
|---|---|---|
| `retos` | SELECT solo activos (`activo = true`) | ALL |
| `intentos` | SELECT solo el activo (`NOT cerrado`) | ALL |
| `posiciones` | SELECT solo `NOT descartado` del intento activo | ALL |
| `intenciones` | Ninguna política (cero acceso) | ALL |
| `comentarios` | SELECT `publico AND NOT oculto` (+ raíz visible si es respuesta, 0011); INSERT sin poder fijar `oculto` ni `es_autor`, y solo si el reto tiene la sección (y, para respuestas, las respuestas de visitantes) encendida (0012) | ALL |
| `textos` | SELECT | ALL |
| `minuto_a_minuto` | SELECT solo entradas del intento activo (`NOT cerrado`) | ALL |
| `visitas_web` | Ninguna política (cero acceso) | ALL |
| `config_trafico` | Ninguna política (cero acceso) | ALL |
| `retos_admin` | Ninguna política + `revoke all` a `anon`/`authenticated` (0010) | ALL |

Todo el schema vive en `supabase/migrations/0007_schema_plataforma.sql` (FP0).
El service role bypassa RLS por diseño de Supabase (no necesita políticas
explícitas); las políticas son únicamente para el rol `anon`. Storage (bucket
`minuto-a-minuto`) no tiene políticas propias: es un bucket público, y todas
las subidas pasan por el cliente service role.

Las columnas nuevas de `intentos` (`modo`, `destino_lat`, `destino_lon`,
DT-016; `foto_llegada_url`, DT-024) no cambian la política
RLS existente de `intentos_select_activo` — siguen siendo columnas del mismo
intento activo, ya visible en su totalidad para `anon` (necesario para que
`app/page.tsx`, `obtenerFotoLlegadaUrl`, pueda leer la foto con el cliente
público).

---

## Migración

**Ubicación:** `supabase/migrations/0001_esquema_inicial.sql` (5 tablas
iniciales), `supabase/migrations/0002_minuto_a_minuto.sql` (tabla
`minuto_a_minuto` + bucket de Storage, DT-013),
`supabase/migrations/0003_modo_intento.sql` (columnas `modo`/`destino_lat`/
`destino_lon` de `intentos`, DT-016),
`supabase/migrations/0004_visitas_web.sql` (tabla `visitas_web`, DT-022) y
`supabase/migrations/0006_foto_llegada.sql` (columna `foto_llegada_url` de
`intentos`, DT-024). Desde FP0 el esquema de plataforma está en `0007` y las
posteriores: `0012_config_reto.sql` (configuración por reto en `retos` y RLS
de INSERT de `comentarios`, DT-032), `0013_bucket_fotos.sql` (bucket de
Storage `minuto-a-minuto`, que 0007 no creaba) y la última,
`0014_mam_clave_envio.sql` (`minuto_a_minuto.clave_envio` + índice único
parcial, DT-033).

**Convención de carpeta:** `supabase/migrations/NNNN_slug.sql`, numeración
secuencial de 4 dígitos — la misma que usa la CLI oficial de Supabase
(`supabase migration new <slug>`), para que aplicar la migración el día que
exista el proyecto sea tan simple como pegarla en el editor SQL o correr
`supabase db push`.

**Contenido:** las 5 tablas de este documento, sus índices (incluidos el
único-activo de `intentos` y el de `posiciones` filtrado por `NOT
descartado`), y RLS activado con las políticas de la tabla de arriba.

---

## Clientes Supabase tipados

`lib/supabase/admin.ts` (`getSupabaseAdmin()`, service role — bypassa RLS,
solo server-side) y `lib/supabase/public.ts` (`getSupabasePublic()`, anon key
— sujeto a RLS). Ambos:

- Comparten el tipo `BaseDeDatos` (definido en `admin.ts`, importado por
  `public.ts`), espejo tipado de las tablas de este documento.
- Se construyen de forma perezosa: la primera llamada a `getSupabaseAdmin()`
  / `getSupabasePublic()` lee las env vars y lanza si faltan. Importar el
  módulo, o que `pnpm build` recorra el árbol de imports, nunca falla por
  falta de credenciales — condición necesaria para poder compilar el
  proyecto antes de que exista el proyecto Supabase (F0).
- Cada `Row` de `BaseDeDatos` se envuelve en `Pick<T, keyof T>` en vez de usar
  el `interface` de `lib/types.ts` directamente. Es una particularidad de
  cómo `@supabase/supabase-js` infiere tipos: exige que `Row` sea
  estructuralmente asignable a `Record<string, unknown>`, y los `interface`
  de TypeScript no tienen index signature implícito. Sin el envoltorio,
  `.insert()`/`.update()` resuelven silenciosamente a `never` sin ningún
  error hasta que se usan con datos reales — documentado en el comentario de
  `admin.ts` junto al tipo.
