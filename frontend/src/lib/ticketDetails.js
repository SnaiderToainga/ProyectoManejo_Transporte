export const passengerLabels = {
  NORMAL: 'Tarifa completa', MENOR: 'Menor de edad', NIÑO: 'Menor de edad',
  TERCERA_EDAD: 'Tercera edad', DISCAPACIDAD: 'Discapacidad'
};
export function discountedPrice(base, type = 'NORMAL') {
  const cents = Math.round(Number(base) * 100);
  return (type === 'NORMAL' ? cents : Math.round(cents / 2)) / 100;
}
export function purchaseTime(value) {
  if (!value) return 'Fecha exacta no registrada';
  const normalized = typeof value === 'string' && !/(Z|[+-]\d\d:\d\d)$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? 'Fecha exacta no registrada' : new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(date) + ' · Ecuador (UTC-5)';
}
