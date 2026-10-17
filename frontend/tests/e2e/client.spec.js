import { test, expect } from '@playwright/test';

const trips = [
  { programacion_id: 1, origen: 'Ambato', destino: 'Quito', hora_salida_programada: '07:00:00', precio_base: '4.50', capacidad: 40, tiene_bano_posterior: true, cooperativa_nombre: 'Cooperativa de prueba A', numero_disco: 15, estado: 'PROGRAMADO' },
  { programacion_id: 2, origen: 'Ambato', destino: 'Guayaquil', hora_salida_programada: '10:00:00', precio_base: '9.00', capacidad: 41, tiene_bano_posterior: false, cooperativa_nombre: 'Cooperativa de prueba B', numero_disco: 18, estado: 'PROGRAMADO' },
];
const seats = (id) => Array.from({ length: id === 1 ? 40 : 41 }, (_, i) => ({ asiento_id: id * 100 + i + 1, numero_asiento: i + 1, categoria: i < 8 ? 'VIP' : 'NORMAL', estado_ocupacion: i === 11 ? 'OCUPADO' : 'DISPONIBLE' }));

async function mockApi(page, { conflict = false, uploadStatus = 'PAGADO', expiration = 300000 } = {}) {
  const state = { reservation: null, creations: 0, uploads: 0 };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/cooperativas') return json(trips.map((trip, i) => ({ id: i + 1, nombre: trip.cooperativa_nombre, banco: 'Banco de prueba', cuenta_bancaria: 'SOLO-PRUEBA' })));
    if (path === '/api/viajes') return json(trips.map(trip => ({ ...trip, fecha_viaje: url.searchParams.get('fecha') })));
    if (/\/viajes\/\d+\/asientos$/.test(path)) return json(seats(Number(path.split('/')[3])));
    if (path === '/api/reservas') {
      state.creations++;
      if (conflict) return json({ error: 'Uno o más asientos seleccionados ya no están disponibles', asientos_ocupados: [101] }, 409);
      const payload = route.request().postDataJSON();
      expect(payload.pasajeros).toHaveLength(payload.asientos.length);
      expect(payload.pasajeros[0].nombre).toBe('Pasajero de prueba');
      const trip = trips.find(t => t.programacion_id === payload.programacion_id);
      state.reservation = { ...trip, codigo_reserva: 'RES-PRUEBA', estado: 'PENDIENTE', expira_en: new Date(Date.now() + expiration).toISOString(), total: payload.pasajeros.reduce((sum, p) => sum + p.precio, 0), fecha_viaje: '2026-10-20', boletos: payload.pasajeros.map((p, i) => ({ id: i + 1, nombre_pasajero: p.nombre, cedula_pasajero: p.cedula, numero_asiento: p.asiento_id % 100, categoria: 'VIP', precio: p.precio })) };
      return json({ reserva: state.reservation }, 201);
    }
    if (path.endsWith('/comprobante')) {
      state.uploads++;
      expect(route.request().headers()['content-type']).toContain('multipart/form-data');
      expect(route.request().postData()).toContain('name="comprobante"');
      state.reservation = { ...state.reservation, estado: uploadStatus, comprobante_url: '/uploads/prueba.png' };
      return json({ reserva: state.reservation });
    }
    if (path.endsWith('/pdf')) return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n% Documento ficticio de prueba\n%%EOF' });
    if (path === '/api/reservas/RES-PRUEBA' && state.reservation) return json(state.reservation);
    return json({ error: 'Reserva no encontrada' }, 404);
  });
  return state;
}
async function selectSeat(page, trip = 0) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Elegir asientos' }).nth(trip).click();
  await page.getByRole('button', { name: 'Asiento 1, VIP, disponible', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}
async function reserve(page) {
  await page.getByLabel('Nombre completo').fill('Pasajero de prueba');
  await page.getByLabel('Cédula', { exact: true }).fill('0102030405');
  await page.getByRole('button', { name: 'Reservar por 5 minutos' }).click();
  await expect(page.getByText('RES-PRUEBA', { exact: true })).toBeVisible();
}
const receipt = { name: 'prueba.png', mimeType: 'image/png', buffer: Buffer.from('comprobante-ficticio') };

test('buscar por cooperativa y horario, limpiar filtros y mostrar vacío', async ({ page }) => {
  await mockApi(page); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Elegir asientos' })).toHaveCount(2);
  await page.getByLabel('Cooperativa', { exact: true }).selectOption('Cooperativa de prueba B');
  await page.getByRole('button', { name: 'Buscar viajes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Elegir asientos' })).toHaveCount(1);
  await page.getByLabel('Desde', { exact: true }).fill('11:00');
  await page.getByRole('button', { name: 'Buscar viajes', exact: true }).click();
  await expect(page.getByText('No hay viajes con estos filtros')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByRole('button', { name: 'Elegir asientos' })).toHaveCount(2);
});

for (const capacity of [40, 41]) test(`mapa de ${capacity} asientos, ocupado no seleccionable y filtro VIP`, async ({ page }) => {
  await mockApi(page); await page.goto('/');
  await page.getByRole('button', { name: 'Elegir asientos' }).nth(capacity === 40 ? 0 : 1).click();
  const grid = page.getByRole('group', { name: `Bus de ${capacity} asientos` });
  await expect(grid.getByRole('button')).toHaveCount(capacity);
  await expect(page.getByRole('button', { name: 'Asiento 12, normal, ocupado', exact: true })).toBeDisabled();
  if (capacity === 40) await expect(page.getByLabel('Baño posterior derecho')).toBeVisible();
  else { await expect(page.getByLabel('Baño posterior derecho')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Asiento 41, normal, disponible', exact: true })).toBeVisible(); }
  await page.getByLabel('Tipo de asiento', { exact: true }).selectOption('VIP');
  await expect(page.getByRole('button', { name: 'Asiento 9, normal, fuera del filtro', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Asiento 1, VIP, disponible', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeEnabled();
});

test('comprar, subir comprobante, consultar QR y descargar PDF', async ({ page }) => {
  const state = await mockApi(page); await selectSeat(page); await reserve(page);
  await expect(page.getByRole('timer')).toHaveText(/04:5\d|05:00/);
  await page.getByLabel('Comprobante de pago', { exact: false }).setInputFiles(receipt);
  await page.getByRole('button', { name: 'Enviar comprobante', exact: true }).click();
  await expect(page.getByText('Tu viaje está confirmado')).toBeVisible();
  await expect(page.getByAltText('Código QR del boleto del asiento 1')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar boleto PDF' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('boleto-RES-PRUEBA-1.pdf');
  expect(state.creations).toBe(1); expect(state.uploads).toBe(1);
});

test('un comprobante pendiente de validación no muestra QR ni descarga', async ({ page }) => {
  await mockApi(page, { uploadStatus: 'PENDIENTE_VALIDACION' }); await selectSeat(page); await reserve(page);
  await page.getByLabel('Comprobante de pago', { exact: false }).setInputFiles(receipt);
  await page.getByRole('button', { name: 'Enviar comprobante', exact: true }).click();
  await expect(page.getByText('Comprobante en revisión')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar boleto PDF' })).toHaveCount(0);
  await expect(page.getByRole('img')).toHaveCount(0);
});

test('reserva vencida bloquea la carga y la recarga no reinicia el reloj', async ({ page }) => {
  await page.clock.install();
  const state = await mockApi(page, { expiration: 40000 }); await selectSeat(page); await reserve(page);
  await page.getByRole('button', { name: 'Consultar esta reserva' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Consultar reserva', exact: true }).click();
  await expect(page.getByRole('timer')).not.toHaveText('05:00');
  await page.clock.fastForward(45000);
  await expect(page.getByText('Reserva vencida', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar comprobante', exact: true })).toHaveCount(0);
  expect(state.uploads).toBe(0);
});

test('conflicto de asientos permite volver al mapa sin generar otra reserva', async ({ page }) => {
  const state = await mockApi(page, { conflict: true }); await selectSeat(page);
  await page.getByLabel('Nombre completo').fill('Pasajero de prueba'); await page.getByLabel('Cédula', { exact: true }).fill('0102030405');
  await page.getByRole('button', { name: 'Reservar por 5 minutos' }).click();
  await expect(page.getByRole('alert')).toContainText('ya no están disponibles');
  await page.getByRole('button', { name: 'Actualizar y elegir otros asientos' }).click();
  await expect(page.getByRole('group', { name: 'Bus de 40 asientos' })).toBeVisible(); expect(state.creations).toBe(1);
});

test('rechaza comprobantes inválidos sin enviarlos al servidor', async ({ page }) => {
  const state = await mockApi(page); await selectSeat(page); await reserve(page);
  await page.getByLabel('Comprobante de pago', { exact: false }).setInputFiles({ name: 'no-valido.txt', mimeType: 'text/plain', buffer: Buffer.from('prueba') });
  await expect(page.getByRole('alert')).toContainText('PNG, JPG o PDF');
  await expect(page.getByRole('button', { name: 'Enviar comprobante', exact: true })).toBeDisabled();
  expect(state.uploads).toBe(0);
});

test('un error de servicio nunca se sustituye por viajes ficticios', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Servicio no disponible' }) }));
  await page.goto('/'); await expect(page.getByRole('alert')).toContainText('Servicio no disponible');
  await expect(page.getByRole('button', { name: 'Elegir asientos' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Explorar una demostración' }).click();
  await expect(page.getByText('Demostración · Datos ficticios.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Elegir asientos' })).toHaveCount(3);
});

test('vista móvil sin desbordamiento, selección y formulario accesibles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockApi(page); await selectSeat(page);
  await expect(page.getByLabel('Nombre completo')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await reserve(page); await expect(page.getByRole('timer')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('la demostración permite consultar un QR de ejemplo', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?demo=1#boleto');
  await page.getByRole('button', { name: 'DEMO-PAGADO', exact: true }).click();
  await expect(page.getByAltText('Código QR del boleto del asiento 9')).toBeVisible();
  await expect(page.getByText('EJEMPLO · NO VÁLIDO PARA VIAJAR')).toBeVisible();
  expect(errors).toEqual([]);
});
