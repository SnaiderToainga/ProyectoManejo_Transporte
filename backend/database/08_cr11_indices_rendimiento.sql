-- backend/database/08_cr11_indices_rendimiento.sql
-- CR-11 (VENT-22, VENT-24, COOP-16): Índices aditivos e idempotentes para optimizar
-- login, bandeja de comprobantes pendientes de oficinista y carga de catálogos.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_usuarios_correo_lower
  ON usuarios (LOWER(TRIM(correo)));

CREATE INDEX IF NOT EXISTS idx_reservas_estado_creado
  ON reservas (estado, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_reservas_usuario_creado
  ON reservas (usuario_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_frecuencias_coop_activo
  ON frecuencias (cooperativa_id, activo);

CREATE INDEX IF NOT EXISTS idx_buses_coop_estado
  ON buses (cooperativa_id, estado);

COMMIT;
