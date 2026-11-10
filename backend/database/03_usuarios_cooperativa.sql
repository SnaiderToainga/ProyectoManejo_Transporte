BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cooperativa_id INT
  REFERENCES cooperativas(id) ON DELETE SET NULL;

-- Asociar únicamente cuentas existentes y cooperativas identificadas por RUC.
UPDATE usuarios u
SET cooperativa_id = c.id
FROM cooperativas c
WHERE u.rol = 'ADMIN_COOP' AND u.cooperativa_id IS NULL
  AND ((LOWER(TRIM(u.correo)) = 'gerente@cita.com' AND c.ruc = '1890012345001')
    OR (LOWER(TRIM(u.correo)) = 'gerente@pelileo.com' AND c.ruc = '1890098765001'));

COMMIT;
