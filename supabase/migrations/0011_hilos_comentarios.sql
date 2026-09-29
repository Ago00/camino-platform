-- Respuestas en hilo en los comentarios (FP3a, DT-030)
--
-- `comentarios.parent_id` existía desde 0007 sin uso. A partir de aquí una fila
-- con `parent_id` es una RESPUESTA a un comentario raíz. Reglas (en BD porque
-- la anon key es pública y cualquiera puede llamar a PostgREST directamente):
--
--   - Un solo nivel: solo se responde a raíces (parent_id null), públicas, no
--     ocultas y del mismo reto (trigger `comentarios_validar_respuesta`).
--   - Las respuestas son siempre públicas (check `comentarios_respuesta_publica`).
--   - `es_autor = true` marca la respuesta del caminante (insignia "Caminante");
--     solo el service role (panel admin) puede fijarla: la política de INSERT
--     de anon exige `es_autor = false`.
--   - Borrar una raíz borra sus respuestas (FK con `on delete cascade`).
--   - Ocultar una raíz oculta todo su hilo para anon: la política de SELECT
--     exige que la raíz de una respuesta siga visible. Una política RLS no
--     puede consultar su propia tabla sin recursión, por eso la comprobación
--     vive en la función security definer `comentario_raiz_visible`.
--
-- Supabase concede por defecto EXECUTE sobre las funciones de `public` a anon y
-- authenticated (default privileges), así que no basta con revocar a `public`:
-- se revoca explícitamente a cada rol y solo se concede lo imprescindible.
--
-- Aplicar MANUALMENTE en el editor SQL del proyecto Supabase de la plataforma.

alter table comentarios add column es_autor boolean not null default false;

alter table comentarios drop constraint comentarios_parent_id_fkey;
alter table comentarios add constraint comentarios_parent_id_fkey
  foreign key (parent_id) references comentarios(id) on delete cascade;

alter table comentarios add constraint comentarios_respuesta_publica
  check (parent_id is null or visibilidad = 'publico');

create index comentarios_raices_idx on comentarios (reto_id, created_at desc) where parent_id is null;
create index comentarios_parent_idx on comentarios (parent_id) where parent_id is not null;

-- Security definer: el INSERT de anon debe poder ver el padre aunque esté
-- oculto o sea privado, para rechazarlo (con RLS no lo vería y el mensaje
-- sería "no encontrado", pero el resultado — rechazo — sería el mismo).
create function comentarios_validar_respuesta() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if new.parent_id is null then return new; end if;
  select reto_id, parent_id, visibilidad, oculto into p from comentarios where id = new.parent_id;
  if not found or p.reto_id <> new.reto_id or p.parent_id is not null
     or p.visibilidad <> 'publico' or p.oculto then
    raise exception 'respuesta_no_permitida' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- Es función de trigger: nadie debe poder invocarla directamente.
revoke all on function comentarios_validar_respuesta() from public, anon, authenticated;

create trigger comentarios_validar_respuesta before insert or update of parent_id
  on comentarios for each row execute function comentarios_validar_respuesta();

create function comentario_raiz_visible(p_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from comentarios where id = p_id and parent_id is null
                 and visibilidad = 'publico' and not oculto) $$;

revoke all on function comentario_raiz_visible(bigint) from public, anon, authenticated;
grant execute on function comentario_raiz_visible(bigint) to anon;

drop policy comentarios_select_publico_no_oculto on comentarios;
create policy comentarios_select_publico_no_oculto on comentarios for select to anon
  using (visibilidad = 'publico' and not oculto
         and (parent_id is null or comentario_raiz_visible(parent_id)));

drop policy comentarios_insert_publico on comentarios;
create policy comentarios_insert_publico on comentarios for insert to anon
  with check (oculto = false and es_autor = false);

-- La anon key es pública: sin esto, un POST directo a PostgREST podía fijar
-- created_at (p.ej. 2099) y anclar un comentario arriba del muro. Solo se
-- permite insertar las columnas que envía la API.
revoke insert on comentarios from anon, authenticated;
grant insert (reto_id, parent_id, nombre, texto, visibilidad) on comentarios to anon;
