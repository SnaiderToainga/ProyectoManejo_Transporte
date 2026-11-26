// CORS explícito para producción (Vercel/dominio propio) y desarrollo local (CR-14).
const PRODUCTION_ORIGINS = ['https://proyecto-web.online', 'https://www.proyecto-web.online'];

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/i;

function normalizeOrigin(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.origin.toLowerCase();
  } catch {
    return '';
  }
}

function configuredOrigins(env = process.env) {
  const extra = [env.FRONTEND_URL, ...String(env.CORS_ORIGINS || '').split(',')];
  return new Set([...PRODUCTION_ORIGINS, ...extra].map(normalizeOrigin).filter(Boolean));
}

function isAllowedOrigin(origin, env = process.env) {
  // Sin cabecera Origin: webhooks de Stripe, curl y healthchecks de Render.
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return configuredOrigins(env).has(normalized) || LOCAL_ORIGIN.test(normalized);
}

function buildCorsOptions(env = process.env) {
  return {
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin, env));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // x-user-role y x-user-cooperativa-id los envía el panel administrativo (GestionCooperativas.jsx);
    // sin ellas el navegador bloquearía el preflight en producción.
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'x-user-role', 'x-user-cooperativa-id'],
    optionsSuccessStatus: 204
  };
}

module.exports = { buildCorsOptions, isAllowedOrigin, normalizeOrigin, PRODUCTION_ORIGINS };
