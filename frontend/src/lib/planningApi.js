const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname) || import.meta.env.DEV;
const base = (import.meta.env.VITE_API_URL || (isLocal ? '/api' : 'https://transporte-uta-api.onrender.com/api')).replace(/\/$/, '');

export async function planningRequest(user, path, { method = 'GET', data, signal } = {}) {
  if (!user?.token) throw new Error('Vuelve a iniciar sesión para acceder a la planificación.');
  const response = await fetch(`${base}${path}`, {
    method,
    signal,
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `No se pudo completar la operación (${response.status}).`);
  return result;
}
