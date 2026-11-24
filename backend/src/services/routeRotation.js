function planningError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function positiveId(value, label = 'Identificador') {
  if (!['number', 'string'].includes(typeof value)) throw planningError(`${label} inválido.`);
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw planningError(`${label} inválido.`);
  return id;
}

function dateRange(start, end) {
  const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end)) throw planningError('Selecciona fechas válidas.');
  const count = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (count < 1 || count > 31) throw planningError('El rango debe contener entre 1 y 31 días.');
  return Array.from({ length: count }, (_, index) => new Date(Date.parse(start) + index * 86400000).toISOString().slice(0, 10));
}

function proposeRotation(buses, frequencies, dates, anchor, stops = []) {
  if (!frequencies.length || buses.length < frequencies.length + 2) {
    throw planningError('Se requieren al menos dos buses de reserva además de uno por frecuencia.');
  }
  dateRange(anchor, anchor);
  return dates.flatMap(date => {
    const offset = ((Date.parse(date) - Date.parse(anchor)) / 86400000 % buses.length + buses.length) % buses.length;
    const rotation = frequencies.map((frequency, index) => ({
      frecuencia_id: frequency.id, fecha: date, bus_id: buses[(index + offset) % buses.length].id
    }));
    const blocked = new Set(stops.filter(stop => stop.fecha === date).map(stop => stop.bus_id));
    const available = buses.filter(bus => !blocked.has(bus.id));
    if (available.length < frequencies.length + (blocked.size ? 1 : 2)) {
      throw planningError(`No hay unidades de reserva suficientes para el ${date}.`, 409);
    }
    const replacements = available.filter(bus => !rotation.some(cell => cell.bus_id === bus.id));
    return rotation.map(cell => blocked.has(cell.bus_id) ? { ...cell, bus_id: replacements.shift().id } : cell);
  });
}

module.exports = { planningError, positiveId, dateRange, proposeRotation };
