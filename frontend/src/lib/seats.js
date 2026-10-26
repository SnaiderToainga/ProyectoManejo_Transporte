export function uniqueSeats(seats) {
  const result = new Map();
  for (const seat of seats) {
    const number = Number(seat.numero_asiento);
    if (!Number.isInteger(number) || number < 1) continue;
    const previous = result.get(number);
    // La consulta actual puede repetir asientos por reservas históricas. Ante duda, no ofrecerlos.
    if (!previous || seat.estado_ocupacion !== 'DISPONIBLE') result.set(number, { ...seat, numero_asiento: number });
  }
  return [...result.values()].sort((a, b) => a.numero_asiento - b.numero_asiento);
}
export const seatCategory = (seat) => seat.categoria || (Number(seat.numero_asiento) <= 8 ? 'VIP' : 'NORMAL');
export const isAvailable = (seat) => Boolean(seat?.asiento_id) && seat.estado_ocupacion === 'DISPONIBLE';
export function seatPosition(number) {
  if (number >= 37) return { gridRow: 10, gridColumn: number - 36 };
  const column = (number - 1) % 4;
  return { gridRow: Math.floor((number - 1) / 4) + 1, gridColumn: column < 2 ? column + 1 : column + 2 };
}
export function seatPrice(seat, trip) {
  const value = Number(seat.precio ?? trip.precio_base);
  return Number.isFinite(value) && value > 0 ? value : null;
}
