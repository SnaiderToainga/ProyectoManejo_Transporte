export function uniqueSeats(seats) {
  const result = new Map();
  for (const seat of seats || []) {
    const number = Number(seat.numero_asiento);
    if (!Number.isInteger(number) || number < 1) continue;
    const previous = result.get(number);
    if (!previous || seat.estado_ocupacion !== 'DISPONIBLE') {
      result.set(number, { ...seat, numero_asiento: number });
    }
  }
  return [...result.values()].sort((a, b) => a.numero_asiento - b.numero_asiento);
}

export const seatCategory = (seat) => seat?.categoria || (Number(seat?.numero_asiento) <= 8 ? 'VIP' : 'NORMAL');

export const isLargeSeat = (seat) => {
  if (!seat) return false;
  if (seat.tamano) return String(seat.tamano).toUpperCase() === 'GRANDE';
  return seatCategory(seat) === 'VIP';
};

export const isAvailable = (seat) => Boolean(seat?.asiento_id) && seat.estado_ocupacion === 'DISPONIBLE';

export function aisleAfterColumn(cols = 4, configured = null) {
  const c = Number(cols) || 4;
  if (Number.isInteger(Number(configured)) && Number(configured) >= 1 && Number(configured) < c) {
    return Number(configured);
  }
  if (c <= 2) return 1;
  return 2;
}

export function gridColumnForLogical(col, aisleAfter = 2) {
  const c = Number(col) || 1;
  return c <= aisleAfter ? c : c + 1;
}

export function seatPosition(number, seat = null, aisleAfter = 2) {
  if (seat && (seat.fila_piso || seat.fila) && seat.columna) {
    const row = Number(seat.fila_piso || seat.fila);
    const col = Number(seat.columna);
    return {
      gridRow: row,
      gridColumn: gridColumnForLogical(col, aisleAfter)
    };
  }
  if (number >= 37) return { gridRow: 10, gridColumn: number - 36 };
  const column = (number - 1) % 4;
  return { gridRow: Math.floor((number - 1) / 4) + 1, gridColumn: column < 2 ? column + 1 : column + 2 };
}

export function seatPrice(seat, trip) {
  const value = Number(seat?.precio ?? trip?.precio_base);
  return Number.isFinite(value) && value > 0 ? value : null;
}
