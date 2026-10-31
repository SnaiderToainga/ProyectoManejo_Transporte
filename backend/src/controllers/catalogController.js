const db = require('../config/db');

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
      SELECT f.*, c.nombre as cooperativa_nombre, c.color_distintivo
      FROM frecuencias f
      JOIN cooperativas c ON f.cooperativa_id = c.id
      WHERE f.activo = true
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener hoja de ruta / viajes programados para una fecha
exports.getViajesProgramados = async (req, res) => {
  const { fecha } = req.query;
  try {
    const query = `
      SELECT pv.id as programacion_id, pv.fecha_viaje, pv.hora_salida_programada, pv.estado,
             f.origen, f.destino, f.precio_base, f.resolucion_ant, f.tipo_servicio,
             b.numero_disco, b.placa, b.capacidad, b.tiene_bano_posterior,
             c.nombre as cooperativa_nombre
      FROM programacion_viajes pv
      JOIN frecuencias f ON pv.frecuencia_id = f.id
      JOIN buses b ON pv.bus_id = b.id
      JOIN cooperativas c ON f.cooperativa_id = c.id
      WHERE pv.fecha_viaje = $1
      ORDER BY pv.hora_salida_programada ASC
    `;
    const result = await db.query(query, [fecha || new Date().toISOString().split('T')[0]]);
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
                  AND r.estado IN ('PAGADO', 'PENDIENTE')
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