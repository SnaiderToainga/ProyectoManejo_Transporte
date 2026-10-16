const ticketService = require('../services/ticketService');
const db = require('../config/db');

// 1. Crear reserva temporal (Bloqueo de 5 minutos)
exports.crearReserva = async (req, res) => {
  const { programacion_id, usuario_id, asientos, pasajeros } = req.body;
  // asientos: array de IDs de asientos [1, 2]
  // pasajeros: array de objetos [{ nombre, cedula, asiento_id, precio }]

  if (!programacion_id || !asientos || asientos.length === 0) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para la reserva' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN'); // Inicia transacción atómica

    // Limpiar automáticamente reservas expiradas que quedaron pendientes
    await client.query(`
      UPDATE reservas 
      SET estado = 'CANCELADO' 
      WHERE estado = 'PENDIENTE' AND expira_en < CURRENT_TIMESTAMP
    `);

    // Validar si algún asiento solicitado ya está ocupado o reservado activo
    const checkAsientos = await client.query(`
      SELECT db.asiento_id 
      FROM detalle_boletos db
      JOIN reservas r ON r.id = db.reserva_id
      WHERE r.programacion_id = $1 
        AND db.asiento_id = ANY($2::int[])
        AND (r.estado = 'PAGADO' OR (r.estado = 'PENDIENTE' AND r.expira_en > CURRENT_TIMESTAMP))
    `, [programacion_id, asientos]);

    if (checkAsientos.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Uno o más asientos seleccionados ya no están disponibles',
        asientos_ocupados: checkAsientos.rows.map(r => r.asiento_id)
      });
    }

    // Calcular el total
    const total = pasajeros.reduce((sum, p) => sum + Number(p.precio), 0);

    // Generar código único de reserva (ej. RES-9F3A1C)
    const codigoReserva = 'RES-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Tiempo de bloqueo: 5 minutos desde ahora
    const minutosBloqueo = process.env.TIEMPO_RESERVA_MINUTOS || 5;

    // Insertar la cabecera de la reserva
    const insertReserva = await client.query(`
      INSERT INTO reservas (programacion_id, usuario_id, codigo_reserva, total, estado, expira_en)
      VALUES ($1, $2, $3, $4, 'PENDIENTE', CURRENT_TIMESTAMP + ($5 || ' minutes')::interval)
      RETURNING *
    `, [programacion_id, usuario_id || null, codigoReserva, total, minutosBloqueo]);

    const reservaCreada = insertReserva.rows[0];

    // Insertar el detalle de boletos para cada asiento
    for (const pas of pasajeros) {
      await client.query(`
        INSERT INTO detalle_boletos (reserva_id, asiento_id, nombre_pasajero, cedula_pasajero, precio)
        VALUES ($1, $2, $3, $4, $5)
      `, [reservaCreada.id, pas.asiento_id, pas.nombre, pas.cedula, pas.precio]);
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
    const reservaQuery = await db.query(`
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

    const boletosQuery = await db.query(`
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
    const update = await db.query(`
      UPDATE reservas
      SET comprobante_url = $1, estado = 'PAGADO'
      WHERE codigo_reserva = $2 AND estado = 'PENDIENTE'
      RETURNING *
    `, [comprobanteUrl, codigo]);

    if (update.rows.length === 0) {
      return res.status(400).json({ error: 'Reserva inválida o ya procesada/expirada' });
    }

    res.json({
      mensaje: 'Comprobante recibido y reserva confirmada como PAGADA',
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
    const reservaQuery = await db.query(`
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

    const boletoQuery = await db.query(`
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
    const boletoQuery = await db.query(`
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

    await db.query('UPDATE detalle_boletos SET validado_en_puerta = TRUE WHERE id = $1', [boleto_id]);

    res.json({
      valido: true,
      mensaje: `Boleto válido. Pasajero: ${boleto.nombre_pasajero} autorizado para abordar.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};