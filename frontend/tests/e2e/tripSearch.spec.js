import { test, expect } from '@playwright/test';

const pageErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async ({ page }) => expect(pageErrors.get(page)).toEqual([]));

const trips = [
  { programacion_id: 1, origen: 'Quito', destino: 'Loja', paradas_intermedias: ['Latacunga', 'Ambato', 'Riobamba', 'Cuenca'],
    hora_salida_programada: '07:00:00', precio_base: '20.00', capacidad: 40, cooperativa_nombre: 'Cooperativa A',
    numero_disco: 15, estado: 'PROGRAMADO', marca_chasis: 'Mercedes-Benz', carroceria: 'Marcopolo', tipo_servicio: 'PARADAS',
    asientos_disponibles: 3, asientos_disponibles_normal: 1, asientos_disponibles_vip: 2 },
  { programacion_id: 2, origen: 'Ambato', destino: 'Quito', hora_salida_programada: '09:00:00', precio_base: '5.00',
    capacidad: 41, cooperativa_nombre: 'Cooperativa B', numero_disco: 18, estado: 'PROGRAMADO',
    marca_chasis: 'Hino', carroceria: 'Cepeda', tipo_servicio: 'DIRECTO',
    asientos_disponibles: 10, asientos_disponibles_normal: 9, asientos_disponibles_vip: 1 },
  { programacion_id: 3, origen: 'Ambato', destino: 'Cuenca', hora_salida_programada: '10:00:00', precio_base: '10.00',
    capacidad: 40, cooperativa_nombre: 'Cooperativa A', numero_disco: 20, estado: 'PROGRAMADO', tipo_servicio: 'DIRECTO',
    asientos_disponibles: 0, asientos_disponibles_normal: 0, asientos_disponibles_vip: 0 },
];

async function mockCatalog(page, { legacy = false, seatError = false, empty = false } = {}) {
  const calls = { seats: 0, dates: [] };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/api/cooperativas') return json([{ id: 1, nombre: 'Cooperativa A' }, { id: 2, nombre: 'Cooperativa B' }]);
    if (url.pathname === '/api/frecuencias') return json([...trips, { origen: 'Baños', destino: 'Ambato' }]);
    if (url.pathname === '/api/viajes') {
      calls.dates.push(url.searchParams.get('fecha'));
      return json(empty ? [] : trips.map(trip => ({ ...trip, fecha_viaje: url.searchParams.get('fecha'),
        ...(legacy ? { asientos_disponibles: undefined, asientos_disponibles_normal: undefined, asientos_disponibles_vip: undefined } : {}) })));
    }
    if (/\/viajes\/\d+\/asientos$/.test(url.pathname)) {
      calls.seats++;
      if (seatError) return json({ error: 'No se pudo verificar la disponibilidad' }, 503);
      const id = Number(url.pathname.split('/')[3]);
      return json(Array.from({ length: 40 }, (_, i) => ({ asiento_id: id * 100 + i + 1, numero_asiento: i + 1,
        categoria: i < 8 ? 'VIP' : 'NORMAL', estado_ocupacion: (id === 1 ? [0, 1, 8] : id === 2 ? [0, 8, 9, 10, 11, 12, 13, 14, 15, 16] : []).includes(i) ? 'DISPONIBLE' : 'OCUPADO' })));
    }
    return json({ error: 'No encontrado' }, 404);
  });
  // El mapa no necesita red externa para validar las búsquedas.
  await page.route('**/*.tile.openstreetmap.org/**', route => route.abort());
  return calls;
}
const search = page => page.getByRole('button', { name: 'Buscar viajes', exact: true }).click();

test('CR-06: combina sugerencias, pasajeros y cuatro filtros y conserva la compra intermedia', async ({ page }, testInfo) => {
  const calls = await mockCatalog(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Elegir asientos' })).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Origen', exact: true }).fill('latac');
  await expect(page.getByRole('listbox').getByRole('option', { name: 'Latacunga', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Origen', exact: true }).press('ArrowDown');
  await page.getByRole('combobox', { name: 'Origen', exact: true }).press('Enter');
  await expect(page.getByRole('combobox', { name: 'Origen', exact: true })).toHaveValue('Latacunga');
  await page.getByRole('combobox', { name: 'Destino', exact: true }).fill('cuen');
  await page.getByRole('listbox').getByRole('option', { name: 'Cuenca', exact: true }).click();
  await page.getByLabel('Pasajeros', { exact: true }).fill('2');
  await page.getByLabel('Cooperativa', { exact: true }).selectOption('Cooperativa A');
  await page.getByLabel('Tipo de asiento', { exact: true }).selectOption('VIP');
  await page.getByLabel('Marca de chasis', { exact: true }).selectOption('Mercedes-Benz');
  await page.getByLabel('Carrocería', { exact: true }).selectOption('Marcopolo');
  await page.getByLabel('Tipo de viaje', { exact: true }).selectOption('PARADAS');
  await page.getByLabel('Desde', { exact: true }).fill('06:00');
  await page.getByLabel('Hasta', { exact: true }).fill('08:00');
  await search(page);
  const card = page.locator('.trip-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('2 disponibles (VIP) · 2 pasajeros');
  await expect(card.getByLabel('Subida:')).toHaveValue('1');
  await expect(card.getByLabel('Bajada:')).toHaveValue('4');
  await expect(card.locator('.trip-price > strong')).toContainText('12');
  await page.screenshot({ path: testInfo.outputPath('busqueda-filtros-tramo.png'), fullPage: true });
  // Cambiar la bajada conserva el origen que eligió el autocompletado.
  await card.getByLabel('Bajada:').selectOption('3');
  await expect(card.getByLabel('Subida:')).toHaveValue('1');
  await card.getByLabel('Bajada:').selectOption('4');
  expect(calls.seats).toBe(0);
  await page.getByRole('button', { name: 'Elegir asientos' }).click();
  await expect(page.getByRole('heading', { name: 'Elige dónde viajar.' })).toBeVisible();
  await expect(page.getByText('Latacunga → Cuenca · Cooperativa A')).toBeVisible();
  await expect(page.getByLabel('Tipo de asiento', { exact: true })).toHaveValue('VIP');
});

test('CR-06: categoría exige plazas suficientes y limpiar filtros restablece la búsqueda', async ({ page }) => {
  await mockCatalog(page); await page.goto('/');
  await page.getByLabel('Pasajeros', { exact: true }).fill('3');
  await page.getByLabel('Tipo de asiento', { exact: true }).selectOption('VIP');
  await search(page);
  await expect(page.getByText('No hay viajes con estos filtros')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByLabel('Pasajeros', { exact: true })).toHaveValue('1');
  await expect(page.getByRole('button', { name: 'Elegir asientos' })).toHaveCount(2);
  await page.getByLabel('Tipo de viaje', { exact: true }).selectOption('DIRECTO');
  await page.getByLabel('Marca de chasis', { exact: true }).selectOption('Hino');
  await page.getByLabel('Carrocería', { exact: true }).selectOption('Cepeda');
  await search(page);
  await expect(page.locator('.trip-card')).toHaveCount(1);
  await expect(page.locator('.trip-card')).toContainText('Cooperativa B');
});

test('CR-06: sugiere cantones con tildes aunque no haya viajes en la fecha', async ({ page }) => {
  await mockCatalog(page, { empty: true }); await page.goto('/');
  await expect(page.getByText('No hay viajes con estos filtros')).toBeVisible();
  const origin = page.getByRole('combobox', { name: 'Origen', exact: true });
  await origin.fill('banos');
  await expect(page.getByRole('option', { name: 'Baños', exact: true })).toBeVisible();
  await origin.press('ArrowDown'); await origin.press('Enter');
  await expect(origin).toHaveValue('Baños');
  await origin.fill('sin coincidencias');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('CR-06: APIs anteriores verifican plazas y un fallo nunca publica disponibilidad ficticia', async ({ page }) => {
  const calls = await mockCatalog(page, { legacy: true }); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Elegir asientos' })).toHaveCount(2);
  expect(calls.seats).toBe(3);
  await page.getByLabel('Pasajeros', { exact: true }).fill('4'); await search(page);
  await expect(page.locator('.trip-card')).toHaveCount(1);
  await expect(page.locator('.trip-card')).toContainText('Cooperativa B');
});

test('CR-06: fallo al verificar disponibilidad presenta error y permite reintentar', async ({ page }) => {
  await mockCatalog(page, { legacy: true, seatError: true }); await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('No se pudo verificar la disponibilidad');
  await expect(page.getByRole('button', { name: 'Elegir asientos' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
});

for (const width of [320, 390, 768]) test(`CR-06: buscador y sugerencias sin desbordamiento a ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await mockCatalog(page); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Elegir asientos' })).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Origen', exact: true }).fill('amb');
  await expect(page.getByRole('listbox').getByRole('option', { name: 'Ambato', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (width === 390) await page.screenshot({ path: testInfo.outputPath('busqueda-movil-sugerencias.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'Origen', exact: true }).press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});
