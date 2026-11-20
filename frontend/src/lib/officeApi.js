const isLocal = typeof window === 'undefined' || ['localhost', '127.0.0.1'].includes(window.location.hostname) || import.meta.env?.DEV;
const base = (import.meta.env?.VITE_API_URL || (isLocal ? '/api' : 'https://transporte-uta-api.onrender.com/api')).replace(/\/$/, '');

export async function officeRequest(user, path, { method = 'GET', data, signal } = {}) {
  if (!user?.token) {
    const error = new Error('Vuelve a iniciar sesión para acceder a taquilla.');
    error.status = 401; throw error;
  }
  const response = await fetch(`${base}${path}`, {
    method, signal, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    const error = new Error(result?.error || 'No se pudo completar la operación de taquilla.');
    error.status = response.status; error.occupied = result?.asientos_ocupados;
    throw error;
  }
  return result;
}
