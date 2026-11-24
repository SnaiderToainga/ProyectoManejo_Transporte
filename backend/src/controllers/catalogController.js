const db = require('../config/db');
const { occupiedReservation } = require('../services/seatInventory');
const { getBusLayout, enrichSeatsWithLayout } = require('../services/busLayoutStore');

function ecuadorToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
}

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
             (f.es_destacada = true
              AND (f.patrocinio_inicio IS NULL OR f.patrocinio_inicio <= CURRENT_TIMESTAMP)
              AND (f.patrocinio_fin IS NULL OR f.patrocinio_fin >= CURRENT_TIMESTAMP)) AS patrocinio_activo,
             c.nombre as cooperativa_nombre, c.color_distintivo, c.logo_url
      FROM frecuencias f
      JOIN cooperativas c ON f.cooperativa_id = c.id
      WHERE f.activo = true AND c.activo = true
      ORDER BY (f.es_destacada = true
                AND (f.patrocinio_inicio IS NULL OR f.patrocinio_inicio <= CURRENT_TIMESTAMP)
                AND (f.patrocinio_fin IS NULL OR f.patrocinio_fin >= CURRENT_TIMESTAMP)) DESC, f.id ASC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Consultar la programación publicada desde la matriz de hojas de ruta.
exports.getViajesProgramados = async (req, res) => {
  const fecha = req.query.fecha || ecuadorToday();
  try {
    const query = `
      SELECT pv.id as programacion_id, pv.bus_id, pv.fecha_viaje, pv.hora_salida_programada, pv.estado,
             f.origen, f.destino, f.precio_base, f.resolucion_ant, f.tipo_servicio,
             (f.es_destacada = true
              AND (f.patrocinio_inicio IS NULL OR f.patrocinio_inicio <= CURRENT_TIMESTAMP)
              AND (f.patrocinio_fin IS NULL OR f.patrocinio_fin >= CURRENT_TIMESTAMP)) AS es_destacada,
             f.patrocinio_inicio, f.patrocinio_fin,
             f.paradas_intermedias,
             b.numero_disco, b.placa, b.capacidad, b.tiene_bano_posterior,
             NULLIF(BTRIM(to_jsonb(b)->>'marca_chasis'), '') AS marca_chasis,
             NULLIF(BTRIM(to_jsonb(b)->>'carroceria'), '') AS carroceria,
             NULLIF(BTRIM(to_jsonb(b)->>'socio_nombre'), '') AS socio_nombre,
             NULLIF(BTRIM(to_jsonb(b)->>'foto_url'), '') AS foto_url,
             COALESCE(
               NULLIF(to_jsonb(b)->'fotos', '[]'::jsonb),
               CASE
                 WHEN NULLIF(BTRIM(to_jsonb(b)->>'foto_url'), '') IS NOT NULL
                   THEN jsonb_build_array(BTRIM(to_jsonb(b)->>'foto_url'))
                 ELSE '[]'::jsonb
               END
             ) AS fotos,
             disponibilidad.asientos_disponibles,
             disponibilidad.asientos_disponibles_normal,
             disponibilidad.asientos_disponibles_vip,
             c.nombre as cooperativa_nombre, c.color_distintivo, c.logo_url
      FROM programacion_viajes pv
      JOIN frecuencias f ON pv.frecuencia_id = f.id
      JOIN buses b ON pv.bus_id = b.id
      JOIN cooperativas c ON f.cooperativa_id = c.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS asientos_disponibles,
               COUNT(*) FILTER (WHERE a.categoria = 'NORMAL')::int AS asientos_disponibles_normal,
               COUNT(*) FILTER (WHERE a.categoria = 'VIP')::int AS asientos_disponibles_vip
        FROM asientos a
        WHERE a.bus_id = b.id AND a.activo IS DISTINCT FROM false
          AND NOT EXISTS (
            SELECT 1 FROM detalle_boletos db
            JOIN reservas r ON r.id = db.reserva_id
            WHERE db.asiento_id = a.id AND r.programacion_id = pv.id
              AND ${occupiedReservation}
          )
      ) disponibilidad ON true
      WHERE pv.fecha_viaje = $1 AND pv.estado <> 'CANCELADO' AND f.activo = true AND c.activo = true
      ORDER BY (f.es_destacada = true
                AND (f.patrocinio_inicio IS NULL OR f.patrocinio_inicio <= CURRENT_TIMESTAMP)
                AND (f.patrocinio_fin IS NULL OR f.patrocinio_fin >= CURRENT_TIMESTAMP)) DESC,
               pv.hora_salida_programada ASC
    `;
    const result = await db.query(query, [fecha]);
    const enriched = result.rows.map((row) => {
      const layout = getBusLayout(row.bus_id);
      if (!layout) return row;
      return {
        ...row,
        bus_layout: {
          plantilla_id: layout.plantilla_id,
          plantilla_nombre: layout.plantilla_nombre,
          pisos: layout.pisos,
          capacidad_total: layout.capacidad_total,
          capacidad_piso1: layout.capacidad_piso1,
          columnas: layout.columnas,
          columnas_piso2: layout.columnas_piso2,
          pasillo_despues_col: layout.pasillo_despues_col,
          pasillo_despues_col_piso2: layout.pasillo_despues_col_piso2,
          celdasBano: layout.celdasBano || [],
          celdasBloqueadas: layout.celdasBloqueadas || []
        }
      };
    });
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener asientos y su disponibilidad para un viaje
exports.getAsientosPorViaje = async (req, res) => {
  const { programacionId } = req.params;
  try {
    const query = `
      SELECT pv.bus_id,
            a.id as asiento_id,
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
      WHERE pv.id = $1 AND a.activo IS DISTINCT FROM false
      ORDER BY a.numero_asiento ASC
    `;
    const result = await db.query(query, [programacionId]);
    if (result.rows.length === 0) return res.json([]);
    const busId = result.rows[0].bus_id;
    const { seats } = enrichSeatsWithLayout(result.rows, busId);
    res.json(seats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
