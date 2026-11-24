async function loadReservation(pool, code) {
  const { rows: [reservation] } = await pool.query(`SELECT r.*, pv.fecha_viaje, pv.hora_salida_programada,
    COALESCE(r.origen_tramo,f.origen) AS origen, COALESCE(r.destino_tramo,f.destino) AS destino,
    f.resolucion_ant, c.nombre AS cooperativa_nombre, c.color_distintivo, b.numero_disco,
    u.correo AS email
    FROM reservas r JOIN programacion_viajes pv ON pv.id=r.programacion_id
    JOIN frecuencias f ON f.id=pv.frecuencia_id JOIN cooperativas c ON c.id=f.cooperativa_id
    JOIN buses b ON b.id=pv.bus_id LEFT JOIN usuarios u ON u.id=r.usuario_id
    WHERE r.codigo_reserva=$1`, [code]);
  if (!reservation) return null;
  const { rows } = await pool.query(`SELECT d.*, a.numero_asiento, a.categoria
    FROM detalle_boletos d JOIN asientos a ON a.id=d.asiento_id
    WHERE d.reserva_id=$1 ORDER BY a.numero_asiento, d.id`, [reservation.id]);
  return { ...reservation, boletos: rows };
}

async function notifyReservation(pool, code) {
  const reservation = await loadReservation(pool, code);
  if (!reservation?.email || reservation.estado !== 'PAGADO') return;
  return require('./emailService').enviarBoletoEmail({
    emailDestinatario: reservation.email, cooperativa: reservation.cooperativa_nombre,
    origen: reservation.origen, destino: reservation.destino,
    fecha: reservation.fecha_viaje instanceof Date ? reservation.fecha_viaje.toISOString().slice(0,10) : String(reservation.fecha_viaje).slice(0,10),
    hora: reservation.hora_salida_programada, comprado_en: reservation.comprado_en,
    creado_en: reservation.creado_en, boletos: reservation.boletos,
    asientos: reservation.boletos.map(b => b.numero_asiento), total: reservation.total, reservaId: code
  });
}
module.exports = { loadReservation, notifyReservation };
