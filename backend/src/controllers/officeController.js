// backend/src/controllers/officeController.js
const pool = require('../config/db');
const crypto = require('crypto');

// 1. Obtener reservas con comprobante en estado PENDIENTE
exports.getReservasPendientes = async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.codigo_reserva,
        r.total,
        r.estado,
        r.comprobante_url,
        r.expira_en,
        r.creado_en,
        pv.fecha_viaje,
        pv.hora_salida_programada AS hora_salida,
        f.origen,
        f.destino,
        c.nombre AS cooperativa_nombre,
        b.numero_disco,
        b.placa,
        COALESCE(
          json_agg(
            json_build_object(
              'boleto_id', db.id,
              'nombre_pasajero', db.nombre_pasajero,
              'cedula_pasajero', db.cedula_pasajero,
              'precio', db.precio,
              'numero_asiento', a.numero_asiento,
              'categoria', a.categoria
            )
          ) FILTER (WHERE db.id IS NOT NULL), '[]'
        ) AS pasajeros
      FROM reservas r
      JOIN programacion_viajes pv ON r.programacion_id = pv.id
      JOIN frecuencias f ON pv.frecuencia_id = f.id
      JOIN cooperativas c ON f.cooperativa_id = c.id
      JOIN buses b ON pv.bus_id = b.id
      LEFT JOIN detalle_boletos db ON db.reserva_id = r.id
      LEFT JOIN asientos a ON db.asiento_id = a.id
      WHERE r.estado = 'PENDIENTE'
      GROUP BY r.id, pv.id, f.id, c.id, b.id
      ORDER BY r.creado_en DESC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener reservas pendientes:', error);
    res.status(500).json({ error: 'Error interno al obtener reservas pendientes' });
  }
};

// 2. Aprobar o Rechazar comprobante (HU05)
exports.validarComprobante = async (req, res) => {
  const { id } = req.params;
  const { accion, estado } = req.body; // Soporta { accion: 'APROBAR' | 'RECHAZAR' } o { estado: 'PAGADO' | 'RECHAZADO' }

  const aprobar =
    accion === 'APROBAR' ||
    estado === 'PAGADO' ||
    estado === 'APROBADO';

  const nuevoEstado = aprobar ? 'PAGADO' : 'RECHAZADO';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE reservas SET estado = $1, expira_en = NULL WHERE id = $2 RETURNING *`,
      [nuevoEstado, id]
    );

    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const reserva = updateRes.rows[0];

    // Si se aprueba, generar códigos QR para cada boleto de la reserva
    if (aprobar) {
      const boletosRes = await client.query(
        `SELECT id, cedula_pasajero FROM detalle_boletos WHERE reserva_id = $1`,
        [id]
      );

      for (const b of boletosRes.rows) {
        const qrToken = `QR-${reserva.codigo_reserva}-${b.cedula_pasajero}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await client.query(
          `UPDATE detalle_boletos SET codigo_qr = $1 WHERE id = $2`,
          [qrToken, b.id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({
      mensaje: aprobar ? 'Comprobante aprobado y boletos emitidos' : 'Reserva rechazada y asientos liberados',
      reserva
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al validar comprobante:', error);
    res.status(500).json({ error: 'Error interno al validar la reserva' });
  } finally {
    client.release();
  }
};

// 3. Venta directa en ventanilla / taquilla (Efectivo, Transferencia, Depósito + Descuentos)
exports.crearVentaVentanilla = async (req, res) => {
  const { programacion_id, viaje_id, pasajeros } = req.body;
  const progId = programacion_id || viaje_id;

  if (!progId || !Array.isArray(pasajeros) || pasajeros.length === 0) {
    return res.status(400).json({ error: 'Datos de viaje y pasajeros son obligatorios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const codigoReserva = 'TAQ-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const total = pasajeros.reduce((acc, p) => acc + Number(p.precio || 0), 0);

    const insertReserva = await client.query(
      `INSERT INTO reservas (programacion_id, codigo_reserva, total, estado, comprobante_url)
       VALUES ($1, $2, $3, 'PAGADO', 'VENTA_VENTANILLA_EFECTIVO')
       RETURNING *`,
      [progId, codigoReserva, total]
    );

    const reserva = insertReserva.rows[0];

    for (const p of pasajeros) {
      const qrToken = `QR-${codigoReserva}-${p.cedula_pasajero || p.cedula}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      await client.query(
        `INSERT INTO detalle_boletos (reserva_id, asiento_id, nombre_pasajero, cedula_pasajero, precio, codigo_qr)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          reserva.id,
          p.asiento_id,
          p.nombre_pasajero || p.nombre,
          p.cedula_pasajero || p.cedula,
          p.precio,
          qrToken
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      mensaje: 'Venta en ventanilla registrada con éxito',
      codigo_reserva: codigoReserva,
      reserva
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en venta de ventanilla:', error);
    res.status(500).json({ error: 'Error al registrar la venta en ventanilla' });
  } finally {
    client.release();
  }
};

// 4. Obtener Hoja de Ruta Diaria
exports.getHojaRutaHoy = async (req, res) => {
  try {
    const query = `
      SELECT 
        pv.id,
        pv.fecha_viaje,
        pv.hora_salida_programada,
        pv.estado,
        pv.estado AS estado_viaje,
        f.origen,
        f.destino,
        f.precio_base,
        f.tipo_servicio,
        f.resolucion_ant,
        b.id AS bus_id,
        b.numero_disco,
        b.placa,
        b.capacidad,
        c.nombre AS cooperativa_nombre,
        (
          SELECT COUNT(*)
          FROM detalle_boletos db
          JOIN reservas r ON db.reserva_id = r.id
          WHERE r.programacion_id = pv.id AND r.estado IN ('PAGADO', 'PENDIENTE')
        )::int AS asientos_ocupados
      FROM programacion_viajes pv
      JOIN frecuencias f ON pv.frecuencia_id = f.id
      JOIN buses b ON pv.bus_id = b.id
      JOIN cooperativas c ON f.cooperativa_id = c.id
      WHERE pv.fecha_viaje >= CURRENT_DATE
      ORDER BY pv.fecha_viaje ASC, pv.hora_salida_programada ASC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener hoja de ruta:', error);
    res.status(500).json({ error: 'Error al obtener la hoja de ruta' });
  }
};

// 5. Actualizar estado de un viaje en la Hoja de Ruta
exports.actualizarEstadoViaje = async (req, res) => {
  const { id } = req.params;
  const { estado, estado_viaje } = req.body;
  const nuevoEstado = estado || estado_viaje;

  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE programacion_viajes SET estado = $1 WHERE id = $2 RETURNING *`,
      [nuevoEstado, id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Viaje programado no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al actualizar estado del viaje:', error);
    res.status(500).json({ error: 'Error al actualizar el estado del viaje' });
  }
};

exports.aprobarComprobante = exports.validarComprobante;
exports.procesarComprobante = exports.validarComprobante;
exports.validarReserva = exports.validarComprobante;
exports.actualizarEstadoReserva = exports.validarComprobante;

exports.ventaVentanilla = exports.crearVentaVentanilla;
exports.registrarVentaVentanilla = exports.crearVentaVentanilla;

exports.getHojaRuta = exports.getHojaRutaHoy;
exports.obtenerHojaRuta = exports.getHojaRutaHoy;

exports.cambiarEstadoViaje = exports.actualizarEstadoViaje;
exports.updateEstadoViaje = exports.actualizarEstadoViaje;