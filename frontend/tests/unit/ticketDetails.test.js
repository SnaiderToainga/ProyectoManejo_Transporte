import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discountedPrice, purchaseTime, passengerLabels } from '../../src/lib/ticketDetails.js';

test('los tres beneficios redondean centavos igual que el servidor', () => {
  assert.equal(discountedPrice(5.01,'NORMAL'),5.01);
  for (const type of ['MENOR','TERCERA_EDAD','DISCAPACIDAD','NIÑO']) {
    assert.equal(discountedPrice(5.01,type),2.51);
    assert.ok(passengerLabels[type]);
  }
});
test('la compra conserva segundos en hora de Ecuador y no inventa fechas históricas', () => {
  assert.match(purchaseTime('2026-11-20T20:00:15Z'),/15:00:15/);
  assert.match(purchaseTime('2026-11-20 20:00:15'),/15:00:15/);
  assert.equal(purchaseTime(null),'Fecha exacta no registrada');
});
