export const isDemo = new URLSearchParams(window.location.search).get('demo') === '1';
const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, details = {}) { super(message); this.status = status; this.details = details; }
}

async function request(path, { signal, ...options } = {}) {
  const timeout = AbortSignal.timeout(20000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new ApiError(data?.error || 'No se pudo completar la solicitud. Intenta nuevamente.', response.status, data || {});
    if (!data) throw new ApiError('El servicio no devolvió una respuesta válida. Intenta más tarde.');
    return data;
  } catch (error) {
    if (signal?.aborted || error instanceof ApiError) throw error;
    throw new ApiError(timeout.aborted ? 'La conexión tardó demasiado. Intenta nuevamente.' : 'No pudimos conectar con el servicio de viajes. Revisa tu conexión e intenta nuevamente.');
  }
}

async function call(name, args, live) {
  if (isDemo) return (await import('./demo.js')).demoApi[name](...args);
  return live();
}

export const api = {
  trips: (date, signal) => call('trips', [date], () => request(`/viajes?fecha=${encodeURIComponent(date)}`, { signal })),
  cooperatives: (signal) => call('cooperatives', [], () => request('/cooperativas', { signal })),
  seats: (id, signal) => call('seats', [id], () => request(`/viajes/${encodeURIComponent(id)}/asientos`, { signal })),
};
