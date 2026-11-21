import { getTripItinerary, normalize } from './format.js';
import { isAvailable, uniqueSeats } from './seats.js';

export const MAX_PASSENGERS = 65;

export function passengerCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= MAX_PASSENGERS ? count : null;
}

export function searchOptions(rows, field) {
  const options = new Map();
  for (const row of rows) {
    const label = String(row[field] || '').trim();
    if (label && !options.has(normalize(label))) options.set(normalize(label), label);
  }
  return [...options.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

export function cantonOptions(routes, field) {
  const rows = routes.flatMap(route => {
    const stops = getTripItinerary(route);
    return (field === 'origen' ? stops.slice(0, -1) : stops.slice(1)).map(nombre => ({ nombre }));
  });
  return searchOptions(rows, 'nombre');
}

export function tripAvailability(trip, category = '') {
  const field = category ? `asientos_disponibles_${category.toLowerCase()}` : 'asientos_disponibles';
  const value = trip[field];
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

export function countAvailableSeats(seats, category = '') {
  return uniqueSeats(seats).filter(seat => isAvailable(seat) && seat.activo !== false
    && (!category || seat.categoria === category)).length;
}
