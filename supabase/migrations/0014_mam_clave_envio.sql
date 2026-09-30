-- Clave de idempotencia de las publicaciones del "minuto a minuto" (DT-033)
--
-- El composer del panel reintenta automáticamente la Server Action
-- `crearMinutoAMinuto` ante un corte de red (DT-017). Si el servidor llegó a
-- publicar y lo que se perdió fue la respuesta, el reintento publicaba la
-- entrada dos veces. El cliente genera ahora un UUID por publicación, estable
-- entre reintentos, y lo envía como `clave_envio`; el índice único garantiza
-- que dos inserciones con la misma clave no pueden coexistir aunque lleguen a
-- la vez, y la acción trata la violación de unicidad (23505) como éxito.
--
-- Nullable: las entradas anteriores y cualquier llamada sin clave siguen
-- funcionando. El índice es parcial para no indexar esas filas.
--
-- No es un secreto: la policy SELECT de anon (0007) permite leerla vía
-- PostgREST igual que el resto de columnas de la fila, y conocerla no permite
-- escribir nada (solo el panel admin, con service role, inserta).

alter table minuto_a_minuto add column clave_envio uuid;

create unique index minuto_a_minuto_clave_envio_idx
  on minuto_a_minuto (clave_envio)
  where clave_envio is not null;
