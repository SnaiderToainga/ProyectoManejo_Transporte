const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createFixture } = require('./helpers/planningFixture');

let fixture;
let server;
let baseUrl;
let cardPaymentService;
let historyAccess;
const uploadedFilesToClean = [];

const savedEnv = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
  HISTORY_TOKEN_SECRET: process.env.HISTORY_TOKEN_SECRET,
  ALLOW_LIVE_PAYMENTS: process.env.ALLOW_LIVE_PAYMENTS
};

const FUTURE_DATE = '2099-05-15';

async function api(route, { method = 'GET', data, token, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  let body;
  if (data !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }
  const response = await fetch(`${baseUrl}/api${route}`, { method, headers: reqHeaders, body });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  return { status: response.status, payload, headers: response.headers };
}

function signStripeWebhook(eventObject, secret, offsetSeconds = 0) {
  const payloadString = JSON.stringify(eventObject);
  const timestamp = Math.floor(Date.now() / 1000) + offsetSeconds;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payloadString}`)
    .digest('hex');
  return {
    payloadString,
    signatureHeader: `t=${timestamp},v1=${sig}`
  };
}

describe('CR-01: Cooperativas, Ficha de Buses, Cuentas Cliente y Pasarela Stripe Sandbox', () => {
  before(async () => {
    process.env.HISTORY_TOKEN_SECRET = 'secreto_historial_pruebas_cr01_minimo_32_bytes';
    process.env.FRONTEND_URL = 'https://uta-rutas.example.test';
    delete process.env.ALLOW_LIVE_PAYMENTS;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    fixture = await createFixture();
    const migration07 = fs.readFileSync(
      path.join(__dirname, '../database/07_cr01_cooperativas_clientes_pagos.sql'),
      'utf8'
    );
    // Verificar repetibilidad e idempotencia de la migración 07
    await fixture.database.exec(migration07);
    await fixture.database.exec(migration07);

    cardPaymentService = require('../src/services/cardPaymentService');
    historyAccess = require('../src/services/historyAccess');

    server = http.createServer(fixture.app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    cardPaymentService?.setFetchImpl(null);
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const filePath of uploadedFilesToClean) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    if (server) await new Promise(resolve => server.close(resolve));
    if (fixture?.database) await fixture.database.close();
  });

  it('migración 07 soporta capacidad flexible, campos institucionales y tablas transaccionales', async () => {
    const colCheck = await fixture.pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name IN ('cooperativas', 'usuarios', 'buses', 'reservas', 'pagos_tarjeta')`
    );
    const cols = new Set(colCheck.rows.map(r => r.column_name));
    for (const expected of ['resolucion_ant', 'correo', 'cedula', 'marca_chasis', 'carroceria', 'socio_nombre', 'foto_url', 'fotos', 'metodo_pago', 'idempotency_key', 'provider_session_id']) {
      assert.ok(cols.has(expected), `Falta columna ${expected}`);
    }
  });

  it('1. Alta atómica y edición de cooperativas con RBAC estricto e invariantes', async () => {
    const superToken = fixture.createSession(1);
    const adminCoopToken = fixture.createSession(2);

    // ADMIN_COOP no puede crear cooperativas ni editar otra
    const forbiddenCreate = await api('/admin/cooperativas', {
      method: 'POST',
      token: adminCoopToken,
      data: { nombre: 'Coop Ilegal', ruc: '1890088888001' }
    });
    assert.equal(forbiddenCreate.status, 403);

    // Rechaza RUC inválido, escalación de rol y contraseña sin símbolo
    const badRuc = await api('/admin/cooperativas', {
      method: 'POST',
      token: superToken,
      data: {
        nombre: 'Coop Inválida',
        ruc: '9990012345001',
        resolucion_ant: 'ANT-RES-2026-999',
        telefono: '0991112233',
        correo: 'info@invalida.test',
        direccion: 'Terminal Sur',
        color_distintivo: '#214E44',
        banco: 'Banco Pichincha',
        cuenta_bancaria: '2100123456',
        gerente: {
          nombre: 'Gerente Uno',
          cedula: '1710034065',
          correo: 'g1@invalida.test',
          telefono: '0981112233',
          password: 'Password123',
          rol: 'ADMIN_COOP'
        }
      }
    });
    assert.equal(badRuc.status, 400);

    // Correo duplicado de gerente debe revertir la inserción de la cooperativa (atomicidad)
    const rollbackRes = await api('/admin/cooperativas', {
      method: 'POST',
      token: superToken,
      data: {
        nombre: 'Coop Rollback Test',
        ruc: '1890055555001',
        resolucion_ant: 'ANT-RES-2026-555',
        telefono: '0992223344',
        correo: 'institucion@rollback.test',
        direccion: 'Av. Los Andes',
        color_distintivo: '#114422',
        logo_url: 'https://cdn.example.test/logo.png',
        banco: 'Banco Pichincha',
        cuenta_bancaria: '2100999888',
        gerente: {
          nombre: 'Gerente Duplicado',
          cedula: '1710034065',
          correo: 'admin_coop2@prueba.test',
          telefono: '0982223344',
          password: 'ClaveSegura9!',
          rol: 'ADMIN_COOP'
        }
      }
    });
    assert.equal(rollbackRes.status, 409);
    const notCreated = await fixture.pool.query(
      `SELECT id FROM cooperativas WHERE ruc = '1890055555001'`
    );
    assert.equal(notCreated.rowCount, 0);

    // Alta atómica válida
    const created = await api('/admin/cooperativas', {
      method: 'POST',
      token: superToken,
      data: {
        nombre: 'Cooperativa Tungurahua Express',
        ruc: '1890044444001',
        resolucion_ant: 'ANT-RES-2026-444',
        telefono: '0993334455',
        correo: 'contacto@tungurahua.test',
        direccion: 'Terminal Terrestre Ambato',
        color_distintivo: '#214e44',
        logo_url: 'https://cdn.example.test/tungurahua.png',
        banco: 'Banco de Guayaquil',
        cuenta_bancaria: '4455667788',
        gerente: {
          nombre: 'Carlos Mendoza',
          cedula: '1710034065',
          correo: 'carlos.mendoza@tungurahua.test',
          telefono: '0983334455',
          password: 'ClaveFicticia9!',
          rol: 'ADMIN_COOP'
        }
      }
    });
    assert.equal(created.status, 201);
    assert.equal(created.payload.cooperativa.resolucion_ant, 'ANT-RES-2026-444');
    assert.equal(created.payload.cooperativa.correo, 'contacto@tungurahua.test');
    assert.equal(created.payload.gerente.rol, 'ADMIN_COOP');
    assert.equal(created.payload.gerente.cedula, '1710034065');
    assert.equal(created.payload.gerente.password_hash, undefined);

    const newCoopId = created.payload.cooperativa.id;

    // Gerente creado inicia sesión correctamente
    const managerLogin = await api('/admin/login', {
      method: 'POST',
      data: { correo: 'carlos.mendoza@tungurahua.test', password: 'ClaveFicticia9!' }
    });
    assert.equal(managerLogin.status, 200);
    assert.equal(managerLogin.payload.usuario.cooperativa_id, newCoopId);
    const managerToken = managerLogin.payload.usuario.token;

    // Cross-tenant bloqueado aun manipulando cabecera x-user-role
    const crossTenantEdit = await api('/admin/cooperativas/1', {
      method: 'PUT',
      token: managerToken,
      headers: { 'x-user-role': 'SUPERADMIN', 'x-user-cooperativa-id': '1' },
      data: { nombre: 'Secuestro' }
    });
    assert.equal(crossTenantEdit.status, 403);

    // Edición legítima por el gerente de su propia cooperativa
    const selfEdit = await api(`/admin/cooperativas/${newCoopId}`, {
      method: 'PUT',
      token: managerToken,
      data: {
        resolucion_ant: 'ANT-RES-2026-445',
        correo: 'nuevo@tungurahua.test',
        color_distintivo: '#0F766E'
      }
    });
    assert.equal(selfEdit.status, 200);
    assert.equal(selfEdit.payload.cooperativa.resolucion_ant, 'ANT-RES-2026-445');
    assert.equal(selfEdit.payload.cooperativa.correo, 'nuevo@tungurahua.test');

    // GET devuelve solo la cooperativa del gerente y conserva todos los campos
    const listSelf = await api('/admin/cooperativas', { token: managerToken });
    assert.equal(listSelf.status, 200);
    assert.equal(listSelf.payload.length, 1);
    assert.equal(listSelf.payload[0].correo, 'nuevo@tungurahua.test');
    assert.equal(listSelf.payload[0].resolucion_ant, 'ANT-RES-2026-445');

    // Contraseña del gerente no fue alterada tras edición
    const managerRelogin = await api('/admin/login', {
      method: 'POST',
      data: { correo: 'carlos.mendoza@tungurahua.test', password: 'ClaveFicticia9!' }
    });
    assert.equal(managerRelogin.status, 200);
  });

  it('2. Buses con capacidad 35, ficha técnica, consulta de asientos y bloqueo ante reservas', async () => {
    const managerCoop1 = fixture.createSession(2);
    const managerCoop2 = fixture.createSession(3);

    // Alta de unidad con capacidad 35, marcas, socio y fotos
    const createdBus = await api('/admin/buses', {
      method: 'POST',
      token: managerCoop1,
      data: {
        cooperativa_id: 2, // aunque envíe 2 en body, servidor fuerza 1 o rechaza si no coincide
        numero_disco: 99,
        placa: 'TAA-0999',
        capacidad: 35,
        marca_chasis: 'Hino AK8J',
        carroceria: 'Miral Vip',
        socio_nombre: 'Juan Pérez',
        fotos: ['https://cdn.example.test/bus99-1.jpg', 'https://cdn.example.test/bus99-2.jpg']
      }
    });
    assert.equal(createdBus.status, 403);

    const validBus = await api('/admin/buses', {
      method: 'POST',
      token: managerCoop1,
      data: {
        cooperativa_id: 1,
        numero_disco: 99,
        placa: 'TAA-0999',
        capacidad: 35,
        marca_chasis: 'Hino AK8J',
        carroceria: 'Miral Vip',
        socio_nombre: 'Juan Pérez',
        fotos: ['https://cdn.example.test/bus99-1.jpg', 'https://cdn.example.test/bus99-2.jpg']
      }
    });
    assert.equal(validBus.status, 201);
    assert.equal(validBus.payload.bus.capacidad, 35);
    assert.equal(validBus.payload.bus.foto_url, 'https://cdn.example.test/bus99-1.jpg');
    assert.equal(validBus.payload.bus.fotos.length, 2);
    assert.equal(validBus.payload.total_asientos_generados, 35);
    const busId = validBus.payload.bus.id;

    // Consulta de estructura en menú admin
    const seatsRes = await api(`/admin/buses/${busId}/asientos`, { token: managerCoop1 });
    assert.equal(seatsRes.status, 200);
    assert.equal(seatsRes.payload.asientos.length, 35);

    // Otro gerente no puede ver ni editar este bus
    assert.equal((await api(`/admin/buses/${busId}/asientos`, { token: managerCoop2 })).status, 403);
    assert.equal((await api(`/admin/buses/${busId}`, {
      method: 'PUT',
      token: managerCoop2,
      data: { socio_nombre: 'Intruso' }
    })).status, 403);

    // Programar un viaje futuro con este bus y crear una reserva real
    const tripRes = await fixture.pool.query(
      `INSERT INTO programacion_viajes (frecuencia_id, bus_id, fecha_viaje, hora_salida_programada, estado)
       VALUES (1, $1, $2, '08:00', 'PROGRAMADO')
       RETURNING id`,
      [busId, FUTURE_DATE]
    );
    const tripId = tripRes.rows[0].id;

    // Catálogo público expone ficha técnica y fotos
    const catalog = await api(`/viajes?fecha=${FUTURE_DATE}`);
    assert.equal(catalog.status, 200);
    const listedTrip = catalog.payload.find(t => t.programacion_id === tripId);
    assert.ok(listedTrip);
    assert.equal(listedTrip.marca_chasis, 'Hino AK8J');
    assert.equal(listedTrip.carroceria, 'Miral Vip');
    assert.equal(listedTrip.socio_nombre, 'Juan Pérez');
    assert.equal(listedTrip.fotos.length, 2);

    const firstSeatId = seatsRes.payload.asientos[0].asiento_id;
    const reservaRes = await api('/reservas', {
      method: 'POST',
      data: {
        programacion_id: tripId,
        asientos: [firstSeatId],
        email: 'viajero.bus35@example.test',
        pasajeros: [{
          asiento_id: firstSeatId,
          nombre: 'Viajero Uno',
          cedula: '1801234566',
          tipo_pasajero: 'NORMAL'
        }]
      }
    });
    assert.equal(reservaRes.status, 201);

    // Edición de ficha técnica SIN cambiar capacidad preserva IDs de asientos y reserva
    const metadataEdit = await api(`/admin/buses/${busId}`, {
      method: 'PUT',
      token: managerCoop1,
      data: {
        capacidad: 35,
        marca_chasis: 'Scania K410',
        socio_nombre: 'Juan Pérez actualizado'
      }
    });
    assert.equal(metadataEdit.status, 200);
    assert.equal(metadataEdit.payload.bus.marca_chasis, 'Scania K410');

    const seatsAfterEdit = await api(`/admin/buses/${busId}/asientos`, { token: managerCoop1 });
    assert.equal(seatsAfterEdit.payload.asientos[0].asiento_id, firstSeatId);

    // Cambio de capacidad con reservas activas rechazado con 409
    const unsafeResize = await api(`/admin/buses/${busId}`, {
      method: 'PUT',
      token: managerCoop1,
      data: { capacidad: 40 }
    });
    assert.equal(unsafeResize.status, 409);
  });

  it('3. Cuenta personal de cliente, aislamiento de tokens, historial y privacidad estricta por cédula', async () => {
    // Registro de usuario que previamente compró como visitante (viajero.bus35@example.test)
    const reg = await api('/clientes/registro', {
      method: 'POST',
      data: {
        nombre: 'Andrea Morales',
        cedula: '1802345676',
        email: 'viajero.bus35@example.test',
        password: 'MiClaveSegura9!'
      }
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.payload.cliente.cedula, '1802345676');
    const clientToken = reg.payload.token;

    // Aislamiento estricto: token de cliente NO sirve para rutas admin, token admin NO sirve para /clientes/me
    assert.equal((await api('/admin/cooperativas', { token: clientToken })).status, 401);
    assert.equal((await api('/clientes/me', { token: fixture.createSession(1) })).status, 401);

    // /me e historial heredado tras elevar cuenta de visitante
    const profile = await api('/clientes/me', { token: clientToken });
    assert.equal(profile.status, 200);
    assert.equal(profile.payload.cliente.email, 'viajero.bus35@example.test');

    const myHistory = await api('/mis-compras', { token: clientToken });
    assert.equal(myHistory.status, 200);
    assert.equal(myHistory.payload.length, 1);

    // Login de cliente funciona correctamente
    const login = await api('/clientes/sesion', {
      method: 'POST',
      data: { email: 'viajero.bus35@example.test', password: 'MiClaveSegura9!' }
    });
    assert.equal(login.status, 200);
    assert.ok(login.payload.token);

    // Privacidad por cédula: propia (200), acompañante previo (200), tercero ajeno (404)
    const selfLookup = await api('/clientes/por-cedula/1802345676', { token: clientToken });
    assert.equal(selfLookup.status, 200);
    assert.equal(selfLookup.payload.cliente.nombre, 'Andrea Morales');

    const companionLookup = await api('/clientes/por-cedula/1801234566', { token: clientToken });
    assert.equal(companionLookup.status, 200);
    assert.equal(companionLookup.payload.cliente.nombre, 'Viajero Uno');
    assert.equal(companionLookup.payload.cliente.email, null);

    // Registrar segundo cliente completamente aparte y verificar no-enumeración entre cuentas
    const client2Reg = await api('/clientes/registro', {
      method: 'POST',
      data: {
        nombre: 'Tercero Privado',
        cedula: '1803456787',
        email: 'tercero@example.test',
        password: 'OtraClave9!'
      }
    });
    assert.equal(client2Reg.status, 201);

    const scrapingAttempt = await api('/clientes/por-cedula/1803456787', { token: clientToken });
    assert.equal(scrapingAttempt.status, 404);

    // También admite enlace de historial anterior cuando está firmado correctamente
    const magicToken = (() => {
      const p = Buffer.from(JSON.stringify({
        purpose: 'purchase-history',
        email: 'viajero.bus35@example.test',
        expires: Date.now() + 60000
      })).toString('base64url');
      const sig = crypto.createHmac('sha256', process.env.HISTORY_TOKEN_SECRET).update(p).digest('base64url');
      return `${p}.${sig}`;
    })();
    const viaMagic = await api('/clientes/por-cedula/1801234566', { token: viaMagicTokenOr(magicToken) });
    assert.equal(viaMagic.status, 200);
    assert.equal(viaMagic.payload.cliente.nombre, 'Viajero Uno');
  });

  it('4. Pasarela Stripe Sandbox USD: idempotencia, guardas, webhook HMAC, QR y comprobante DEPOSITO', async () => {
    const tripRes = await fixture.pool.query(
      `INSERT INTO programacion_viajes (frecuencia_id, bus_id, fecha_viaje, hora_salida_programada, estado)
       VALUES (1, 1, '2099-06-20', '10:30', 'PROGRAMADO')
       RETURNING id`
    );
    const tripId = tripRes.rows[0].id;
    const seats = await fixture.pool.query(
      `SELECT id FROM asientos WHERE bus_id = 1 ORDER BY numero_asiento ASC LIMIT 2`
    );

    const resCard = await api('/reservas', {
      method: 'POST',
      data: {
        programacion_id: tripId,
        asientos: [seats.rows[0].id],
        email: 'pagotarjeta@example.test',
        pasajeros: [{
          asiento_id: seats.rows[0].id,
          nombre: 'Lucía Card',
          cedula: '1710034065',
          tipo_pasajero: 'NORMAL'
        }]
      }
    });
    assert.equal(resCard.status, 201);
    const codigoCard = resCard.payload.reserva.codigo_reserva;

    // Sin configurar -> 503
    delete process.env.STRIPE_SECRET_KEY;
    const missingKey = await api(`/reservas/${codigoCard}/pago-tarjeta`, {
      method: 'POST',
      data: { metodo_pago: 'TARJETA' }
    });
    assert.equal(missingKey.status, 503);

    // Con llave live bloqueada -> 503
    process.env.STRIPE_SECRET_KEY = 'sk_live_ficticia_rechazada';
    const liveKey = await api(`/reservas/${codigoCard}/pago-tarjeta`, {
      method: 'POST',
      data: { metodo_pago: 'TARJETA' }
    });
    assert.equal(liveKey.status, 503);

    // Con llave sandbox sk_test_ y dominio inseguro devuelto -> 502
    process.env.STRIPE_SECRET_KEY = 'sk_test_sandbox_uta_12345';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_sandbox_uta_12345';
    cardPaymentService.setFetchImpl(async () => new Response(JSON.stringify({
      id: 'cs_test_bad',
      url: 'https://evil-phishing.example.test/pay'
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const evilDomain = await api(`/reservas/${codigoCard}/pago-tarjeta`, {
      method: 'POST',
      data: { metodo_pago: 'TARJETA' }
    });
    assert.equal(evilDomain.status, 502);

    // Con respuesta oficial checkout.stripe.com: valida cálculo USD desde BD e idempotencia
    let stripeCalls = 0;
    let capturedStripeParams = null;
    cardPaymentService.setFetchImpl(async (url, init) => {
      if (init?.method === 'GET' && String(url).includes('/v1/checkout/sessions/cs_test_valid_1001')) {
        return new Response(JSON.stringify({
          id: 'cs_test_valid_1001',
          status: 'open',
          payment_status: 'unpaid',
          currency: 'usd',
          amount_total: 500
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      stripeCalls++;
      capturedStripeParams = new URLSearchParams(init.body);
      return new Response(JSON.stringify({
        id: 'cs_test_valid_1001',
        payment_intent: 'pi_test_1001',
        status: 'open',
        payment_status: 'unpaid',
        url: 'https://checkout.stripe.com/c/pay/cs_test_valid_1001'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const payInit1 = await api(`/reservas/${codigoCard}/pago-tarjeta`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `cr01-${codigoCard}` },
      data: { metodo_pago: 'TARJETA', amount: 0.01, success_url: 'https://evil.test' }
    });
    assert.equal(payInit1.status, 201);
    assert.equal(payInit1.payload.checkout_url, 'https://checkout.stripe.com/c/pay/cs_test_valid_1001');
    assert.equal(stripeCalls, 1);
    assert.equal(capturedStripeParams.get('line_items[0][price_data][currency]'), 'usd');
    assert.equal(capturedStripeParams.get('line_items[0][price_data][unit_amount]'), '500');
    assert.ok(capturedStripeParams.get('success_url').startsWith('https://uta-rutas.example.test/?reserva='));

    // Misma Idempotency-Key reutiliza sesión sin volver a invocar a Stripe
    const payInit2 = await api(`/reservas/${codigoCard}/pago-tarjeta`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `cr01-${codigoCard}` },
      data: { metodo_pago: 'TARJETA' }
    });
    assert.equal(payInit2.status, 200);
    assert.equal(payInit2.payload.idempotent, true);
    assert.equal(stripeCalls, 1);

    // Reserva sigue PENDIENTE antes del webhook (sin aprobación ficticia)
    const statusBefore = await api(`/reservas/${codigoCard}`);
    assert.equal(statusBefore.payload.estado, 'PENDIENTE');

    // Taquilla no puede aprobar manualmente una sesión de tarjeta sin comprobante -> 409
    const manualClerk = await api(`/oficina/reservas/${statusBefore.payload.id}/aprobar`, {
      method: 'PUT',
      token: fixture.createSession(4)
    });
    assert.equal(manualClerk.status, 409);

    // Webhook sin firma o firma incorrecta -> 400
    const badWebhook = await fetch(`${baseUrl}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=123,v1=deadbeef' },
      body: JSON.stringify({ id: 'evt_bad', type: 'checkout.session.completed' })
    });
    assert.equal(badWebhook.status, 400);

    // Webhook con monto adulterado -> 400 y reserva intacta PENDIENTE
    const tampered = signStripeWebhook({
      id: 'evt_tamper',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_valid_1001', currency: 'usd', amount_total: 100, payment_status: 'paid' } }
    }, process.env.STRIPE_WEBHOOK_SECRET);
    const tamperedResp = await fetch(`${baseUrl}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': tampered.signatureHeader },
      body: tampered.payloadString
    });
    assert.equal(tamperedResp.status, 400);

    // Webhook firmado legítimo -> PAGADO, QR, PDF descargable, reentrega idempotente 200
    const signedOk = signStripeWebhook({
      id: 'evt_ok_1001',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_valid_1001',
          payment_intent: 'pi_test_confirmed_1001',
          currency: 'usd',
          amount_total: 500,
          payment_status: 'paid'
        }
      }
    }, process.env.STRIPE_WEBHOOK_SECRET);
    const okResp = await fetch(`${baseUrl}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signedOk.signatureHeader },
      body: signedOk.payloadString
    });
    assert.equal(okResp.status, 200);

    const statusAfter = await api(`/reservas/${codigoCard}`);
    assert.equal(statusAfter.payload.estado, 'PAGADO');
    assert.equal(statusAfter.payload.metodo_pago, 'TARJETA');
    assert.equal(statusAfter.payload.expira_en, null);
    assert.ok(statusAfter.payload.comprado_en);
    assert.ok(statusAfter.payload.boletos[0].codigo_qr.startsWith(`QR-${codigoCard}-`));

    const pdfResp = await fetch(`${baseUrl}/api/reservas/${codigoCard}/boletos/${statusAfter.payload.boletos[0].id}/pdf`);
    assert.equal(pdfResp.status, 200);
    assert.equal(pdfResp.headers.get('content-type'), 'application/pdf');

    // Reentrega idempotente del webhook -> 200
    const dupResp = await fetch(`${baseUrl}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signedOk.signatureHeader },
      body: signedOk.payloadString
    });
    assert.equal(dupResp.status, 200);
    assert.equal((await dupResp.json()).already_processed, true);

    // Segunda reserva pagada mediante DEPOSITO multipart y protección frente a doble liquidación
    const resDep = await api('/reservas', {
      method: 'POST',
      data: {
        programacion_id: tripId,
        asientos: [seats.rows[1].id],
        email: 'deposito@example.test',
        pasajeros: [{
          asiento_id: seats.rows[1].id,
          nombre: 'Marco Depósito',
          cedula: '1801234566',
          tipo_pasajero: 'NORMAL'
        }]
      }
    });
    assert.equal(resDep.status, 201);
    const codigoDep = resDep.payload.reserva.codigo_reserva;

    // Abre primero sesión tarjeta y luego cambia a comprobante DEPOSITO -> anula sesión tarjeta pendiente
    let secondStripeCalls = 0;
    cardPaymentService.setFetchImpl(async () => {
      secondStripeCalls++;
      return new Response(JSON.stringify({
        id: 'cs_test_cancelled_by_deposit',
        url: 'https://checkout.stripe.com/c/pay/cs_test_cancelled_by_deposit'
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    assert.equal((await api(`/reservas/${codigoDep}/pago-tarjeta`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `cr01-${codigoDep}` },
      data: { metodo_pago: 'TARJETA' }
    })).status, 201);
    assert.equal(secondStripeCalls, 1);

    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const form = new FormData();
    form.append('metodo_pago', 'DEPOSITO');
    form.append('comprobante', new Blob([pngHeader], { type: 'image/png' }), 'deposito.png');

    const compResp = await fetch(`${baseUrl}/api/reservas/${codigoDep}/comprobante`, {
      method: 'POST',
      body: form
    });
    const compJson = await compResp.json();
    assert.equal(compResp.status, 200);
    assert.equal(compJson.reserva.estado, 'PENDIENTE');
    assert.equal(compJson.reserva.metodo_pago, 'DEPOSITO');
    if (compJson.reserva.comprobante_url) {
      uploadedFilesToClean.push(path.join(__dirname, '../uploads', path.basename(compJson.reserva.comprobante_url)));
    }

    // No permite iniciar otra sesión tarjeta cuando ya existe comprobante en revisión
    assert.equal((await api(`/reservas/${codigoDep}/pago-tarjeta`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `cr01-${codigoDep}-retry` },
      data: { metodo_pago: 'TARJETA' }
    })).status, 409);

    // Webhook tardío de esa sesión cancelada por comprobante debe rechazarse (409)
    const lateWebhook = signStripeWebhook({
      id: 'evt_late_1002',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_cancelled_by_deposit',
          currency: 'usd',
          amount_total: 500,
          payment_status: 'paid'
        }
      }
    }, process.env.STRIPE_WEBHOOK_SECRET);
    const lateResp = await fetch(`${baseUrl}/api/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': lateWebhook.signatureHeader },
      body: lateWebhook.payloadString
    });
    assert.equal(lateResp.status, 409);
  });

  it('5. Conciliación servidor-a-servidor al consultar GET /reservas/:codigo sin webhook local', async () => {
    const tripRes = await fixture.pool.query(
      `INSERT INTO programacion_viajes (frecuencia_id, bus_id, fecha_viaje, hora_salida_programada, estado)
       VALUES (1, 1, '2099-07-01', '12:00', 'PROGRAMADO')
       RETURNING id`
    );
    const seats = await fixture.pool.query(
      `SELECT id FROM asientos WHERE bus_id = 1 ORDER BY numero_asiento ASC LIMIT 1 OFFSET 3`
    );

    const reservaRes = await api('/reservas', {
      method: 'POST',
      data: {
        programacion_id: tripRes.rows[0].id,
        asientos: [seats.rows[0].id],
        email: 'conciliacion@example.test',
        pasajeros: [{
          asiento_id: seats.rows[0].id,
          nombre: 'Sofía Sandbox',
          cedula: '1710034065',
          tipo_pasajero: 'NORMAL'
        }]
      }
    });
    assert.equal(reservaRes.status, 201);
    const codigo = reservaRes.payload.reserva.codigo_reserva;

    process.env.STRIPE_SECRET_KEY = 'sk_test_sandbox_poll_12345';
    let sessionState = 'open';
    let paymentStatus = 'unpaid';

    cardPaymentService.setFetchImpl(async (url, init) => {
      if (init?.method === 'POST' && String(url).endsWith('/v1/checkout/sessions')) {
        return new Response(JSON.stringify({
          id: 'cs_test_poll_2001',
          status: 'open',
          payment_status: 'unpaid',
          url: 'https://checkout.stripe.com/c/pay/cs_test_poll_2001'
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (init?.method === 'GET' && String(url).includes('/v1/checkout/sessions/cs_test_poll_2001')) {
        return new Response(JSON.stringify({
          id: 'cs_test_poll_2001',
          status: sessionState,
          payment_status: paymentStatus,
          currency: 'usd',
          amount_total: 500,
          payment_intent: paymentStatus === 'paid' ? 'pi_test_poll_2001' : null
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`Unexpected fetch ${init?.method} ${url}`);
    });

    const initPay = await api(`/reservas/${codigo}/pago-tarjeta`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `cr01-${codigo}` },
      data: { metodo_pago: 'TARJETA' }
    });
    assert.equal(initPay.status, 201);

    // Mientras Stripe reporta open/unpaid, GET mantiene PENDIENTE
    const stillPending = await api(`/reservas/${codigo}`);
    assert.equal(stillPending.status, 200);
    assert.equal(stillPending.payload.estado, 'PENDIENTE');

    // Al completar pago en Stripe Sandbox, GET concilia servidor-a-servidor y emite QR/PDF
    sessionState = 'complete';
    paymentStatus = 'paid';
    const reconciled = await api(`/reservas/${codigo}`);
    assert.equal(reconciled.status, 200);
    assert.equal(reconciled.payload.estado, 'PAGADO');
    assert.equal(reconciled.payload.metodo_pago, 'TARJETA');
    assert.ok(reconciled.payload.boletos[0].codigo_qr.startsWith(`QR-${codigo}-`));

    const pdfResp = await fetch(`${baseUrl}/api/reservas/${codigo}/boletos/${reconciled.payload.boletos[0].id}/pdf`);
    assert.equal(pdfResp.status, 200);
    assert.equal(pdfResp.headers.get('content-type'), 'application/pdf');
  });
});

function viaMagicTokenOr(token) {
  return token;
}
