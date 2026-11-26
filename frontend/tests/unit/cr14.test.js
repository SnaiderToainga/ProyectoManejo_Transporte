import test from 'node:test';
import assert from 'node:assert/strict';
import { RENDER_API_URL, backendOriginFrom, createMediaResolver, isLocalHostname, isLocalRuntime, resolveApiBase } from '../../src/lib/env.js';
import { safeExternalUrl, supportChannelErrors, supportChannels, whatsappLink } from '../../src/lib/supportChannels.js';

test('CR-14: API_BASE usa /api en local, respeta VITE_API_URL explícito y cae a Render en producción', () => {
  // Local (Vite dev o red LAN) sin variable: proxy /api.
  assert.equal(resolveApiBase({ viteApiUrl: undefined, hostname: 'localhost', dev: false }), '/api');
  assert.equal(resolveApiBase({ viteApiUrl: '', hostname: '192.168.1.15', dev: false }), '/api');
  assert.equal(resolveApiBase({ viteApiUrl: undefined, hostname: 'cualquiera', dev: true }), '/api');
  // Docker/Nginx: VITE_API_URL='/api' explícito se respeta aunque el host sea público.
  assert.equal(resolveApiBase({ viteApiUrl: '/api', hostname: 'proyecto-web.online', dev: false }), '/api');
  // Vercel sin VITE_API_URL inyectado: Render.
  assert.equal(resolveApiBase({ viteApiUrl: undefined, hostname: 'proyecto-web.online', dev: false }), RENDER_API_URL);
  // URL explícita sin barra final.
  assert.equal(resolveApiBase({ viteApiUrl: 'https://api.example.test/api/', hostname: 'proyecto-web.online', dev: false }), 'https://api.example.test/api');
});

test('CR-14: detección de entorno local y origen del backend', () => {
  for (const host of ['localhost', '127.0.0.1', '192.168.0.5', '10.0.0.8', '172.16.4.2']) assert.equal(isLocalHostname(host), true, host);
  for (const host of ['proyecto-web.online', 'www.proyecto-web.online', '']) assert.equal(isLocalHostname(host), false, host);
  assert.equal(isLocalRuntime({ hostname: '', dev: false }), false);
  assert.equal(backendOriginFrom(RENDER_API_URL), 'https://transporte-uta-api.onrender.com');
  assert.equal(backendOriginFrom('/api'), '');
});

test('CR-14: resolveMediaUrl antepone el backend a /uploads en Vercel y conserva rutas relativas en local', () => {
  const vercel = createMediaResolver(backendOriginFrom(RENDER_API_URL));
  const local = createMediaResolver(backendOriginFrom('/api'));
  assert.equal(vercel('/uploads/media/abc.png'), 'https://transporte-uta-api.onrender.com/uploads/media/abc.png');
  assert.equal(vercel('uploads/media/abc.png'), 'https://transporte-uta-api.onrender.com/uploads/media/abc.png');
  assert.equal(local('/uploads/media/abc.png'), '/uploads/media/abc.png');
  assert.equal(vercel('https://cdn.example.test/logo.png'), 'https://cdn.example.test/logo.png');
  assert.equal(vercel('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  // Esquemas peligrosos, credenciales y URLs protocol-relative se descartan.
  for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'https://u:p@example.test/x.png', '//evil.test/x.png', '', null, undefined]) {
    assert.equal(vercel(bad), '', String(bad));
  }
  // Comillas y paréntesis se codifican para que no rompan src ni url("...") en CSS.
  assert.equal(vercel('/uploads/media/a"b(c).png'), 'https://transporte-uta-api.onrender.com/uploads/media/a%22b%28c%29.png');
});

test('CR-14: redes sociales y soporte solo generan enlaces seguros', () => {
  assert.equal(safeExternalUrl('https://facebook.com/coop'), 'https://facebook.com/coop');
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.test', 'https://u:p@x.test', 'https://x.test/"><script>']) {
    assert.equal(safeExternalUrl(bad), '', bad);
  }
  assert.equal(whatsappLink('099 123-4567'), 'https://wa.me/593991234567');
  assert.equal(whatsappLink('+593991234567'), 'https://wa.me/593991234567');
  assert.equal(whatsappLink('llamar'), '');

  const channels = supportChannels({ facebook_url: 'https://facebook.com/coop', instagram_url: 'javascript:alert(1)',
    whatsapp_soporte: '0991234567', correo_soporte: 'soporte@coop.test' });
  assert.deepEqual(channels.map(channel => channel.key), ['facebook', 'whatsapp', 'email']);
  assert.equal(channels.find(channel => channel.key === 'email').href, 'mailto:soporte@coop.test');

  assert.deepEqual(supportChannelErrors({ facebook_url: '', instagram_url: '', whatsapp_soporte: '', correo_soporte: '' }), {});
  assert.deepEqual(Object.keys(supportChannelErrors({ facebook_url: 'javascript:x', whatsapp_soporte: 'abc', correo_soporte: 'mal' })),
    ['facebook_url', 'whatsapp_soporte', 'correo_soporte']);
});
