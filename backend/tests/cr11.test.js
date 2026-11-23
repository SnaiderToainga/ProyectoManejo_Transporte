const { describe, test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, unlinkSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const { createFixture } = require('./helpers/planningFixture');

const MIG_08 = readFileSync(path.join(__dirname, '../database/08_cr11_indices_rendimiento.sql'), 'utf8');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

describe('CR-11: Fallback de comprobantes en disco efímero y optimización de consultas', () => {
  let fixture, server, base;

  async function api(route, { method = 'GET', user = 4, data } = {}) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { Authorization: `Bearer ${fixture.createSession(user)}` } : {})
      },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
    return { status: response.status, data: await response.json() };
  }

  before(async () => {
    fixture = await createFixture();
    await fixture.database.exec(MIG_08);
    server = fixture.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });

  beforeEach(async () => {
    await fixture.seed();
    await fixture.pool.query(
      `INSERT INTO programacion_viajes (id, frecuencia_id, bus_id, fecha_viaje, hora_salida_programada)
       VALUES (1, 1, 1, '2100-01-01', '08:00')`
    );
  });

  after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fixture.database.close();
  });

  test('migración 08 es aditiva, repetible y crea los 5 índices de rendimiento', async () => {
    await fixture.database.exec(MIG_08);
    const { rows } = await fixture.pool.query(
      `SELECT indexname FROM pg_indexes
       WHERE indexname IN (
         'idx_usuarios_correo_lower',
         'idx_reservas_estado_creado',
         'idx_reservas_usuario_creado',
         'idx_frecuencias_coop_activo',
         'idx_buses_coop_estado'
       )
       ORDER BY indexname`
    );
    assert.equal(rows.length, 5);
  });

  test('bandeja de oficina reporta comprobante_disponible=false ante archivo perdido (404 Render) y permite aprobar sin bloqueo', async () => {
    await fixture.pool.query(
      `INSERT INTO reservas (id, programacion_id, codigo_reserva, total, estado, comprobante_url, expira_en)
       VALUES (1, 1, 'CR11-404', 5.00, 'PENDIENTE', '/uploads/comprobante-perdido-render.png', '2100-01-02')`
    );
    await fixture.pool.query(
      `INSERT INTO detalle_boletos (reserva_id, asiento_id, nombre_pasajero, cedula_pasajero, precio)
       SELECT 1, a.id, 'Pasajero Fallback', '1710034065', 5.00
       FROM asientos a WHERE a.bus_id = 1 AND a.numero_asiento = 1`
    );

    const list = await api('/oficina/reservas-pendientes');
    assert.equal(list.status, 200);
    assert.equal(list.data.length, 1);
    assert.equal(list.data[0].cliente_nombre, 'Pasajero Fallback');
    assert.equal(list.data[0].cliente_cedula, '1710034065');
    assert.equal(list.data[0].comprobante_disponible, false);

    // Aunque la imagen haya desaparecido del disco efímero, el oficinista puede aprobar sin bloqueo.
    const approve = await api('/oficina/reservas/1/aprobar', { method: 'PUT' });
    assert.equal(approve.status, 200);
    assert.equal(approve.data.reserva.estado, 'PAGADO');
  });

  test('bandeja de oficina reporta comprobante_disponible=true cuando el archivo existe localmente', async () => {
    mkdirSync(UPLOADS_DIR, { recursive: true });
    const tempFile = 'comprobante-cr11-temp-test.png';
    const tempPath = path.join(UPLOADS_DIR, tempFile);
    writeFileSync(tempPath, Buffer.from('png-demo'));
    try {
      await fixture.pool.query(
        `INSERT INTO reservas (id, programacion_id, codigo_reserva, total, estado, comprobante_url, expira_en)
         VALUES (2, 1, 'CR11-OK', 5.00, 'PENDIENTE', $1, '2100-01-02')`,
        [`/uploads/${tempFile}`]
      );
      await fixture.pool.query(
        `INSERT INTO detalle_boletos (reserva_id, asiento_id, nombre_pasajero, cedula_pasajero, precio)
         SELECT 2, a.id, 'Pasajero Presente', '1710034065', 5.00
         FROM asientos a WHERE a.bus_id = 1 AND a.numero_asiento = 2`
      );

      const list = await api('/oficina/reservas-pendientes');
      assert.equal(list.status, 200);
      assert.equal(list.data[0].comprobante_disponible, true);
    } finally {
      try { unlinkSync(tempPath); } catch {}
    }
  });
});
