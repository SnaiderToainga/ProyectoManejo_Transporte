export function passengerError(passengers) {
  if (!passengers.length) return 'Selecciona al menos un asiento.';
  for (const passenger of passengers) {
    if (passenger.nombre.trim().length < 3) return 'Escribe el nombre completo de cada pasajero.';
    if (!/^\d{10}$/.test(passenger.cedula.trim())) return 'La cédula debe tener 10 dígitos.';
  }
  if (new Set(passengers.map(p => p.cedula.trim())).size !== passengers.length) return 'Cada pasajero debe tener una cédula diferente.';
  return '';
}
export function receiptError(file) {
  if (!file) return 'Selecciona tu comprobante de pago.';
  if (file.size <= 0) return 'El archivo está vacío.';
  if (file.size > 5 * 1024 * 1024) return 'El comprobante no puede superar los 5 MB.';
  const allowed = { 'image/png': /\.png$/i, 'image/jpeg': /\.jpe?g$/i, 'application/pdf': /\.pdf$/i };
  if (!allowed[file.type]?.test(file.name)) return 'Adjunta un archivo PNG, JPG o PDF válido.';
  return '';
}
