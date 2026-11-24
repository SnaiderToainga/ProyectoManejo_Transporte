import { test, expect } from '@playwright/test';

const cooperative = { id: 1, nombre: 'Cooperativa de prueba CR-01', ruc: '1890012345001', resolucion_ant: 'ANT-RES-2026-001',
  telefono: '0991234567', correo: 'institucion@example.test', direccion: 'Terminal de prueba', banco: 'Banco Pichincha',
  cuenta_bancaria: '1234567890', color_distintivo: '#214e44', logo_url: '/cr01-logo.svg', activo: true };
const bus = { id: 15, bus_id: 15, cooperativa_id: 1, cooperativa_nombre: cooperative.nombre, numero_disco: 15, placa: 'TEST-015',
  capacidad: 40, estado: 'OPERATIVO', marca_chasis: 'Chasis de prueba', carroceria: 'Carrocería de prueba',
  socio_nombre: 'Propietario de prueba', fotos: ['/cr01-bus.svg'], tiene_bano_posterior: true };
const frequency = { id: 1, cooperativa_id: 1, cooperativa_nombre: cooperative.nombre, origen: 'Ambato', destino: 'Quito',
  hora_salida: '09:30:00', precio_base: '9.50', resolucion_ant: cooperative.resolucion_ant, tipo_servicio: 'DIRECTO', paradas_intermedias: [], activo: true };
const trip = { ...frequency, ...bus, programacion_id: 1, hora_salida_programada: '09:30:00',
  estado: 'PROGRAMADO', asientos_disponibles: 40, asientos_disponibles_normal: 32, asientos_disponibles_vip: 8 };
const customer = { id: 77, nombre: 'Cliente de prueba', cedula: '1710034065', email: 'cliente@example.test' };

async function mockApi(page, { role, failSave = false, cardUrl = 'https://gateway.example.test/checkout/aislado', missingCard = false, delayLookup = false } = {}) {
  const writes = []; const lookups = [];
  let currentCoop = { ...cooperative }; let currentBus = { ...bus }; let reservation = null; let occupied = false;
  if (role) await page.addInitScript(user => localStorage.setItem('transporte_auth', JSON.stringify(user)), {
    id: 1, rol: role, nombre: 'Administración de prueba', cooperativa_id: 1, cooperativa_nombre: cooperative.nombre, token: 'sesion-admin-aislada' });
  await page.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (req.method() !== 'GET') {
      const multipart = req.headers()['content-type']?.includes('multipart/form-data');
      const data = multipart ? req.postData() : req.postDataJSON(); writes.push({ path, data, headers: req.headers() });
      if (path === '/api/admin/cooperativas' || path === '/api/admin/cooperativas/1') {
        if (failSave) return json({ error: 'Error de guardado de prueba' }, 500);
        currentCoop = { ...currentCoop, ...data, id: path === '/api/admin/cooperativas' ? 2 : 1 }; return json({ cooperativa: currentCoop, gerente: { id: 2 } });
      }
      if (path.startsWith('/api/admin/buses')) { currentBus = { ...currentBus, ...data, id: req.method() === 'POST' ? 25 : 15 }; return json({ bus: currentBus }); }
      if (['/api/clientes/sesion', '/api/clientes/registro'].includes(path)) return json({ token: 'sesion-cliente-aislada', cliente: customer });
      if (path === '/api/reservas') {
        reservation = { ...trip, codigo_reserva: 'CR01-PRUEBA', estado: 'PENDIENTE', total: 9.5, expira_en: new Date(Date.now() + 300000).toISOString() };
        return json({ reserva: reservation }, 201);
      }
      if (path.endsWith('/pago-tarjeta')) return missingCard ? json({ error: 'Pendiente integración' }, 501) : json({ checkout_url: cardUrl });
      if (path.endsWith('/comprobante')) { reservation = { ...reservation, estado: 'PENDIENTE_VALIDACION', comprobante_url: '/uploads/prueba.png' }; return json({ reserva: reservation }); }
      return json({ error: 'Escritura no prevista en prueba aislada' }, 400);
    }
    if (['/api/cooperativas', '/api/admin/cooperativas'].includes(path)) return json([currentCoop]);
    if (path === '/api/admin/buses') return json([currentBus]);
    if (path === '/api/admin/buses/15/asientos') return json({ asientos: Array.from({ length: 40 }, (_, i) => ({ asiento_id: i + 1, numero_asiento: i + 1,
      categoria: i < 8 ? 'VIP' : 'NORMAL', estado_ocupacion: 'DISPONIBLE' })) });
    if (['/api/frecuencias', '/api/admin/frecuencias'].includes(path)) return json([frequency]);
    if (path === '/api/viajes') return json([{ ...trip, fecha_viaje: url.searchParams.get('fecha') }]);
    if (path === '/api/viajes/1/asientos') return json(Array.from({ length: 40 }, (_, i) => ({ asiento_id: i + 1, numero_asiento: i + 1,
      categoria: i < 8 ? 'VIP' : 'NORMAL', estado_ocupacion: occupied && i === 8 ? 'OCUPADO' : 'DISPONIBLE' })));
    if (path === '/api/clientes/me') return json({ cliente: customer });
    if (path.startsWith('/api/clientes/por-cedula/')) {
      lookups.push({ path, token: req.headers().authorization });
      if (delayLookup) await new Promise(resolve => setTimeout(resolve, 500));
      return json({ cliente: customer });
    }
    if (path === '/api/mis-compras') return json([{ ...trip, id: 1, codigo_reserva: 'COMPRA-ANTERIOR', fecha_viaje: '2026-11-22', total_pasajeros: 1, total: 9.5, estado: 'PAGADO' }]);
    if (path === '/api/reservas/CR01-PRUEBA') return json(reservation);
    return json({ error: 'No encontrado' }, 404);
  });
  await page.route('**/cr01-*.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140"><rect width="240" height="140" fill="#214e44"/><text x="30" y="80" fill="white">BUS DE PRUEBA</text></svg>' }));
  await page.route('**/*.tile.openstreetmap.org/**', route => route.abort());
  return { writes, lookups, occupy: () => { occupied = true; } };
}

async function wizardFirstStep(page) {
  await page.getByLabel('Nombre de la cooperativa', { exact: true }).fill('Cooperativa nueva de prueba');
  await page.getByLabel('RUC', { exact: true }).fill('1890012345001');
  await page.getByLabel('Resolución ANT', { exact: true }).fill('ANT-RES-2026-001');
  await page.getByLabel('Celular de contacto', { exact: true }).fill('0991234567');
  await page.getByLabel('Correo institucional de la cooperativa', { exact: true }).fill('institucion@example.test');
  await page.getByLabel('Dirección de la matriz', { exact: true }).fill('Terminal de prueba');
}
async function openCheckout(page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Elegir asientos', exact: true }).click();
  await page.getByRole('button', { name: 'Asiento 9, normal, disponible', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}
async function reserve(page) {
  await page.getByLabel('Correo electrónico para recibir los boletos con QR').fill(customer.email);
  await page.getByLabel('Nombre completo', { exact: true }).fill(customer.nombre);
  await page.getByLabel('Cédula', { exact: true }).fill(customer.cedula);
  await page.getByRole('button', { name: 'Reservar por 5 minutos' }).click();
  await expect(page.getByText('CR01-PRUEBA', { exact: true })).toBeVisible();
}

test('CR-01: wizard respeta cuatro pasos, valida antes de avanzar y crea cooperativa y gerente juntos', async ({ page }, info) => {
  const state = await mockApi(page, { role: 'SUPERADMIN' }); await page.goto('/#admin');
  await page.getByRole('button', { name: 'Nueva Cooperativa', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText('Escribe el nombre de la cooperativa.')).toBeVisible(); expect(state.writes).toHaveLength(0);
  await wizardFirstStep(page); await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Paso 2 de 4: Marca y banco');
  await page.getByLabel('Entidad bancaria').selectOption('OTRO'); await page.getByLabel('Nombre del otro banco').fill('Banco de prueba');
  await page.getByLabel('Número de cuenta', { exact: true }).fill('1234567890');
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(page.getByLabel('Nombre de la cooperativa', { exact: true })).toHaveValue('Cooperativa nueva de prueba');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.getByLabel('Nombre completo del gerente').fill('Gerente de prueba'); await page.getByLabel('Cédula del gerente').fill(customer.cedula);
  await page.getByLabel('Correo del gerente', { exact: true }).fill('gerente@example.test'); await page.getByLabel('Celular del gerente').fill('0981234567');
  await page.getByLabel('Contraseña inicial del gerente').fill('PruebaClave9!'); await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.getByRole('dialog').screenshot({ path: info.outputPath('wizard-confirmacion.png') });
  await page.getByRole('button', { name: 'Registrar cooperativa y gerente' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.writes).toHaveLength(1); expect(state.writes[0].data.gerente.nombre).toBe('Gerente de prueba');
  expect(state.writes[0].data.gerente.correo).toBe('gerente@example.test'); expect(state.writes[0].data.correo).toBe('institucion@example.test');
});

test('CR-01: perfil precargado de gerente conserva credenciales y muestra errores de servidor', async ({ page }) => {
  const state = await mockApi(page, { role: 'ADMIN_COOP', failSave: true }); await page.goto('/#admin');
  await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name: 'Buscar viaje', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mi Cooperativa & Branding', exact: true }).click();
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click();
  await expect(page.getByLabel('Nombre de la cooperativa', { exact: true })).toHaveValue(cooperative.nombre);
  await expect(page.getByLabel('Correo institucional de la cooperativa')).toHaveValue(cooperative.correo);
  await expect(page.getByRole('dialog').getByAltText(`Logo de ${cooperative.nombre}`)).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByLabel('Contraseña inicial del gerente')).toHaveCount(0);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); await page.getByRole('button', { name: 'Guardar perfil', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Error de guardado de prueba'); await expect(page.getByRole('dialog')).toBeVisible();
  expect(state.writes[0].data.gerente).toBeUndefined(); expect(state.writes[0].path).toBe('/api/admin/cooperativas/1');
});

test('CR-01: bus se registra en modal con capacidad 35, marcas y socio, sin selector para gerente', async ({ page }) => {
  const state = await mockApi(page, { role: 'ADMIN_COOP' }); await page.goto('/#admin');
  await page.getByRole('button', { name: 'Registrar unidad', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('Cooperativa', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Número de disco').fill('25'); await dialog.getByLabel('Placa', { exact: true }).fill('test-025');
  await dialog.getByLabel('Cantidad de asientos').fill('35'); await dialog.getByLabel('Marca del chasis').fill('Marca de prueba');
  await dialog.getByLabel('Marca de la carrocería').fill('Carrocería de prueba'); await dialog.getByLabel('Socio / propietario').fill('Socio de prueba');
  await dialog.getByLabel('Fotografías del bus').fill('https://example.test/bus.png'); await dialog.getByRole('button', { name: 'Guardar unidad' }).click();
  await expect(dialog).toHaveCount(0); expect(state.writes[0].data.capacidad).toBe(35); expect(state.writes[0].data.cooperativa_id).toBe(1);
  expect(state.writes[0].data.placa).toBe('TEST-025'); expect(state.writes[0].data.fotos).toEqual(['https://example.test/bus.png']);
});

test('CR-01: ficha pública muestra fotos y datos del bus y devuelve el foco al cerrar', async ({ page }, info) => {
  const state = await mockApi(page); await page.goto('/'); const trigger = page.getByRole('button', { name: 'Ver más del bus 15' });
  await trigger.click(); await expect(page.getByRole('dialog').getByText(bus.socio_nombre)).toBeVisible();
  await expect(page.getByRole('dialog').getByText(bus.marca_chasis)).toBeVisible(); await expect(page.getByAltText('Bus 15, fotografía 1')).toBeVisible();
  await page.getByRole('dialog').screenshot({ path: info.outputPath('ficha-bus.png') });
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(trigger).toBeFocused(); expect(state.writes).toHaveLength(0);
});

test('CR-01: volver desde pasajeros conserva asientos y datos, recargar revalida disponibilidad', async ({ page }) => {
  const state = await mockApi(page); await openCheckout(page);
  await page.getByLabel('Nombre completo', { exact: true }).fill(customer.nombre);
  await page.getByRole('button', { name: 'Cambiar asientos' }).click();
  await expect(page.getByRole('button', { name: /Asiento 9, normal/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByLabel('Nombre completo', { exact: true })).toHaveValue(customer.nombre);
  await page.reload(); await expect(page.getByRole('button', { name: /Asiento 9, normal/ })).toHaveAttribute('aria-pressed', 'true');
  state.occupy(); await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Asiento 9, normal, ocupado', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled(); expect(state.writes).toHaveLength(0);
});

test('CR-01: cuenta opcional, historial y precarga autenticada no cambian la tarifa legal', async ({ page }) => {
  const state = await mockApi(page); await openCheckout(page); await page.getByRole('button', { name: 'Entrar a mi cuenta de cliente', exact: true }).click();
  await page.getByLabel('Correo electrónico', { exact: true }).fill(customer.email); await page.getByLabel('Contraseña', { exact: true }).fill('PruebaClave9!');
  await page.getByRole('button', { name: 'Entrar a mi cuenta', exact: true }).click();
  await page.getByRole('button', { name: 'Consultar mis compras', exact: true }).click(); await expect(page.getByText(/COMPRA-ANTERIOR/)).toBeVisible();
  await page.getByRole('button', { name: 'Volver a mi compra', exact: true }).click();
  await expect(page.getByLabel('Nombre completo', { exact: true })).toHaveValue(customer.nombre);
  await expect(page.getByLabel('Correo electrónico para recibir los boletos con QR')).toHaveValue(customer.email);
  await page.getByRole('button', { name: 'Completar por cédula', exact: true }).click();
  await expect(page.getByText('Nombre precargado. Revisa los datos antes de reservar.')).toBeVisible();
  expect(state.lookups[0].token).toBe('Bearer sesion-cliente-aislada');
  await expect(page.getByLabel('Tipo de tarifa / descuento legal')).toHaveValue('NORMAL');
  expect(state.writes.filter(write => write.path === '/api/reservas')).toHaveLength(0);
});

test('CR-01: visitante no consulta datos personales sin acceso y puede reservar manualmente', async ({ page }) => {
  const state = await mockApi(page); await openCheckout(page); await page.getByLabel('Cédula', { exact: true }).fill(customer.cedula);
  await page.getByRole('button', { name: 'Completar por cédula', exact: true }).click();
  await expect(page.getByText(/Abre tu acceso a Mis compras/)).toBeVisible(); expect(state.lookups).toHaveLength(0);
  await reserve(page); expect(state.writes.find(write => write.path === '/api/reservas').data.pasajeros[0].precio).toBe(9.5);
  expect(await page.evaluate(() => sessionStorage.getItem('transporte-uta-seleccion-cr01'))).toBeNull();
});

test('CR-01: tarjeta abre pasarela externa sin marcar la reserva como pagada', async ({ page }, info) => {
  const state = await mockApi(page); await openCheckout(page); await reserve(page);
  await page.getByLabel('Tarjeta de débito o crédito', { exact: true }).check(); await page.getByRole('button', { name: 'Pagar con tarjeta', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Continuar en la pasarela' })).toHaveAttribute('href', 'https://gateway.example.test/checkout/aislado');
  await expect(page.getByText('Pago registrado', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Descargar boleto/ })).toHaveCount(0);
  expect(state.writes.find(write => write.path.endsWith('/pago-tarjeta')).headers['idempotency-key']).toBe('cr01-CR01-PRUEBA');
  await page.locator('.payment-panel').screenshot({ path: info.outputPath('metodos-pago.png') });
});

for (const options of [{ cardUrl: 'javascript:alert(1)' }, { missingCard: true }]) test(`CR-01: tarjeta rechaza ${options.missingCard ? 'servicio no integrado' : 'enlace inseguro'} sin confirmar pagos`, async ({ page }) => {
  await mockApi(page, options); await openCheckout(page); await reserve(page);
  await page.getByLabel('Tarjeta de débito o crédito', { exact: true }).check(); await page.getByRole('button', { name: 'Pagar con tarjeta', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByRole('link', { name: 'Continuar en la pasarela' })).toHaveCount(0);
  await page.getByLabel('Transferencia bancaria', { exact: true }).check(); await expect(page.getByRole('button', { name: 'Enviar comprobante', exact: true })).toBeVisible();
});

test('CR-01: depósito envía el método y mantiene validación por oficina sin emitir boleto', async ({ page }) => {
  const state = await mockApi(page); await openCheckout(page); await reserve(page);
  await expect(page.getByRole('button', { name: 'Enviar comprobante', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pagar con tarjeta', exact: true })).toHaveCount(0);
  await page.getByLabel('Depósito bancario', { exact: true }).check();
  await expect(page.getByText('2207575571', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Banco Guayaquil', exact: true }).click();
  await expect(page.getByText('0045882190', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Banco Pichincha', exact: true }).click();
  await expect(page.getByText('2207575571', { exact: true })).toBeVisible();
  await page.getByLabel('Comprobante de pago', { exact: false }).setInputFiles({ name: 'prueba.png', mimeType: 'image/png', buffer: Buffer.from('prueba-aislada') });
  await page.getByRole('button', { name: 'Enviar comprobante', exact: true }).click();
  await expect(page.getByText('Comprobante en revisión', { exact: true })).toBeVisible();
  const receipt = state.writes.find(write => write.path.endsWith('/comprobante')); expect(receipt.data).toContain('name="metodo_pago"'); expect(receipt.data).toContain('DEPOSITO');
  await expect(page.getByRole('button', { name: /Descargar boleto/ })).toHaveCount(0);
});

test('CR-01: wizard y ficha móvil caben en pantalla', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockApi(page, { role: 'SUPERADMIN' }); await page.goto('/#admin');
  await page.getByRole('button', { name: 'Nueva Cooperativa', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await dialog.screenshot({ path: info.outputPath('wizard-movil.png') }); await page.getByRole('button', { name: 'Cerrar ventana' }).click();
  await page.goto('/'); await page.getByRole('button', { name: 'Ver más del bus 15' }).click();
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('CR-01: registro de cliente es opcional y cerrar sesión retira acceso al historial', async ({ page }) => {
  const state = await mockApi(page); await page.goto('/#mi-cuenta');
  const nav = page.getByRole('navigation', { name: 'Principal' });
  await expect(nav.getByRole('button', { name: 'Mis compras', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Mi cuenta', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Registrarme', exact: true }).click();
  await page.getByLabel('Nombre completo', { exact: true }).fill(customer.nombre); await page.getByLabel('Cédula', { exact: true }).fill(customer.cedula);
  await page.getByLabel('Correo electrónico', { exact: true }).fill(customer.email); await page.getByLabel('Contraseña', { exact: true }).fill('PruebaClave9!');
  await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Hola, ${customer.nombre}` })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Hola, Cliente', exact: true })).toBeVisible();
  expect(state.writes[0].path).toBe('/api/clientes/registro');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Menú', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Hola, Cliente', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Cerrar sesión de cliente', exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('transporte_cliente_token'))).toBeNull();
  await expect(nav.getByRole('button', { name: 'Mi cuenta', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Consultar mis compras por correo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enviar enlace', exact: true })).toBeVisible(); await expect(page.getByText(/COMPRA-ANTERIOR/)).toHaveCount(0);
});

test('CR-01: precarga tardía no sobrescribe una cédula editada por el comprador', async ({ page }) => {
  const state = await mockApi(page, { delayLookup: true }); await page.addInitScript(() => sessionStorage.setItem('transporte_cliente_token', 'sesion-cliente-aislada'));
  await openCheckout(page); await expect(page.getByLabel('Cédula', { exact: true })).toHaveValue(customer.cedula);
  await page.getByRole('button', { name: 'Completar por cédula', exact: true }).click();
  await expect.poll(() => state.lookups.length).toBeGreaterThanOrEqual(1);
  await page.getByLabel('Cédula', { exact: true }).fill('1720034064'); await page.getByLabel('Nombre completo', { exact: true }).fill('Nombre corregido');
  await expect(page.getByLabel('Nombre completo', { exact: true })).toHaveValue('Nombre corregido');
  await expect(page.getByText('Nombre precargado. Revisa los datos antes de reservar.')).toHaveCount(0);
});

test('CR-01: menú de estructuras consulta asientos sin modificar plantillas de CR-09', async ({ page }) => {
  const state = await mockApi(page, { role: 'ADMIN_COOP' }); await page.goto('/#admin');
  await page.getByRole('button', { name: 'Plantillas y estructuras', exact: true }).click();
  await page.getByLabel('Unidad para consultar estructura').selectOption('15');
  await expect(page.getByRole('group', { name: 'Bus de 40 asientos' }).getByRole('button')).toHaveCount(40);
  await expect(page.getByRole('button', { name: 'Asiento 9, normal, disponible', exact: true })).toBeDisabled(); expect(state.writes).toHaveLength(0);
});

test('CR-01: datos de un acompañante se completan automáticamente al terminar la cédula', async ({ page }) => {
  const state = await mockApi(page); await page.addInitScript(() => sessionStorage.setItem('transporte_cliente_token', 'sesion-cliente-aislada'));
  await page.goto('/'); await page.getByRole('button', { name: 'Elegir asientos', exact: true }).click();
  await page.getByRole('button', { name: 'Asiento 9, normal, disponible', exact: true }).click();
  await page.getByRole('button', { name: 'Asiento 10, normal, disponible', exact: true }).click(); await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Cédula', { exact: true }).nth(1).fill(customer.cedula);
  await expect(page.getByLabel('Nombre completo', { exact: true }).nth(1)).toHaveValue(customer.nombre);
  expect(state.lookups.length).toBeGreaterThanOrEqual(1); expect(state.writes).toHaveLength(0);
});

test('CR-01: un visitante o una cuenta de cliente no puede abrir la administración', async ({ page }) => {
  const state = await mockApi(page); await page.addInitScript(() => sessionStorage.setItem('transporte_cliente_token', 'sesion-cliente-aislada'));
  await page.goto('/#admin'); await expect(page.getByRole('button', { name: 'Nueva Cooperativa', exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toBeVisible(); expect(state.writes).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem('transporte_auth'))).toBeNull();
});
