-- backend/database/01_schema.sql

-- Limpieza preventiva
DROP TABLE IF EXISTS detalle_boletos CASCADE;
DROP TABLE IF EXISTS reservas CASCADE;
DROP TABLE IF EXISTS programacion_viajes CASCADE;
DROP TABLE IF EXISTS asientos CASCADE;
DROP TABLE IF EXISTS buses CASCADE;
DROP TABLE IF EXISTS frecuencias CASCADE;
DROP TABLE IF EXISTS cooperativas CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- 1. Usuarios del sistema
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('CLIENTE', 'OFICINISTA', 'SUPERADMIN', 'ADMIN_COOP')),
    password_hash VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cooperativas de transporte
CREATE TABLE cooperativas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE,
    ruc VARCHAR(13) NOT NULL UNIQUE,
    color_distintivo VARCHAR(20) DEFAULT '#1E40AF',
    cuenta_bancaria VARCHAR(50),
    banco VARCHAR(50),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Frecuencias oficiales autorizadas por la ANT
CREATE TABLE frecuencias (
    id SERIAL PRIMARY KEY,
    cooperativa_id INT REFERENCES cooperativas(id) ON DELETE CASCADE,
    resolucion_ant VARCHAR(50) NOT NULL,
    origen VARCHAR(80) NOT NULL,
    destino VARCHAR(80) NOT NULL,
    hora_salida TIME NOT NULL,
    precio_base NUMERIC(6, 2) NOT NULL CHECK (precio_base > 0),
    tipo_servicio VARCHAR(20) DEFAULT 'DIRECTO' CHECK (tipo_servicio IN ('DIRECTO', 'PARADAS')),
    activo BOOLEAN DEFAULT TRUE
);

-- 4. Buses de la flota (configuración física de 40 o 41 asientos)
CREATE TABLE buses (
    id SERIAL PRIMARY KEY,
    cooperativa_id INT REFERENCES cooperativas(id) ON DELETE CASCADE,
    numero_disco INT NOT NULL,
    placa VARCHAR(10) UNIQUE NOT NULL,
    capacidad INT NOT NULL CHECK (capacidad IN (40, 41)),
    tiene_bano_posterior BOOLEAN DEFAULT TRUE,
    estado VARCHAR(20) DEFAULT 'OPERATIVO' CHECK (estado IN ('OPERATIVO', 'MANTENIMIENTO', 'PARADA')),
    UNIQUE(cooperativa_id, numero_disco)
);

-- 5. Catálogo estructural de Asientos por Bus
CREATE TABLE asientos (
    id SERIAL PRIMARY KEY,
    bus_id INT REFERENCES buses(id) ON DELETE CASCADE,
    numero_asiento INT NOT NULL,
    fila INT NOT NULL,
    columna INT NOT NULL, -- Col 1, 2 (izq), Col 3, 4 (der)
    categoria VARCHAR(10) DEFAULT 'NORMAL' CHECK (categoria IN ('VIP', 'NORMAL')),
    activo BOOLEAN DEFAULT TRUE,
    UNIQUE(bus_id, numero_asiento)
);

-- 6. Hoja de Ruta Diaria (Asignación Frecuencia + Bus para una fecha)
CREATE TABLE programacion_viajes (
    id SERIAL PRIMARY KEY,
    frecuencia_id INT REFERENCES frecuencias(id) ON DELETE RESTRICT,
    bus_id INT REFERENCES buses(id) ON DELETE RESTRICT,
    fecha_viaje DATE NOT NULL,
    hora_salida_programada TIME NOT NULL,
    estado VARCHAR(20) DEFAULT 'PROGRAMADO' CHECK (estado IN ('PROGRAMADO', 'EN_RUTA', 'FINALIZADO', 'CANCELADO')),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bus_id, fecha_viaje, hora_salida_programada)
);

-- 7. Reservas y Ventas de Pasajes
CREATE TABLE reservas (
    id SERIAL PRIMARY KEY,
    programacion_id INT REFERENCES programacion_viajes(id) ON DELETE RESTRICT,
    usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    codigo_reserva VARCHAR(12) UNIQUE NOT NULL,
    total NUMERIC(8, 2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PAGADO', 'RECHAZADO', 'CANCELADO')),
    comprobante_url VARCHAR(255),
    expira_en TIMESTAMP, -- Bloqueo temporal de 5 minutos
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Detalle individual de Asientos por Reserva
CREATE TABLE detalle_boletos (
    id SERIAL PRIMARY KEY,
    reserva_id INT REFERENCES reservas(id) ON DELETE CASCADE,
    asiento_id INT REFERENCES asientos(id) ON DELETE RESTRICT,
    nombre_pasajero VARCHAR(100) NOT NULL,
    cedula_pasajero VARCHAR(15) NOT NULL,
    precio NUMERIC(6, 2) NOT NULL,
    codigo_qr VARCHAR(255),
    validado_en_puerta BOOLEAN DEFAULT FALSE
);