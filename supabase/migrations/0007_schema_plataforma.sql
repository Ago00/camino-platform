-- Schema completo de la plataforma multi-tenant (FP0 — DT-025)
--
-- Este fichero es la migración única que se ejecuta contra el nuevo proyecto
-- Supabase de la plataforma. El proyecto es un entorno vacío y limpio, así
-- que todo se crea desde cero: no hay ALTER TABLE ni backfill.
--
-- El número 0007 mantiene coherencia histórica con las migraciones del
-- proyecto original (camino-santi-ago), aunque en el nuevo Supabase solo
-- existe esta migración.
--
-- Aplicar MANUALMENTE: pegar en el editor SQL del proyecto Supabase o
-- ejecutar con la CLI de Supabase (`supabase db push`). Ver DEBT.md.

-- ---------------------------------------------------------------------------
-- Tabla: retos
-- Entidad raíz del modelo multi-tenant. Cada reto tiene su propio conjunto
-- de datos aislado en el resto de tablas (vía reto_id FK).
-- ---------------------------------------------------------------------------

create table retos (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  nombre      text not null,
  descripcion text,
  ruta_tipo   text not null check (ruta_tipo in ('predefinida', 'libre')),
  ruta_id     text,    -- carpeta en lib/rutas/<ruta_id>/ del repo; null solo en modo libre
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  -- En modo predefinida, ruta_id es obligatorio (mapea a los GeoJSON del repo).
  -- En modo libre no hay traza fija, ruta_id puede ser null.
  check (ruta_tipo = 'libre' or ruta_id is not null)
);

-- ---------------------------------------------------------------------------
-- Tabla: intentos
-- ---------------------------------------------------------------------------

create table intentos (
  id               bigint generated always as identity primary key,
  reto_id          bigint not null references retos(id),
  fase             text not null default 'antes' check (fase in ('antes','durante','llegada')),
  modo             text not null default 'guiado' check (modo in ('guiado','libre')),
  destino_lat      double precision,
  destino_lon      double precision,
  cerrado          boolean not null default false,
  started_at       timestamptz,
  ended_at         timestamptz,
  mensaje_llegada  text,
  foto_llegada_url text,
  created_at       timestamptz not null default now()
);

-- Solo un intento abierto a la vez (en todo el sistema; FP1 refinará a por reto).
create unique index intentos_activo_unico on intentos ((true)) where not cerrado;

-- ---------------------------------------------------------------------------
-- Tabla: posiciones
-- Scoped vía intento_id — no necesita reto_id directo.
-- ---------------------------------------------------------------------------

create table posiciones (
  id         bigint generated always as identity primary key,
  intento_id bigint not null references intentos(id),
  lat        double precision not null,
  lon        double precision not null,
  ts         timestamptz not null,
  batt       int,
  acc        real,
  fuente     text not null default 'app' check (fuente in ('app','manual')),
  descartado boolean not null default false,
  created_at timestamptz not null default now()
);

create index posiciones_intento_ts_idx on posiciones (intento_id, ts asc) where not descartado;

-- ---------------------------------------------------------------------------
-- Tabla: intenciones
-- ---------------------------------------------------------------------------

create table intenciones (
  id         bigint generated always as identity primary key,
  reto_id    bigint not null references retos(id),
  texto      text not null check (char_length(texto) between 1 and 1000),
  nombre     text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabla: comentarios
-- parent_id (DT-025): columna dormida hasta FP3 (hilos de respuesta). Se
-- añade al schema ahora para no requerir una migración de ALTER TABLE en FP3.
-- ---------------------------------------------------------------------------

create table comentarios (
  id          bigint generated always as identity primary key,
  reto_id     bigint not null references retos(id),
  parent_id   bigint references comentarios(id),   -- null = comentario raíz
  nombre      text not null check (char_length(nombre) between 1 and 80),
  texto       text not null check (char_length(texto) between 1 and 1000),
  visibilidad text not null default 'publico' check (visibilidad in ('publico','privado')),
  oculto      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabla: textos
-- La clave ya no es PK: el PK es id, y la clave es única por reto.
-- ---------------------------------------------------------------------------

create table textos (
  id         bigint generated always as identity primary key,
  reto_id    bigint not null references retos(id),
  clave      text not null,
  valor      text not null default '',
  updated_at timestamptz not null default now(),
  unique (reto_id, clave)
);

-- ---------------------------------------------------------------------------
-- Tabla: minuto_a_minuto
-- Scoped vía intento_id — no necesita reto_id directo.
-- ---------------------------------------------------------------------------

create table minuto_a_minuto (
  id          bigint generated always as identity primary key,
  intento_id  bigint not null references intentos(id),
  texto       text not null check (char_length(texto) between 1 and 500),
  foto_url    text,
  lat         double precision,
  lon         double precision,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index minuto_a_minuto_intento_idx on minuto_a_minuto (intento_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Tabla: visitas_web
-- ---------------------------------------------------------------------------

create table visitas_web (
  id           bigint generated always as identity primary key,
  reto_id      bigint not null references retos(id),
  ruta         text not null,
  ts           timestamptz not null,
  visitante_id text not null,
  referer      text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabla: config_trafico
-- Una fila por reto (antes: fila única global).
-- ---------------------------------------------------------------------------

create table config_trafico (
  id           bigint generated always as identity primary key,
  reto_id      bigint not null references retos(id),
  cuenta_desde timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (reto_id)
);

-- ---------------------------------------------------------------------------
-- Índices por reto_id
-- ---------------------------------------------------------------------------

create index comentarios_reto_idx    on comentarios    (reto_id);
create index intenciones_reto_idx    on intenciones    (reto_id);
create index intentos_reto_idx       on intentos       (reto_id);
create index visitas_web_reto_idx    on visitas_web    (reto_id);
create index textos_reto_idx         on textos         (reto_id);
create index config_trafico_reto_idx on config_trafico (reto_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- retos: lectura pública de retos activos
alter table retos enable row level security;

create policy retos_select_activo
  on retos
  for select
  to anon
  using (activo);

-- intentos: el anon solo ve el intento activo
alter table intentos enable row level security;

create policy intentos_select_activo
  on intentos
  for select
  to anon
  using (not cerrado);

-- posiciones: el anon solo ve posiciones no descartadas del intento activo
alter table posiciones enable row level security;

create policy posiciones_select_activo_no_descartado
  on posiciones
  for select
  to anon
  using (
    not descartado
    and intento_id in (select id from intentos where not cerrado)
  );

-- intenciones: sin políticas para anon — RLS habilitado equivale a cero acceso
alter table intenciones enable row level security;

-- comentarios
alter table comentarios enable row level security;

create policy comentarios_select_publico_no_oculto
  on comentarios
  for select
  to anon
  using (visibilidad = 'publico' and not oculto);

-- INSERT público permitido, pero sin poder fijar oculto=true
create policy comentarios_insert_publico
  on comentarios
  for insert
  to anon
  with check (oculto = false);

-- textos: lectura pública
alter table textos enable row level security;

create policy textos_select_publico
  on textos
  for select
  to anon
  using (true);

-- minuto_a_minuto: el anon ve solo entradas del intento activo
alter table minuto_a_minuto enable row level security;

create policy select_intento_activo
  on minuto_a_minuto
  for select
  using (
    exists (
      select 1 from intentos
      where intentos.id = minuto_a_minuto.intento_id
      and not intentos.cerrado
    )
  );

-- visitas_web: sin políticas para anon — solo service role
alter table visitas_web enable row level security;

-- config_trafico: sin políticas para anon — solo service role
alter table config_trafico enable row level security;

-- ---------------------------------------------------------------------------
-- Datos iniciales: primer reto
-- ---------------------------------------------------------------------------

insert into retos (slug, nombre, descripcion, ruta_tipo, ruta_id, activo)
values (
  'portuguesa-110',
  'Camino Portugués 110 km',
  'Los últimos 110 km del Camino Portugués Central hasta Santiago de Compostela.',
  'predefinida',
  'portuguesa-110',
  true
);
