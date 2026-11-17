// backend/src/services/seatTemplateService.js

/**
 * Genera la distribución de asientos por Filas x Columnas aplicando
 * compensación automática al final (Requerimiento crítico BUS-17):
 * Si se bloquean/eliminan asientos en la primera fila o por baño,
 * las plazas se reubican automáticamente al final para conservar la capacidad exacta.
 */
exports.generarEstructuraCompensada = ({
  capacidad = 40,
  columnas = 4,
  pisos = 1,
  celdasBloqueadas = [], // ej. ["1-2", "1-3", "1-4"] en primera fila
  celdasBano = []        // ej. ["10-4"]
}) => {
  const numCapacidad = parseInt(capacidad, 10);
  if (isNaN(numCapacidad) || numCapacidad < 12 || numCapacidad > 65) {
    throw new Error('La capacidad del bus debe estar entre 12 y 65 asientos.');
  }

  const bloqueadosSet = new Set(celdasBloqueadas);
  const banoSet = new Set(celdasBano);
  const asientosGenerados = [];

  let asientoActual = 1;
  let filaActual = 1;

  // Avanza fila por fila; si encuentra celdas bloqueadas o baños, salta la posición
  // y continúa agregando asientos al final hasta cumplir exactamente numCapacidad
  while (asientosGenerados.length < numCapacidad && filaActual <= 30) {
    for (let col = 1; col <= columnas; col++) {
      if (asientosGenerados.length >= numCapacidad) break;
      const key = `${filaActual}-${col}`;

      if (bloqueadosSet.has(key) || banoSet.has(key)) {
        continue; // Posición bloqueada o baño: se compensa automáticamente al final
      }

      const piso = pisos === 2 && asientoActual > Math.ceil(numCapacidad / 2) ? 2 : 1;
      const categoria = asientoActual <= 4 ? 'VIP' : 'NORMAL';

      asientosGenerados.push({
        numero_asiento: asientoActual,
        fila: filaActual,
        columna: col,
        piso,
        categoria
      });
      asientoActual++;
    }
    filaActual++;
  }

  return {
    capacidad_total: numCapacidad,
    pisos,
    columnas,
    filas_totales: filaActual - 1,
    compensados_al_final: bloqueadosSet.size + banoSet.size,
    asientos: asientosGenerados
  };
};