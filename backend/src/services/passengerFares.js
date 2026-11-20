const { validarCedulaEcuatoriana } = require('../utils/validators');

const labels = { NORMAL: 'Tarifa completa', MENOR: 'Menor de edad', TERCERA_EDAD: 'Tercera edad', DISCAPACIDAD: 'Discapacidad' };
function invalid(message) { const error = new Error(message); error.status = 400; throw error; }

// La frecuencia es la fuente de tarifa. La categoría VIP no introduce recargos
// que no existan en el catálogo. La cédula valida identidad, no elegibilidad.
async function quotePassengers(client, trip, passengers, segment) {
  const { rows: [frequency] } = await client.query(`SELECT f.* FROM frecuencias f
    JOIN programacion_viajes pv ON pv.frecuencia_id=f.id WHERE pv.id=$1`, [trip.id]);
  const itinerary = [frequency.origen, ...(frequency.paradas_intermedias || []), frequency.destino];
  let start = 0, end = itinerary.length - 1;
  if (segment != null) {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)
        || !Number.isInteger(segment.inicio) || !Number.isInteger(segment.fin)
        || segment.inicio < 0 || segment.fin >= itinerary.length || segment.inicio >= segment.fin) {
      invalid('El tramo seleccionado no pertenece al itinerario del viaje.');
    }
    start = segment.inicio; end = segment.fin;
  }
  const fullCents = Math.round(Number(frequency.precio_base) * 100);
  const partial = start !== 0 || end !== itinerary.length - 1;
  const cents = partial ? Math.max(50, Math.round(fullCents * (end - start) / (itinerary.length - 1))) : fullCents;
  if (!Number.isSafeInteger(cents) || cents <= 0) invalid('La tarifa del viaje no está configurada.');
  const identities = new Set();
  const details = passengers.map(passenger => {
    const nombre = passenger.nombre ?? passenger.nombre_pasajero;
    const cedula = passenger.cedula ?? passenger.cedula_pasajero;
    let type = passenger.tipo_pasajero ?? 'NORMAL';
    if (type === 'NIÑO' || type === 'NINO') type = 'MENOR';
    if (typeof nombre !== 'string' || nombre.trim().length < 3 || nombre.trim().length > 100) invalid('Ingresa el nombre completo de cada pasajero (3 a 100 caracteres).');
    if (typeof cedula !== 'string' || !validarCedulaEcuatoriana(cedula) || identities.has(cedula.trim())) invalid('Ingresa una cédula ecuatoriana válida y distinta para cada pasajero.');
    if (typeof type !== 'string' || !Object.hasOwn(labels, type)) invalid('El tipo de pasajero no es válido.');
    identities.add(cedula.trim());
    const paidCents = type === 'NORMAL' ? cents : Math.round(cents / 2);
    return { asiento_id: Number(passenger.asiento_id), nombre: nombre.trim(), cedula: cedula.trim(),
      tipo_pasajero: type, tarifa_base: cents / 100, descuento: (cents - paidCents) / 100, precio: paidCents / 100 };
  });
  return { pasajeros: details, total: details.reduce((sum, p) => sum + Math.round(p.precio * 100), 0) / 100,
    origen: itinerary[start], destino: itinerary[end] };
}
module.exports = { quotePassengers, labels };
