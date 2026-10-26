import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCountdown, reservationStatus, secondsRemaining } from '../../src/lib/reservation.js';

test('el reloj usa el vencimiento absoluto y no se reinicia al recargar', () => {
  const now = Date.parse('2026-01-01T10:00:00Z');
  const expiry = '2026-01-01T10:05:00Z';
  assert.equal(secondsRemaining(expiry, now), 300);
  assert.equal(secondsRemaining(expiry, now + 240000), 60);
  assert.equal(secondsRemaining(expiry, now + 301000), 0);
  assert.equal(secondsRemaining('fecha-invalida', now), 0);
  assert.equal(formatCountdown(300), '05:00');
});
test('solo una reserva pagada permite emitir el boleto', () => {
  const now = Date.parse('2026-01-01T10:00:00Z');
  const reservation = { estado: 'PENDIENTE', expira_en: '2026-01-01T09:59:00Z' };
  assert.equal(reservationStatus(reservation, now), 'expired');
  assert.equal(reservationStatus({ ...reservation, estado: 'PAGADO' }, now), 'paid');
  assert.equal(reservationStatus({ ...reservation, estado: 'PENDIENTE_VALIDACION' }, now), 'review');
  assert.equal(reservationStatus({ ...reservation, comprobante_url: '/uploads/prueba.png' }, now), 'review');
});
