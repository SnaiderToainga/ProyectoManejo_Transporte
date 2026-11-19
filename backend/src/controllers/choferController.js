const db = require('../config/db');

// 1. Obtener viajes del chofer (viajes de hoy o activos)
exports.obtenerViajesChofer = async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];

    // Asegurar que existan viajes para la fecha solicitada
    const checkQuery = await db.query(
      'SELECT COUNT(*)::int as count FROM programacion_viajes WHERE fecha_viaje = $1',
      [fecha]
    );

    if (checkQuery.rows[0].count === 0) {
      // Auto-generar hoja de ruta base para la fecha si aún no existe
      await db.query(`
        INSERT INTO programacion_viajes (frecuencia_id, bus_id, fecha_viaje, hora_salida_programada, estado)
        SELECT 
          f.id,
          CASE 
            WHEN f.id = 4 THEN 3
            WHEN f.id = 2 THEN 2
            WHEN f.id = 1 THEN 1
            ELSE 1
          END as bus_id,
          $1::date,
          f.hora_salida,
          'PROGRAMADO'
        FROM frecuencias f
        ON CONFLICT DO NOTHING
      `, [fecha]);
    }

    let whereConditions = ['pv.fecha_viaje = $1'];
    let queryParams = [fecha];

    if (req.query.cooperativa_id) {
      queryParams.push(req.query.cooperativa_id);
      whereConditions.push(`c.id = $${queryParams.length}`);
    }

    if (req.query.bus_id) {
      queryParams.push(req.query.bus_id);
      whereConditions.push(`b.id = $${queryParams.length}`);
    } else if (req.query.disco) {
      queryParams.push(req.query.disco);
      whereConditions.push(`b.numero_disco = $${queryParams.length}`);
    }

    const query = `
      SELECT 
        pv.id,
        pv.fecha_viaje,
        pv.hora_salida_programada,
        pv.estado,
        f.origen,
        f.destino,
        f.resolucion_ant,
        f.paradas_intermedias,
        f.precio_base as tarifa_base,
        f.es_destacada,
        b.numero_disco,
        b.placa,
        b.capacidad as capacidad_asientos,
        b.tiene_bano_posterior,
        c.id as cooperativa_id,
        c.nombre as cooperativa_nombre,
        c.logo_url,
        COALESCE(stats.total_boletos, 0)::int as total_boletos,
        COALESCE(stats.boletos_validados, 0)::int as boletos_validados
      FROM programacion_viajes pv
      JOIN frecuencias f ON pv.frecuencia_id = f.id
      JOIN buses b ON pv.bus_id = b.id
      JOIN cooperativas c ON f.cooperativa_id = c.id
      LEFT JOIN (
        SELECT 
          r.programacion_id,
          COUNT(db.id) as total_boletos,
          COUNT(CASE WHEN db.validado_en_puerta = TRUE THEN 1 END) as boletos_validados
        FROM reservas r
        JOIN detalle_boletos db ON db.reserva_id = r.id
        WHERE r.estado = 'PAGADO'
        GROUP BY r.programacion_id
      ) stats ON stats.programacion_id = pv.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY 
        CASE pv.estado 
          WHEN 'EN_RUTA' THEN 1 
          WHEN 'PROGRAMADO' THEN 2 
          ELSE 3 
        END,
        pv.hora_salida_programada ASC
    `;

    const result = await db.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener viajes del chofer:', error);
    res.status(500).json({ error: 'Error al consultar viajes del chofer' });
  }
};

// 2. Obtener manifiesto de pasajeros de un viaje específico
exports.obtenerManifiestoViaje = async (req, res) => {
  const { id } = req.params;
  try {
    const viajeQuery = await db.query(`
      SELECT 
        pv.id, pv.fecha_viaje, pv.hora_salida_programada, pv.estado,
        f.origen, f.destino, f.resolucion_ant, f.paradas_intermedias,
        b.numero_disco, b.placa, b.capacidad as capacidad_asientos,
        c.nombre as cooperativa_nombre, c.logo_url
      FROM programacion_viajes pv
      JOIN frecuencias f ON pv.frecuencia_id = f.id
      JOIN buses b ON pv.bus_id = b.id
      JOIN cooperativas c ON f.cooperativa_id = c.id
      WHERE pv.id = $1
    `, [id]);

    if (viajeQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }

    const pasajerosQuery = await db.query(`
      SELECT 
        db.id as boleto_id,
        db.nombre_pasajero,
        db.cedula_pasajero,
        db.precio,
        db.codigo_qr,
        COALESCE(db.validado_en_puerta, FALSE) as validado_en_puerta,
        a.numero_asiento,
        r.id as reserva_id,
        r.codigo_reserva,
        r.estado as estado_reserva,
        r.creado_en as fecha_compra
      FROM detalle_boletos db
      JOIN reservas r ON r.id = db.reserva_id
      JOIN asientos a ON a.id = db.asiento_id
      WHERE r.programacion_id = $1 AND r.estado = 'PAGADO'
      ORDER BY a.numero_asiento ASC
    `, [id]);

    const viaje = viajeQuery.rows[0];
    const pasajeros = pasajerosQuery.rows;
    const total_validados = pasajeros.filter(p => p.validado_en_puerta).length;

    res.json({
      viaje,
      pasajeros,
      resumen: {
        total_pasajeros: pasajeros.length,
        validados: total_validados,
        pendientes: pasajeros.length - total_validados,
        capacidad: viaje.capacidad_asientos
      }
    });
  } catch (error) {
    console.error('Error al obtener manifiesto del viaje:', error);
    res.status(500).json({ error: 'Error al consultar manifiesto de pasajeros' });
  }
};

// 3. Iniciar Viaje (Requerimiento RUTA-16 del Docente)
exports.iniciarViaje = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT * FROM programacion_viajes WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }

    if (check.rows[0].estado === 'FINALIZADO') {
      return res.status(400).json({ error: 'Este viaje ya fue finalizado previamente' });
    }

    const update = await db.query(`
      UPDATE programacion_viajes 
      SET estado = 'EN_RUTA' 
      WHERE id = $1 
      RETURNING *
    `, [id]);

    res.json({
      success: true,
      mensaje: '¡Viaje iniciado con éxito! Estado actualizado a EN RUTA.',
      viaje: update.rows[0]
    });
  } catch (error) {
    console.error('Error al iniciar viaje:', error);
    res.status(500).json({ error: 'No se pudo iniciar el viaje' });
  }
};

// 4. Finalizar Viaje (Requerimiento RUTA-16 del Docente)
exports.finalizarViaje = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db.query('SELECT * FROM programacion_viajes WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }

    const update = await db.query(`
      UPDATE programacion_viajes 
      SET estado = 'FINALIZADO' 
      WHERE id = $1 
      RETURNING *
    `, [id]);

    res.json({
      success: true,
      mensaje: '¡Viaje finalizado con éxito! El servicio ha concluido.',
      viaje: update.rows[0]
    });
  } catch (error) {
    console.error('Error al finalizar viaje:', error);
    res.status(500).json({ error: 'No se pudo finalizar el viaje' });
  }
};

// 5. Validar Boleto en Puerta mediante QR / Escaneo (Requerimiento VENT-05)
exports.validarBoletoPuerta = async (req, res) => {
  const { qr_payload, boleto_id, codigo_reserva, numero_asiento, programacion_id } = req.body;

  try {
    let queryConditions = [];
    let queryParams = [];

    // Parsear payload de QR si viene como texto o URL
    let reservaBuscada = codigo_reserva;
    let asientoBuscado = numero_asiento;
    let qrTokenBuscado = null;

    if (qr_payload && typeof qr_payload === 'string') {
      const trimmed = qr_payload.trim();

      // Caso 1: URL con parámetros (?reserva=RES-XXX&asiento=Y)
      if (trimmed.includes('reserva=') || trimmed.includes('asiento=')) {
        try {
          const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://dummy.com/${trimmed.replace(/^\//, '')}`);
          reservaBuscada = urlObj.searchParams.get('reserva') || reservaBuscada;
          asientoBuscado = urlObj.searchParams.get('asiento') || asientoBuscado;
        } catch {
          // Si falla parseo de URL, extraer con Regex
          const matchRes = trimmed.match(/reserva=([A-Z0-9-]+)/i);
          const matchAsi = trimmed.match(/asiento=([0-9]+)/i);
          if (matchRes) reservaBuscada = matchRes[1];
          if (matchAsi) asientoBuscado = matchAsi[1];
        }
      } else if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        // Caso 2: Objeto JSON en QR
        try {
          const parsed = JSON.parse(trimmed);
          reservaBuscada = parsed.codigo_reserva || parsed.reserva || reservaBuscada;
          asientoBuscado = parsed.numero_asiento || parsed.asiento || asientoBuscado;
        } catch {
          qrTokenBuscado = trimmed;
        }
      } else {
        // Caso 3: Token alfanumérico o código directo
        qrTokenBuscado = trimmed;
      }
    }

    let boletoQuery;

    if (boleto_id) {
      boletoQuery = await db.query(`
        SELECT db.*, r.codigo_reserva, r.estado as estado_reserva, r.programacion_id,
               a.numero_asiento, f.origen, f.destino, pv.fecha_viaje, pv.hora_salida_programada
        FROM detalle_boletos db
        JOIN reservas r ON r.id = db.reserva_id
        JOIN asientos a ON a.id = db.asiento_id
        JOIN programacion_viajes pv ON pv.id = r.programacion_id
        JOIN frecuencias f ON f.id = pv.frecuencia_id
        WHERE db.id = $1
      `, [boleto_id]);
    } else if (reservaBuscada && asientoBuscado) {
      boletoQuery = await db.query(`
        SELECT db.*, r.codigo_reserva, r.estado as estado_reserva, r.programacion_id,
               a.numero_asiento, f.origen, f.destino, pv.fecha_viaje, pv.hora_salida_programada
        FROM detalle_boletos db
        JOIN reservas r ON r.id = db.reserva_id
        JOIN asientos a ON a.id = db.asiento_id
        JOIN programacion_viajes pv ON pv.id = r.programacion_id
        JOIN frecuencias f ON f.id = pv.frecuencia_id
        WHERE UPPER(r.codigo_reserva) = UPPER($1) AND a.numero_asiento = $2
      `, [reservaBuscada, asientoBuscado]);
    } else if (qrTokenBuscado) {
      boletoQuery = await db.query(`
        SELECT db.*, r.codigo_reserva, r.estado as estado_reserva, r.programacion_id,
               a.numero_asiento, f.origen, f.destino, pv.fecha_viaje, pv.hora_salida_programada
        FROM detalle_boletos db
        JOIN reservas r ON r.id = db.reserva_id
        JOIN asientos a ON a.id = db.asiento_id
        JOIN programacion_viajes pv ON pv.id = r.programacion_id
        JOIN frecuencias f ON f.id = pv.frecuencia_id
        WHERE db.codigo_qr = $1 OR UPPER(r.codigo_reserva) = UPPER($1)
      `, [qrTokenBuscado]);
    } else if (reservaBuscada) {
      boletoQuery = await db.query(`
        SELECT db.*, r.codigo_reserva, r.estado as estado_reserva, r.programacion_id,
               a.numero_asiento, f.origen, f.destino, pv.fecha_viaje, pv.hora_salida_programada
        FROM detalle_boletos db
        JOIN reservas r ON r.id = db.reserva_id
        JOIN asientos a ON a.id = db.asiento_id
        JOIN programacion_viajes pv ON pv.id = r.programacion_id
        JOIN frecuencias f ON f.id = pv.frecuencia_id
        WHERE UPPER(r.codigo_reserva) = UPPER($1)
        LIMIT 1
      `, [reservaBuscada]);
    }

    if (!boletoQuery || boletoQuery.rows.length === 0) {
      return res.status(404).json({
        valido: false,
        mensaje: 'Código QR no reconocido o boleto inexistente en el sistema.'
      });
    }

    const boleto = boletoQuery.rows[0];

    // Validar estado de la reserva
    if (boleto.estado_reserva !== 'PAGADO') {
      return res.status(400).json({
        valido: false,
        mensaje: `La reserva ${boleto.codigo_reserva} se encuentra en estado '${boleto.estado_reserva}' (no está pagada).`,
        pasajero: boleto.nombre_pasajero,
        asiento: boleto.numero_asiento
      });
    }

    // Validar concordancia con el viaje si se envía programacion_id
    if (programacion_id && String(boleto.programacion_id) !== String(programacion_id)) {
      const fechaBoleto = boleto.fecha_viaje ? new Date(boleto.fecha_viaje).toISOString().split('T')[0] : '';
      const horaBoleto = boleto.hora_salida_programada ? boleto.hora_salida_programada.slice(0, 5) : '';
      return res.status(400).json({
        valido: false,
        mensaje: `Este boleto fue emitido para el turno del ${fechaBoleto} a las ${horaBoleto} (${boleto.origen} ➔ ${boleto.destino}), no corresponde a este turno actual.`,
        pasajero: boleto.nombre_pasajero,
        asiento: boleto.numero_asiento
      });
    }

    // Validar si ya fue utilizado (Prevención de fraude de doble abordaje)
    if (boleto.validado_en_puerta) {
      return res.status(409).json({
        valido: false,
        ya_usado: true,
        mensaje: `¡ATENCIÓN! Este boleto ya fue validado previamente para abordar.`,
        pasajero: boleto.nombre_pasajero,
        cedula: boleto.cedula_pasajero,
        asiento: boleto.numero_asiento,
        codigo_reserva: boleto.codigo_reserva
      });
    }

    // Registrar abordaje en puerta
    await db.query(`
      UPDATE detalle_boletos 
      SET validado_en_puerta = TRUE 
      WHERE id = $1
    `, [boleto.id]);

    res.json({
      valido: true,
      mensaje: `¡Abordaje Autorizado! Pasajero verificado con éxito.`,
      boleto_id: boleto.id,
      pasajero: boleto.nombre_pasajero,
      cedula: boleto.cedula_pasajero,
      asiento: boleto.numero_asiento,
      codigo_reserva: boleto.codigo_reserva,
      ruta: `${boleto.origen} ➔ ${boleto.destino}`
    });
  } catch (error) {
    console.error('Error al validar QR en puerta:', error);
    res.status(500).json({ error: 'Error interno al validar el código QR' });
  }
};

// 6. Alternar abordaje manual (por contingencia si el pasajero no tiene celular)
exports.toggleAbordajeManual = async (req, res) => {
  const { boleto_id } = req.params;
  try {
    const boleto = await db.query('SELECT * FROM detalle_boletos WHERE id = $1', [boleto_id]);
    if (boleto.rows.length === 0) {
      return res.status(404).json({ error: 'Boleto no encontrado' });
    }

    const nuevoEstado = !boleto.rows[0].validado_en_puerta;
    await db.query('UPDATE detalle_boletos SET validado_en_puerta = $1 WHERE id = $2', [nuevoEstado, boleto_id]);

    res.json({
      success: true,
      validado_en_puerta: nuevoEstado,
      mensaje: nuevoEstado ? 'Pasajero marcado como abordado manualmente.' : 'Abordaje desmarcado.'
    });
  } catch (error) {
    console.error('Error al alternar abordaje manual:', error);
    res.status(500).json({ error: 'Error al cambiar estado de abordaje' });
  }
};
