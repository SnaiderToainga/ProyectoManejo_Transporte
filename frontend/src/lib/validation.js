export function validarCedulaEcuador(cedula) {
  if (!cedula) return false;
  const clean = cedula.trim();
  if (!/^\d{10}$/.test(clean)) return false;
  const prov = parseInt(clean.substring(0, 2), 10);
  if (prov < 1 || prov > 24) return false;
  if (parseInt(clean.charAt(2), 10) >= 6) return false;

  const coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let val = parseInt(clean.charAt(i), 10) * coefs[i];
    if (val >= 10) val -= 9;
    suma += val;
  }
  const digito = (10 - (suma % 10)) % 10;
  return digito === parseInt(clean.charAt(9), 10);
}

export function passengerError(passengers) {
  if (!passengers.length) return 'Selecciona al menos un asiento.';
  for (const passenger of passengers) {
    if (passenger.nombre.trim().length < 3) return 'Escribe el nombre completo de cada pasajero.';
    if (!validarCedulaEcuador(passenger.cedula)) {
      return `La cédula ${passenger.cedula} no es una cédula ecuatoriana válida (Algoritmo Módulo 10).`;
    }
  }
  if (new Set(passengers.map(p => p.cedula.trim())).size !== passengers.length) {
    return 'Cada pasajero debe tener una cédula diferente.';
  }
  return '';
}

export function receiptError(file) {
  if (!file) return 'Selecciona tu comprobante de pago.';
  if (file.size <= 0) return 'El archivo está vacío.';
  if (file.size > 5 * 1024 * 1024) return 'El comprobante no puede superar los 5 MB.';
  const allowed = {
    'image/png': /\.png$/i,
    'image/jpeg': /\.jpe?g$/i,
    'image/jpg': /\.jpe?g$/i,
    'application/pdf': /\.pdf$/i
  };
  if (!allowed[file.type]?.test(file.name)) return 'Adjunta un archivo PNG, JPG o PDF válido.';
  return '';
}