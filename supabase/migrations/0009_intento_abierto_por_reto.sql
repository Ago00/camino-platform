-- Un intento abierto por reto, no uno en todo el sistema (FP2.5, DT-028)
--
-- 0007_schema_plataforma.sql creó `intentos_activo_unico ON intentos ((true))
-- WHERE NOT cerrado`: un único intento con cerrado = false en TODA la
-- plataforma. Con varios retos, crear el segundo reto (que siembra su
-- intento inicial en fase "antes") viola ese índice, y dos retos nunca
-- pueden tener un intento abierto a la vez.
--
-- El invariante correcto con multi-tenant es "como mucho un intento abierto
-- por reto". El código de FP2.5 filtra siempre el intento activo por
-- reto_id (lib/supabase/intentos.ts), y este índice lo garantiza en BD.
--
-- No se crea ningún índice global sobre la fase "durante": dos retos pueden
-- estar en marcha simultáneamente (cada uno con su propio tracker, ver
-- /api/track?reto=<slug>).

drop index if exists intentos_activo_unico;

create unique index intentos_abierto_por_reto on intentos (reto_id) where not cerrado;
