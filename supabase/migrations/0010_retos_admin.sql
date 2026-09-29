-- Contraseña de admin propia por reto (FP2.6, DT-029)
--
-- Hasta FP2.5 todos los paneles `/<slug>/admin` compartían la env var
-- ADMIN_PASSWORD, y la cookie `admin_session` no estaba ligada a ningún reto:
-- quien entraba en un panel entraba en todos. Esta tabla guarda el hash de la
-- contraseña de admin de cada reto (lo fija el superadmin al crear/editar).
--
-- Tabla aparte (no columna en `retos`) porque `retos` tiene una política RLS
-- de SELECT para anon (retos activos): una columna ahí quedaría expuesta al
-- cliente público. `retos_admin` no tiene ninguna política, así que solo el
-- service role (lib/supabase/credenciales-admin.ts) puede leerla o escribirla.
--
-- `password_hash` en formato `scrypt$N$r$p$salt$hash` (lib/auth/password.ts);
-- el check impide guardar texto plano por error.
--
-- `reto_id` es bigint: `retos.id` es `bigint generated always as identity`
-- (0007). `on delete cascade`: eliminar el reto elimina su credencial.
--
-- Aplicar MANUALMENTE en el editor SQL del proyecto Supabase de la plataforma.

create table retos_admin (
  reto_id       bigint primary key references retos(id) on delete cascade,
  password_hash text not null check (password_hash like 'scrypt$%'),
  updated_at    timestamptz not null default now()
);

alter table retos_admin enable row level security;

-- Sin políticas: solo el service role puede tocarla (DT-029).
revoke all on retos_admin from anon, authenticated;
