export const FLOW_KEY = 'transporte-uta-seleccion-cr01';
const lifetime = 30 * 60 * 1000;
const tripFields = ['programacion_id', 'fecha_viaje', 'hora_salida_programada', 'numero_disco', 'capacidad',
  'cooperativa_id', 'cooperativa_nombre', 'origen', 'destino', 'precio_base', 'precio_vip', 'porcentaje_vip',
  'tramo', 'ruta_completa_origen', 'ruta_completa_destino', 'es_tramo_intermedio', 'pasajeros_solicitados'];

export function selectionKey(trip) {
  return JSON.stringify([trip?.programacion_id, trip?.fecha_viaje, trip?.tramo?.inicio, trip?.tramo?.fin]);
}

export function saveSelection(storage, trip, category, ids, now = Date.now(), demo = false) {
  try {
    const key = `${FLOW_KEY}${demo ? '-demo' : ''}`;
    if (!trip) { storage.removeItem(key); return; }
    storage.setItem(key, JSON.stringify({ version: 1, savedAt: now, category, ids,
      trip: Object.fromEntries(tripFields.filter(field => trip[field] !== undefined).map(field => [field, trip[field]])) }));
  } catch { /* La compra funciona aunque el navegador bloquee sessionStorage. */ }
}

export function loadSelection(storage, now = Date.now(), demo = false) {
  try {
    const value = JSON.parse(storage.getItem(`${FLOW_KEY}${demo ? '-demo' : ''}`));
    if (value?.version !== 1 || !Number.isFinite(value.savedAt) || now - value.savedAt > lifetime || now < value.savedAt ||
        !Number.isSafeInteger(Number(value.trip?.programacion_id)) || Number(value.trip.programacion_id) <= 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(String(value.trip.fecha_viaje)) || !Array.isArray(value.ids)) return null;
    return { trip: value.trip, category: ['NORMAL', 'VIP'].includes(value.category) ? value.category : '',
      ids: [...new Set(value.ids)].filter(id => Number.isSafeInteger(Number(id)) && Number(id) > 0) };
  } catch { return null; }
}

export function hostedPaymentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
