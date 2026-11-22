-- CR-01 (SCR-EXP-2026-007): Migración incremental e idempotente.
-- Amplía cooperativas, usuarios (cédula de clientes/gerentes), ficha técnica de buses,
-- métodos de pago en reservas y tabla transaccional para pagos con tarjeta en sandbox.
BEGIN;

-- 1. Cooperativas: campos institucionales completos
ALTER TABLE cooperativas
  ADD COLUMN IF NOT EXISTS resolucion_ant VARCHAR(50),
  ADD COLUMN IF NOT EXISTS correo VARCHAR(120);

-- 2. Usuarios: cédula para gerentes y clientes con cuenta personal
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS cedula VARCHAR(15);

CREATE INDEX IF NOT EXISTS usuarios_cedula_idx
  ON usuarios(cedula)
  WHERE cedula IS NOT NULL;

-- Solo las cuentas cliente con contraseña propia exigen cédula única (preserva invitados previos).
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_cliente_cedula_uidx
  ON usuarios(cedula)
  WHERE rol = 'CLIENTE' AND password_hash <> 'invitado_sin_password' AND cedula IS NOT NULL;

-- 3. Buses: metadatos técnicos, socio, galería fotográfica y capacidad flexible (1..100)
ALTER TABLE buses
  ADD COLUMN IF NOT EXISTS marca_chasis VARCHAR(80),
  ADD COLUMN IF NOT EXISTS carroceria VARCHAR(80),
  ADD COLUMN IF NOT EXISTS socio_nombre VARCHAR(120),
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS fotos TEXT[] DEFAULT '{}';

DO $$ DECLARE constraint_name TEXT; BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'buses'::regclass
      AND contype = 'c'
      AND (
        conname = 'buses_capacidad_check'
        OR (pg_get_constraintdef(oid) LIKE '%capacidad%' AND pg_get_constraintdef(oid) LIKE '%40%')
      )
  LOOP
    EXECUTE format('ALTER TABLE buses DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'buses'::regclass AND conname = 'buses_capacidad_cr01_check'
  ) THEN
    ALTER TABLE buses
      ADD CONSTRAINT buses_capacidad_cr01_check CHECK (capacidad >= 1 AND capacidad <= 100);
  END IF;
END $$;

-- 4. Reservas: método de pago explícito (comprobantes + pasarela tarjeta)
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(20);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'reservas'::regclass AND conname = 'reservas_metodo_pago_cr01_check'
  ) THEN
    ALTER TABLE reservas
      ADD CONSTRAINT reservas_metodo_pago_cr01_check CHECK (
        metodo_pago IS NULL OR metodo_pago IN ('TRANSFERENCIA', 'DEPOSITO', 'TARJETA', 'EFECTIVO')
      );
  END IF;
END $$;

-- 5. Sesiones y confirmaciones de pasarela alojada con tarjeta (Sandbox / Stripe)
CREATE TABLE IF NOT EXISTS pagos_tarjeta (
  id SERIAL PRIMARY KEY,
  reserva_id INT NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  codigo_reserva VARCHAR(12) NOT NULL,
  proveedor VARCHAR(30) NOT NULL DEFAULT 'STRIPE_SANDBOX',
  modo VARCHAR(20) NOT NULL DEFAULT 'SANDBOX' CHECK (modo IN ('SANDBOX', 'LIVE')),
  idempotency_key VARCHAR(120) NOT NULL,
  provider_session_id VARCHAR(255),
  provider_payment_intent_id VARCHAR(255),
  checkout_url TEXT NOT NULL,
  monto_usd NUMERIC(8, 2) NOT NULL CHECK (monto_usd > 0),
  moneda VARCHAR(10) NOT NULL DEFAULT 'USD',
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'CONFIRMADO', 'FALLIDO', 'EXPIRADO', 'CANCELADO')),
  webhook_event_id VARCHAR(255),
  payload_resumen JSONB,
  confirmado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (reserva_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS pagos_tarjeta_session_uidx
  ON pagos_tarjeta(provider_session_id)
  WHERE provider_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pagos_tarjeta_reserva_confirmado_uidx
  ON pagos_tarjeta(reserva_id)
  WHERE estado = 'CONFIRMADO';

CREATE INDEX IF NOT EXISTS pagos_tarjeta_codigo_idx
  ON pagos_tarjeta(codigo_reserva);

CREATE INDEX IF NOT EXISTS pagos_tarjeta_webhook_idx
  ON pagos_tarjeta(webhook_event_id)
  WHERE webhook_event_id IS NOT NULL;

COMMIT;
