-- CR-06. Propuesta de soporte para revisar y coordinar con CAB/SCM.
-- No aplicar automáticamente sobre la base compartida. Requiere respaldo previo.
-- No crea buses, no asigna marcas ficticias y no modifica reservas.
BEGIN;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS marca_chasis VARCHAR(80);
ALTER TABLE buses ADD COLUMN IF NOT EXISTS carroceria VARCHAR(80);
COMMIT;

-- Completar estas columnas únicamente con los datos verificados de cada bus.
-- La API tolera bases anteriores a esta migración y devuelve NULL para las marcas.
