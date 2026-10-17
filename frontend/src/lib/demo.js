// Datos ficticios disponibles únicamente al abrir ?demo=1. Nunca sustituyen un error de la API.
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
};
