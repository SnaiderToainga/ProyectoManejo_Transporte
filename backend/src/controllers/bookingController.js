// backend/src/controllers/bookingController.js
const ticketService = require('../services/ticketService');
const historyAccess = require('../services/historyAccess');
const { lockTrip, occupiedSeats, seatIds, tripSeats } = require('../services/seatInventory');
const db = require('../config/db');
const pool = db.pool || db;

exports.solicitarAccesoHistorial = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  res.set('Cache-Control', 'no-store');
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Ingresa un correo válido' });
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM || !process.env.FRONTEND_URL
      || Buffer.byteLength(process.env.HISTORY_TOKEN_SECRET || '') < 32) {
    return res.status(503).json({ error: 'La consulta por correo no está disponible en este momento' });
  }
  if (!historyAccess.allowRequest(req.ip, email)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' });
  }
  try {
    // Responder igual haya compras o no: el historial solo se abre desde el buzón.
    await historyAccess.sendLink(email);
    res.status(202).json({ mensaje: 'Revisa tu correo para abrir el historial.' });
  } catch (err) {
    console.error('Error al enviar enlace de historial:', err.message);
    res.status(503).json({ error: 'No se pudo enviar el enlace. Inténtalo más tarde.' });
  }
};

exports.obtenerHistorialCliente = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const match = /^Bearer (.+)$/i.exec(req.get('authorization') || '');
  const email = match && historyAccess.verifyToken(match[1]);
  if (!email) return res.status(401).json({ error: 'Abre un enlace de acceso válido enviado a tu correo' });
  try {
    const result = await pool.query(`
      SELECT r.id, r.codigo_reserva, r.total, r.estado, r.creado_en, r.expira_en,
             r.comprobante_url IS NOT NULL AS tiene_comprobante,
             c.nombre AS cooperativa_nombre, f.origen, f.destino, pv.fecha_viaje,
             pv.hora_salida_programada, COUNT(d.id)::int AS total_pasajeros
      FROM reservas r
      JOIN usuarios u ON u.id = r.usuario_id
      JOIN programacion_viajes pv ON pv.id = r.programacion_id
      JOIN frecuencias f ON f.id = pv.frecuencia_id
      JOIN cooperativas c ON c.id = f.cooperativa_id
      LEFT JOIN detalle_boletos d ON d.reserva_id = r.id
      WHERE LOWER(TRIM(u.correo)) = $1
      GROUP BY r.id, c.nombre, f.origen, f.destino, pv.fecha_viaje, pv.hora_salida_programada
      ORDER BY r.creado_en DESC, r.id DESC
    `, [email]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al consultar historial:', err.message);
    res.status(500).json({ error: 'No se pudo consultar el historial' });
  }
};

exports.obtenerQrBoleto = async (req, res) => {
  const { codigo, boletoId } = req.params;
  if (!/^[A-Z0-9-]{1,12}$/.test(codigo) || !/^\d{1,10}$/.test(boletoId)) return res.sendStatus(404);
  try {
    const result = await pool.query(`
      SELECT a.numero_asiento FROM reservas r
      JOIN detalle_boletos d ON d.reserva_id = r.id
      JOIN asientos a ON a.id = d.asiento_id
      WHERE r.codigo_reserva = $1 AND r.estado = 'PAGADO' AND d.id = $2::bigint
    `, [codigo, boletoId]);
    if (!result.rows.length) return res.sendStatus(404);
    const base = (process.env.FRONTEND_URL || 'https://proyecto-web.online').replace(/\/$/, '');
    const url = `${base}/validar?reserva=${encodeURIComponent(codigo)}&asiento=${result.rows[0].numero_asiento}`;
    res.set('Cache-Control', 'private, no-store');
    res.type('png').send(await require('qrcode').toBuffer(url, { width: 200, margin: 2 }));
  } catch (err) {
    console.error('Error al generar QR de respaldo:', err.message);
    res.sendStatus(500);
  }
};

// 1. Crear reserva temporal (Bloqueo de 5 minutos)
exports.crearReserva = async (req, res) => {
  const { programacion_id, usuario_id, asientos, pasajeros, email, correo } = req.body;
  const emailContacto = email || correo;

  const ids = seatIds(asientos);
  const passengerIds = Array.isArray(pasajeros) && seatIds(pasajeros.map(p => p?.asiento_id));
  if (!programacion_id || !ids || !passengerIds || ids.length !== passengerIds.length
      || passengerIds.some(id => !ids.includes(id))) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para la reserva' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const trip = await lockTrip(client, programacion_id);
    if (!trip || (await tripSeats(client, trip, ids)).size !== ids.length) {
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

    // Asociar usuario automáticamente si envía correo en Checkout
    let finalUsuarioId = usuario_id || null;
    if (!finalUsuarioId && emailContacto) {
      const emailLimpio = emailContacto.trim().toLowerCase();
      const userCheck = await client.query('SELECT id FROM usuarios WHERE correo = $1', [emailLimpio]);
      if (userCheck.rows.length > 0) {
        finalUsuarioId = userCheck.rows[0].id;
      } else {
        const nombrePasajero = (pasajeros && pasajeros[0] && (pasajeros[0].nombre || pasajeros[0].nombre_pasajero))
          ? (pasajeros[0].nombre || pasajeros[0].nombre_pasajero).trim()
          : 'Cliente Pasajero';
        const newUser = await client.query(
          `INSERT INTO usuarios (nombre, correo, rol, password_hash)
           VALUES ($1, $2, 'CLIENTE', 'invitado_sin_password')
           RETURNING id`,
          [nombrePasajero, emailLimpio]
        );
        finalUsuarioId = newUser.rows[0].id;
      }
    }

    // Limpiar automáticamente reservas expiradas que quedaron pendientes
    await client.query(`
      UPDATE reservas 
      SET estado = 'CANCELADO' 
      WHERE programacion_id = $1 AND estado = 'PENDIENTE' AND expira_en <= statement_timestamp()
    `, [trip.id]);

    // Calcular el total
    const total = pasajeros.reduce((sum, p) => sum + Number(p.precio || 0), 0);

    // Generar código único de reserva (ej. RES-9F3A1C)
    const codigoReserva = 'RES-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Tiempo de bloqueo: 5 minutos desde ahora
    const minutosBloqueo = process.env.TIEMPO_RESERVA_MINUTOS || 5;

    // Insertar la cabecera de la reserva con finalUsuarioId asociado
    const insertReserva = await client.query(`
      INSERT INTO reservas (programacion_id, usuario_id, codigo_reserva, total, estado, expira_en)
      VALUES ($1, $2, $3, $4, 'PENDIENTE', statement_timestamp() + ($5 || ' minutes')::interval)
      RETURNING *
    `, [programacion_id, finalUsuarioId, codigoReserva, total, minutosBloqueo]);

    const reservaCreada = insertReserva.rows[0];

    // Insertar el detalle de boletos para cada asiento
    for (const pas of pasajeros) {
      await client.query(`
        INSERT INTO detalle_boletos (reserva_id, asiento_id, nombre_pasajero, cedula_pasajero, precio)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        reservaCreada.id, 
        pas.asiento_id, 
        pas.nombre || pas.nombre_pasajero, 
        pas.cedula || pas.cedula_pasajero, 
        pas.precio
      ]);
    }

    await client.query('COMMIT'); // Confirmar transacción

    res.status(201).json({
      mensaje: `Reserva creada exitosamente. Asientos bloqueados por ${minutosBloqueo} minutos.`,
      reserva: reservaCreada
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al procesar reserva:', error);
    res.status(500).json({ error: 'Error interno al generar la reserva' });
  } finally {
    client.release();
  }
};

// 2. Consultar reserva por código
exports.obtenerReservaPorCodigo = async (req, res) => {
  const { codigo } = req.params;
  try {
    const reservaQuery = await pool.query(`
      SELECT r.*, pv.fecha_viaje, pv.hora_salida_programada,
             f.origen, f.destino, c.nombre as cooperativa_nombre, b.numero_disco
      FROM reservas r
      JOIN programacion_viajes pv ON pv.id = r.programacion_id
      JOIN frecuencias f ON f.id = pv.frecuencia_id
      JOIN cooperativas c ON c.id = f.cooperativa_id
      JOIN buses b ON b.id = pv.bus_id
      WHERE r.codigo_reserva = $1
    `, [codigo]);

    if (reservaQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const reserva = reservaQuery.rows[0];

    const boletosQuery = await pool.query(`
      SELECT db.*, a.numero_asiento, a.categoria
      FROM detalle_boletos db
      JOIN asientos a ON a.id = db.asiento_id
      WHERE db.reserva_id = $1
    `, [reserva.id]);

    res.json({
      ...reserva,
      boletos: boletosQuery.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Subir comprobante de pago y confirmar
exports.subirComprobante = async (req, res) => {
  const { codigo } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'Debe adjuntar un archivo de comprobante' });
  }

  const comprobanteUrl = `/uploads/${req.file.filename}`;

  try {
    const update = await pool.query(`
      UPDATE reservas
      SET comprobante_url = $1, estado = 'PENDIENTE'
      WHERE codigo_reserva = $2 AND estado = 'PENDIENTE'
      RETURNING *
    `, [comprobanteUrl, codigo]);

    if (update.rows.length === 0) {
      return res.status(400).json({ error: 'Reserva inválida o ya procesada/expirada' });
    }

    res.json({
      mensaje: 'Comprobante recibido exitosamente. Queda en revisión por el oficinista.',
      reserva: update.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Descargar Boleto en PDF con QR
exports.descargarBoletoPDF = async (req, res) => {
  const { codigo, boletoId } = req.params;
  try {
    const reservaQuery = await pool.query(`
      SELECT r.*, pv.fecha_viaje, pv.hora_salida_programada,
             f.origen, f.destino, f.resolucion_ant,
             c.nombre as cooperativa_nombre, c.color_distintivo, b.numero_disco
      FROM reservas r
      JOIN programacion_viajes pv ON pv.id = r.programacion_id
      JOIN frecuencias f ON f.id = pv.frecuencia_id
      JOIN cooperativas c ON c.id = f.cooperativa_id
      JOIN buses b ON b.id = pv.bus_id
      WHERE r.codigo_reserva = $1 AND r.estado = 'PAGADO'
    `, [codigo]);

    if (reservaQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva no pagada o no encontrada' });
    }

    const boletoQuery = await pool.query(`
      SELECT db.*, a.numero_asiento, a.categoria
      FROM detalle_boletos db
      JOIN asientos a ON a.id = db.asiento_id
      WHERE db.id = $1 AND db.reserva_id = $2
    `, [boletoId, reservaQuery.rows[0].id]);

    if (boletoQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Boleto no encontrado en esta reserva' });
    }

    await ticketService.generarPDFBoleto(reservaQuery.rows[0], boletoQuery.rows[0], res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Validar boleto en puerta mediante escaneo de QR (Rol Oficinista/Conductor)
exports.validarQRBoleto = async (req, res) => {
  const { boleto_id, codigo_reserva } = req.body;
  try {
    const boletoQuery = await pool.query(`
      SELECT db.*, r.estado as estado_reserva
      FROM detalle_boletos db
      JOIN reservas r ON r.id = db.reserva_id
      WHERE db.id = $1 AND r.codigo_reserva = $2
    `, [boleto_id, codigo_reserva]);

    if (boletoQuery.rows.length === 0) {
      return res.status(404).json({ valido: false, mensaje: 'Boleto no registrado en el sistema' });
    }

    const boleto = boletoQuery.rows[0];

    if (boleto.estado_reserva !== 'PAGADO') {
      return res.status(400).json({ valido: false, mensaje: 'La reserva no se encuentra pagada' });
    }

    if (boleto.validado_en_puerta) {
      return res.status(400).json({ valido: false, mensaje: 'Este boleto ya fue utilizado para abordar' });
    }

    await pool.query('UPDATE detalle_boletos SET validado_en_puerta = TRUE WHERE id = $1', [boleto_id]);

    res.json({
      valido: true,
      mensaje: `Boleto válido. Pasajero: ${boleto.nombre_pasajero} autorizado para abordar.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
