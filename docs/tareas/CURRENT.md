# Tarea en curso — FP0: Schema plataforma multi-tenant

## Decisión técnica

**DT-025** (`docs/tecnico/decisiones-tecnicas.md`). FK directo (`reto_id`) en
cada tabla top-level. Reorganización de assets de rutas a `lib/rutas/<ruta_id>/`.
Sin cambios de UI ni de endpoints en esta fase.

## Alcance exacto de FP0

### 1. Migración `supabase/migrations/0007_schema_plataforma.sql`

Schema completo de la plataforma en una única migración:

**Tabla nueva `retos`:**
```sql
create table retos (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  nombre      text not null,
  descripcion text,
  ruta_tipo   text not null check (ruta_tipo in ('predefinida', 'libre')),
  ruta_id     text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (ruta_tipo = 'libre' or ruta_id is not null)
);
```

**Columnas `reto_id` en tablas existentes** — añadir nullable primero, backfill, luego NOT NULL:
- `comentarios` + `reto_id` + `parent_id bigint references comentarios(id)`
- `intenciones` + `reto_id`
- `intentos` + `reto_id`
- `visitas_web` + `reto_id`
- `textos` + `reto_id` + unique `(reto_id, clave)`
- `config_trafico` + `reto_id`

**Índices:**
```sql
create index comentarios_reto_idx    on comentarios    (reto_id);
create index intenciones_reto_idx    on intenciones    (reto_id);
create index intentos_reto_idx       on intentos       (reto_id);
create index visitas_web_reto_idx    on visitas_web    (reto_id);
create index textos_reto_idx         on textos         (reto_id);
create index config_trafico_reto_idx on config_trafico (reto_id);
```

**Fila inicial:**
```sql
insert into retos (slug, nombre, descripcion, ruta_tipo, ruta_id, activo)
values (
  'portuguesa-110',
  'Camino Portugués 110 km',
  'Los últimos 110 km del Camino Portugués Central hasta Santiago de Compostela.',
  'predefinida',
  'portuguesa-110',
  true
);
```

### 2. `lib/types.ts`

- Tipo nuevo `Reto` con los campos de la tabla.
- Campo `reto_id: number` en `Intento`, `Comentario`, `Intencion` y cualquier otro tipo que mapee una tabla modificada.
- `parent_id: number | null` en `Comentario`.

### 3. `lib/supabase/admin.ts` — `BaseDeDatos`

- Añadir `retos` con el patrón `Pick<T, keyof T>` obligatorio (ver `LESSONS.md`).
- Actualizar entradas existentes con `reto_id`.

### 4. Reorganización de assets de rutas

Mover:
```
lib/traza/traza.geojson       → lib/rutas/portuguesa-110/traza.geojson
lib/traza/traza-mapa.geojson  → lib/rutas/portuguesa-110/traza-mapa.geojson
```

`cargar-traza.ts` y `cargar-traza-mapa.ts` reciben `ruta_id: string` como parámetro.
Todos los callers actuales pasan `'portuguesa-110'` — se completa el contexto dinámico en FP1.
Actualizar `AGENTS.md` con las rutas nuevas.

### 5. Aplicar migración contra Supabase real ⚠️ MANUAL

Esta parte la hace Santi. Ver lista de tareas manuales al final.

### 6. Quality gates

- `pnpm typecheck` — 0 errores.
- `pnpm test` — en verde (excepto timeout preexistente de `proyeccion.ventana.test.ts` si aplica).

## Qué NO hace FP0

- No toca rutas de Next.js.
- No cambia endpoints de API.
- No crea UI nueva.
- No implementa hilos de respuesta (`parent_id` queda dormido hasta FP3).
- No implementa el panel superadmin (FP2).

## Archivos esperados al cerrar FP0

**Nuevos:**
- `supabase/migrations/0007_schema_plataforma.sql`
- `lib/rutas/portuguesa-110/traza.geojson`
- `lib/rutas/portuguesa-110/traza-mapa.geojson`

**Modificados:**
- `lib/types.ts`
- `lib/supabase/admin.ts`
- `lib/traza/cargar-traza.ts`
- `lib/traza/cargar-traza-mapa.ts`
- Callers de `cargarTraza`/`cargarTrazaMapa`
- `AGENTS.md`
- `docs/tecnico/arquitectura.md`
- `docs/tecnico/modelo-datos.md`
- `CHANGELOG.md`
- `DEBT.md`

**Eliminados:**
- `lib/traza/traza.geojson`
- `lib/traza/traza-mapa.geojson`

## Historial de revisión

### Revisión 1 — 2026-09-28 — Reviewer

**Veredicto: BLOQUEANTES A CORREGIR**

**Bloqueante 1 — `app/admin/actions.ts:84` y `:323`**
Dos inserts en `intentos` sin `reto_id`:
```ts
supabase.from("intentos").insert({ fase: "antes" })
```
Con el schema de 0007 (`reto_id bigint not null references retos(id)`), estos inserts fallarán en runtime. Afecta a las acciones `iniciarPrimerIntento` y `reiniciarReto`.
Fix: añadir `reto_id: 1` con comentario `// FP1: obtener reto_id del contexto del reto activo`.

**Bloqueante 2 — `scripts/simplificar-traza.ts:465-469`**
El script escribe los GeoJSON generados en `lib/traza/` (path antiguo). Tras FP0, el código lee de `lib/rutas/portuguesa-110/`. Cualquier ejecución de `pnpm simplificar-traza` dejará los ficheros en la ubicación incorrecta y no serán cargados por el runtime.
Fix: cambiar `libTrazaDir` a `join(ROOT, "lib", "rutas", "portuguesa-110")` y actualizar el docstring del script.
