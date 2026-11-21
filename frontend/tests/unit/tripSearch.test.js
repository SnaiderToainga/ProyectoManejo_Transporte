import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTrip, resolveTripSegment } from '../../src/lib/format.js';
import { cantonOptions, countAvailableSeats, passengerCount, searchOptions, tripAvailability } from '../../src/lib/tripSearch.js';

const trip = { origen: 'Quito', destino: 'Loja', paradas_intermedias: ['Latacunga', 'Ambato', 'Riobamba', 'Cuenca'],
  estado: 'PROGRAMADO', cooperativa_nombre: 'CITA', hora_salida_programada: '07:00', precio_base: 20,
  marca_chasis: 'Mercedes-Benz', carroceria: 'Marcopolo', tipo_servicio: 'PARADAS' };

test('CR-06: combina los cuatro filtros, ruta intermedia, horario y marcas sin tildes', () => {
  const filters = { origen: 'Latacunga', destino: 'Cuenca', cooperativa: 'CITA', marca_chasis: 'mercedes-benz',
    carroceria: 'Marcopolo', tipo_servicio: 'PARADAS', desde: '06:00', hasta: '08:00' };
  assert.equal(matchesTrip(trip, filters), true);
  for (const changes of [{ cooperativa: 'Otra' }, { marca_chasis: 'Hino' }, { carroceria: 'Cepeda' },
    { tipo_servicio: 'DIRECTO' }, { desde: '08:00' }, { origen: 'Cuenca', destino: 'Latacunga' }]) {
    assert.equal(matchesTrip(trip, { ...filters, ...changes }), false);
  }
  assert.equal(resolveTripSegment(trip, filters.origen, filters.destino).precioTramo, 12);
  assert.equal(matchesTrip({ ...trip, marca_chasis: null }, filters), false);
  assert.equal(matchesTrip({ ...trip, marca_chasis: null, carroceria: null }, {}), true);
});

test('CR-06: sugerencias incluyen paradas válidas para subir y bajar, sin duplicar tildes', () => {
  const routes = [trip, { origen: 'Baños', destino: 'Ambato', paradas_intermedias: 'Salasaca, Pelileo' },
    { origen: 'BANOS', destino: 'Quito' }, {}];
  const origins = cantonOptions(routes, 'origen');
  assert.ok(origins.includes('Latacunga')); assert.ok(origins.includes('Salasaca'));
  assert.equal(origins.filter(stop => /ba[ñn]os/i.test(stop)).length, 1);
  assert.equal(origins.includes('Loja'), false);
  assert.ok(cantonOptions(routes, 'destino').includes('Loja'));
  assert.deepEqual(searchOptions([{ nombre: ' Hino ' }, { nombre: 'HINO' }, { nombre: null }], 'nombre'), ['Hino']);
});

test('CR-06: pasajeros exige enteros positivos y limita al máximo admitido por la flota', () => {
  for (const value of ['', '0', '-1', '1.5', '66', 'abc', null, undefined]) assert.equal(passengerCount(value), null);
  assert.equal(passengerCount('3'), 3); assert.equal(passengerCount(65), 65);
});

test('CR-06: disponibilidad por categoría no se sustituye por capacidad física', () => {
  const available = { capacidad: 40, asientos_disponibles: 6, asientos_disponibles_normal: 4, asientos_disponibles_vip: 2 };
  assert.equal(tripAvailability(available), 6);
  assert.equal(tripAvailability(available, 'NORMAL'), 4);
  assert.equal(tripAvailability(available, 'VIP'), 2);
  assert.equal(tripAvailability({ asientos_disponibles: 0 }), 0);
  for (const value of [null, undefined, '', -1, 'incorrecto', 1.5]) {
    assert.equal(tripAvailability({ asientos_disponibles: value }), null);
  }
  assert.equal(tripAvailability({ capacidad: 40 }), null);
});

test('CR-06: API anterior cuenta asientos únicos, activos, disponibles y de la categoría solicitada', () => {
  const seat = (id, category = 'VIP', state = 'DISPONIBLE', extra = {}) => ({ asiento_id: id, numero_asiento: id, categoria: category, estado_ocupacion: state, ...extra });
  const seats = [seat(1), seat(1, 'VIP', 'OCUPADO'), seat(2), seat(3, 'NORMAL'),
    seat(4, 'VIP', 'DISPONIBLE', { activo: false }), seat(5, 'VIP', 'OCUPADO')];
  assert.equal(countAvailableSeats(seats), 2);
  assert.equal(countAvailableSeats(seats, 'VIP'), 1);
  assert.equal(countAvailableSeats(seats, 'NORMAL'), 1);
  assert.equal(countAvailableSeats([], 'VIP'), 0);
});
