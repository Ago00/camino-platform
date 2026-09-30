-- Token de GPS propio por reto (DT-035)
--
-- Hasta aquí `/api/track` comparaba contra una única env var global
-- (TRACK_TOKEN): cualquiera que tuviera el móvil de un reto podía escribir
-- posiciones en todos, y rotarlo obligaba a reconfigurar todos los móviles y
-- a redesplegar. Desde DT-035 cada reto tiene su token, que el admin del reto
-- y el superadmin pueden ver, copiar (o escanear como QR de OwnTracks) y
-- regenerar al instante.
--
-- El token se guarda EN CLARO, no hasheado: el panel tiene que poder volver a
-- enseñarlo (URL y QR) para reconfigurar el móvil sin rotarlo. Es un secreto
-- aleatorio de 192 bits (no una contraseña elegida por una persona), así que
-- lo que se protege es el acceso a la tabla, no su contenido.
--
-- Tabla aparte (no columna en `retos`) por el mismo motivo que `retos_admin`
-- (0010): `retos` tiene una política RLS de SELECT para anon, y una columna
-- ahí quedaría expuesta al cliente público. `retos_gps` no tiene ninguna
-- política: solo el service role (lib/supabase/credenciales-gps.ts) la lee o
-- la escribe.
--
-- `track_token` único (también sirve de índice) y con longitud mínima para
-- que nunca se guarde por error un token corto o vacío. `on delete cascade`:
-- eliminar el reto elimina su token.
--
-- El insert final da un token a cada reto existente, generado en la propia BD
-- (24 bytes aleatorios en base64url, 32 caracteres, el mismo formato que
-- `generarTokenGps()`). Tras aplicarla hay que reconfigurar el móvil de cada
-- reto con el QR del panel: el TRACK_TOKEN global deja de valer en cuanto se
-- despliega el código de DT-035.
--
-- Aplicar MANUALMENTE en el editor SQL del proyecto Supabase de la plataforma,
-- ANTES de desplegar el código que la usa.

create extension if not exists pgcrypto with schema extensions;

create table retos_gps (
  reto_id     bigint primary key references retos(id) on delete cascade,
  track_token text not null unique check (length(track_token) >= 32),
  updated_at  timestamptz not null default now()
);

alter table retos_gps enable row level security;

-- Sin políticas: solo el service role puede tocarla (DT-035).
revoke all on retos_gps from anon, authenticated;

insert into retos_gps (reto_id, track_token)
select id, translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_')
from retos;
