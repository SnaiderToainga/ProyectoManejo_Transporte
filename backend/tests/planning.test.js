const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('./helpers/planningFixture');
const { dateRange, proposeRotation } = require('../src/services/routeRotation');

let fixture;
let server;
let base;
const scope = { cooperativa_id: 1, grupo_buses_id: 1, grupo_frecuencias_id: 1, desde: '2100-01-01', hasta: '2100-01-05' };

async function request(path, { method = 'GET', data, user = 2, headers = {} } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${fixture.createSession(user)}` } : {}), ...headers },
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  return { status: response.status, data: await response.json() };
}
const load = () => request(`/planificacion/matriz?${new URLSearchParams(scope)}`);
async function plan() {
  const proposed = await request('/planificacion/propuesta', { method: 'POST', data: scope });
  assert.equal(proposed.status, 200);
  return request('/planificacion/matriz', { method: 'PUT', data: { ...scope, motivo: 'Rotación inicial de pruebas', asignaciones: proposed.data.asignaciones } });
}
function replacement(trip, busId, averia = true) {
  return { frecuencia_id: trip.frecuencia_id, fecha: trip.fecha_viaje, bus_id: busId,
    programacion_id: trip.id, version: trip.version, averia };
}
const save = cells => request('/planificacion/matriz', { method: 'PUT', data: { ...scope, motivo: 'Reasignación de prueba', asignaciones: cells } });

before(async () => {
  fixture = await createFixture();
  server = fixture.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => fixture.seed());
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await fixture?.database.close();
});

test('rotación 3+2 distribuye tres trabajos y dos descansos por unidad sin repetición diaria', () => {
  const buses = [1, 2, 3, 4, 5].map(id => ({ id }));
  const frequencies = [1, 2, 3].map(id => ({ id }));
  const dates = dateRange(scope.desde, scope.hasta);
  const rotation = proposeRotation(buses, frequencies, dates, scope.desde);
  for (const bus of buses) assert.equal(rotation.filter(a => a.bus_id === bus.id).length, 3);
  for (const date of dates) assert.equal(new Set(rotation.filter(a => a.fecha === date).map(a => a.bus_id)).size, 3);
  assert.deepEqual(proposeRotation(buses, frequencies, dates.slice(2), scope.desde), rotation.slice(6));
  assert.throws(() => proposeRotation(buses.slice(0, 4), frequencies, dates, scope.desde), /reserva/);
});

test('rechaza fechas inexistentes y rangos mayores a 31 días', () => {
  assert.throws(() => dateRange('2100-02-30', '2100-03-01'), /válidas/);
  assert.throws(() => dateRange('2100-01-01', '2100-02-02'), /31/);
});

test('autenticación rechaza anónimos, cabeceras de rol y firmas alteradas', async () => {
  assert.equal((await request('/planificacion/catalogo', { user: null })).status, 401);
  assert.equal((await request('/planificacion/catalogo', { user: null, headers: { 'x-user-role': 'SUPERADMIN' } })).status, 401);
  assert.equal((await request('/planificacion/catalogo', { user: null, headers: { Authorization: `Bearer ${fixture.createSession(2)}x` } })).status, 401);
});

test('roles y cooperativas se validan en servidor', async () => {
  for (const user of [5, 6]) assert.equal((await request('/planificacion/catalogo?cooperativa_id=1', { user })).status, 403);
  assert.equal((await request('/planificacion/catalogo?cooperativa_id=1', { user: 4 })).status, 200);
  assert.equal((await request('/planificacion/grupos', { method: 'POST', user: 4, data: scope })).status, 403);
  assert.equal((await request('/planificacion/catalogo?cooperativa_id=2')).status, 403);
  const global = await request('/planificacion/catalogo?cooperativa_id=2', { user: 1 });
  assert.equal(global.status, 200);
  assert.deepEqual(global.data.buses.map(b => b.id), [6]);
});

test('creación de grupos rechaza miembros ajenos y revierte altas con miembros repetidos', async () => {
  const group = { cooperativa_id: 1, clase: 'BUSES', nombre: 'Nueva flota', tipo_operacion: 'INTERPROVINCIAL', inicio_ciclo: scope.desde };
  assert.equal((await request('/planificacion/grupos', { method: 'POST', data: { ...group, miembros: [6] } })).status, 403);
  assert.equal((await request('/planificacion/grupos', { method: 'POST', data: { ...group, miembros: [1] } })).status, 409);
  assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM grupos_buses')).rows[0].n, 1);
});

test('vínculos impiden combinar grupos urbanos e interprovinciales', async () => {
  const group = await request('/planificacion/grupos', { method: 'POST', data: {
    cooperativa_id: 1, clase: 'FRECUENCIAS', nombre: 'Urbanas', tipo_operacion: 'URBANO', miembros: [5]
  } });
  assert.equal(group.status, 201);
  assert.equal((await request('/planificacion/vinculos', { method: 'POST', data: {
    cooperativa_id: 1, grupo_buses_id: 1, grupo_frecuencias_id: group.data.id
  } })).status, 400);
});

test('gerencia crea sucursal y oficinista que puede iniciar sesión y programar', async () => {
  const branch = await request('/planificacion/sucursales', { method: 'POST', data: { cooperativa_id: 1, nombre: 'Oficina norte', localidad: 'Ambato' } });
  assert.equal(branch.status, 201);
  const data = { nombre: 'Oficinista prueba', correo: 'oficina.norte@prueba.test', password: 'Prueba2026*', rol: 'OFICINISTA', cooperativa_id: 1, sucursal_id: branch.data.id };
  assert.equal((await request('/admin/usuarios', { method: 'POST', data: { ...data, sucursal_id: 2 } })).status, 403);
  const staff = await request('/admin/usuarios', { method: 'POST', data });
  assert.equal(staff.status, 201);
  assert.equal(staff.data.usuario.sucursal_id, branch.data.id);
  const login = await request('/admin/login', { method: 'POST', user: null, data: { correo: data.correo, password: data.password } });
  assert.equal(login.status, 200);
  assert.ok(login.data.usuario.token);
  assert.equal(login.data.usuario.sucursal_id, branch.data.id);
  assert.equal((await request('/planificacion/catalogo?cooperativa_id=1', { user: staff.data.usuario.id })).status, 200);
});

test('gerente no eleva privilegios ni crea personal ajeno por un payload manipulado', async () => {
  const data = { nombre: 'Prueba', correo: 'prueba@prueba.test', password: 'Prueba2026*', rol: 'SUPERADMIN', creador_rol: 'SUPERADMIN' };
  assert.equal((await request('/admin/usuarios', { method: 'POST', data })).status, 403);
  assert.equal((await request('/admin/usuarios', { method: 'POST', data: { ...data, rol: 'OFICINISTA', cooperativa_id: 2, sucursal_id: 2 } })).status, 403);
});

test('guarda matriz, mantiene dos reservas diarias y el reintento no duplica viajes ni auditoría', async () => {
  assert.equal((await plan()).status, 200);
  const current = (await load()).data;
  assert.equal(current.viajes.length, 15);
  assert.equal(current.paradas.length, 10);
  assert.equal(current.historial.length, 15);
  const retry = await save(current.viajes.map(v => replacement(v, v.bus_id, false)));
  assert.equal(retry.status, 200);
  assert.equal(retry.data.actualizados, 0);
  assert.equal((await load()).data.historial.length, 15);
});

test('bloquea bus duplicado por día y conserva la matriz completa ante error', async () => {
  await plan();
  const original = (await load()).data;
  const trip = original.viajes.find(v => v.frecuencia_id === 1 && v.fecha_viaje === scope.desde);
  assert.equal((await save([replacement(trip, 2, false)])).status, 409);
  assert.deepEqual((await load()).data.viajes, original.viajes);
});

test('intercambio de dos unidades se guarda atómicamente aun con la misma hora de salida', async () => {
  await plan();
  const trips = (await load()).data.viajes.filter(v => v.fecha_viaje === scope.desde);
  assert.equal((await save([replacement(trips[0], 2, false), replacement(trips[1], 1, false)])).status, 200);
  const changed = (await load()).data.viajes.filter(v => v.fecha_viaje === scope.desde);
  assert.equal(changed[0].bus_id, 2);
  assert.equal(changed[1].bus_id, 1);
});

test('reemplazo por avería conserva reserva, QR, número y categoría; registra parada y auditoría', async () => {
  await plan();
  const trip = (await load()).data.viajes[0];
  const reservation = (await fixture.pool.query(`INSERT INTO reservas(programacion_id,codigo_reserva,total,estado)
    VALUES($1,'TEST-PAGADO',5,'PAGADO') RETURNING id`, [trip.id])).rows[0];
  await fixture.pool.query(`INSERT INTO detalle_boletos(reserva_id,asiento_id,nombre_pasajero,cedula_pasajero,precio,codigo_qr)
    SELECT $1,id,'Pasajero prueba','1800000000',5,'QR-INMUTABLE' FROM asientos WHERE bus_id=$2 AND numero_asiento=9`, [reservation.id, trip.bus_id]);
  const changed = await save([replacement(trip, 4)]);
  assert.equal(changed.status, 200);
  const seat = (await fixture.pool.query(`SELECT a.bus_id,a.numero_asiento,a.categoria,d.codigo_qr,r.id AS reserva_id
    FROM detalle_boletos d JOIN asientos a ON a.id=d.asiento_id JOIN reservas r ON r.id=d.reserva_id`)).rows[0];
  assert.deepEqual(seat, { bus_id: 4, numero_asiento: 9, categoria: 'NORMAL', codigo_qr: 'QR-INMUTABLE', reserva_id: reservation.id });
  const current = (await load()).data;
  assert.ok(current.paradas.some(p => p.bus_id === trip.bus_id && p.fecha === trip.fecha_viaje && p.motivo === 'AVERIA'));
  assert.equal(current.historial.length, 16);
  const newTrip = current.viajes.find(v => v.id === trip.id);
  assert.equal(newTrip.version, 2);
  assert.equal((await save([replacement(newTrip, trip.bus_id, false)])).status, 409);
});

test('capacidad incompatible revierte la transacción y conserva todos los asientos originales', async () => {
  await plan();
  const trip = (await load()).data.viajes[0];
  const reservation = (await fixture.pool.query(`INSERT INTO reservas(programacion_id,codigo_reserva,total,estado)
    VALUES($1,'TEST-CAP',5,'PAGADO') RETURNING id`, [trip.id])).rows[0];
  await fixture.pool.query(`INSERT INTO detalle_boletos(reserva_id,asiento_id,nombre_pasajero,cedula_pasajero,precio)
    SELECT $1,id,'Prueba','1800000000',5 FROM asientos WHERE bus_id=$2 AND numero_asiento=40`, [reservation.id, trip.bus_id]);
  await fixture.pool.query('DELETE FROM asientos WHERE bus_id=4 AND numero_asiento=40');
  assert.equal((await save([replacement(trip, 4)])).status, 409);
  const current = (await load()).data;
  assert.equal(current.viajes.find(v => v.id === trip.id).bus_id, trip.bus_id);
  assert.equal(current.historial.length, 15);
  assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM programacion_viajes WHERE bus_id IS NULL')).rows[0].n, 0);
});

test('rechaza versiones desactualizadas y viajes iniciados', async () => {
  await plan();
  const trip = (await load()).data.viajes[0];
  assert.equal((await save([{ ...replacement(trip, 4), version: 0 }])).status, 409);
  await fixture.pool.query("UPDATE programacion_viajes SET estado='EN_RUTA' WHERE id=$1", [trip.id]);
  assert.equal((await save([replacement(trip, 4)])).status, 409);
});

test('consultas de cliente y chofer no crean viajes para fechas sin programación', async () => {
  assert.equal((await request('/viajes?fecha=2100-02-01', { user: null })).status, 200);
  assert.equal((await request('/chofer/viajes?fecha=2100-02-01', { user: 6 })).status, 200);
  assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM programacion_viajes')).rows[0].n, 0);
});

test('migración repetible conserva las asignaciones y su auditoría', async () => {
  await plan();
  await fixture.database.exec(fixture.migration);
  assert.equal((await load()).data.viajes.length, 15);
  assert.equal((await load()).data.historial.length, 15);
});

test('retirar una asignación libre conserva su historial y permite reasignar el mismo bus', async () => {
  await plan();
  const original = (await load()).data.viajes[0];
  assert.equal((await save([replacement(original, null, false)])).status, 200);
  assert.equal((await load()).data.viajes.length, 14);
  assert.equal((await request('/venta-ventanilla', { method: 'POST', user: 4, data: {
    programacion_id: original.id, pasajeros: [{ asiento_id: 9, nombre: 'Prueba', cedula: '1710034065', precio: 5 }]
  } })).status, 400);
  assert.equal((await save([{ frecuencia_id: original.frecuencia_id, fecha: original.fecha_viaje, bus_id: original.bus_id }])).status, 200);
  const current = (await load()).data;
  assert.equal(current.viajes.length, 15);
  assert.equal(current.historial.length, 17);
});

test('rechaza quitar viajes vendidos y revierte un lote si falla un reemplazo posterior', async () => {
  await plan();
  const current = (await load()).data;
  const first = current.viajes.find(v => v.frecuencia_id === 1 && v.fecha_viaje === scope.desde);
  const second = current.viajes.find(v => v.frecuencia_id === 2 && v.fecha_viaje === scope.desde);
  const reservation = (await fixture.pool.query(`INSERT INTO reservas(programacion_id,codigo_reserva,total,estado)
    VALUES($1,'TEST-LOTE',5,'PAGADO') RETURNING id`, [second.id])).rows[0];
  await fixture.pool.query(`INSERT INTO detalle_boletos(reserva_id,asiento_id,nombre_pasajero,cedula_pasajero,precio)
    SELECT $1,id,'Prueba','1800000000',5 FROM asientos WHERE bus_id=$2 AND numero_asiento=40`, [reservation.id, second.bus_id]);
  assert.equal((await save([replacement(second, null, false)])).status, 409);
  await fixture.pool.query('DELETE FROM asientos WHERE bus_id=5 AND numero_asiento=40');
  const result = await save([replacement(first, 4, false), replacement(second, 5, false)]);
  assert.equal(result.status, 409);
  assert.deepEqual((await load()).data.viajes, current.viajes);
  assert.equal((await load()).data.historial.length, 15);
});

test('venta y reserva usan las asignaciones guardadas y rechazan asientos del bus sustituido', async () => {
  await plan();
  const trip = (await load()).data.viajes[0];
  const oldSeat = (await fixture.pool.query('SELECT id FROM asientos WHERE bus_id=$1 AND numero_asiento=9', [trip.bus_id])).rows[0].id;
  const pending = await request('/reservas', { method: 'POST', user: null, data: {
    programacion_id: trip.id, asientos: [oldSeat], pasajeros: [{ asiento_id: oldSeat, nombre: 'Pasajero de prueba', cedula: '1710034065', precio: 5 }]
  } });
  assert.equal(pending.status, 201);
  assert.equal((await save([replacement(trip, 4)])).status, 200);
  const reservation = await request(`/reservas/${pending.data.reserva.codigo_reserva}`, { user: null });
  assert.equal(reservation.status, 200);
  assert.equal(reservation.data.boletos[0].numero_asiento, 9);
  assert.notEqual(reservation.data.boletos[0].asiento_id, oldSeat);
  const invalidSale = await request('/venta-ventanilla', { method: 'POST', user: 4, data: {
    programacion_id: trip.id, pasajeros: [{ asiento_id: oldSeat, nombre: 'Prueba', cedula: '1710034065', precio: 5 }]
  } });
  assert.equal(invalidSale.status, 400);
  const newSeat = (await fixture.pool.query('SELECT id FROM asientos WHERE bus_id=4 AND numero_asiento=10')).rows[0].id;
  const sale = await request('/venta-ventanilla', { method: 'POST', user: 4, data: {
    programacion_id: trip.id, pasajeros: [{ asiento_id: newSeat, nombre: 'Prueba', cedula: '1710034065', precio: 5 }]
  } });
  assert.equal(sale.status, 201);
});

test('rechaza reemplazar un viaje con pasajeros ya abordados', async () => {
  await plan();
  const trip = (await load()).data.viajes[0];
  const reservation = (await fixture.pool.query(`INSERT INTO reservas(programacion_id,codigo_reserva,total,estado)
    VALUES($1,'TEST-ABORD',5,'PAGADO') RETURNING id`, [trip.id])).rows[0];
  await fixture.pool.query(`INSERT INTO detalle_boletos(reserva_id,asiento_id,nombre_pasajero,cedula_pasajero,precio,validado_en_puerta)
    SELECT $1,id,'Prueba','1800000000',5,TRUE FROM asientos WHERE bus_id=$2 AND numero_asiento=9`, [reservation.id, trip.bus_id]);
  assert.equal((await save([replacement(trip, 4)])).status, 409);
  assert.equal((await load()).data.viajes.find(v => v.id === trip.id).bus_id, trip.bus_id);
});

test('entradas malformadas no modifican la programación', async () => {
  assert.equal((await save([null])).status, 400);
  assert.equal((await request('/planificacion/propuesta', { method: 'POST', data: [] })).status, 400);
  assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM programacion_viajes')).rows[0].n, 0);
});

test('una avería afecta únicamente a su fecha en las nuevas propuestas', async () => {
  await fixture.pool.query("INSERT INTO bus_paradas(bus_id,fecha,motivo,usuario_id) VALUES(1,$1,'AVERIA',2)", [scope.desde]);
  const proposed = await request('/planificacion/propuesta', { method: 'POST', data: scope });
  assert.equal(proposed.status, 200);
  assert.ok(!proposed.data.asignaciones.some(a => a.fecha === scope.desde && a.bus_id === 1));
  assert.ok(proposed.data.asignaciones.some(a => a.fecha !== scope.desde && a.bus_id === 1));
  const saved = await save(proposed.data.asignaciones);
  assert.equal(saved.status, 200);
});
