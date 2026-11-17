const db = require('../config/db');
const { occupiedReservation } = require('../services/seatInventory');

// Obtener todas las cooperativas
exports.getCooperativas = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM cooperativas WHERE activo = true');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener frecuencias con información de cooperativa
exports.getFrecuencias = async (req, res) => {
  try {
    const query = `
      SELECT f.*,
             (f.es_destacada = true AND (f.patrocinio_fin IS NULL OR f.patrocinio_fin >= CURRENT_TIMESTAMP)) AS patrocinio_activo,
             c.nombre as cooperativa_nombre, c.color_distintivo, c.logo_url
      FROM frecuencias f
      JOIN cooperativas c ON f.cooperativa_id = c.id
      WHERE f.activo = true
      ORDER BY (f.es_destacada = true AND (f.patrocinio_fin IS NULL OR f.patrocinio_fin >= CURRENT_TIMESTAMP)) DESC, f.id ASC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener hoja de ruta / viajes programados para una fecha
// Obtener hoja de ruta / viajes programados para una fecha con auto-programación diaria
exports.getViajesProgramados = async (req, res) => {
  const fecha = req.query.fecha || new Date().toISOString().split('T')[0];
  try {
    // 1. Verificar si ya existen viajes programados para la fecha solicitada
    const checkQuery = await db.query(
      'SELECT COUNT(*)::int as count FROM programacion_viajes WHERE fecha_viaje = $1',
      [fecha]
    );

    // 2. Si no existen, auto-generar la hoja de ruta del día a partir de las frecuencias autorizadas por la ANT
    if (checkQuery.rows[0].count === 0) {
      await db.query(`
        INSERT INTO programacion_viajes (frecuencia_id, bus_id, fecha_viaje, hora_salida_programada, estado)
        SELECT 
          f.id,
          CASE 
            WHEN f.id = 4 THEN 3 -- Pelileo Express (Bus 3 de 40 asientos)
            WHEN f.id = 2 THEN 2 -- CITA Carcelén (Bus 2 de 41 asientos)
            ELSE 1               -- CITA Quitumbe / Guayaquil (Bus 1 de 40 asientos)
          END as bus_id,
          $1::date,
          f.hora_salida,
          'PROGRAMADO'
        FROM frecuencias f
        WHERE f.activo = true
        ON CONFLICT (bus_id, fecha_viaje, hora_salida_programada) DO NOTHING
      `, [fecha]);
    }

    // 3. Consultar y retornar los viajes programados
    const query = `
      SELECT pv.id as programacion_id, pv.fecha_viaje, pv.hora_salida_programada, pv.estado,
             f.origen, f.destino, f.precio_base, f.resolucion_ant, f.tipo_servicio,
             (f.es_destacada = true AND (f.patrocinio_fin IS NULL OR f.patrocinio_fin >= CURRENT_TIMESTAMP)) AS es_destacada,
             f.patrocinio_inicio, f.patrocinio_fin,
             f.paradas_intermedias,
             b.numero_disco, b.placa, b.capacidad, b.tiene_bano_posterior,
             c.nombre as cooperativa_nombre, c.color_distintivo, c.logo_url
      FROM programacion_viajes pv
      JOIN frecuencias f ON pv.frecuencia_id = f.id
      JOIN buses b ON pv.bus_id = b.id
      JOIN cooperativas c ON f.cooperativa_id = c.id
      WHERE pv.fecha_viaje = $1
      ORDER BY (f.es_destacada = true AND (f.patrocinio_fin IS NULL OR f.patrocinio_fin >= CURRENT_TIMESTAMP)) DESC, pv.hora_salida_programada ASC
    `;
    const result = await db.query(query, [fecha]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener asientos y su disponibilidad para un viaje
exports.getAsientosPorViaje = async (req, res) => {
  const { programacionId } = req.params;
  try {
    const query = `
      SELECT a.id as asiento_id,
            a.numero_asiento,
            a.fila,
            a.columna,
            a.categoria,
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM detalle_boletos db
                JOIN reservas r ON r.id = db.reserva_id
                WHERE db.asiento_id = a.id
                  AND r.programacion_id = pv.id
                  AND ${occupiedReservation}
              )
              THEN 'OCUPADO'
              ELSE 'DISPONIBLE'
            END as estado_ocupacion
      FROM programacion_viajes pv
      JOIN asientos a ON a.bus_id = pv.bus_id
      WHERE pv.id = $1
      ORDER BY a.numero_asiento ASC
    `;
    const result = await db.query(query, [programacionId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
