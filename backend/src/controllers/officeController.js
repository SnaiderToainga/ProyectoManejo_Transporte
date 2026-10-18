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