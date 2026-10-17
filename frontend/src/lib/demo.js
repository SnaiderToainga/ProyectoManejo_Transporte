// Datos ficticios disponibles únicamente al abrir ?demo=1. Nunca sustituyen un error de la API.
const reservations = new Map();
const trips = [
  { programacion_id: 1, origen: 'Ambato', destino: 'Quito (Quitumbe)', hora_salida_programada: '07:00:00', precio_base: '4.50', capacidad: 40, tiene_bano_posterior: true, cooperativa_nombre: 'Cooperativa de Transportes CITA', numero_disco: 15, placa: 'DEMO-015', resolucion_ant: 'EJEMPLO', estado: 'PROGRAMADO' },
  { programacion_id: 2, origen: 'Ambato', destino: 'Quito (Carcelén)', hora_salida_programada: '08:30:00', precio_base: '5.00', capacidad: 41, tiene_bano_posterior: false, cooperativa_nombre: 'Cooperativa de Transportes CITA', numero_disco: 18, placa: 'DEMO-018', resolucion_ant: 'EJEMPLO', estado: 'PROGRAMADO' },
  { programacion_id: 3, origen: 'Ambato', destino: 'Guayaquil', hora_salida_programada: '10:00:00', precio_base: '9.00', capacidad: 40, tiene_bano_posterior: true, cooperativa_nombre: 'Flota Pelileo Express', numero_disco: 5, placa: 'DEMO-005', resolucion_ant: 'EJEMPLO', estado: 'PROGRAMADO' },
];
export const demoApi = {
  trips: async (date) => trips.map(trip => ({ ...trip, fecha_viaje: date })),
  cooperatives: async () => [...new Set(trips.map(t => t.cooperativa_nombre))].map((nombre, i) => ({ id: i + 1, nombre })),
  seats: async (id) => {
    const trip = trips.find(t => t.programacion_id === Number(id));
    return Array.from({ length: trip?.capacidad || 40 }, (_, index) => ({
      asiento_id: Number(id) * 100 + index + 1, numero_asiento: index + 1,
      categoria: index < 8 ? 'VIP' : 'NORMAL', estado_ocupacion: [11, 12, 19, 20, 29].includes(index + 1) ? 'OCUPADO' : 'DISPONIBLE',
    }));
  },
  reserve: async (payload) => {
    const trip = trips.find(t => t.programacion_id === Number(payload.programacion_id));
    const codigo_reserva = `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const reserva = { ...trip, id: Date.now(), codigo_reserva, estado: 'PENDIENTE', total: payload.pasajeros.reduce((sum, p) => sum + p.precio, 0), expira_en: new Date(Date.now() + 300000).toISOString(), fecha_viaje: new Date().toISOString().slice(0, 10), boletos: payload.pasajeros.map((p, i) => ({ ...p, id: i + 1, nombre_pasajero: p.nombre, cedula_pasajero: p.cedula, numero_asiento: p.asiento_id % 100, categoria: p.asiento_id % 100 <= 8 ? 'VIP' : 'NORMAL' })) };
    reservations.set(codigo_reserva, reserva);
    return { reserva };
  },
  reservation: async (code) => {
    const reservation = reservations.get(code);
    if (!reservation) throw new Error('No encontramos esa reserva de demostración. Las reservas de prueba se reinician al recargar la página.');
    return { ...reservation };
  },
  receipt: async (code) => {
    const reservation = reservations.get(code);
    if (!reservation || Date.parse(reservation.expira_en) <= Date.now()) throw new Error('La reserva de prueba venció.');
    const next = { ...reservation, estado: 'PENDIENTE_VALIDACION', comprobante_url: 'demo' };
    reservations.set(code, next);
    return { reserva: next };
  },
};
