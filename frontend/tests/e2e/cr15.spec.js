import { test, expect } from '@playwright/test';

const trips = [
  {
    programacion_id: 1,
    origen: 'Ambato',
    destino: 'Quito (Carcelén)',
    paradas_intermedias: ['Latacunga', 'Machachi'],
    hora_salida_programada: '08:30:00',
    precio_base: '5.00',
    capacidad: 20,
    cooperativa_nombre: 'Cooperativa de Transportes CITA',
    numero_disco: 56,
    estado: 'PROGRAMADO',
    marca_chasis: 'HINO',
    carroceria: 'CEPEDA',
    tipo_servicio: 'PARADAS',
    resolucion_ant: 'ANT-RES-2024-002',
    tiene_bano_posterior: true,
    es_destacada: true,
    asientos_disponibles: 20,
    asientos_disponibles_normal: 16,
    asientos_disponibles_vip: 4
  },
  {
    programacion_id: 2,
    origen: 'Baños',
    destino: 'Ambato',
    paradas_intermedias: [],
    hora_salida_programada: '11:00:00',
    precio_base: '2.50',
    capacidad: 41,
    cooperativa_nombre: 'Expreso Baños',
    numero_disco: 18,
    estado: 'PROGRAMADO',
    marca_chasis: 'Mercedes-Benz',
    carroceria: 'Marcopolo',
    tipo_servicio: 'DIRECTO',
    resolucion_ant: 'ANT-RES-2025-010',
    tiene_bano_posterior: false,
    es_destacada: false,
    asientos_disponibles: 14,
    asientos_disponibles_normal: 14,
    asientos_disponibles_vip: 0
  }
];

async function mockCr15Api(page) {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/api/cooperativas') {
      return json([{ id: 1, nombre: 'Cooperativa de Transportes CITA' }, { id: 2, nombre: 'Expreso Baños' }]);
    }
    if (url.pathname === '/api/frecuencias') return json(trips);
    if (url.pathname === '/api/viajes') {
      const fecha = url.searchParams.get('fecha');
      return json(trips.map(t => ({ ...t, fecha_viaje: fecha })));
    }
    if (/\/viajes\/\d+\/asientos$/.test(url.pathname)) {
      return json(Array.from({ length: 20 }, (_, i) => ({
        asiento_id: 100 + i + 1,
        numero_asiento: i + 1,
        categoria: i < 4 ? 'VIP' : 'NORMAL',
        estado_ocupacion: 'DISPONIBLE'
      })));
    }
    return json({ error: 'No encontrado' }, 404);
  });
  await page.route('**/*.tile.openstreetmap.org/**', route => route.abort());
}

test('CR-15: navbar limpia con Acceso operativo junto a Mi cuenta y selección directa de asientos', async ({ page }) => {
  await mockCr15Api(page);
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Principal' });
  await expect(nav.getByRole('button', { name: 'Buscar viaje', exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Mi cuenta', exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Acceso operativo', exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Administración', exact: true })).toHaveCount(0);

  await nav.getByRole('button', { name: 'Acceso operativo', exact: true }).click();
  await expect(page.locator('input[type="password"]')).toBeVisible();

  await page.getByRole('button', { name: /volver|buscar/i }).first().click();
  await page.getByRole('button', { name: 'Elegir asientos' }).first().click();
  await expect(page.getByRole('heading', { name: 'Elige dónde viajar.' })).toBeVisible();
});

test('CR-15: tarjetas rediseñadas, mapa por tarjeta bajo demanda e intercambio/limpieza interactiva de filtros', async ({ page }, testInfo) => {
  await mockCr15Api(page);
  await page.goto('/');

  await expect(page.locator('.trip-card')).toHaveCount(2);
  await expect(page.locator('.route-map-panel')).toHaveCount(0);
  await expect(page.locator('.results-count-pill')).toHaveText('2 opciones');

  const firstCard = page.locator('.trip-card').first();
  await expect(firstCard.locator('.trip-price > strong')).toHaveText('$ 5.00 USD');
  await expect(firstCard.locator('.trip-route > strong')).toHaveText('08:30');

  await firstCard.getByRole('button', { name: 'Ver mapa de ruta' }).click();
  await expect(firstCard.locator('.route-map-panel')).toBeVisible();
  await expect(firstCard.locator('.route-map-panel')).toContainText('Unidad #56');
  await page.screenshot({ path: testInfo.outputPath('cr15-tarjeta-y-mapa.png'), fullPage: true });

  await firstCard.getByRole('button', { name: 'Ocultar mapa' }).click();
  await expect(page.locator('.route-map-panel')).toHaveCount(0);

  await page.getByLabel('Tipo de viaje', { exact: true }).selectOption('DIRECTO');
  await expect(page.locator('.trip-card')).toHaveCount(1);
  await expect(page.locator('.filter-chip', { hasText: 'Directo' })).toBeVisible();

  await page.getByRole('button', { name: 'Limpiar todo', exact: true }).click();
  await expect(page.locator('.trip-card')).toHaveCount(2);

  await page.getByRole('combobox', { name: 'Origen', exact: true }).fill('Ambato');
  await page.getByRole('combobox', { name: 'Destino', exact: true }).fill('Quito');
  await page.getByRole('button', { name: 'Intercambiar origen y destino', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Origen', exact: true })).toHaveValue('Quito');
  await expect(page.getByRole('combobox', { name: 'Destino', exact: true })).toHaveValue('Ambato');

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
