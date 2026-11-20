const { labels } = require('./passengerFares');
const money = value => `$ ${Number(value).toFixed(2)} USD`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function purchaseDate(value) {
  if (!value) return 'No registrada';
  const normalized = typeof value === 'string' && !/(Z|[+-]\d\d:\d\d)$/.test(value)
    ? value.replace(' ', 'T') + 'Z' : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? 'No registrada' : new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(date) + ' (Ecuador UTC-5)';
}
function fareLines(ticket) {
  if (ticket.tarifa_base == null || ticket.descuento == null || !labels[ticket.tipo_pasajero]) {
    return ['Desglose histórico no registrado', `Valor del boleto: ${money(ticket.precio)}`];
  }
  return [`Tarifa base: ${money(ticket.tarifa_base)}`, `Tipo: ${labels[ticket.tipo_pasajero]}`,
    `Descuento (${ticket.tipo_pasajero === 'NORMAL' ? 0 : 50}%): ${money(ticket.descuento)}`,
    `Total del boleto: ${money(ticket.precio)}`];
}
module.exports = { money, escapeHtml, purchaseDate, fareLines };
