-- CR-08. Migración incremental. Ejecutar después de respaldar la base de datos.
BEGIN;

CREATE TABLE IF NOT EXISTS sucursales (
    id SERIAL PRIMARY KEY,
    cooperativa_id INT NOT NULL REFERENCES cooperativas(id),
    nombre VARCHAR(100) NOT NULL,
    localidad VARCHAR(100) NOT NULL,
    UNIQUE (cooperativa_id, nombre),
    UNIQUE (id, cooperativa_id)
);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sucursal_id INT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_sucursal_cooperativa_fk') THEN
        ALTER TABLE usuarios ADD CONSTRAINT usuarios_sucursal_cooperativa_fk
            FOREIGN KEY (sucursal_id, cooperativa_id) REFERENCES sucursales(id, cooperativa_id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS grupos_buses (
    id SERIAL PRIMARY KEY,
    cooperativa_id INT NOT NULL REFERENCES cooperativas(id),
    nombre VARCHAR(100) NOT NULL,
    tipo_operacion VARCHAR(20) NOT NULL CHECK (tipo_operacion IN ('URBANO', 'INTERPROVINCIAL')),
    inicio_ciclo DATE NOT NULL,
    UNIQUE (cooperativa_id, nombre)
);
CREATE TABLE IF NOT EXISTS grupos_frecuencias (
    id SERIAL PRIMARY KEY,
    cooperativa_id INT NOT NULL REFERENCES cooperativas(id),
    nombre VARCHAR(100) NOT NULL,
    tipo_operacion VARCHAR(20) NOT NULL CHECK (tipo_operacion IN ('URBANO', 'INTERPROVINCIAL')),
    UNIQUE (cooperativa_id, nombre)
);
CREATE TABLE IF NOT EXISTS grupo_bus_miembros (
    bus_id INT PRIMARY KEY REFERENCES buses(id),
    grupo_id INT NOT NULL REFERENCES grupos_buses(id)
);
CREATE TABLE IF NOT EXISTS grupo_frecuencia_miembros (
    frecuencia_id INT PRIMARY KEY REFERENCES frecuencias(id),
    grupo_id INT NOT NULL REFERENCES grupos_frecuencias(id)
);
CREATE TABLE IF NOT EXISTS grupo_vinculos (
    grupo_buses_id INT NOT NULL REFERENCES grupos_buses(id),
    grupo_frecuencias_id INT NOT NULL REFERENCES grupos_frecuencias(id),
    PRIMARY KEY (grupo_buses_id, grupo_frecuencias_id)
);
ALTER TABLE programacion_viajes ADD COLUMN IF NOT EXISTS grupo_buses_id INT REFERENCES grupos_buses(id);
ALTER TABLE programacion_viajes ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- Una cancelación conserva el viaje histórico y libera su horario para otra
-- asignación. Se sustituye únicamente la restricción de esas tres columnas.
DO $$ DECLARE constraint_name TEXT; BEGIN
    FOR constraint_name IN SELECT conname FROM pg_constraint
        WHERE conrelid='programacion_viajes'::regclass AND contype='u'
          AND pg_get_constraintdef(oid)='UNIQUE (bus_id, fecha_viaje, hora_salida_programada)'
    LOOP
        EXECUTE format('ALTER TABLE programacion_viajes DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS programacion_bus_horario_activo_uidx
    ON programacion_viajes(bus_id,fecha_viaje,hora_salida_programada) WHERE estado <> 'CANCELADO';
CREATE UNIQUE INDEX IF NOT EXISTS programacion_frecuencia_planificada_uidx
    ON programacion_viajes(frecuencia_id,fecha_viaje) WHERE grupo_buses_id IS NOT NULL AND estado <> 'CANCELADO';

CREATE TABLE IF NOT EXISTS bus_paradas (
    bus_id INT NOT NULL REFERENCES buses(id),
    fecha DATE NOT NULL,
    motivo VARCHAR(15) NOT NULL CHECK (motivo IN ('DESCANSO', 'AVERIA')),
    detalle VARCHAR(300) NOT NULL DEFAULT '',
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    PRIMARY KEY (bus_id, fecha)
);
CREATE TABLE IF NOT EXISTS auditoria_hojas_ruta (
    id SERIAL PRIMARY KEY,
    programacion_id INT NOT NULL REFERENCES programacion_viajes(id),
    usuario_id INT NOT NULL REFERENCES usuarios(id),
    bus_anterior_id INT REFERENCES buses(id),
    bus_nuevo_id INT REFERENCES buses(id),
    motivo VARCHAR(300) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS programacion_fecha_frecuencia_idx ON programacion_viajes(fecha_viaje, frecuencia_id);
CREATE INDEX IF NOT EXISTS grupo_bus_grupo_idx ON grupo_bus_miembros(grupo_id);
CREATE INDEX IF NOT EXISTS grupo_frecuencia_grupo_idx ON grupo_frecuencia_miembros(grupo_id);
COMMIT;
