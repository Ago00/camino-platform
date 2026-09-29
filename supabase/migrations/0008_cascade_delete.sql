-- Cascade delete en las FK de retos.id (FP2)
--
-- La migración original (0007_schema_plataforma.sql) no incluyó ON DELETE
-- CASCADE en ninguna de las FK que apuntan a retos(id) ni en las que apuntan
-- a intentos(id). Sin esta migración, eliminar un reto desde el panel
-- superadmin falla con un error de violación de FK si el reto tiene datos
-- asociados (intentos, intenciones, comentarios, textos, visitas, config).
--
-- Cadena de dependencia al borrar un reto:
--   retos → intentos → posiciones
--   retos → intentos → minuto_a_minuto
--   retos → intenciones
--   retos → comentarios
--   retos → textos
--   retos → visitas_web
--   retos → config_trafico
--
-- Se usan DROP CONSTRAINT + ADD CONSTRAINT porque PostgreSQL no permite
-- ALTER CONSTRAINT ... ON DELETE en una sola sentencia.

-- ---------------------------------------------------------------------------
-- intentos.reto_id → retos(id) ON DELETE CASCADE
-- ---------------------------------------------------------------------------

ALTER TABLE intentos
  DROP CONSTRAINT intentos_reto_id_fkey;

ALTER TABLE intentos
  ADD CONSTRAINT intentos_reto_id_fkey
    FOREIGN KEY (reto_id) REFERENCES retos(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- posiciones.intento_id → intentos(id) ON DELETE CASCADE
-- (necesario para la cadena retos → intentos → posiciones)
-- ---------------------------------------------------------------------------

ALTER TABLE posiciones
  DROP CONSTRAINT posiciones_intento_id_fkey;

ALTER TABLE posiciones
  ADD CONSTRAINT posiciones_intento_id_fkey
    FOREIGN KEY (intento_id) REFERENCES intentos(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- minuto_a_minuto.intento_id → intentos(id) ON DELETE CASCADE
-- (necesario para la cadena retos → intentos → minuto_a_minuto)
-- ---------------------------------------------------------------------------

ALTER TABLE minuto_a_minuto
  DROP CONSTRAINT minuto_a_minuto_intento_id_fkey;

ALTER TABLE minuto_a_minuto
  ADD CONSTRAINT minuto_a_minuto_intento_id_fkey
    FOREIGN KEY (intento_id) REFERENCES intentos(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- intenciones.reto_id → retos(id) ON DELETE CASCADE
-- ---------------------------------------------------------------------------

ALTER TABLE intenciones
  DROP CONSTRAINT intenciones_reto_id_fkey;

ALTER TABLE intenciones
  ADD CONSTRAINT intenciones_reto_id_fkey
    FOREIGN KEY (reto_id) REFERENCES retos(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- comentarios.reto_id → retos(id) ON DELETE CASCADE
-- ---------------------------------------------------------------------------

ALTER TABLE comentarios
  DROP CONSTRAINT comentarios_reto_id_fkey;

ALTER TABLE comentarios
  ADD CONSTRAINT comentarios_reto_id_fkey
    FOREIGN KEY (reto_id) REFERENCES retos(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- textos.reto_id → retos(id) ON DELETE CASCADE
-- ---------------------------------------------------------------------------

ALTER TABLE textos
  DROP CONSTRAINT textos_reto_id_fkey;

ALTER TABLE textos
  ADD CONSTRAINT textos_reto_id_fkey
    FOREIGN KEY (reto_id) REFERENCES retos(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- visitas_web.reto_id → retos(id) ON DELETE CASCADE
-- ---------------------------------------------------------------------------

ALTER TABLE visitas_web
  DROP CONSTRAINT visitas_web_reto_id_fkey;

ALTER TABLE visitas_web
  ADD CONSTRAINT visitas_web_reto_id_fkey
    FOREIGN KEY (reto_id) REFERENCES retos(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- config_trafico.reto_id → retos(id) ON DELETE CASCADE
-- ---------------------------------------------------------------------------

ALTER TABLE config_trafico
  DROP CONSTRAINT config_trafico_reto_id_fkey;

ALTER TABLE config_trafico
  ADD CONSTRAINT config_trafico_reto_id_fkey
    FOREIGN KEY (reto_id) REFERENCES retos(id) ON DELETE CASCADE;
