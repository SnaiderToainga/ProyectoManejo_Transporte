const pool = require('../config/db'); // Asegúrate de que esta sea la ruta a tu conexión de BD

// ==========================================
// 1. BANDEJA DE VALIDACIÓN DE COMPROBANTES
// ==========================================

// Obtener todas las reservas PENDIENTES
exports.getReservasPendientes = async (req, res) => {
    try {
        const query = `
            SELECT r.id as reserva_id, r.estado, r.total_pagado, r.comprobante_url, r.fecha_reserva,
                   u.nombre as cliente_nombre, u.cedula as cliente_cedula,
                   f.hora_salida, f.origen, f.destino,
                   c.nombre as cooperativa_nombre
            FROM reservas r
            JOIN usuarios u ON r.usuario_id = u.id
            JOIN frecuencias f ON r.frecuencia_id = f.id
            JOIN cooperativas c ON f.cooperativa_id = c.id
            WHERE r.estado = 'PENDIENTE'
            ORDER BY r.fecha_reserva ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener reservas pendientes:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

// Aprobar un comprobante (cambia a PAGADO y genera QR)
exports.aprobarComprobante = async (req, res) => {
    const { reserva_id } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN'); // Iniciar transacción

        // 1. Actualizar estado de la reserva a PAGADO
        const updateReserva = await client.query(
            `UPDATE reservas SET estado = 'PAGADO' WHERE id = $1 AND estado = 'PENDIENTE' RETURNING *`,
            [reserva_id]
        );

        if (updateReserva.rowCount === 0) {
            throw new Error("Reserva no encontrada o ya fue procesada.");
        }

        // 2. Generar los códigos QR en detalle_boletos 
        // (Nota: Aquí idealmente llamarías a tu qrService.js, pero lo haremos directo en BD para simular)
        // Suponiendo que al crear la reserva ya se crearon los registros en detalle_boletos con estado pendiente
        await client.query(
            `UPDATE detalle_boletos 
             SET codigo_qr = CONCAT('QR-', $1, '-', asiento_id, '-', EXTRACT(EPOCH FROM NOW())) 
             WHERE reserva_id = $1`,
            [reserva_id]
        );

        await client.query('COMMIT');
        res.json({ mensaje: "Pago aprobado y boletos generados correctamente." });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error al aprobar comprobante:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

// Rechazar un comprobante (cambia a RECHAZADO y libera asientos)
exports.rechazarComprobante = async (req, res) => {
    const { reserva_id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Cambiar estado de la reserva a RECHAZADO
        const updateReserva = await client.query(
            `UPDATE reservas SET estado = 'RECHAZADO' WHERE id = $1 AND estado = 'PENDIENTE' RETURNING *`,
            [reserva_id]
        );

        if (updateReserva.rowCount === 0) {
            throw new Error("Reserva no encontrada o ya fue procesada.");
        }

        // 2. Liberar los asientos (suponiendo que en detalle_boletos guardas los asientos ocupados)
        // Si manejas una tabla 'asientos' con estado, aquí los vuelves a 'DISPONIBLE'
        await client.query(
            `UPDATE asientos SET estado = 'DISPONIBLE' 
             WHERE id IN (SELECT asiento_id FROM detalle_boletos WHERE reserva_id = $1)`,
            [reserva_id]
        );

        // Opcional: Eliminar el detalle de boletos de esa reserva rechazada
        await client.query(`DELETE FROM detalle_boletos WHERE reserva_id = $1`, [reserva_id]);

        await client.query('COMMIT');
        res.json({ mensaje: "Comprobante rechazado. Asientos liberados." });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error al rechazar comprobante:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};


// ==========================================
// 2. VENTA PRESENCIAL EN VENTANILLA
// ==========================================

exports.ventaVentanilla = async (req, res) => {
    const { 
        frecuencia_id, 
        asientos_ids, // Array de IDs de asientos
        usuario_id, // ID del pasajero (o crear uno genérico para ventanilla)
        tipo_pasajero, // 'NORMAL', 'NIÑO', 'TERCERA_EDAD', 'DISCAPACIDAD'
        metodo_pago // 'EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO'
    } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Calcular el total con descuento (50% para Niño, Tercera Edad, Discapacidad)
        const frecuenciaQuery = await client.query('SELECT precio_base FROM frecuencias WHERE id = $1', [frecuencia_id]);
        if (frecuenciaQuery.rowCount === 0) throw new Error("Frecuencia no encontrada.");
        
        let precioBase = parseFloat(frecuenciaQuery.rows[0].precio_base);
        let descuento = 1;
        
        if (['NIÑO', 'TERCERA_EDAD', 'DISCAPACIDAD'].includes(tipo_pasajero)) {
            descuento = 0.5; // 50% de descuento
        }

        const precioFinal = precioBase * descuento;
        const total = precioFinal * asientos_ids.length;

        // 2. Crear la reserva directamente como PAGADO (porque es ventanilla)
        const insertReserva = await client.query(`
            INSERT INTO reservas (usuario_id, frecuencia_id, estado, total_pagado, metodo_pago, fecha_reserva)
            VALUES ($1, $2, 'PAGADO', $3, $4, NOW()) RETURNING id
        `, [usuario_id, frecuencia_id, total, metodo_pago]);

        const reserva_id = insertReserva.rows[0].id;

        // 3. Insertar en detalle_boletos y actualizar asientos a OCUPADO
        for (let asiento_id of asientos_ids) {
            // Generar QR directamente
            const qr = `QR-VENTANILLA-${reserva_id}-${asiento_id}-${Date.now()}`;
            
            await client.query(`
                INSERT INTO detalle_boletos (reserva_id, asiento_id, precio_final, codigo_qr)
                VALUES ($1, $2, $3, $4)
            `, [reserva_id, asiento_id, precioFinal, qr]);

            await client.query(`
                UPDATE asientos SET estado = 'OCUPADO' WHERE id = $1
            `, [asiento_id]);
        }

        await client.query('COMMIT');
        res.json({ mensaje: "Venta en ventanilla registrada exitosamente.", reserva_id, total });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error en venta ventanilla:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};
// ==========================================
// 3. HOJA DE RUTA DIARIA
// ==========================================

exports.getHojaRutaHoy = async (req, res) => {
    try {
        const query = `
            SELECT pv.id as programacion_id, pv.estado_viaje, pv.fecha_programada,
                   f.hora_salida, f.origen, f.destino, f.tipo_servicio,
                   b.numero_disco, b.placa,
                   c.nombre as cooperativa
            FROM programacion_viajes pv
            JOIN frecuencias f ON pv.frecuencia_id = f.id
            JOIN buses b ON pv.bus_id = b.id
            JOIN cooperativas c ON b.cooperativa_id = c.id
            WHERE DATE(pv.fecha_programada) = CURRENT_DATE
            ORDER BY f.hora_salida ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener hoja de ruta:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

exports.actualizarEstadoViaje = async (req, res) => {
    const { programacion_id } = req.params;
    const { estado_viaje } = req.body; // 'PROGRAMADO', 'EN_RUTA', 'FINALIZADO'

    try {
        const result = await pool.query(
            `UPDATE programacion_viajes SET estado_viaje = $1 WHERE id = $2 RETURNING *`,
            [estado_viaje, programacion_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Viaje no encontrado" });
        }

        res.json({ mensaje: "Estado del viaje actualizado", viaje: result.rows[0] });
    } catch (error) {
        console.error("Error al actualizar estado de viaje:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};