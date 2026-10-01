-- Monigote elegible por reto (DT-036)
--
-- El admin de cada reto elige en Configuración qué monigote pasea por su web
-- pública (o ninguno) entre los 22 del catálogo (lib/monigotes/catalogo.ts),
-- su grito al pincharlo y si suena. Sustituye al interruptor
-- `peregrino_animado` (0015): quien lo tenía encendido pasa al monigote
-- "atleti", que es el mismo peregrino rojiblanco de siempre.
--
-- La BD solo exige el formato del id (el catálogo vive en el código y puede
-- crecer sin migración); un id que el código no conozca se trata como
-- "ninguno" (`monigoteDelReto`). El grito personalizado se guarda ya
-- normalizado por el servidor; null = el grito del catálogo.
--
-- Compatibilidad: el código lee las columnas con `monigoteDelReto`
-- (lib/retos/config.ts), que sin la columna `monigote` sigue respetando
-- `peregrino_animado`: desplegar antes de aplicar esta migración no cambia la
-- web (guardar la configuración sí falla hasta aplicarla). `peregrino_animado`
-- queda obsoleta; `guardarConfiguracion` la mantiene sincronizada hasta que
-- 0018 la elimine.
--
-- Aplicar MANUALMENTE en el editor SQL del proyecto Supabase de la plataforma.

alter table public.retos
  add column monigote text null
    constraint retos_monigote_formato check (monigote ~ '^[a-z]{2,24}$'),
  add column monigote_grito text null
    constraint retos_monigote_grito_longitud check (char_length(monigote_grito) between 1 and 48),
  add column monigote_sonido boolean not null default true;

update public.retos set monigote = 'atleti' where peregrino_animado;

comment on column public.retos.peregrino_animado is 'OBSOLETA (DT-036): sustituida por monigote. Se elimina en 0018.';
