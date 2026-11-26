-- backend/database/09_cr14_branding_soporte.sql
-- CR-14: canales de soporte y redes sociales de cada cooperativa
-- ("Configuración de la aplicación: logo, colores, redes sociales, soporte").
-- Migración aditiva e idempotente: puede ejecutarse varias veces sin efectos secundarios.
BEGIN;

ALTER TABLE cooperativas
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_soporte VARCHAR(40),
  ADD COLUMN IF NOT EXISTS correo_soporte VARCHAR(120);

COMMIT;
