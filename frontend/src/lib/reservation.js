export function secondsRemaining(expiresAt, now = Date.now()) {
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) ? Math.max(0, Math.ceil((timestamp - now) / 1000)) : 0;
}
export function formatCountdown(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export function reservationStatus(reservation, now = Date.now()) {
  if (reservation.estado === 'PAGADO') return 'paid';
  if (['PENDIENTE_VALIDACION', 'PENDIENTE_VALIDACIÓN'].includes(reservation.estado)) return 'review';
  if (reservation.estado === 'RECHAZADO') return 'rejected';
  if (reservation.estado === 'CANCELADO') return 'cancelled';
  if (reservation.estado === 'PENDIENTE') {
    if (reservation.comprobante_url) return 'review';
    return secondsRemaining(reservation.expira_en, now) > 0 ? 'pending' : 'expired';
  }
  return 'unknown';
}
function codeKey() { return `transporte-uta-reserva${new URLSearchParams(window.location.search).get('demo') === '1' ? '-demo' : ''}`; }
export function rememberCode(code) { try { sessionStorage.setItem(codeKey(), code); } catch { /* El modo privado puede bloquear el almacenamiento. */ } }
export function recalledCode() { try { return sessionStorage.getItem(codeKey()) || ''; } catch { return ''; } }
