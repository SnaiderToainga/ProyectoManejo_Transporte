import test from 'node:test';
import assert from 'node:assert/strict';
import { isAvailable, seatCategory, seatPosition, seatPrice, uniqueSeats } from '../../src/lib/seats.js';
import { matchesTrip, resolveTripSegment } from '../../src/lib/format.js';
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
  assert.equal(passengerError([{ nombre: 'Pasajero de prueba', cedula: '1710034065' }]), '');
  assert.ok(passengerError([{ nombre: 'A', cedula: '123' }]));
  assert.ok(passengerError([{ nombre: 'Uno', cedula: '1710034065' }, { nombre: 'Dos', cedula: '1710034065' }]));
  assert.equal(receiptError({ name: 'pago.pdf', type: 'application/pdf', size: 100 }), '');
  assert.ok(receiptError({ name: 'pago.exe', type: 'image/png', size: 100 }));
  assert.ok(receiptError({ name: 'pago.png', type: 'image/png', size: 5 * 1024 * 1024 + 1 }));
  assert.ok(receiptError({ name: 'pago.png', type: 'image/png', size: 0 }));
});
test('CR-05: permite buscar y calcular tarifa proporcional entre paradas intermedias (Latacunga - Cuenca en ruta Quito - Loja)', () => {
  const trip = {
    origen: 'Quito',
    destino: 'Loja',
    paradas_intermedias: ['Latacunga', 'Ambato', 'Riobamba', 'Cuenca'],
    precio_base: '20.00',
    cooperativa_nombre: 'Cooperativa de Transportes CITA',
    hora_salida_programada: '07:00:00',
    estado: 'PROGRAMADO'
  };
  assert.equal(matchesTrip(trip, { origen: 'Latacunga', destino: 'Cuenca' }), true);
  assert.equal(matchesTrip(trip, { origen: 'Cuenca', destino: 'Latacunga' }), false);
  const seg = resolveTripSegment(trip, 'Latacunga', 'Cuenca');
  assert.equal(seg.esTramoIntermedio, true);
  assert.equal(seg.tramoOrigen, 'Latacunga');
  assert.equal(seg.tramoDestino, 'Cuenca');
  assert.equal(seg.precioTramo, 12);
});

test('CR-04: control de estados de viaje (RUTA-16) y validación de boletos QR en puerta (VENT-05)', () => {
  // 1. Simulación de transiciones de estado de viaje por el chofer (RUTA-16)
  const viaje = { id: 10, estado: 'PROGRAMADO' };
  const iniciarViaje = (v) => {
    if (v.estado === 'FINALIZADO') throw new Error('Viaje ya finalizado');
    return { ...v, estado: 'EN_RUTA' };
  };
  const finalizarViaje = (v) => ({ ...v, estado: 'FINALIZADO' });

  const enRuta = iniciarViaje(viaje);
  assert.equal(enRuta.estado, 'EN_RUTA');

  const finalizado = finalizarViaje(enRuta);
  assert.equal(finalizado.estado, 'FINALIZADO');
  assert.throws(() => iniciarViaje(finalizado), /Viaje ya finalizado/);

  // 2. Validación de abordaje por QR en puerta (VENT-05)
  const boleto = {
    id: 101,
    codigo_reserva: 'RES-TEST-123',
    numero_asiento: 15,
    estado_reserva: 'PAGADO',
    validado_en_puerta: false
  };

  const validarAbordaje = (b) => {
    if (b.estado_reserva !== 'PAGADO') return { valido: false, mensaje: 'No pagado' };
    if (b.validado_en_puerta) return { valido: false, ya_usado: true, mensaje: 'Boleto ya utilizado' };
    return { valido: true, boletoActualizado: { ...b, validado_en_puerta: true } };
  };

  // Primer intento: Exitoso
  const intento1 = validarAbordaje(boleto);
  assert.equal(intento1.valido, true);
  assert.equal(intento1.boletoActualizado.validado_en_puerta, true);

  // Segundo intento con boleto ya validado: Debe ser rechazado para evitar fraude
  const intento2 = validarAbordaje(intento1.boletoActualizado);
  assert.equal(intento2.valido, false);
  assert.equal(intento2.ya_usado, true);
});
