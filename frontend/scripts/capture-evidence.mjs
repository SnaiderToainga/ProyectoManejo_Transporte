import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const directory = fileURLToPath(new URL('../../docs/evidencias/cliente/', import.meta.url));
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined), headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const base = process.env.CLIENT_PREVIEW_URL || 'http://127.0.0.1:5173';
  const capture = (name) => page.screenshot({ path: join(directory, name), fullPage: true });
  await page.goto(`${base}/?demo=1`);
  await page.getByRole('button', { name: 'Elegir asientos' }).first().waitFor();
  await capture('01-buscador.png');
  await page.getByRole('button', { name: 'Elegir asientos' }).first().click();
  await page.getByRole('button', { name: 'Asiento 1, VIP, disponible', exact: true }).click();
  await capture('02-asientos-40.png');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Nombre completo').fill('Pasajero de ejemplo');
  await page.getByLabel('Cédula', { exact: true }).fill('0000000000');
  await capture('03-pasajero.png');
  await page.getByRole('button', { name: 'Reservar por 5 minutos' }).click();
  await page.getByRole('timer').waitFor();
  await capture('04-temporizador-comprobante.png');
  await page.getByRole('button', { name: 'Buscar viaje', exact: true }).click();
  await page.getByRole('button', { name: 'Elegir asientos' }).nth(1).click();
  await page.getByRole('button', { name: 'Asiento 41, normal, disponible', exact: true }).waitFor();
  await capture('05-asientos-41.png');
  await page.goto(`${base}/?demo=1#boleto`);
  await page.getByRole('button', { name: 'DEMO-PAGADO', exact: true }).click();
  await page.getByAltText('Código QR del boleto del asiento 9').waitFor();
  await capture('06-boleto-qr.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/?demo=1`);
  await page.getByRole('button', { name: 'Elegir asientos' }).first().waitFor();
  await capture('07-movil.png');
  console.log(`7 capturas de demostración guardadas en ${directory}`);
} finally { await browser.close(); }
