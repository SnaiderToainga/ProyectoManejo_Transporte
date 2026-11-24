import test from 'node:test';
import assert from 'node:assert/strict';
import { money, shortTime } from '../../src/lib/format.js';
import { calculateSegmentPrice } from '../../src/lib/format.js';
import { discountedPrice, purchaseTime } from '../../src/lib/ticketDetails.js';

test('CR-02: moneda usa símbolo, punto decimal, dos decimales y USD', () => {
  for (const [value, expected] of [[0, '$ 0.00 USD'], [9.5, '$ 9.50 USD'], ['1.67', '$ 1.67 USD'],
    [1000, '$ 1000.00 USD'], [-5, '$ -5.00 USD'], [1.005, '$ 1.01 USD']]) {
    assert.equal(money(value), expected);
  }
  for (const value of [undefined, null, '', 'incorrecto', Infinity, NaN]) assert.equal(money(value), '$ 0.00 USD');
});

test('CR-02: horarios de viaje conservan la hora y muestran HH:mm con ceros iniciales', () => {
  assert.equal(shortTime('07:05:30'), '07:05');
  assert.equal(shortTime('7:5'), '07:05');
  assert.equal(shortTime('00:00:00'), '00:00');
  assert.equal(shortTime('23:59:59.123456'), '23:59');
  for (const value of [null, '', 'no registrado', '24:01', '10:60']) assert.equal(shortTime(value), '--:--');
});

test('CR-02: formatear no modifica datos ni los cálculos de descuentos y tramos', () => {
  const original = { precio_base: '5.00', hora_salida: '08:30:00' };
  const copy = { ...original };
  money(original.precio_base); shortTime(original.hora_salida);
  assert.deepEqual(original, copy);
  assert.equal(discountedPrice(5.01, 'TERCERA_EDAD'), 2.51);
  assert.equal(calculateSegmentPrice(5, 3, 1), 1.67);
  assert.equal(money(discountedPrice(5.01, 'TERCERA_EDAD')), '$ 2.51 USD');
});

test('CR-02: la marca exacta de compra de CR-07 mantiene los segundos y la zona de Ecuador', () => {
  assert.match(purchaseTime('2026-11-20T20:00:15Z'), /15:00:15/);
  assert.match(purchaseTime('2026-11-20T20:00:15Z'), /Ecuador/);
});
