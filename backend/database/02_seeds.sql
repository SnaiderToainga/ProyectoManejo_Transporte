-- backend/database/02_seeds.sql

-- 1. Insertar Usuarios base
INSERT INTO usuarios (nombre, correo, telefono, rol, password_hash) VALUES
('Administrador General', 'admin@transporteuta.com', '0991234567', 'SUPERADMIN', 'hash_admin_123'),
('Taquillero Ambato', 'taquilla@transporteuta.com', '0987654321', 'OFICINISTA', 'hash_oficina_123'),
('Cliente Pasajero', 'pasajero@correo.com', '0978901234', 'CLIENTE', 'hash_cliente_123');

-- 2. Insertar Cooperativas
INSERT INTO cooperativas (nombre, ruc, color_distintivo, cuenta_bancaria, banco) VALUES
('Cooperativa de Transportes CITA', '1890012345001', '#1D4ED8', '2200114455', 'Banco Pichincha'),
('Flota Pelileo Express', '1890098765001', '#DC2626', '1055667788', 'Banco del Pacífico');

-- 3. Frecuencias oficiales (ANT)
INSERT INTO frecuencias (cooperativa_id, resolucion_ant, origen, destino, hora_salida, precio_base, tipo_servicio) VALUES
(1, 'ANT-RES-2024-001', 'Ambato', 'Quito (Quitumbe)', '07:00:00', 4.50, 'DIRECTO'),
(1, 'ANT-RES-2024-002', 'Ambato', 'Quito (Carcelén)', '08:30:00', 5.00, 'DIRECTO'),
(1, 'ANT-RES-2024-003', 'Ambato', 'Guayaquil', '10:00:00', 9.00, 'DIRECTO'),
(2, 'ANT-RES-2024-104', 'Pelileo', 'Ambato', '06:15:00', 1.25, 'PARADAS');

-- 4. Buses (1 bus de 40 asientos con baño posterior, 1 bus de 41 asientos y 1 bus de Pelileo)
INSERT INTO buses (cooperativa_id, numero_disco, placa, capacidad, tiene_bano_posterior, estado) VALUES
(1, 15, 'TAA-1515', 40, TRUE, 'OPERATIVO'),
(1, 18, 'TAA-1818', 41, FALSE, 'OPERATIVO'),
(2, 05, 'TBA-0505', 40, TRUE, 'OPERATIVO');

-- 5. Generar Asientos para Bus 1 (40 asientos: filas 1 a 10, con baño al fondo)
DO $$
DECLARE
    i INT;
    cat VARCHAR(10);
BEGIN
    FOR i IN 1..40 LOOP
        IF i <= 4 THEN
            cat := 'VIP';
        ELSE
            cat := 'NORMAL';
        END IF;
        INSERT INTO asientos (bus_id, numero_asiento, fila, columna, categoria)
        VALUES (1, i, ((i - 1) / 4) + 1, ((i - 1) % 4) + 1, cat);
    END LOOP;
END $$;

-- 6. Generar Asientos para Bus 2 (41 asientos continuos)
DO $$
DECLARE
    i INT;
    cat VARCHAR(10);
BEGIN
    FOR i IN 1..41 LOOP
        IF i <= 4 THEN
            cat := 'VIP';
        ELSE
            cat := 'NORMAL';
        END IF;
        INSERT INTO asientos (bus_id, numero_asiento, fila, columna, categoria)
        VALUES (2, i, ((i - 1) / 4) + 1, ((i - 1) % 4) + 1, cat);
    END LOOP;
END $$;

-- 7. Generar Asientos para Bus 3 (40 asientos: Cooperativa Flota Pelileo Express)
DO $$
DECLARE
    i INT;
    cat VARCHAR(10);
BEGIN
    FOR i IN 1..40 LOOP
        IF i <= 4 THEN
            cat := 'VIP';
        ELSE
            cat := 'NORMAL';
        END IF;
        INSERT INTO asientos (bus_id, numero_asiento, fila, columna, categoria)
        VALUES (3, i, ((i - 1) / 4) + 1, ((i - 1) % 4) + 1, cat)
        ON CONFLICT (bus_id, numero_asiento) DO NOTHING;
    END LOOP;
END $$;

-- 8. Hoja de Ruta / Viajes Programados para la fecha actual (fechas relativas dinámicas)
INSERT INTO programacion_viajes (frecuencia_id, bus_id, fecha_viaje, hora_salida_programada, estado) VALUES
(1, 1, CURRENT_DATE, '07:00:00', 'PROGRAMADO'),
(2, 2, CURRENT_DATE, '08:30:00', 'PROGRAMADO'),
(3, 1, CURRENT_DATE, '10:00:00', 'PROGRAMADO'),
(4, 3, CURRENT_DATE, '06:15:00', 'PROGRAMADO');
