import test from 'node:test';
import assert from 'node:assert/strict';
import { isAvailable, seatCategory, seatPosition, seatPrice, uniqueSeats } from '../../src/lib/seats.js';
import { matchesTrip } from '../../src/lib/format.js';
import { passengerError, receiptError } from '../../src/lib/validation.js';
import { demoApi } from '../../src/lib/demo.js';

test('la reserva de demostración conserva la fecha elegida', async () => {
  await demoApi.trips('2027-02-15');
  const result = await demoApi.reserve({ programacion_id: 1, asientos: [101], pasajeros: [{ asiento_id: 101, nombre: 'Ejemplo', cedula: '0000000000', precio: 4.5 }] });
  assert.equal(result.reserva.fecha_viaje, '2027-02-15');
});

test('los mapas tienen posiciones únicas y una fila posterior de cinco en el bus de 41', () => {
  for (const capacity of [40, 41]) {
    const positions = Array.from({ length: capacity }, (_, i) => seatPosition(i + 1));
    assert.equal(new Set(positions.map(p => `${p.gridRow}-${p.gridColumn}`)).size, capacity);
    assert.equal(positions.filter(p => p.gridRow === 10).length, capacity - 36);
    assert.ok(positions.filter(p => p.gridRow < 10).every(p => p.gridColumn !== 3));
  }
  assert.deepEqual(seatPosition(41), { gridRow: 10, gridColumn: 5 });
});
test('las reservas históricas repetidas no vuelven disponible un asiento ocupado', () => {
  const free = { asiento_id: 7, numero_asiento: 7, estado_ocupacion: 'DISPONIBLE' };
  const occupied = { ...free, estado_ocupacion: 'OCUPADO' };
  for (const rows of [[free, occupied], [occupied, free]]) {
    const seats = uniqueSeats(rows);
    assert.equal(seats.length, 1); assert.equal(isAvailable(seats[0]), false);
  }
  assert.equal(isAvailable(undefined), false);
});
test('se respeta la categoría y tarifa del servidor sin inventar recargos', () => {
  assert.equal(seatCategory({ numero_asiento: 5, categoria: 'NORMAL' }), 'NORMAL');
  assert.equal(seatCategory({ numero_asiento: 8 }), 'VIP');
  assert.equal(seatCategory({ numero_asiento: 9 }), 'NORMAL');
  assert.equal(seatPrice({}, { precio_base: '4.50' }), 4.5);
  assert.equal(seatPrice({ precio: '6.00' }, { precio_base: '4.50' }), 6);
  assert.equal(seatPrice({}, { precio_base: 'incorrecto' }), null);
});
test('los filtros combinan ruta sin tildes, cooperativa, horario y estado', () => {
  const trip = { origen: 'Ambato', destino: 'Quito (Carcelén)', cooperativa_nombre: 'CITA', hora_salida_programada: '08:30:00', estado: 'PROGRAMADO' };
  assert.equal(matchesTrip(trip, { destino: 'carcelen', cooperativa: 'CITA', desde: '08:00', hasta: '09:00' }), true);
  assert.equal(matchesTrip(trip, { desde: '09:00' }), false);
  assert.equal(matchesTrip({ ...trip, estado: 'CANCELADO' }, {}), false);
});
test('se validan pasajeros y comprobantes antes de enviar solicitudes', () => {
  assert.equal(passengerError([{ nombre: 'Pasajero de prueba', cedula: '0102030405' }]), '');
  assert.ok(passengerError([{ nombre: 'A', cedula: '123' }]));
  assert.ok(passengerError([{ nombre: 'Uno', cedula: '0102030405' }, { nombre: 'Dos', cedula: '0102030405' }]));
  assert.equal(receiptError({ name: 'pago.pdf', type: 'application/pdf', size: 100 }), '');
  assert.ok(receiptError({ name: 'pago.exe', type: 'image/png', size: 100 }));
  assert.ok(receiptError({ name: 'pago.png', type: 'image/png', size: 5 * 1024 * 1024 + 1 }));
  assert.ok(receiptError({ name: 'pago.png', type: 'image/png', size: 0 }));
});
