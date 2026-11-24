import { test, expect } from '@playwright/test';

const officeUser = {
  id: 3,
  rol: 'OFICINISTA',
  nombre: 'Oficinista CR-11',
  cooperativa_id: 1,
  cooperativa_nombre: 'Cooperativa CITA',
  sucursal_id: 1,
  token: 'sesion-oficina-cr11',
};

test('CR-11: fallback local ante imagen 404 en Render permite al oficinista aprobar sin bloqueo', async ({ page }) => {
  let approved = false;
  await page.addInitScript(user => localStorage.setItem('transporte_auth', JSON.stringify(user)), officeUser);
  page.on('dialog', dialog => dialog.accept());

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/reservas-pendientes') {
      return json(approved ? [] : [{
        reserva_id: 91,
        codigo_reserva: 'RES-CR11-404',
        cliente_nombre: 'Pasajero Contingencia',
        cliente_cedula: '1710034065',
        origen: 'Ambato',
        destino: 'Quito',
        hora_salida: '08:00:00',
        total_pagado: '5.00',
        comprobante_url: '/uploads/comprobante-perdido.png',
        comprobante_disponible: true,
      }]);
    }
    if (url.pathname === '/api/reservas/91/aprobar' && route.request().method() === 'PUT') {
      approved = true;
      return json({ mensaje: 'Comprobante aprobado', reserva: { id: 91, estado: 'PAGADO' } });
    }
    return json({ error: 'No encontrado' }, 404);
  });

  // Simular disco efímero de Render devolviendo 404 para la imagen del comprobante.
  await page.route('**/uploads/comprobante-perdido.png', route =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) })
  );

  await page.goto('/#oficina');
  await expect(page.getByRole('heading', { name: 'Bandeja de comprobantes pendientes' })).toBeVisible();
  await page.getByRole('button', { name: 'Ver imagen', exact: true }).click();

  const fallback = page.getByTestId('comprobante-fallback');
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText('Respaldo local activado');
  await expect(fallback).toContainText('RES-CR11-404');
  await expect(fallback).toContainText('$ 5.00 USD');

  await page.getByRole('button', { name: 'Aprobar reserva', exact: true }).click();
  await expect(page.getByText(/No hay comprobantes pendientes/)).toBeVisible();
  expect(approved).toBe(true);
});
