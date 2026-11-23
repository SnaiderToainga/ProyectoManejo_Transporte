import test from 'node:test';
import assert from 'node:assert/strict';
import { cooperativeDraft, cooperativeErrors, cooperativePayload, safeImageUrl } from '../../src/lib/cooperativeForm.js';
import { FLOW_KEY, hostedPaymentUrl, loadSelection, saveSelection, selectionKey } from '../../src/lib/purchaseFlow.js';

const valid = { ...cooperativeDraft(), nombre: 'Cooperativa de prueba', ruc: '1890012345001', resolucion_ant: 'ANT-RES-2026-001',
  telefono: '0991234567', correo: 'institucion@example.test', direccion: 'Terminal de prueba', cuenta_bancaria: '1234567890',
  gerente_nombre: 'Gerente de prueba', gerente_cedula: '1710034065', gerente_correo: 'gerente@example.test',
  gerente_telefono: '0981234567', gerente_password: 'ClavePrueba9!' };
const memory = () => { const values = new Map(); return { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) || null, removeItem: key => values.delete(key) }; };

test('CR-01: los pasos validan institución, banco y gerente por separado', () => {
  for (let step = 0; step < 3; step++) assert.deepEqual(cooperativeErrors(valid, step), {});
  assert.ok(cooperativeErrors({ ...valid, correo: 'sin-correo' }, 0).correo);
  assert.ok(cooperativeErrors({ ...valid, banco: '', cuenta_bancaria: 'abc' }, 1).banco);
  assert.ok(cooperativeErrors({ ...valid, gerente_cedula: '0102030405' }, 2).gerente_cedula);
  assert.ok(cooperativeErrors({ ...valid, gerente_password: 'SinSimbolo9' }, 2).gerente_password);
});

test('CR-01: alta envía ambos correos y la identidad completa del gerente en una operación', () => {
  const payload = cooperativePayload(valid);
  assert.equal(payload.correo, 'institucion@example.test');
  assert.equal(payload.gerente.correo, 'gerente@example.test');
  assert.equal(payload.gerente.nombre, valid.gerente_nombre);
  assert.equal(payload.gerente.cedula, valid.gerente_cedula);
  assert.equal(payload.gerente.rol, 'ADMIN_COOP');
  assert.equal(payload.gerente.password, valid.gerente_password);
});

test('CR-01: editar precarga el perfil y no envía contraseñas ni cambios de rol', () => {
  const existing = { id: 7, nombre: 'Coop', correo: 'coop@example.test', logo_url: 'https://example.test/logo.png' };
  const draft = cooperativeDraft(existing);
  assert.equal(draft.correo, existing.correo); assert.equal(draft.logo_url, existing.logo_url);
  assert.equal(draft.gerente_password, '');
  const payload = cooperativePayload({ ...valid, ...draft }, existing);
  assert.equal(payload.id, 7); assert.equal(payload.gerente, undefined);
  assert.deepEqual(cooperativeErrors(draft, 2, true), {});
});

test('CR-01: selección por sesión conserva tramo e IDs pero excluye datos personales', () => {
  const storage = memory(); const trip = { programacion_id: 1, fecha_viaje: '2026-11-22', origen: 'Latacunga', destino: 'Machachi',
    tramo: { inicio: 1, fin: 2 }, precio_base: 1.67, nombre: 'Dato personal', cedula: '1710034065', token: 'privado' };
  saveSelection(storage, trip, 'NORMAL', [9, 10], 1000);
  const restored = loadSelection(storage, 2000);
  assert.deepEqual(restored.ids, [9, 10]); assert.deepEqual(restored.trip.tramo, trip.tramo);
  assert.equal(restored.trip.precio_base, 1.67); assert.equal(restored.trip.nombre, undefined);
  assert.doesNotMatch(storage.getItem(FLOW_KEY), /privado|1710034065|Dato personal/);
  assert.notEqual(selectionKey(trip), selectionKey({ ...trip, tramo: { inicio: 0, fin: 2 } }));
});

test('CR-01: selección caduca, se limpia al reservar y separa demo de compras reales', () => {
  const storage = memory(); const trip = { programacion_id: 1, fecha_viaje: '2026-11-22' };
  saveSelection(storage, trip, '', [1], 1000, true);
  assert.equal(loadSelection(storage, 2000), null);
  assert.deepEqual(loadSelection(storage, 2000, true).ids, [1]);
  assert.equal(loadSelection(storage, 1900000, true), null);
  saveSelection(storage, null, '', [], 2000, true); assert.equal(loadSelection(storage, 2000, true), null);
  storage.setItem(FLOW_KEY, '{invalido'); assert.equal(loadSelection(storage), null);
  const blocked = { getItem() { throw Error('bloqueado'); }, setItem() { throw Error('bloqueado'); } };
  assert.equal(loadSelection(blocked), null); assert.doesNotThrow(() => saveSelection(blocked, trip, '', []));
});

test('CR-01: enlaces de fotos y pasarela rechazan protocolos ejecutables y credenciales', () => {
  assert.equal(safeImageUrl('javascript:alert(1)'), ''); assert.equal(safeImageUrl('https://user:secret@example.test/x'), '');
  assert.equal(safeImageUrl('/uploads/bus.png'), '/uploads/bus.png');
  assert.equal(hostedPaymentUrl('http://example.test/cobrar'), ''); assert.equal(hostedPaymentUrl('javascript:alert(1)'), '');
  assert.equal(hostedPaymentUrl('https://gateway.example.test/session/1'), 'https://gateway.example.test/session/1');
});
