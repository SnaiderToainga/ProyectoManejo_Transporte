const occupiedReservation = `(r.estado = 'PAGADO' OR
  (r.estado = 'PENDIENTE' AND r.expira_en > statement_timestamp()))`;

function seatIds(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (values.some(value => typeof value !== 'number' && typeof value !== 'string')) return null;
  const ids = values.map(Number);
  return ids.every(id => Number.isInteger(id) && id > 0 && id <= 2147483647)
    && new Set(ids).size === ids.length ? ids : null;
}

async function lockTrip(client, tripId) {
  const result = await client.query(
    'SELECT id, bus_id FROM programacion_viajes WHERE id = $1 FOR NO KEY UPDATE',
    [tripId]
  );
  return result.rows[0];
}

async function tripSeats(client, trip, ids) {
  const result = await client.query(
    'SELECT id, numero_asiento FROM asientos WHERE bus_id = $1 AND id = ANY($2::int[])',
    [trip.bus_id, ids]
  );
  return new Map(result.rows.map(seat => [seat.id, seat.numero_asiento]));
}

// Consultar en una sentencia separada, después de adquirir el bloqueo del viaje.
async function occupiedSeats(client, tripId, ids, excludedReservationId = null) {
  const result = await client.query(`
    SELECT DISTINCT d.asiento_id
    FROM detalle_boletos d
    JOIN reservas r ON r.id = d.reserva_id
    WHERE r.programacion_id = $1
      AND d.asiento_id = ANY($2::int[])
      AND r.id IS DISTINCT FROM $3::int
      AND ${occupiedReservation}
  `, [tripId, ids, excludedReservationId]);
  return result.rows.map(row => row.asiento_id);
}

module.exports = { lockTrip, occupiedReservation, occupiedSeats, seatIds, tripSeats };
