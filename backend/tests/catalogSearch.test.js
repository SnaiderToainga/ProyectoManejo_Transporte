const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createFixture } = require('./helpers/planningFixture');

let fixture, server, base;
const migration = readFileSync(path.join(__dirname, '../database/06_catalogo_busqueda.sql'), 'utf8');
async function get(path) {
  const response = await fetch(`${base}${path}`);
  return { status: response.status, data: await response.json() };
}
before(async () => {
  fixture = await createFixture();
  server = fixture.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
beforeEach(async () => {
  await fixture.seed();
  await fixture.pool.query(`INSERT INTO programacion_viajes(id,frecuencia_id,bus_id,fecha_viaje,hora_salida_programada)
    VALUES(1,1,1,'2100-01-01','08:00'),(2,2,2,'2100-01-01','09:00')`);
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await fixture?.database.close();
});

test('CR-06: catálogo funciona sin columnas nuevas y publica disponibilidad por categoría', async () => {
  const { status, data } = await get('/viajes?fecha=2100-01-01');
  assert.equal(status, 200); assert.equal(data.length, 2);
  assert.equal(data[0].marca_chasis, null); assert.equal(data[0].carroceria, null);
  assert.equal(data[0].asientos_disponibles, 40);
  assert.equal(data[0].asientos_disponibles_normal, 32);
  assert.equal(data[0].asientos_disponibles_vip, 8);
});

test('CR-06: pagos y retenciones vigentes ocupan; vencidos y rechazados liberan sin duplicar asientos', async () => {
  await fixture.pool.query(`INSERT INTO reservas(id,programacion_id,codigo_reserva,total,estado,expira_en) VALUES
    (1,1,'PAID',5,'PAGADO',NULL), (2,1,'HOLD',5,'PENDIENTE',CURRENT_TIMESTAMP + INTERVAL '1 day'),
    (3,1,'EXPIRED',5,'PENDIENTE',CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (4,1,'REJECTED',5,'RECHAZADO',CURRENT_TIMESTAMP + INTERVAL '1 day'),
    (5,2,'OTHER-TRIP',5,'PAGADO',NULL), (6,1,'PAID-AGAIN',5,'PAGADO',NULL)`);
  await fixture.pool.query(`INSERT INTO detalle_boletos(reserva_id,asiento_id,nombre_pasajero,cedula_pasajero,precio)
    SELECT v.reserva_id,a.id,'Prueba','1710034065',5
    FROM (VALUES(1,1,1),(2,1,2),(3,1,3),(4,1,4),(5,2,1),(6,1,1)) v(reserva_id,bus_id,numero)
    JOIN asientos a ON a.bus_id=v.bus_id AND a.numero_asiento=v.numero`);
  await fixture.pool.query('UPDATE asientos SET activo=false WHERE bus_id=1 AND numero_asiento=9');
  const result = await get('/viajes?fecha=2100-01-01');
  assert.equal(result.status, 200);
  const trip = result.data.find(trip => trip.programacion_id === 1);
  assert.equal(trip.asientos_disponibles, 37);
  assert.equal(trip.asientos_disponibles_vip, 6);
  assert.equal(trip.asientos_disponibles_normal, 31);
  const seats = (await get('/viajes/1/asientos')).data;
  assert.equal(seats.length, 39);
  assert.equal(seats.filter(seat => seat.estado_ocupacion === 'DISPONIBLE').length, 37);
  assert.equal(result.data.find(trip => trip.programacion_id === 2).asientos_disponibles, 39);
});

test('CR-06: migración es repetible y conserva marcas verificadas sin inventarlas para otros buses', async () => {
  await fixture.database.exec(migration);
  await fixture.pool.query("UPDATE buses SET marca_chasis=' Mercedes-Benz ', carroceria='Marcopolo' WHERE id=1");
  await fixture.database.exec(migration);
  const { status, data } = await get('/viajes?fecha=2100-01-01');
  assert.equal(status, 200);
  assert.equal(data[0].marca_chasis, 'Mercedes-Benz'); assert.equal(data[0].carroceria, 'Marcopolo');
  assert.equal(data[1].marca_chasis, null);
  assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM asientos')).rows[0].n, 240);
});

test('CR-06: conserva las paradas, el tipo de servicio y el orden de las rutas destacadas', async () => {
  await fixture.pool.query("UPDATE frecuencias SET paradas_intermedias=ARRAY['Latacunga','Cuenca'], tipo_servicio='PARADAS', es_destacada=true WHERE id=2");
  const { data } = await get('/viajes?fecha=2100-01-01');
  assert.equal(data[0].programacion_id, 2);
  assert.deepEqual(data[0].paradas_intermedias, ['Latacunga', 'Cuenca']);
  assert.equal(data[0].tipo_servicio, 'PARADAS');
  assert.deepEqual((await get('/viajes?fecha=2100-01-02')).data, []);
});
