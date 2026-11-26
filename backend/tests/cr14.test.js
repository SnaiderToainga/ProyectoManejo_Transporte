const { describe, test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createFixture } = require('./helpers/planningFixture');

const MIG_07 = fs.readFileSync(path.join(__dirname, '../database/07_cr01_cooperativas_clientes_pagos.sql'), 'utf8');
const MIG_09 = fs.readFileSync(path.join(__dirname, '../database/09_cr14_branding_soporte.sql'), 'utf8');
const NOTIFICATIONS_DIR = path.join(__dirname, '../uploads/notificaciones');
const MAIL_ENV = ['RESEND_API_KEY', 'RESEND_FROM', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

const listNotifications = () => (fs.existsSync(NOTIFICATIONS_DIR) ? fs.readdirSync(NOTIFICATIONS_DIR) : []);

describe('CR-14: producción Vercel/Render, branding de soporte y notificaciones de estado', () => {
  let fixture, server, base;
  const savedEnv = {};
  let notificationsBefore = [];

  async function api(route, { method = 'GET', user = 2, data } = {}) {
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
    // Sin credenciales de correo: las pruebas nunca deben enviar correos reales.
    for (const key of MAIL_ENV) { savedEnv[key] = process.env[key]; delete process.env[key]; }
    notificationsBefore = listNotifications();
    fixture = await createFixture();
    // Columnas institucionales de CR-01 que usa la actualización de cooperativas.
    await fixture.database.exec(MIG_07);
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
    // Esperar a que terminen los avisos asíncronos disparados por los controladores.
    await new Promise(resolve => setTimeout(resolve, 300));
    await new Promise(resolve => server.close(resolve));
    await fixture.database.close();
    for (const file of listNotifications()) {
      if (!notificationsBefore.includes(file)) fs.unlinkSync(path.join(NOTIFICATIONS_DIR, file));
    }
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('migración 09 es aditiva, repetible y agrega las 4 columnas de soporte', async () => {
    await fixture.database.exec(MIG_09);
    await fixture.database.exec(MIG_09);
    const { rows } = await fixture.pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'cooperativas'
         AND column_name IN ('facebook_url', 'instagram_url', 'whatsapp_soporte', 'correo_soporte')`
    );
    assert.equal(rows.length, 4);
  });

  test('gerencia guarda redes sociales y soporte validados en su cooperativa', async () => {
    const res = await api('/admin/cooperativas/1', {
      method: 'PUT',
      data: {
        facebook_url: 'https://facebook.com/cooperativa-prueba',
        instagram_url: 'https://www.instagram.com/cooperativa.prueba',
        whatsapp_soporte: '099 123-4567',
        correo_soporte: 'Soporte@Prueba.test'
      }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.cooperativa.facebook_url, 'https://facebook.com/cooperativa-prueba');
    assert.equal(res.data.cooperativa.instagram_url, 'https://www.instagram.com/cooperativa.prueba');
    assert.equal(res.data.cooperativa.whatsapp_soporte, '0991234567');
    assert.equal(res.data.cooperativa.correo_soporte, 'soporte@prueba.test');

    // Vaciar un canal lo deja en NULL sin tocar los demás.
    const cleared = await api('/admin/cooperativas/1', { method: 'PUT', data: { instagram_url: '' } });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.data.cooperativa.instagram_url, null);
    assert.equal(cleared.data.cooperativa.facebook_url, 'https://facebook.com/cooperativa-prueba');
  });

  test('rechaza URLs peligrosas (javascript:, data:, credenciales) y datos de soporte inválidos', async () => {
    const cases = [
      { facebook_url: 'javascript:alert(1)' },
      { instagram_url: 'data:text/html;base64,PHNjcmlwdD4=' },
      { facebook_url: 'https://usuario:clave@facebook.com/coop' },
      { facebook_url: 'ftp://facebook.com/coop' },
      { instagram_url: 'https://instagram.com/coop"><script>' },
      { whatsapp_soporte: 'llamar-ya' },
      { correo_soporte: 'sin-arroba' }
    ];
    for (const data of cases) {
      const res = await api('/admin/cooperativas/1', { method: 'PUT', data });
      assert.equal(res.status, 400, `debió rechazar ${JSON.stringify(data)}`);
    }
    const { rows: [coop] } = await fixture.pool.query('SELECT facebook_url, instagram_url FROM cooperativas WHERE id = 1');
    assert.equal(coop.facebook_url, null);
    assert.equal(coop.instagram_url, null);
  });

  test('gerencia no puede editar los canales de otra cooperativa', async () => {
    const res = await api('/admin/cooperativas/2', { method: 'PUT', data: { facebook_url: 'https://facebook.com/ajena' } });
    assert.equal(res.status, 403);
  });

  test('el catálogo público expone los canales de soporte de la cooperativa del viaje', async () => {
    await fixture.pool.query(
      `UPDATE cooperativas SET facebook_url = 'https://facebook.com/coop', whatsapp_soporte = '0991234567' WHERE id = 1`
    );
    const res = await api('/viajes?fecha=2100-01-01', { user: null });
    assert.equal(res.status, 200);
    const trip = res.data.find(item => Number(item.programacion_id) === 1);
    assert.ok(trip, 'el viaje programado debe aparecer en el catálogo');
    assert.equal(trip.facebook_url, 'https://facebook.com/coop');
    assert.equal(trip.whatsapp_soporte, '0991234567');
    assert.equal(trip.instagram_url, null);
  });

  test('rechazar un comprobante responde 200 y libera asientos aunque no haya SMTP/Resend configurado', async () => {
    await fixture.pool.query(
      `INSERT INTO reservas (id, programacion_id, usuario_id, codigo_reserva, total, estado, comprobante_url)
       VALUES (1, 1, 5, 'CR14-RECH', 5.00, 'PENDIENTE', '/uploads/comprobante-cr14.png')`
    );
    await fixture.pool.query(
      `INSERT INTO detalle_boletos (reserva_id, asiento_id, nombre_pasajero, cedula_pasajero, precio)
       SELECT 1, a.id, 'Pasajero CR14', '1710034065', 5.00 FROM asientos a WHERE a.bus_id = 1 AND a.numero_asiento = 1`
    );
    const res = await api('/oficina/reservas/1/rechazar', { method: 'PUT', user: 4 });
    assert.equal(res.status, 200);
    assert.equal(res.data.reserva.estado, 'RECHAZADO');
  });

  test('notifyReservationStatus usa plantilla propia y respaldo local, sin emitir boleto', async () => {
    const { notifyReservationStatus } = require('../src/services/receiptData');
    await fixture.pool.query(
      `INSERT INTO reservas (id, programacion_id, usuario_id, codigo_reserva, total, estado)
       VALUES (2, 1, 5, 'CR14-REV', 5.00, 'PENDIENTE'), (3, 1, 5, 'CR14-NO', 5.00, 'RECHAZADO')`
    );
    const review = await notifyReservationStatus(fixture.pool, 'CR14-REV', 'COMPROBANTE_EN_REVISION');
    assert.equal(review.exito, true);
    assert.equal(review.enviadoReal, false);
    assert.equal(review.tipo, 'COMPROBANTE_EN_REVISION');
    const html = fs.readFileSync(path.join(__dirname, '..', review.filePath), 'utf8');
    assert.match(html, /Recibimos tu comprobante de pago/);
    assert.doesNotMatch(html, /Pago Validado|Comprobante Oficial de Abordaje/);

    // Un aviso que no corresponde al estado real de la reserva no se envía.
    assert.equal(await notifyReservationStatus(fixture.pool, 'CR14-NO', 'COMPROBANTE_EN_REVISION'), null);
    await assert.rejects(() => notifyReservationStatus(fixture.pool, 'CR14-REV', 'PAGADO'));
  });

  test('la plantilla de estado escapa HTML y diferencia revisión de rechazo', () => {
    const { generarPlantillaEstadoReserva, ESTADOS_NOTIFICACION } = require('../src/services/emailService');
    const datos = { cooperativa: '<script>x</script>', origen: 'Ambato', destino: 'Quito', reservaId: 'RES-1', fecha: '2100-01-01', hora: '08:00', asientos: [1], total: 5 };
    const rechazo = generarPlantillaEstadoReserva(datos, 'RECHAZADO');
    assert.doesNotMatch(rechazo, /<script>x<\/script>/);
    assert.match(rechazo, /los asientos quedaron liberados/);
    assert.equal(ESTADOS_NOTIFICACION.RECHAZADO.asunto(datos), '⚠️ Reserva rechazada: Ambato a Quito (RES-1)');
    assert.equal(ESTADOS_NOTIFICACION.COMPROBANTE_EN_REVISION.asunto(datos), '🕒 Comprobante recibido: Ambato a Quito (RES-1)');
  });

  test('CORS permite producción, FRONTEND_URL/CORS_ORIGINS, redes locales y peticiones sin Origin', () => {
    const { isAllowedOrigin, buildCorsOptions } = require('../src/config/corsOptions');
    const env = { FRONTEND_URL: 'https://mi-front.vercel.app/', CORS_ORIGINS: 'https://extra.example.test, https://otro.example.test' };
    for (const origin of ['https://proyecto-web.online', 'https://www.proyecto-web.online', 'https://mi-front.vercel.app',
      'https://extra.example.test', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://192.168.1.20:5173', undefined]) {
      assert.equal(isAllowedOrigin(origin, env), true, `debió permitir ${origin}`);
    }
    for (const origin of ['https://malicioso.example', 'https://proyecto-web.online.evil.test', 'http://172.32.0.1:5173', 'null']) {
      assert.equal(isAllowedOrigin(origin, env), false, `debió bloquear ${origin}`);
    }
    const options = buildCorsOptions(env);
    assert.deepEqual(options.methods, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
    for (const header of ['Content-Type', 'Authorization', 'Idempotency-Key', 'x-user-role', 'x-user-cooperativa-id']) {
      assert.ok(options.allowedHeaders.includes(header), `falta la cabecera ${header}`);
    }
  });
});
