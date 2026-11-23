// backend/src/controllers/officeController.js
const { quotePassengers } = require('../services/passengerFares');
const { notifyReservation } = require('../services/receiptData');
const { lockTrip, occupiedReservation, occupiedSeats, seatIds, tripSeats } = require('../services/seatInventory');
const db = require('../config/db');
const pool = db.pool || db;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { officeScope, assertOfficeTrip } = require('../services/officeAccess');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

function checkLocalReceiptExists(comprobanteUrl) {
  if (!comprobanteUrl || typeof comprobanteUrl !== 'string') return false;
  if (/^https?:\/\//i.test(comprobanteUrl)) return true;
  const clean = comprobanteUrl.replace(/^\/?uploads\//i, '').split('?')[0];
  if (!clean || clean.includes('..') || clean.includes('/') || clean.includes('\\')) return false;
  const fullPath = path.resolve(UPLOADS_DIR, clean);
  if (!fullPath.startsWith(UPLOADS_DIR + path.sep)) return false;
  return fs.existsSync(fullPath);
}

// 1. Obtener reservas con comprobante en estado PENDIENTE
exports.getReservasPendientes = async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.id AS reserva_id,
        r.codigo_reserva,
        r.total,
        r.total AS total_pagado,
        r.estado,
        r.comprobante_url,
        to_jsonb(r)->>'metodo_pago' AS metodo_pago,
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
          (array_agg(db.nombre_pasajero ORDER BY db.id) FILTER (WHERE db.id IS NOT NULL))[1],
          'Cliente Pasajero'
        ) AS cliente_nombre,
        COALESCE(
          (array_agg(db.cedula_pasajero ORDER BY db.id) FILTER (WHERE db.id IS NOT NULL))[1],
          '1801234567'
        ) AS cliente_cedula,
        COALESCE(
          json_agg(
            json_build_object(
              'boleto_id', db.id,
              'nombre_pasajero', db.nombre_pasajero,
              'cedula_pasajero', db.cedula_pasajero,
              'precio', db.precio,
              'numero_asiento', a.numero_asiento,
              'categoria', a.categoria
            ) ORDER BY db.id
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
        AND ($1::boolean OR (f.cooperativa_id=$2::int AND b.cooperativa_id=$2::int))
      GROUP BY r.id, pv.id, f.id, c.id, b.id
      ORDER BY r.creado_en DESC;
    `;
    const { rows } = await pool.query(query, officeScope(req));
    const enriched = rows.map(row => ({
      ...row,
      comprobante_disponible: row.comprobante_url ? checkLocalReceiptExists(row.comprobante_url) : false
    }));
    res.json(enriched);
  } catch (error) {
    console.error('Error al obtener reservas pendientes:', error);
    res.status(500).json({ error: 'Error interno al obtener reservas pendientes' });
  }
};

// 2. Aprobar o Rechazar comprobante (HU05) + Despacho de Correo con QR
exports.validarComprobante = async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const accion = body.accion || (req.path && req.path.includes('aprobar') ? 'APROBAR' : req.path && req.path.includes('rechazar') ? 'RECHAZAR' : '');
  const estado = body.estado;

  const nuevoEstado = accion ? { APROBAR: 'PAGADO', RECHAZAR: 'RECHAZADO' }[accion]
    : { PAGADO: 'PAGADO', APROBADO: 'PAGADO', RECHAZADO: 'RECHAZADO' }[estado];
  if (!nuevoEstado) return res.status(400).json({ error: 'Indica si deseas aprobar o rechazar la reserva.' });
  const aprobar = nuevoEstado === 'PAGADO';
  const client = await pool.connect();

  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const lookup = await client.query(
      `SELECT programacion_id, comprobante_url,
              to_jsonb(reservas)->>'metodo_pago' AS metodo_pago
       FROM reservas
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );
    const reservaLock = lookup.rows[0];
    const trip = lookup.rowCount && await lockTrip(client, reservaLock.programacion_id);
    await assertOfficeTrip(client, req, trip);
    if (!trip) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    if (aprobar && reservaLock.metodo_pago === 'TARJETA' && !reservaLock.comprobante_url) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Esta reserva corresponde a un pago con tarjeta en pasarela y solo puede confirmarse mediante el proveedor.'
      });
    }

    if (aprobar) {
      const details = await client.query('SELECT asiento_id FROM detalle_boletos WHERE reserva_id = $1', [id]);
      const ids = seatIds(details.rows.map(row => row.asiento_id));
      if (!ids || (await tripSeats(client, trip, ids)).size !== ids.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'La reserva no tiene asientos válidos para este viaje' });
      }
      const occupied = await occupiedSeats(client, trip.id, ids, id);
      if (occupied.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Uno o más asientos seleccionados ya no están disponibles',
          asientos_ocupados: occupied
        });
      }
    }

    const updateRes = await client.query(
      `UPDATE reservas SET estado = $1::varchar, expira_en = NULL,
         comprado_en = CASE WHEN $1::varchar='PAGADO' THEN statement_timestamp() ELSE comprado_en END
       WHERE id = $2 AND estado = 'PENDIENTE' RETURNING *`,
      [nuevoEstado, id]
    );
    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La reserva ya no está pendiente' });
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

    if (aprobar) {
      notifyReservation(pool, reserva.codigo_reserva).catch(error => console.error('Error al notificar boleto:', error.message));
    }

    res.json({
      mensaje: aprobar ? 'Comprobante aprobado y boletos emitidos' : 'Reserva rechazada y asientos liberados',
      reserva
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status !== 403) console.error('Error al validar comprobante:', error);
    res.status(error.status === 403 ? 403 : 500).json({ error: error.status === 403 ? error.message : 'Error interno al validar la reserva' });
  } finally {
    client.release();
  }
};

// 3. Venta directa en ventanilla / taquilla (Efectivo, Transferencia, Depósito + Descuentos)
exports.crearVentaVentanilla = async (req, res) => {
  const { programacion_id, viaje_id, pasajeros, email, correo } = req.body || {};
  const progId = programacion_id || viaje_id;
  const emailContacto = email || correo;
  if (emailContacto && (typeof emailContacto !== 'string' || emailContacto.trim().length > 100
      || !require('../utils/validators').validarEmail(emailContacto))) {
    return res.status(400).json({ error: 'Ingresa un correo válido.' });
  }

  const ids = Array.isArray(pasajeros) && seatIds(pasajeros.map(p => p?.asiento_id));
  if (!progId || !ids) {
    return res.status(400).json({ error: 'Datos de viaje y pasajeros son obligatorios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const trip = await lockTrip(client, progId);
    await assertOfficeTrip(client, req, trip);
    const seats = trip?.estado === 'PROGRAMADO' && await tripSeats(client, trip, ids);
    if (!seats || seats.size !== ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Los asientos seleccionados no pertenecen al viaje' });
    }
    const occupied = await occupiedSeats(client, trip.id, ids);
    if (occupied.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Uno o más asientos seleccionados ya no están disponibles',
        asientos_ocupados: occupied
      });
    }

    const quote = await quotePassengers(client, trip, pasajeros, req.body.tramo);

    // Asociar usuario si se proporciona correo
    let usuarioId = null;
    if (emailContacto) {
      const emailLimpio = emailContacto.trim().toLowerCase();
      const userCheck = await client.query('SELECT id FROM usuarios WHERE correo = $1', [emailLimpio]);
      if (userCheck.rows.length > 0) {
        usuarioId = userCheck.rows[0].id;
      } else {
        const nombrePasajero = pasajeros[0].nombre_pasajero || pasajeros[0].nombre || 'Cliente Pasajero';
        const newUser = await client.query(
          `INSERT INTO usuarios (nombre, correo, rol, password_hash)
           VALUES ($1, $2, 'CLIENTE', 'invitado_sin_password')
           RETURNING id`,
          [nombrePasajero, emailLimpio]
        );
        usuarioId = newUser.rows[0].id;
      }
    }

    const codigoReserva = 'TAQ-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const total = quote.total;

    const insertReserva = await client.query(
      `INSERT INTO reservas (programacion_id, usuario_id, codigo_reserva, total, estado, comprobante_url, comprado_en, origen_tramo, destino_tramo)
       VALUES ($1, $2, $3, $4, 'PAGADO', 'VENTA_VENTANILLA_EFECTIVO', statement_timestamp(), $5, $6)
       RETURNING *`,
      [progId, usuarioId, codigoReserva, total, quote.origen, quote.destino]
    );

    const reserva = insertReserva.rows[0];

    for (const p of quote.pasajeros) {
      const qrToken = `QR-${codigoReserva}-${p.cedula_pasajero || p.cedula}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      await client.query(
        `INSERT INTO detalle_boletos (reserva_id, asiento_id, nombre_pasajero, cedula_pasajero, precio, codigo_qr, tipo_pasajero, tarifa_base, descuento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          reserva.id,
          p.asiento_id,
          p.nombre_pasajero || p.nombre,
          p.cedula_pasajero || p.cedula,
          p.precio,
          qrToken, p.tipo_pasajero, p.tarifa_base, p.descuento
        ]
      );
    }

    await client.query('COMMIT');

    if (emailContacto) {
      notifyReservation(pool, codigoReserva).catch(error => console.error('Error al notificar taquilla:', error.message));
    }

    res.status(201).json({
      mensaje: 'Venta en ventanilla registrada con éxito',
      codigo_reserva: codigoReserva,
      reserva
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (![400,403].includes(error.status)) console.error('Error en venta de ventanilla:', error);
    res.status([400,403].includes(error.status) ? error.status : 500).json({ error: [400,403].includes(error.status) ? error.message : 'Error al registrar la venta en ventanilla' });
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
        pv.id AS programacion_id,
        pv.fecha_viaje,
        pv.hora_salida_programada,
        pv.hora_salida_programada AS hora_salida,
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
          WHERE r.programacion_id = pv.id AND ${occupiedReservation}
        )::int AS asientos_ocupados
      FROM programacion_viajes pv
      JOIN frecuencias f ON pv.frecuencia_id = f.id
      JOIN buses b ON pv.bus_id = b.id
      JOIN cooperativas c ON f.cooperativa_id = c.id
      WHERE (($3::date IS NULL AND pv.fecha_viaje >= CURRENT_DATE) OR pv.fecha_viaje=$3::date)
        AND ($1::boolean OR (f.cooperativa_id=$2::int AND b.cooperativa_id=$2::int))
      ORDER BY pv.fecha_viaje ASC, pv.hora_salida_programada ASC;
    `;
    const { rows } = await pool.query(query, [...officeScope(req), req.query.fecha || null]);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener hoja de ruta:', error);
    res.status(500).json({ error: 'Error al obtener la hoja de ruta' });
  }
};

// 5. Actualizar estado de un viaje en la Hoja de Ruta
exports.actualizarEstadoViaje = async (req, res) => {
  const { id } = req.params;
  const { estado, estado_viaje } = req.body || {};
  const viajeId = parseInt(id, 10);
  if (isNaN(viajeId)) {
    return res.status(400).json({ error: 'ID de viaje inválido' });
  }
  const value = estado || estado_viaje || '';
  const nuevoEstado = typeof value === 'string' ? value.toUpperCase() : '';
  const previous = { EN_RUTA: 'PROGRAMADO', FINALIZADO: 'EN_RUTA' }[nuevoEstado];
  if (!previous) return res.status(400).json({ error: 'Solo se permite iniciar o finalizar un viaje.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const trip = await lockTrip(client, viajeId);
    if (!trip) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Viaje programado no encontrado' });
    }
    await assertOfficeTrip(client, req, trip);
    const { rows, rowCount } = await client.query(
      `UPDATE programacion_viajes SET estado = $1, version=version+1 WHERE id = $2 AND estado=$3 RETURNING *`,
      [nuevoEstado, viajeId, previous]
    );
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El estado actual del viaje no permite ese cambio.' });
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status !== 403) console.error('Error al actualizar estado del viaje:', error);
    res.status(error.status === 403 ? 403 : 500).json({ error: error.status === 403 ? error.message : 'Error al actualizar el estado del viaje' });
  } finally {
    client.release();
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
