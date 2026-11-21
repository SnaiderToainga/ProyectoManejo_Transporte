const decimalAmount = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false,
});
export const money = (value) => {
  const amount = Number(value);
  return `$ ${decimalAmount.format(Number.isFinite(amount) ? amount : 0)} USD`;
};
export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export const shortTime = (value) => {
  const parts = String(value || '').trim().match(/^(\d{1,2}):(\d{1,2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!parts || Number(parts[1]) > 23 || Number(parts[2]) > 59) return '--:--';
  return `${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
};
export const travelDate = (value) => {
  const part = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(part)
    ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date(`${part}T12:00:00`)) : 'Fecha por confirmar';
};
export const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function getTripItinerary(trip) {
  const paradas = Array.isArray(trip?.paradas_intermedias)
    ? trip.paradas_intermedias
    : typeof trip?.paradas_intermedias === 'string' && trip.paradas_intermedias.trim()
      ? trip.paradas_intermedias.split(',')
      : [];
  return [trip?.origen, ...paradas, trip?.destino]
    .map(stop => String(stop || '').trim())
    .filter(Boolean);
}

export function findSegmentIndices(itinerary, origenFilter = '', destinoFilter = '') {
  if (!itinerary.length) return { valid: false, startIdx: -1, endIdx: -1 };
  const normOrigen = normalize(origenFilter);
  const normDestino = normalize(destinoFilter);

  if (normOrigen && normDestino) {
    for (let i = 0; i < itinerary.length - 1; i++) {
      if (normalize(itinerary[i]).includes(normOrigen)) {
        for (let j = i + 1; j < itinerary.length; j++) {
          if (normalize(itinerary[j]).includes(normDestino)) {
            return { valid: true, startIdx: i, endIdx: j };
          }
        }
      }
    }
    return { valid: false, startIdx: -1, endIdx: -1 };
  }

  if (normOrigen) {
    const startIdx = itinerary.slice(0, -1).findIndex(stop => normalize(stop).includes(normOrigen));
    return startIdx !== -1
      ? { valid: true, startIdx, endIdx: itinerary.length - 1 }
      : { valid: false, startIdx: -1, endIdx: -1 };
  }

  if (normDestino) {
    for (let j = 1; j < itinerary.length; j++) {
      if (normalize(itinerary[j]).includes(normDestino)) {
        return { valid: true, startIdx: 0, endIdx: j };
      }
    }
    return { valid: false, startIdx: -1, endIdx: -1 };
  }

  return { valid: true, startIdx: 0, endIdx: itinerary.length - 1 };
}

export function calculateSegmentPrice(precioBase, totalSegments, traveledSegments) {
  const base = Number(precioBase) || 0;
  if (totalSegments <= 1 || traveledSegments >= totalSegments) return Number(base.toFixed(2));
  const raw = base * (Math.max(1, traveledSegments) / totalSegments);
  return Math.max(0.5, Number(raw.toFixed(2)));
}

export function resolveTripSegment(trip, origenFilter = '', destinoFilter = '') {
  const itinerary = getTripItinerary(trip);
  const { valid, startIdx, endIdx } = findSegmentIndices(itinerary, origenFilter, destinoFilter);
  const sIdx = valid && startIdx >= 0 ? startIdx : 0;
  const eIdx = valid && endIdx > sIdx ? endIdx : Math.max(0, itinerary.length - 1);
  const totalSegments = Math.max(1, itinerary.length - 1);
  const traveledSegments = Math.max(1, eIdx - sIdx);
  const esTramoIntermedio = sIdx > 0 || eIdx < itinerary.length - 1;
  const precioTramo = esTramoIntermedio
    ? calculateSegmentPrice(trip.precio_base, totalSegments, traveledSegments)
    : Number(trip.precio_base);

  return {
    itinerary,
    startIdx: sIdx,
    endIdx: eIdx,
    tramoOrigen: itinerary[sIdx] || trip.origen,
    tramoDestino: itinerary[eIdx] || trip.destino,
    esTramoIntermedio,
    precioTramo,
    totalSegments,
    traveledSegments
  };
}

export function matchesTrip(trip, filters = {}) {
  const hour = shortTime(trip.hora_salida_programada);
  const itinerary = getTripItinerary(trip);
  const { valid } = findSegmentIndices(itinerary, filters.origen, filters.destino);
  return (!trip.estado || trip.estado === 'PROGRAMADO')
    && valid
    && (!filters.cooperativa || trip.cooperativa_nombre === filters.cooperativa)
    && (!filters.marca_chasis || normalize(trip.marca_chasis) === normalize(filters.marca_chasis))
    && (!filters.carroceria || normalize(trip.carroceria) === normalize(filters.carroceria))
    && (!filters.tipo_servicio || trip.tipo_servicio === filters.tipo_servicio)
    && (!filters.desde || hour >= filters.desde)
    && (!filters.hasta || hour <= filters.hasta);
}
