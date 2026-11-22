import { test, expect } from '@playwright/test';

const frequency = { id: 1, cooperativa_id: 1, cooperativa_nombre: 'Cooperativa de prueba',
  origen: 'Ambato', destino: 'Quito', hora_salida: '07:05:00', precio_base: '9.50',
  resolucion_ant: 'ANT-CR02-001', tipo_servicio: 'DIRECTO', paradas_intermedias: [], activo: true };
const trip = { ...frequency, programacion_id: 1, id: 1, hora_salida_programada: '07:05:00',
  estado: 'PROGRAMADO', numero_disco: 15, placa: 'TEST-001', capacidad: 40,
  asientos_disponibles: 40, asientos_disponibles_normal: 32, asientos_disponibles_vip: 8 };
const cooperative = { id: 1, nombre: trip.cooperativa_nombre, ruc: '1890012345001', activo: true,
  color_distintivo: '#1E40AF', telefono: '032820000', direccion: 'Terminal de prueba', resolucion_ant: frequency.resolucion_ant };
const reservation = { ...trip, codigo_reserva: 'CR02-PRUEBA', estado: 'PAGADO', comprado_en: '2026-11-20T20:00:15Z',
  fecha_viaje: '2026-11-22', total: '9.50', boletos: [{ id: 1, numero_asiento: 9, categoria: 'NORMAL',
    nombre_pasajero: 'Pasajero de prueba', cedula_pasajero: '1710034065', precio: '9.50',
    tarifa_base: '9.50', descuento: '0.00', tipo_pasajero: 'NORMAL' }] };

async function mockApi(page, { role, price = '9.50' } = {}) {
  const writes = [];
  let current = reservation;
  if (role) await page.addInitScript(user => localStorage.setItem('transporte_auth', JSON.stringify(user)), {
    id: 1, rol: role, nombre: 'Usuario de prueba', cooperativa_id: 1, bus_id: 1, token: 'sesion-aislada-cr02',
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (route.request().method() !== 'GET') {
      writes.push({ path: url.pathname, data: route.request().postDataJSON() });
      if (url.pathname === '/api/reservas') {
        current = { ...reservation, estado: 'PENDIENTE', expira_en: new Date(Date.now() + 300000).toISOString() };
        return json({ reserva: current }, 201);
      }
      return json({ error: 'Mutación no prevista en la prueba' }, 400);
    }
    if (['/api/cooperativas', '/api/admin/cooperativas'].includes(url.pathname)) return json([cooperative]);
    if (url.pathname === '/api/admin/buses') return json([{ ...trip, cooperativa_id: 1 }]);
    if (['/api/frecuencias', '/api/admin/frecuencias'].includes(url.pathname)) return json([frequency]);
    if (url.pathname === '/api/viajes') return json([{ ...trip, precio_base: price, fecha_viaje: url.searchParams.get('fecha') }]);
    if (url.pathname === '/api/viajes/1/asientos') return json(Array.from({ length: 40 }, (_, i) => ({
      asiento_id: i + 1, numero_asiento: i + 1, categoria: i < 8 ? 'VIP' : 'NORMAL', estado_ocupacion: 'DISPONIBLE',
    })));
    if (url.pathname === '/api/reservas/CR02-PRUEBA') return json(current);
    if (url.pathname === '/api/reservas-pendientes') return json([{ reserva_id: 1, cliente_nombre: 'Pasajero de prueba',
      cliente_cedula: '1710034065', origen: 'Ambato', destino: 'Quito', hora_salida: '07:05:00', total_pagado: '9.5' }]);
    if (url.pathname === '/api/chofer/viajes') return json([trip]);
    if (url.pathname === '/api/chofer/viajes/1/manifiesto') return json({ pasajeros: [], resumen: { validados: 0, total_pasajeros: 0 } });
    if (url.pathname === '/api/mis-compras') return json([{ ...reservation, id: 1, total_pasajeros: 1 }]);
    return json({ error: 'No encontrado' }, 404);
  });
  await page.route('**/*.tile.openstreetmap.org/**', route => route.abort());
  return writes;
}

test('CR-02: resultados de cliente muestran moneda uniforme y salida sin segundos', async ({ page }, testInfo) => {
  const writes = await mockApi(page); await page.goto('/');
  const card = page.locator('.trip-card');
  await expect(card.locator('.trip-price > strong')).toHaveText('$ 9.50 USD');
  await expect(card.locator('.trip-route > strong')).toHaveText('07:05');
  await card.screenshot({ path: testInfo.outputPath('cliente-moneda-hora.png') });
  expect(writes).toEqual([]);
});

test('CR-02: administración usa el mismo formato y mantiene los valores editables', async ({ page }, testInfo) => {
  const writes = await mockApi(page, { role: 'SUPERADMIN' }); await page.goto('/#admin');
  await page.getByRole('button', { name: /Frecuencias oficiales \(ANT\)/i }).click();
  const row = page.getByRole('row').filter({ hasText: 'ANT-CR02-001' });
  await expect(row.getByRole('cell', { name: '07:05', exact: true })).toBeVisible();
  await expect(row.getByText('$ 9.50 USD', { exact: true })).toBeVisible();
  await page.getByRole('table').screenshot({ path: testInfo.outputPath('administracion-moneda-hora.png') });
  await row.getByRole('button', { name: 'Editar frecuencia oficial' }).click();
  await expect(page.locator('input[type="number"]').first()).toHaveValue('9.50');
  await expect(page.locator('input[type="time"]').first()).toHaveValue('07:05');
  expect(writes).toEqual([]);
});

test('CR-02: vista previa institucional corrige textos y elimina AM sin guardar cambios', async ({ page }) => {
  const writes = await mockApi(page, { role: 'SUPERADMIN' }); await page.goto('/#admin');
  await page.getByRole('button', { name: 'Personalizar Marca' }).first().click();
  await expect(page.getByText('FECHA Y HORA', { exact: true })).toBeVisible();
  await expect(page.getByText('CÓDIGO DE RESERVA', { exact: true })).toBeVisible();
  await expect(page.getByText('15/10/2026 | 07:00', { exact: true })).toBeVisible();
  await expect(page.getByText('N.º 04 (VIP)', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test('CR-02: comprobantes y cabina de chofer presentan horarios HH:mm', async ({ page }) => {
  const writes = await mockApi(page, { role: 'SUPERADMIN' }); await page.goto('/#oficina');
  await expect(page.getByRole('heading', { name: 'Bandeja de comprobantes pendientes' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '$ 9.50 USD', exact: true })).toBeVisible();
  await expect(page.getByText('07:05', { exact: true })).toBeVisible();
  await page.goto('/#chofer');
  await expect(page.getByText('07:05', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('07:05:00', { exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
});

test('CR-02: boleto e historial conservan moneda, horarios y segundos de compra', async ({ page }) => {
  const writes = await mockApi(page); await page.goto('/#boleto');
  await page.getByLabel('Código de reserva', { exact: true }).fill('CR02-PRUEBA');
  await page.getByRole('button', { name: 'Consultar reserva', exact: true }).click();
  const ticket = page.locator('.ticket-card');
  await expect(ticket).toContainText('$ 9.50 USD');
  await expect(ticket).toContainText('$ 0.00 USD');
  await expect(ticket).toContainText('07:05');
  await expect(ticket).toContainText('15:00:15');
  await page.goto('/#mis-compras?token=acceso-aislado-cr02');
  await expect(page.getByText(/Pagado · \$ 9\.50 USD/)).toBeVisible();
  expect(writes).toEqual([]);
});

test('CR-02: checkout conserva números y códigos en la solicitud aunque cambie el formato visual', async ({ page }) => {
  const writes = await mockApi(page); await page.goto('/');
  await page.getByRole('button', { name: 'Elegir asientos' }).click();
  await page.getByRole('button', { name: 'Asiento 9, normal, disponible', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.locator('.total-row strong')).toHaveText('$ 9.50 USD');
  await page.getByLabel('Correo electrónico para recibir los boletos con QR').fill('pasajero@prueba.test');
  await page.getByLabel('Nombre completo').fill('Pasajero de prueba');
  await page.getByLabel('Cédula', { exact: true }).fill('1710034065');
  await expect(page.getByRole('option', { name: 'Tercera edad (50 % de descuento)', exact: true })).toHaveAttribute('value', 'TERCERA_EDAD');
  await page.getByRole('button', { name: 'Reservar por 5 minutos' }).click();
  await expect(page.getByText('CR02-PRUEBA', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].data.programacion_id).toBe(1);
  expect(writes[0].data.asientos).toEqual([9]);
  expect(writes[0].data.pasajeros[0].precio).toBe(9.5);
  expect(writes[0].data.pasajeros[0].tipo_pasajero).toBe('NORMAL');
});

for (const width of [320, 390, 768]) test(`CR-02: moneda con USD sin desbordamiento a ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  await mockApi(page, { price: '1234.56' }); await page.goto('/');
  await expect(page.locator('.trip-price > strong')).toHaveText('$ 1234.56 USD');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (width === 390) await page.locator('.trip-card').screenshot({ path: testInfo.outputPath('movil-moneda-hora.png') });
});
