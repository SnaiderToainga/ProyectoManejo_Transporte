export const money = (value) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const shortTime = (value) => String(value || '').slice(0, 5);
export const travelDate = (value) => {
  const part = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(part)
    ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date(`${part}T12:00:00`)) : 'Fecha por confirmar';
};
export const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function matchesTrip(trip, filters) {
  const hour = shortTime(trip.hora_salida_programada);
  return (!trip.estado || trip.estado === 'PROGRAMADO')
    && normalize(trip.origen).includes(normalize(filters.origen))
    && normalize(trip.destino).includes(normalize(filters.destino))
    && (!filters.cooperativa || trip.cooperativa_nombre === filters.cooperativa)
    && (!filters.desde || hour >= filters.desde)
    && (!filters.hasta || hour <= filters.hasta);
}
