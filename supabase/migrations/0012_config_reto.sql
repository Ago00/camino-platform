-- Configuración por reto desde el panel admin (FP3c, DT-032)
--
-- El admin de cada reto puede encender/apagar secciones de la web pública
-- (intenciones, comentarios, minuto a minuto, Instagram), permitir o no las
-- respuestas de visitantes en los comentarios (FP3a) y elegir la foto de
-- "quién camina". Todo por defecto encendido: los retos existentes no cambian.
--
-- La API ya rechaza los envíos a secciones apagadas, pero la anon key es
-- pública y `comentarios` admite INSERT directo por PostgREST (0007/0011): la
-- política de INSERT comprueba también la configuración del reto. Se hace con
-- una función security definer para no depender de la política SELECT de
-- `retos` (solo activos) y no exponer más columnas de las necesarias.
-- `intenciones` no necesita cambios: anon no tiene ninguna política sobre ella.
--
-- El GRANT de INSERT por columnas de 0011 y el trigger
-- `comentarios_validar_respuesta` no cambian.
--
-- Aplicar MANUALMENTE en el editor SQL del proyecto Supabase de la plataforma.

alter table retos
  add column seccion_intenciones     boolean not null default true,
  add column seccion_comentarios     boolean not null default true,
  add column seccion_minuto_a_minuto boolean not null default true,
  add column seccion_instagram       boolean not null default true,
  add column respuestas_visitantes   boolean not null default true,
  add column quien_camina_foto_url   text;

-- El reto original usaba la constante FOTO_SANTI (public/santi.jpg). Su slug
-- actual es 'santi-ago' (se renombró desde 'portuguesa-110').
update retos set quien_camina_foto_url = '/santi.jpg' where slug = 'santi-ago';

create function comentarios_insert_permitido(p_reto_id bigint, p_es_respuesta boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from retos where id = p_reto_id and seccion_comentarios
                 and (not p_es_respuesta or respuestas_visitantes)) $$;

-- Supabase concede EXECUTE por defecto a anon/authenticated (ver 0011): se
-- revoca a todos y se concede solo a anon, el único rol que la usa en RLS.
revoke all on function comentarios_insert_permitido(bigint, boolean) from public, anon, authenticated;
grant execute on function comentarios_insert_permitido(bigint, boolean) to anon;

drop policy comentarios_insert_publico on comentarios;
create policy comentarios_insert_publico on comentarios for insert to anon
  with check (oculto = false and es_autor = false
              and comentarios_insert_permitido(reto_id, parent_id is not null));
