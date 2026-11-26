export const isDemo = new URLSearchParams(window.location.search).get('demo') === '1';
import { API_BASE } from './env.js';

const baseUrl = API_BASE;

export class ApiError extends Error {
  constructor(message, status = 0, details = {}) { super(message); this.status = status; this.details = details; }
}

async function request(path, { signal, ...options } = {}) {
  const timeout = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined;
  const combinedSignal = signal && timeout && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([signal, timeout])
    : (signal || timeout);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: combinedSignal,
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
  customerSession: (register, payload) => request(`/clientes/${register ? 'registro' : 'sesion'}`, { method: 'POST', body: JSON.stringify(payload) }),
  customerProfile: (token, signal) => request('/clientes/me', { signal, headers: { Authorization: `Bearer ${token}` } }),
  ticketUrl: (code, id) => `${baseUrl}/reservas/${encodeURIComponent(code)}/boletos/${encodeURIComponent(id)}/pdf`,
  requestHistoryLink: email => request('/mis-compras/acceso', { method: 'POST', body: JSON.stringify({ email }) }),
  purchaseHistory: (token, signal) => request('/mis-compras', { signal, headers: { Authorization: `Bearer ${token}` } }),
  passenger: (cedula, token, signal) => {
    if (!token) return Promise.reject(new ApiError('Abre tu acceso a Mis compras para completar tus datos guardados.', 401));
    return request(`/clientes/por-cedula/${encodeURIComponent(cedula)}`, { signal, headers: { Authorization: `Bearer ${token}` } });
  },
  cardPayment: code => {
    if (isDemo) return Promise.reject(new ApiError('El pago con tarjeta no está disponible en la demostración.'));
    return request(`/reservas/${encodeURIComponent(code)}/pago-tarjeta`, { method: 'POST',
      headers: { 'Idempotency-Key': `cr01-${code}` }, body: JSON.stringify({ metodo_pago: 'TARJETA' }) });
  },
  ticketQr: (code, id) => `${baseUrl}/reservas/${encodeURIComponent(code)}/boletos/${encodeURIComponent(id)}/qr`,
  trips: (date, signal) => call('trips', [date], () => request(`/viajes?fecha=${encodeURIComponent(date)}`, { signal })),
  cooperatives: (signal) => call('cooperatives', [], () => request('/cooperativas', { signal })),
  frequencies: (signal) => call('frequencies', [], () => request('/frecuencias', { signal })),
  seats: (id, signal) => call('seats', [id], () => request(`/viajes/${encodeURIComponent(id)}/asientos`, { signal })),
  reserve: (payload, customerToken = '') => call('reserve', [payload], () => request('/reservas', {
    method: 'POST',
    headers: customerToken ? { Authorization: `Bearer ${customerToken}` } : {},
    body: JSON.stringify(payload)
  })),
  reservation: (code, signal) => call('reservation', [code], () => request(`/reservas/${encodeURIComponent(code)}`, { signal })),
  receipt: (code, file, method = 'TRANSFERENCIA') => call('receipt', [code, file], () => {
    const body = new FormData(); body.append('comprobante', file); body.append('metodo_pago', method);
    return request(`/reservas/${encodeURIComponent(code)}/comprobante`, { method: 'POST', body });
  }),
  ticket: async (code, ticketId) => {
    if (isDemo) throw new ApiError('El PDF se descarga únicamente para reservas reales pagadas.');
    let response;
    try { response = await fetch(`${baseUrl}/reservas/${encodeURIComponent(code)}/boletos/${encodeURIComponent(ticketId)}/pdf`, { signal: AbortSignal.timeout(20000) }); }
    catch { throw new ApiError('No pudimos descargar el boleto. Intenta nuevamente.'); }
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !type.includes('application/pdf')) {
      const data = type.includes('application/json') ? await response.json() : {};
      throw new ApiError(data.error || 'El boleto todavía no está disponible para descargar.', response.status);
    }
    return response.blob();
  },
};
