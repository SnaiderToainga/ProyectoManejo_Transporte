-- CR-07: cambios aditivos. Aplicar después de 04; no recrea tablas ni infiere
-- descuentos o fechas de compra de boletos históricos sin esa información.
BEGIN;
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS comprado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origen_tramo VARCHAR(80),
  ADD COLUMN IF NOT EXISTS destino_tramo VARCHAR(80);
ALTER TABLE detalle_boletos
  ADD COLUMN IF NOT EXISTS tipo_pasajero VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tarifa_base NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS descuento NUMERIC(6,2);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='detalle_boletos'::regclass AND conname='boleto_desglose_cr07') THEN
    ALTER TABLE detalle_boletos ADD CONSTRAINT boleto_desglose_cr07 CHECK (
      (tipo_pasajero IS NULL AND tarifa_base IS NULL AND descuento IS NULL) OR
      (tipo_pasajero IS NOT NULL AND tarifa_base IS NOT NULL AND descuento IS NOT NULL
       AND tipo_pasajero IN ('NORMAL','MENOR','TERCERA_EDAD','DISCAPACIDAD')
       AND tarifa_base > 0 AND descuento >= 0 AND precio >= 0
       AND precio = tarifa_base - descuento
       AND ((tipo_pasajero='NORMAL' AND descuento=0)
         OR (tipo_pasajero<>'NORMAL' AND precio=ROUND(tarifa_base/2,2))))
    );
  END IF;
END $$;
COMMIT;
