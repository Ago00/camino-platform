-- Bucket de Storage para las fotos (minuto a minuto, llegada, quién camina)
--
-- El bucket `minuto-a-minuto` se creaba en 0002, que pertenece al proyecto
-- original; el schema de la plataforma (0007) no lo incluía, así que en el
-- proyecto Supabase de la plataforma no existía y toda subida de foto fallaba.
--
-- Público: todo su contenido se publica en la web. Sin políticas de Storage
-- para anon: las subidas y borrados van por Server Actions con service role
-- (lib/supabase/storage.ts). Límites alineados con lib/imagen/limites-subida.ts
-- (4 MB) y con los tipos que acepta lib/supabase/storage.ts, como segunda
-- barrera si una validación del servidor fallara.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('minuto-a-minuto', 'minuto-a-minuto', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
