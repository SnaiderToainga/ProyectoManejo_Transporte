// backend/src/services/seatTemplateService.js

/**
 * Normaliza coordenadas de celdas especiales (baño, puerta, escalera, bloqueada).
 * Admite formato legacy "fila-col" (piso 1) o formato estructurado { piso, fila, columna, tipo }.
 */
function normalizeSpecialCells(list, defaultTipo = 'BLOQUEADO') {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const normalized = [];

  for (const item of list) {
    let piso = 1;
    let fila = null;
    let columna = null;
    let tipo = defaultTipo;

    if (typeof item === 'string') {
      const parts = item.trim().split('-').map((n) => parseInt(n, 10));
      if (parts.length === 2 && parts.every((n) => Number.isInteger(n) && n >= 1)) {
        [fila, columna] = parts;
      } else if (parts.length === 3 && parts.every((n) => Number.isInteger(n) && n >= 1)) {
        [piso, fila, columna] = parts;
      }
    } else if (item && typeof item === 'object') {
      piso = Number(item.piso) === 2 ? 2 : 1;
      fila = parseInt(item.fila, 10);
      columna = parseInt(item.columna, 10);
      if (typeof item.tipo === 'string' && item.tipo.trim()) {
        tipo = item.tipo.trim().toUpperCase();
      }
    }

    if (!Number.isInteger(fila) || fila < 1 || fila > 40 || !Number.isInteger(columna) || columna < 1 || columna > 6) {
      continue;
    }

    const key = `${piso}-${fila}-${columna}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ piso, fila, columna, tipo });
  }

  return normalized;
}

function defaultAisleAfter(cols) {
  if (cols <= 2) return 1;
  if (cols === 3) return 2; // Distribución ejecutiva 2+1
  if (cols === 4) return 2; // Distribución clásica 2+2
  return 2; // 5 columnas -> 2+3
}

/**
 * Genera la distribución de asientos por Filas x Columnas (1 o 2 pisos)
 * aplicando compensación automática al final (Requerimiento crítico BUS-17):
 * - Si se bloquean/eliminan asientos o se ubican baños/escaleras/puertas,
 *   las plazas se reubican automáticamente al final para conservar la capacidad exacta.
 * - Si se envía `asientosPersonalizados` (asientos movidos o editados manualmente),
 *   respeta sus coordenadas exactas, categoría (VIP/NORMAL) y tamaño (GRANDE/NORMAL).
 */
exports.generarEstructuraCompensada = ({
  capacidad = 40,
  capacidad_piso1 = null,
  columnas = 4,
  columnas_piso2 = null,
  pasillo_despues_col = null,
  pasillo_despues_col_piso2 = null,
  pisos = 1,
  celdasBloqueadas = [],
  celdasBano = [],
  asientosVip = null,
  asientosGrandes = null,
  asientosPersonalizados = null
} = {}) => {
  const numCapacidad = parseInt(capacidad, 10);
  if (isNaN(numCapacidad) || numCapacidad < 1 || numCapacidad > 100) {
    throw new Error('La capacidad del bus debe estar entre 1 y 100 asientos.');
  }

  const numPisos = parseInt(pisos, 10) === 2 ? 2 : 1;
  const colsP1 = parseInt(columnas, 10) || 4;
  const colsP2 = parseInt(columnas_piso2, 10) || (numPisos === 2 ? 4 : colsP1);

  if (colsP1 < 2 || colsP1 > 5 || colsP2 < 2 || colsP2 > 5) {
    throw new Error('Las columnas por piso deben estar entre 2 y 5.');
  }

  const pasilloP1 = parseInt(pasillo_despues_col, 10) || defaultAisleAfter(colsP1);
  const pasilloP2 = parseInt(pasillo_despues_col_piso2, 10) || defaultAisleAfter(colsP2);

  const banoNorm = normalizeSpecialCells(celdasBano, 'BANO');
  const banoKeys = new Set(banoNorm.map((c) => `${c.piso}-${c.fila}-${c.columna}`));
  const bloqNorm = normalizeSpecialCells(celdasBloqueadas, 'BLOQUEADO')
    .filter((c) => !banoKeys.has(`${c.piso}-${c.fila}-${c.columna}`));
  const bloqKeys = new Set(bloqNorm.map((c) => `${c.piso}-${c.fila}-${c.columna}`));

  const vipSet = Array.isArray(asientosVip)
    ? new Set(asientosVip.map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n) && n >= 1))
    : null;
  const largeSet = Array.isArray(asientosGrandes)
    ? new Set(asientosGrandes.map((n) => parseInt(n, 10)).filter((n) => Number.isInteger(n) && n >= 1))
    : null;

  // Modo personalizado: el usuario movió/editó asientos en el lienzo visual
  if (Array.isArray(asientosPersonalizados) && asientosPersonalizados.length > 0) {
    if (asientosPersonalizados.length > 100) {
      throw new Error('La capacidad máxima permitida es de 100 asientos.');
    }

    const parsedSeats = [];
    const seenCoords = new Set();
    const seenNumbers = new Set();
    let maxRowP1 = 0;
    let maxRowP2 = 0;

    for (let i = 0; i < asientosPersonalizados.length; i++) {
      const raw = asientosPersonalizados[i];
      const piso = numPisos === 2 && Number(raw.piso) === 2 ? 2 : 1;
      const filaPiso = parseInt(raw.fila_piso ?? raw.fila, 10);
      const col = parseInt(raw.columna, 10);
      const numero = parseInt(raw.numero_asiento, 10) || (i + 1);
      const maxCols = piso === 2 ? colsP2 : colsP1;

      if (!Number.isInteger(filaPiso) || filaPiso < 1 || filaPiso > 40) {
        throw new Error(`Fila inválida en el asiento #${numero}.`);
      }
      if (!Number.isInteger(col) || col < 1 || col > maxCols) {
        throw new Error(`Columna inválida en el asiento #${numero}.`);
      }
      const coordKey = `${piso}-${filaPiso}-${col}`;
      if (seenCoords.has(coordKey)) {
        throw new Error(`Dos asientos ocupan la misma posición (${coordKey}).`);
      }
      if (seenNumbers.has(numero)) {
        throw new Error(`Número de asiento duplicado (#${numero}).`);
      }
      seenCoords.add(coordKey);
      seenNumbers.add(numero);

      if (piso === 1 && filaPiso > maxRowP1) maxRowP1 = filaPiso;
      if (piso === 2 && filaPiso > maxRowP2) maxRowP2 = filaPiso;

      const categoria = String(raw.categoria || 'NORMAL').toUpperCase() === 'VIP' ? 'VIP' : 'NORMAL';
      const tamano = String(raw.tamano || (categoria === 'VIP' ? 'GRANDE' : 'NORMAL')).toUpperCase() === 'GRANDE'
        ? 'GRANDE'
        : 'NORMAL';

      parsedSeats.push({
        numero_asiento: numero,
        piso,
        fila_piso: filaPiso,
        columna: col,
        categoria,
        tamano
      });
    }

    // Ordenar y asegurar filas globales sin solapamiento para PostgreSQL
    parsedSeats.sort((a, b) => a.numero_asiento - b.numero_asiento);
    const p1RowsOffset = Math.max(maxRowP1, ...banoNorm.filter(c => c.piso === 1).map(c => c.fila), ...bloqNorm.filter(c => c.piso === 1).map(c => c.fila), 0);
    const finalSeats = parsedSeats.map((s) => ({
      ...s,
      fila: s.piso === 2 ? p1RowsOffset + s.fila_piso : s.fila_piso
    }));

    const capP1Actual = finalSeats.filter((s) => s.piso === 1).length;
    return {
      capacidad_total: finalSeats.length,
      capacidad_piso1: capP1Actual,
      pisos: numPisos,
      columnas: colsP1,
      columnas_piso2: colsP2,
      pasillo_despues_col: pasilloP1,
      pasillo_despues_col_piso2: pasilloP2,
      filas_totales: p1RowsOffset + maxRowP2,
      filas_piso1: p1RowsOffset,
      filas_piso2: maxRowP2,
      compensados_al_final: bloqNorm.length + banoNorm.length,
      celdasBano: banoNorm,
      celdasBloqueadas: bloqNorm,
      asientos: finalSeats
    };
  }

  // Modo automático con compensación al final (BUS-17)
  let capP1 = numCapacidad;
  let capP2 = 0;
  if (numPisos === 2) {
    const parsedCapP1 = parseInt(capacidad_piso1, 10);
    if (Number.isInteger(parsedCapP1) && parsedCapP1 >= 1 && parsedCapP1 < numCapacidad) {
      capP1 = parsedCapP1;
    } else {
      capP1 = Math.max(1, Math.min(numCapacidad - 1, Math.round(numCapacidad * 0.32)));
    }
    capP2 = numCapacidad - capP1;
  }

  const asientosGenerados = [];
  let asientoActual = 1;

  function fillFloor(piso, targetCount, maxCols, rowOffset) {
    let generated = 0;
    let filaPiso = 1;
    while (generated < targetCount && filaPiso <= 40) {
      for (let col = 1; col <= maxCols; col++) {
        if (generated >= targetCount) break;
        const key = `${piso}-${filaPiso}-${col}`;
        if (bloqKeys.has(key) || banoKeys.has(key)) {
          continue; // Compensación automática al final (BUS-17)
        }

        const isVip = vipSet
          ? vipSet.has(asientoActual)
          : (numPisos === 2 ? piso === 1 : asientoActual <= 4);
        const categoria = isVip ? 'VIP' : 'NORMAL';
        const isLarge = largeSet ? largeSet.has(asientoActual) : isVip;
        const tamano = isLarge ? 'GRANDE' : 'NORMAL';

        asientosGenerados.push({
          numero_asiento: asientoActual,
          fila: rowOffset + filaPiso,
          fila_piso: filaPiso,
          columna: col,
          piso,
          categoria,
          tamano
        });
        asientoActual++;
        generated++;
      }
      filaPiso++;
    }
    if (generated < targetCount) {
      throw new Error(`No hay espacio suficiente en el piso ${piso} para ubicar ${targetCount} asientos con tantos bloqueos.`);
    }
    return filaPiso - 1;
  }

  const filasP1 = fillFloor(1, capP1, colsP1, 0);
  const p1RowsSpan = Math.max(
    filasP1,
    ...banoNorm.filter((c) => c.piso === 1).map((c) => c.fila),
    ...bloqNorm.filter((c) => c.piso === 1).map((c) => c.fila),
    0
  );
  const filasP2 = numPisos === 2 ? fillFloor(2, capP2, colsP2, p1RowsSpan) : 0;

  return {
    capacidad_total: numCapacidad,
    capacidad_piso1: capP1,
    pisos: numPisos,
    columnas: colsP1,
    columnas_piso2: colsP2,
    pasillo_despues_col: pasilloP1,
    pasillo_despues_col_piso2: pasilloP2,
    filas_totales: p1RowsSpan + filasP2,
    filas_piso1: p1RowsSpan,
    filas_piso2: filasP2,
    compensados_al_final: bloqNorm.length + banoNorm.length,
    celdasBano: banoNorm,
    celdasBloqueadas: bloqNorm,
    asientos: asientosGenerados
  };
};
