-- Interruptor del peregrino animado de la web pública (DT-034)
--
-- El monigote que pasea por la pantalla y deja huellas (PeregrinoLibre) es un
-- guiño personal del reto original. Pasa a ser opcional por reto: apagado por
-- defecto en los retos nuevos y encendido en 'santi-ago', que ya lo tenía.
--
-- El código lee la columna con `configDelReto` (lib/retos/config.ts), que la
-- trata como encendida si todavía no existe: desplegar antes de aplicar esta
-- migración no cambia nada en la web.
--
-- Aplicar MANUALMENTE en el editor SQL del proyecto Supabase de la plataforma.

alter table public.retos add column peregrino_animado boolean not null default false;

update public.retos set peregrino_animado = true where slug = 'santi-ago';
