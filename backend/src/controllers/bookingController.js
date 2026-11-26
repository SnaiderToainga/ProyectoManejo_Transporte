// backend/src/controllers/bookingController.js
const crypto = require('node:crypto');
const ticketService = require('../services/ticketService');
const historyAccess = require('../services/historyAccess');
const customerAccess = require('../services/customerAccess');
const cardPaymentService = require('../services/cardPaymentService');
const { lockTrip, occupiedSeats, seatIds, tripSeats } = require('../services/seatInventory');
const db = require('../config/db');
const pool = db.pool || db;
const { quotePassengers } = require('../services/passengerFares');
const { loadReservation, notifyReservation, notifyReservationStatus } = require('../services/receiptData');
const { officeScope } = require('../services/officeAccess');

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
  const token = customerAccess.extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Abre tu sesión de cliente o usa un enlace de acceso válido enviado a tu correo' });
  }

  let customer = null;
  let email = null;

  const customerId = customerAccess.verifyCustomerToken(token);
  if (customerId) {
    customer = await customerAccess.loadAuthenticatedCustomer(customerId);
    if (customer) email = customer.email.toLowerCase();
  }

  if (!customer) {
    email = historyAccess.verifyToken(token);
  }

  if (!email && !customer) {
    return res.status(401).json({ error: 'Abre una sesión de cliente o enlace de acceso válido enviado a tu correo' });
  }

  try {
    const result = await pool.query(`
      SELECT r.id, r.codigo_reserva, r.total, r.estado, r.creado_en, r.expira_en,
             to_jsonb(r)->>'metodo_pago' AS metodo_pago,
             r.comprobante_url IS NOT NULL AS tiene_comprobante,
             c.nombre AS cooperativa_nombre, COALESCE(r.origen_tramo,f.origen) AS origen,
             COALESCE(r.destino_tramo,f.destino) AS destino, pv.fecha_viaje,
             pv.hora_salida_programada, COUNT(d.id)::int AS total_pasajeros
      FROM reservas r
      JOIN usuarios u ON u.id = r.usuario_id
      JOIN programacion_viajes pv ON pv.id = r.programacion_id
      JOIN frecuencias f ON f.id = pv.frecuencia_id
      JOIN cooperativas c ON c.id = f.cooperativa_id
      LEFT JOIN detalle_boletos d ON d.reserva_id = r.id
      WHERE ($1::int IS NOT NULL AND r.usuario_id = $1::int)
         OR LOWER(TRIM(u.correo)) = $2
      GROUP BY r.id, c.nombre, f.origen, f.destino, pv.fecha_viaje, pv.hora_salida_programada
      ORDER BY r.creado_en DESC, r.id DESC
    `, [customer?.id || null, email]);
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
  const { programacion_id, usuario_id, asientos, pasajeros, email, correo } = req.body || {};
  const emailContacto = email || correo;
  if (emailContacto && (typeof emailContacto !== 'string' || emailContacto.trim().length > 100
      || !require('../utils/validators').validarEmail(emailContacto))) {
    return res.status(400).json({ error: 'Ingresa un correo válido.' });
  }

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
    if (!trip || trip.estado !== 'PROGRAMADO' || (await tripSeats(client, trip, ids)).size !== ids.length) {
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

    // Asociar usuario priorizando sesión autenticada de cliente y luego correo en Checkout
    let finalUsuarioId = usuario_id || null;
    if (!finalUsuarioId) {
      const bearer = customerAccess.extractBearerToken(req);
      const tokenCustomerId = customerAccess.verifyCustomerToken(bearer);
      if (tokenCustomerId) {
        const authenticatedCustomer = await customerAccess.loadAuthenticatedCustomer(tokenCustomerId);
        if (authenticatedCustomer) finalUsuarioId = authenticatedCustomer.id;
      }
    }
    if (!finalUsuarioId && emailContacto) {
      const emailLimpio = emailContacto.trim().toLowerCase();
      const userCheck = await client.query('SELECT id FROM usuarios WHERE LOWER(TRIM(correo)) = $1', [emailLimpio]);
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

    // Limpiar automáticamente solo reservas expiradas SIN comprobante subido
    await client.query(`
      UPDATE reservas 
      SET estado = 'CANCELADO' 
      WHERE programacion_id = $1
        AND estado = 'PENDIENTE'
        AND comprobante_url IS NULL
        AND expira_en <= statement_timestamp()
    `, [trip.id]);

    // Calcular el total
    const total = quote.total;

    // Generar código criptográfico único de reserva (ej. RES-9F3A1C)
    const codigoReserva = 'RES-' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);

    // Tiempo de bloqueo: 5 minutos desde ahora
    const minutosBloqueo = process.env.TIEMPO_RESERVA_MINUTOS || 5;

    // Insertar la cabecera de la reserva con finalUsuarioId asociado
    const insertReserva = await client.query(`
      INSERT INTO reservas (programacion_id, usuario_id, codigo_reserva, total, estado, expira_en, origen_tramo, destino_tramo)
      VALUES ($1, $2, $3, $4, 'PENDIENTE', statement_timestamp() + ($5 || ' minutes')::interval, $6, $7)
      RETURNING *
    `, [programacion_id, finalUsuarioId, codigoReserva, total, minutosBloqueo, quote.origen, quote.destino]);

    const reservaCreada = insertReserva.rows[0];

    // Insertar el detalle de boletos para cada asiento
    for (const pas of quote.pasajeros) {
      await client.query(`
        INSERT INTO detalle_boletos (reserva_id, asiento_id, nombre_pasajero, cedula_pasajero, precio, tipo_pasajero, tarifa_base, descuento)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        reservaCreada.id, 
        pas.asiento_id, 
        pas.nombre || pas.nombre_pasajero, 
        pas.cedula || pas.cedula_pasajero, 
        pas.precio, pas.tipo_pasajero, pas.tarifa_base, pas.descuento
      ]);
    }

    await client.query('COMMIT'); // Confirmar transacción

    res.status(201).json({
      mensaje: `Reserva creada exitosamente. Asientos bloqueados por ${minutosBloqueo} minutos.`,
      reserva: reservaCreada
    });

  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status !== 400) console.error('Error al procesar reserva:', error);
    res.status(error.status === 400 ? 400 : 500).json({ error: error.status === 400 ? error.message : 'Error interno al generar la reserva' });
  } finally {
    client.release();
  }
};

// 2. Consultar reserva por código (incluye conciliación servidor-a-servidor para pagos con tarjeta)
exports.obtenerReservaPorCodigo = async (req, res) => {
  const { codigo } = req.params;
  try {
    let reserva = await loadReservation(pool, codigo);
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });

    if (
      reserva.estado === 'PENDIENTE' &&
      !reserva.comprobante_url &&
      reserva.metodo_pago === 'TARJETA' &&
      process.env.STRIPE_SECRET_KEY
    ) {
      try {
        const pendingCardRes = await pool.query(
          `SELECT provider_session_id
           FROM pagos_tarjeta
           WHERE reserva_id = $1 AND estado = 'PENDIENTE'
           ORDER BY id DESC
           LIMIT 1`,
          [reserva.id]
        );
        const pendingSessionId = pendingCardRes.rows[0]?.provider_session_id;
        if (pendingSessionId) {
          const stripeSession = await cardPaymentService.retrieveStripeCheckoutSession(pendingSessionId);
          if (stripeSession.status === 'complete' && stripeSession.payment_status === 'paid') {
            await confirmarPagoTarjetaDesdeProveedor(stripeSession, null);
            reserva = await loadReservation(pool, codigo);
          } else if (stripeSession.status === 'expired') {
            await pool.query(
              `UPDATE pagos_tarjeta
               SET estado = 'EXPIRADO', actualizado_en = statement_timestamp()
               WHERE provider_session_id = $1 AND estado = 'PENDIENTE'`,
              [pendingSessionId]
            );
          }
        }
      } catch (reconcileError) {
        console.error('Error al conciliar sesión Stripe por código:', reconcileError.message);
      }
    }

    res.set('Cache-Control', 'private, no-store');
    const { email: contactEmail, ...publicReservation } = reserva;
    res.json(publicReservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Subir comprobante de pago (TRANSFERENCIA / DEPOSITO) para revisión en taquilla
exports.subirComprobante = async (req, res) => {
  const codigo = String(req.params.codigo || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,12}$/.test(codigo)) {
    return res.status(400).json({ error: 'Código de reserva inválido.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Debe adjuntar un archivo de comprobante' });
  }

  const metodoPago = String(req.body?.metodo_pago || 'TRANSFERENCIA').trim().toUpperCase();
  if (!['TRANSFERENCIA', 'DEPOSITO'].includes(metodoPago)) {
    return res.status(400).json({ error: 'El método para comprobante debe ser TRANSFERENCIA o DEPOSITO.' });
  }

  const comprobanteUrl = `/uploads/${req.file.filename}`;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lockRes = await client.query(
      `SELECT id, estado, expira_en,
              (expira_en IS NOT NULL AND expira_en <= statement_timestamp()) AS expirada
       FROM reservas
       WHERE codigo_reserva = $1
       FOR UPDATE`,
      [codigo]
    );
    const reserva = lockRes.rows[0];
    if (!reserva) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }
    if (reserva.expirada && reserva.estado === 'PENDIENTE') {
      await client.query(`UPDATE reservas SET estado = 'CANCELADO' WHERE id = $1`, [reserva.id]);
      await client.query('COMMIT');
      return res.status(409).json({ error: 'El tiempo límite de la reserva ha expirado.' });
    }
    if (reserva.estado !== 'PENDIENTE') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La reserva ya fue procesada o cancelada.' });
    }

    const paidCardRes = await client.query(
      `SELECT 1 FROM pagos_tarjeta WHERE reserva_id = $1 AND estado = 'CONFIRMADO'`,
      [reserva.id]
    );
    if (paidCardRes.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Esta reserva ya registra un pago confirmado con tarjeta.' });
    }

    // Anula sesiones de pasarela pendientes si el cliente optó por comprobante bancario.
    await client.query(
      `UPDATE pagos_tarjeta
       SET estado = 'CANCELADO', actualizado_en = statement_timestamp()
       WHERE reserva_id = $1 AND estado = 'PENDIENTE'`,
      [reserva.id]
    );

    const update = await client.query(
      `UPDATE reservas
       SET comprobante_url = $1,
           metodo_pago = $2,
           expira_en = NULL,
           estado = 'PENDIENTE'
       WHERE id = $3 AND estado = 'PENDIENTE'
       RETURNING *`,
      [comprobanteUrl, metodoPago, reserva.id]
    );

    await client.query('COMMIT');

    // CR-14: aviso asíncrono de "comprobante en revisión" (no bloquea la respuesta ni emite boleto).
    notifyReservationStatus(pool, codigo, 'COMPROBANTE_EN_REVISION')
      .catch(err => console.error('Error al notificar comprobante:', err.message));

    res.json({
      mensaje: 'Comprobante recibido exitosamente. Queda en revisión por el oficinista.',
      reserva: update.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(error?.status || 500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// 3b. Iniciar sesión alojada de pago con tarjeta (Stripe Checkout Sandbox)
exports.iniciarPagoTarjeta = async (req, res) => {
  const codigo = String(req.params.codigo || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,12}$/.test(codigo)) {
    return res.status(400).json({ error: 'Código de reserva inválido.' });
  }

  const metodoBody = req.body?.metodo_pago;
  if (metodoBody !== undefined && String(metodoBody).trim().toUpperCase() !== 'TARJETA') {
    return res.status(400).json({ error: 'El método para pasarela debe ser TARJETA.' });
  }

  const rawKey = req.get('idempotency-key');
  if (rawKey !== undefined && /[\x00-\x1f\x7f]/.test(rawKey)) {
    return res.status(400).json({ error: 'Idempotency-Key inválida.' });
  }
  const idempotencyKey = (typeof rawKey === 'string' && rawKey.trim())
    ? rawKey.trim().slice(0, 120)
    : `cr01-${codigo}`;

  res.set('Cache-Control', 'no-store');

  let gatewayConfig;
  try {
    gatewayConfig = cardPaymentService.getGatewayConfig();
  } catch (configError) {
    return res.status(configError.status || 503).json({ error: configError.message });
  }

  let reservationSnapshot;
  const preClient = await pool.connect();
  try {
    await preClient.query('BEGIN');

    const resLock = await preClient.query(
      `SELECT r.*, u.correo AS email,
              (r.expira_en IS NOT NULL AND r.expira_en <= statement_timestamp()) AS expirada
       FROM reservas r
       LEFT JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.codigo_reserva = $1
       FOR UPDATE OF r`,
      [codigo]
    );
    const reserva = resLock.rows[0];
    if (!reserva) {
      await preClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }
    if (reserva.expirada && reserva.estado === 'PENDIENTE') {
      await preClient.query(`UPDATE reservas SET estado = 'CANCELADO' WHERE id = $1`, [reserva.id]);
      await preClient.query('COMMIT');
      return res.status(409).json({ error: 'El tiempo límite de la reserva ha expirado.' });
    }
    if (reserva.estado === 'PAGADO') {
      await preClient.query('ROLLBACK');
      return res.status(409).json({ error: 'Esta reserva ya se encuentra pagada.' });
    }
    if (reserva.estado !== 'PENDIENTE') {
      await preClient.query('ROLLBACK');
      return res.status(409).json({ error: 'Esta reserva ya no admite pagos.' });
    }
    if (reserva.comprobante_url) {
      await preClient.query('ROLLBACK');
      return res.status(409).json({ error: 'Esta reserva ya tiene un comprobante bancario en revisión.' });
    }

    const confirmedRes = await preClient.query(
      `SELECT 1 FROM pagos_tarjeta WHERE reserva_id = $1 AND estado = 'CONFIRMADO'`,
      [reserva.id]
    );
    if (confirmedRes.rowCount > 0) {
      await preClient.query('ROLLBACK');
      return res.status(409).json({ error: 'El pago con tarjeta para esta reserva ya fue confirmado.' });
    }

    const existingIdem = await preClient.query(
      `SELECT checkout_url, provider_session_id, modo, estado
       FROM pagos_tarjeta
       WHERE reserva_id = $1 AND idempotency_key = $2`,
      [reserva.id, idempotencyKey]
    );
    const prev = existingIdem.rows[0];
    if (prev && prev.estado === 'PENDIENTE') {
      const safeUrl = cardPaymentService.validateHostedCheckoutUrl(prev.checkout_url);
      await preClient.query('COMMIT');
      return res.json({
        checkout_url: safeUrl,
        session_id: prev.provider_session_id,
        metodo_pago: 'TARJETA',
        modo: prev.modo || gatewayConfig.mode,
        idempotent: true
      });
    }
    if (prev && prev.estado === 'CONFIRMADO') {
      await preClient.query('ROLLBACK');
      return res.status(409).json({ error: 'El pago con tarjeta para esta reserva ya fue confirmado.' });
    }

    reservationSnapshot = {
      id: reserva.id,
      codigo_reserva: reserva.codigo_reserva,
      total: reserva.total,
      email: reserva.email
    };
    await preClient.query('COMMIT');
  } catch (error) {
    await preClient.query('ROLLBACK');
    return res.status(error?.status || 500).json({ error: error.message });
  } finally {
    preClient.release();
  }

  let gatewaySession;
  try {
    gatewaySession = await cardPaymentService.createStripeCheckoutSession({
      reservation: reservationSnapshot,
      idempotencyKey
    });
  } catch (gwError) {
    return res.status(gwError.status || 502).json({ error: gwError.message });
  }

  const postClient = await pool.connect();
  try {
    await postClient.query('BEGIN');

    const lockAgain = await postClient.query(
      `SELECT id, estado, comprobante_url,
              (expira_en IS NOT NULL AND expira_en <= statement_timestamp()) AS expirada
       FROM reservas
       WHERE id = $1
       FOR UPDATE`,
      [reservationSnapshot.id]
    );
    const current = lockAgain.rows[0];
    if (!current || current.estado !== 'PENDIENTE' || current.expirada || current.comprobante_url) {
      await postClient.query('ROLLBACK');
      return res.status(409).json({ error: 'La reserva cambió de estado o expiró antes de registrar la sesión de pago.' });
    }

    const insertPayment = await postClient.query(
      `INSERT INTO pagos_tarjeta
         (reserva_id, codigo_reserva, proveedor, modo, idempotency_key,
          provider_session_id, provider_payment_intent_id, checkout_url,
          monto_usd, moneda, estado, payload_resumen)
       VALUES ($1, $2, 'STRIPE_SANDBOX', $3, $4, $5, $6, $7, $8, 'USD', 'PENDIENTE', $9)
       ON CONFLICT (reserva_id, idempotency_key) DO NOTHING
       RETURNING checkout_url, provider_session_id, modo`,
      [
        reservationSnapshot.id,
        reservationSnapshot.codigo_reserva,
        gatewaySession.mode,
        idempotencyKey,
        gatewaySession.sessionId,
        gatewaySession.paymentIntentId,
        gatewaySession.checkoutUrl,
        Number(reservationSnapshot.total),
        JSON.stringify(gatewaySession.rawSummary)
      ]
    );

    if (insertPayment.rowCount === 0) {
      const winnerRes = await postClient.query(
        `SELECT checkout_url, provider_session_id, modo
         FROM pagos_tarjeta
         WHERE reserva_id = $1 AND idempotency_key = $2`,
        [reservationSnapshot.id, idempotencyKey]
      );
      const winner = winnerRes.rows[0];
      await postClient.query('COMMIT');
      return res.json({
        checkout_url: cardPaymentService.validateHostedCheckoutUrl(winner.checkout_url),
        session_id: winner.provider_session_id,
        metodo_pago: 'TARJETA',
        modo: winner.modo,
        idempotent: true
      });
    }

    await postClient.query(
      `UPDATE reservas
       SET metodo_pago = 'TARJETA'
       WHERE id = $1 AND estado = 'PENDIENTE'`,
      [reservationSnapshot.id]
    );

    await postClient.query('COMMIT');

    res.status(201).json({
      checkout_url: gatewaySession.checkoutUrl,
      session_id: gatewaySession.sessionId,
      metodo_pago: 'TARJETA',
      modo: gatewaySession.mode
    });
  } catch (error) {
    await postClient.query('ROLLBACK');
    res.status(error?.status || 500).json({ error: error.message });
  } finally {
    postClient.release();
  }
};

async function confirmarPagoTarjetaDesdeProveedor(session, webhookEventId = null) {
  if (!session?.id || session.payment_status !== 'paid' || String(session.currency || '').toLowerCase() !== 'usd') {
    return { statusCode: 400, body: { error: 'Evento Stripe sin confirmación pagada en USD.' } };
  }

  const client = await pool.connect();
  let notifiedCode = null;

  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');

    const payRes = await client.query(
      `SELECT *
       FROM pagos_tarjeta
       WHERE provider_session_id = $1
       FOR UPDATE`,
      [String(session.id)]
    );
    const payment = payRes.rows[0];
    if (!payment) {
      await client.query('ROLLBACK');
      return { statusCode: 404, body: { error: 'Sesión de pago no registrada.' } };
    }

    const resLock = await client.query(
      `SELECT *
       FROM reservas
       WHERE id = $1
       FOR UPDATE`,
      [payment.reserva_id]
    );
    const reserva = resLock.rows[0];
    if (!reserva) {
      await client.query('ROLLBACK');
      return { statusCode: 404, body: { error: 'Reserva asociada no encontrada.' } };
    }

    const expectedCents = Math.round(Number(reserva.total) * 100);
    if (Number(session.amount_total) !== expectedCents) {
      await client.query(
        `UPDATE pagos_tarjeta
         SET estado = 'FALLIDO', webhook_event_id = $1, actualizado_en = statement_timestamp()
         WHERE id = $2`,
        [webhookEventId, payment.id]
      );
      await client.query('COMMIT');
      return { statusCode: 400, body: { error: 'El monto confirmado por la pasarela no coincide con la reserva.' } };
    }

    if (payment.estado === 'CONFIRMADO') {
      await client.query('COMMIT');
      return { statusCode: 200, body: { received: true, already_processed: true } };
    }

    if (reserva.estado !== 'PENDIENTE' || reserva.comprobante_url || payment.estado === 'CANCELADO') {
      await client.query(
        `UPDATE pagos_tarjeta
         SET estado = 'FALLIDO', webhook_event_id = $1, actualizado_en = statement_timestamp()
         WHERE id = $2`,
        [webhookEventId, payment.id]
      );
      await client.query('COMMIT');
      return {
        statusCode: 409,
        body: { error: 'Conflicto de doble liquidación: la reserva ya fue procesada o cancelada por otro medio.' }
      };
    }

    const trip = await lockTrip(client, reserva.programacion_id);
    const boletosRes = await client.query(
      `SELECT id, asiento_id, cedula_pasajero, codigo_qr
       FROM detalle_boletos
       WHERE reserva_id = $1`,
      [reserva.id]
    );
    const ids = seatIds(boletosRes.rows.map(b => b.asiento_id));
    const occupied = trip && ids ? await occupiedSeats(client, trip.id, ids, reserva.id) : [1];
    if (!trip || !ids || occupied.length > 0) {
      await client.query(
        `UPDATE pagos_tarjeta
         SET estado = 'FALLIDO', webhook_event_id = $1, actualizado_en = statement_timestamp()
         WHERE id = $2`,
        [webhookEventId, payment.id]
      );
      await client.query('COMMIT');
      return {
        statusCode: 409,
        body: { error: 'Uno o más asientos fueron ocupados tras vencer el tiempo de retención.' }
      };
    }

    await client.query(
      `UPDATE pagos_tarjeta
       SET estado = 'CONFIRMADO',
           provider_payment_intent_id = COALESCE($1, provider_payment_intent_id),
           webhook_event_id = COALESCE($2, webhook_event_id),
           confirmado_en = statement_timestamp(),
           actualizado_en = statement_timestamp()
       WHERE id = $3`,
      [typeof session.payment_intent === 'string' ? session.payment_intent : null, webhookEventId, payment.id]
    );

    await client.query(
      `UPDATE reservas
       SET estado = 'PAGADO',
           metodo_pago = 'TARJETA',
           expira_en = NULL,
           comprado_en = statement_timestamp()
       WHERE id = $1`,
      [reserva.id]
    );

    for (const boleto of boletosRes.rows) {
      if (!boleto.codigo_qr) {
        const qrToken = `QR-${reserva.codigo_reserva}-${boleto.cedula_pasajero}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        await client.query(`UPDATE detalle_boletos SET codigo_qr = $1 WHERE id = $2`, [qrToken, boleto.id]);
      }
    }

    notifiedCode = reserva.codigo_reserva;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al confirmar pago tarjeta Stripe:', error.message);
    return { statusCode: error?.status || 500, body: { error: error.message } };
  } finally {
    client.release();
  }

  if (notifiedCode) {
    notifyReservation(pool, notifiedCode).catch((err) =>
      console.error('Error al notificar boleto tras pago tarjeta:', err.message)
    );
  }

  return {
    statusCode: 200,
    body: {
      received: true,
      estado: 'PAGADO',
      codigo_reserva: notifiedCode
    }
  };
}

// 3c. Webhook servidor-a-servidor de Stripe Sandbox (firma HMAC sobre raw body)
exports.procesarWebhookStripe = async (req, res) => {
  let event;
  try {
    event = cardPaymentService.verifyStripeWebhookSignature(req.body, req.get('stripe-signature'));
  } catch (sigError) {
    return res.status(sigError.status || 400).json({ error: sigError.message });
  }

  const eventType = String(event?.type || '');
  const session = event?.data?.object || {};

  if (eventType === 'checkout.session.expired' && session.id) {
    try {
      await pool.query(
        `UPDATE pagos_tarjeta
         SET estado = 'EXPIRADO',
             webhook_event_id = $1,
             actualizado_en = statement_timestamp()
         WHERE provider_session_id = $2 AND estado = 'PENDIENTE'`,
        [event.id || null, String(session.id)]
      );
      return res.json({ received: true, estado: 'EXPIRADO' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (eventType !== 'checkout.session.completed' && eventType !== 'checkout.session.async_payment_succeeded') {
    return res.json({ received: true, ignored: eventType || 'unknown' });
  }

  const outcome = await confirmarPagoTarjetaDesdeProveedor(session, event.id || null);
  return res.status(outcome.statusCode).json(outcome.body);
};

// 4. Descargar Boleto en PDF con QR
exports.descargarBoletoPDF = async (req, res) => {
  const { codigo, boletoId } = req.params;
  try {
    const reserva = await loadReservation(pool, codigo);
    if (!reserva || reserva.estado !== 'PAGADO') return res.status(404).json({ error: 'Reserva no pagada o no encontrada' });
    const boleto = reserva.boletos.find(b => String(b.id) === String(boletoId));
    if (!boleto) return res.status(404).json({ error: 'Boleto no encontrado en esta reserva' });
    res.set('Cache-Control', 'private, no-store');
    await ticketService.generarPDFBoleto(reserva, boleto, res);
  } catch (error) {
    if (res.headersSent) return res.destroy(error);
    res.status(500).json({ error: 'No se pudo generar el boleto.' });
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
      JOIN programacion_viajes pv ON pv.id=r.programacion_id
      JOIN frecuencias f ON f.id=pv.frecuencia_id
      JOIN buses b ON b.id=pv.bus_id
      WHERE db.id = $1 AND r.codigo_reserva = $2
        AND ($3::boolean OR (f.cooperativa_id=$4::int AND b.cooperativa_id=$4::int))
    `, [boleto_id, codigo_reserva, ...officeScope(req)]);

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

    const marked = await pool.query(`UPDATE detalle_boletos SET validado_en_puerta = TRUE
      WHERE id = $1 AND validado_en_puerta=FALSE RETURNING id`, [boleto_id]);
    if (!marked.rowCount) return res.status(409).json({ valido: false, mensaje: 'Este boleto ya fue utilizado para abordar' });

    res.json({
      valido: true,
      mensaje: `Boleto válido. Pasajero: ${boleto.nombre_pasajero} autorizado para abordar.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
