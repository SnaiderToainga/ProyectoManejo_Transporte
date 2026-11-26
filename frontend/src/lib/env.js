// Configuración única de origen del backend (CR-14).
// Local (Vite) y Docker usan '/api' por proxy; Vercel usa Render si VITE_API_URL no se inyecta en el build.
export const RENDER_API_URL = 'https://transporte-uta-api.onrender.com/api';

const LOCAL_HOST_PATTERNS = [
  host => host === 'localhost',
  host => host === '127.0.0.1',
  host => host.startsWith('192.168.'),
  host => host.startsWith('10.'),
  host => host.startsWith('172.')
];

function readViteEnv() {
  try {
    return import.meta.env || {};
  } catch {
    return {};
  }
}

function currentHostname() {
  return typeof window !== 'undefined' && window.location ? window.location.hostname || '' : '';
}

export function isLocalHostname(hostname = '') {
  const host = String(hostname || '').toLowerCase();
  return LOCAL_HOST_PATTERNS.some(match => match(host));
}

export function isLocalRuntime({ hostname = currentHostname(), dev = Boolean(readViteEnv().DEV) } = {}) {
  return Boolean(dev) || isLocalHostname(hostname);
}

export function resolveApiBase({ viteApiUrl = readViteEnv().VITE_API_URL, hostname, dev } = {}) {
  const explicit = typeof viteApiUrl === 'string' ? viteApiUrl.trim() : '';
  const local = isLocalRuntime({
    hostname: hostname ?? currentHostname(),
    dev: dev ?? Boolean(readViteEnv().DEV)
  });
  return (explicit || (local ? '/api' : RENDER_API_URL)).replace(/\/+$/, '');
}

export function backendOriginFrom(apiBase) {
  const base = String(apiBase || '');
  return /^https?:\/\//i.test(base) ? base.replace(/\/api\/?$/i, '').replace(/\/+$/, '') : '';
}

// Codifica caracteres que podrían romper un atributo src o un url("...") de CSS.
const escapeUrl = url => url.replace(/["'()\s\\<>]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);

export function createMediaResolver(backendOrigin) {
  const origin = String(backendOrigin || '').replace(/\/+$/, '');
  return function resolveMediaUrl(value) {
    if (!value || typeof value !== 'string') return '';
    const url = value.trim();
    if (!url) return '';
    if (/^data:image\//i.test(url)) return escapeUrl(url);
    if (/^https?:\/\//i.test(url)) {
      try {
        const parsed = new URL(url);
        return parsed.username || parsed.password ? '' : escapeUrl(url);
      } catch {
        return '';
      }
    }
    // Rutas relativas del backend (/uploads/...): se rechazan esquemas como javascript: o URLs protocol-relative.
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return '';
    const path = url.startsWith('/') ? url : `/${url}`;
    return escapeUrl(`${origin}${path}`);
  };
}

export const API_BASE = resolveApiBase();
export const BACKEND_ORIGIN = backendOriginFrom(API_BASE);
export const resolveMediaUrl = createMediaResolver(BACKEND_ORIGIN);
