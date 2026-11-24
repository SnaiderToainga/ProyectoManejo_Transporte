import { aisleAfterColumn } from './seats.js';

export const BUILTIN_BUS_TEMPLATES = [
  {
    id: 'tpl-estandar-40',
    nombre: 'Estándar 40 (1 Piso + Baño posterior)',
    descripcion: 'Bus interprovincial clásico 2+2 con fila delantera VIP amplia y baño WC posterior compensado.',
    es_sistema: true,
    pisos: 1,
    capacidad: 40,
    capacidad_piso1: 40,
    columnas: 4,
    columnas_piso2: 4,
    pasillo_despues_col: 2,
    pasillo_despues_col_piso2: 2,
    celdasBano: [{ piso: 1, fila: 10, columna: 4 }],
    celdasBloqueadas: [],
    asientosVip: [1, 2, 3, 4],
    asientosGrandes: [1, 2, 3, 4],
    asientosPersonalizados: null
  },
  {
    id: 'tpl-continuo-41',
    nombre: 'Continuo 41 (1 Piso sin baño)',
    descripcion: 'Distribución clásica de 41 plazas continuas sin baño, con primera fila VIP.',
    es_sistema: true,
    pisos: 1,
    capacidad: 41,
    capacidad_piso1: 41,
    columnas: 4,
    columnas_piso2: 4,
    pasillo_despues_col: 2,
    pasillo_despues_col_piso2: 2,
    celdasBano: [],
    celdasBloqueadas: [],
    asientosVip: [1, 2, 3, 4],
    asientosGrandes: [1, 2, 3, 4],
    asientosPersonalizados: null
  },
  {
    id: 'tpl-ejecutivo-vip-30',
    nombre: 'Ejecutivo VIP 30 (1 Piso 2+1 · Asientos VIP Grandes)',
    descripcion: 'Configuración 2+1 espaciosa con 12 asientos VIP grandes tipo cama al frente, puerta y baño posterior.',
    es_sistema: true,
    pisos: 1,
    capacidad: 30,
    capacidad_piso1: 30,
    columnas: 3,
    columnas_piso2: 3,
    pasillo_despues_col: 2,
    pasillo_despues_col_piso2: 2,
    celdasBano: [{ piso: 1, fila: 11, columna: 3 }],
    celdasBloqueadas: [{ piso: 1, fila: 1, columna: 3, tipo: 'PUERTA' }],
    asientosVip: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    asientosGrandes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    asientosPersonalizados: null
  },
  {
    id: 'tpl-doble-piso-56',
    nombre: 'Doble Piso 56 (Piso 1 Salón VIP Grande + Piso 2 Panorámico)',
    descripcion: 'Piso 1 con 16 asientos VIP grandes (2+1), escalera y baño WC; Piso 2 panorámico con 40 asientos (2+2).',
    es_sistema: true,
    pisos: 2,
    capacidad: 56,
    capacidad_piso1: 16,
    columnas: 3,
    columnas_piso2: 4,
    pasillo_despues_col: 2,
    pasillo_despues_col_piso2: 2,
    celdasBano: [{ piso: 1, fila: 6, columna: 3 }],
    celdasBloqueadas: [
      { piso: 1, fila: 1, columna: 3, tipo: 'PUERTA' },
      { piso: 1, fila: 5, columna: 3, tipo: 'ESCALERA' },
      { piso: 2, fila: 5, columna: 3, tipo: 'ESCALERA' },
      { piso: 2, fila: 5, columna: 4, tipo: 'ESCALERA' }
    ],
    asientosVip: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    asientosGrandes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    asientosPersonalizados: null
  },
  {
    id: 'tpl-minibus-24',
    nombre: 'MiniBus 24 (1 Piso · Fila 1 con 1 asiento + compensación)',
    descripcion: 'Unidad compacta de 24 asientos con acceso delantero amplio y plazas compensadas atrás.',
    es_sistema: true,
    pisos: 1,
    capacidad: 24,
    capacidad_piso1: 24,
    columnas: 4,
    columnas_piso2: 4,
    pasillo_despues_col: 2,
    pasillo_despues_col_piso2: 2,
    celdasBano: [],
    celdasBloqueadas: [{ piso: 1, fila: 1, columna: 4, tipo: 'PUERTA' }],
    asientosVip: [1],
    asientosGrandes: [1],
    asientosPersonalizados: null
  }
];

export function coordKey(piso, fila, columna) {
  return `${piso}-${fila}-${columna}`;
}

export function floorOf(item) {
  return Number(item?.piso) === 2 ? 2 : 1;
}

export function rowOf(item) {
  return Number(item?.fila_piso || item?.fila || 1);
}

/**
 * Garantiza que nunca existan baños, puertas o asientos fuera de los límites
 * (piso/columnas actuales), duplicados o solapados en la misma coordenada.
 */
export function sanitizeDesign(design) {
  if (!design) return design;
  const pisos = Number(design.pisos) === 2 ? 2 : 1;
  const colsP1 = Math.max(2, Math.min(5, Number(design.columnas) || 4));
  const colsP2 = Math.max(2, Math.min(5, Number(design.columnas_piso2) || (pisos === 2 ? 4 : colsP1)));
  const maxColsFor = (p) => (p === 2 ? colsP2 : colsP1);

  const validSeats = [];
  const seatKeys = new Set();
  for (const s of (design.asientos || [])) {
    const p = floorOf(s);
    const f = rowOf(s);
    const c = Number(s.columna);
    if (p > pisos || !Number.isInteger(f) || f < 1 || f > 40 || !Number.isInteger(c) || c < 1 || c > maxColsFor(p)) {
      continue;
    }
    const key = coordKey(p, f, c);
    if (seatKeys.has(key)) continue;
    seatKeys.add(key);
    validSeats.push({ ...s, piso: p, fila_piso: f, fila: f, columna: c });
  }

  const validBaths = [];
  const bathKeys = new Set();
  for (const b of (design.celdasBano || [])) {
    const p = floorOf(b);
    const f = Number(b.fila);
    const c = Number(b.columna);
    if (p > pisos || !Number.isInteger(f) || f < 1 || f > 40 || !Number.isInteger(c) || c < 1 || c > maxColsFor(p)) {
      continue;
    }
    const key = coordKey(p, f, c);
    if (seatKeys.has(key) || bathKeys.has(key)) continue;
    bathKeys.add(key);
    validBaths.push({ piso: p, fila: f, columna: c });
  }

  const validBlocked = [];
  const blkKeys = new Set();
  for (const b of (design.celdasBloqueadas || [])) {
    const p = floorOf(b);
    const f = Number(b.fila);
    const c = Number(b.columna);
    const tipo = String(b.tipo || '').toUpperCase();
    if (tipo !== 'PUERTA' && tipo !== 'ESCALERA') continue;
    if (p > pisos || !Number.isInteger(f) || f < 1 || f > 40 || !Number.isInteger(c) || c < 1 || c > maxColsFor(p)) {
      continue;
    }
    const key = coordKey(p, f, c);
    if (seatKeys.has(key) || bathKeys.has(key) || blkKeys.has(key)) continue;
    blkKeys.add(key);
    validBlocked.push({ piso: p, fila: f, columna: c, tipo });
  }

  return {
    ...design,
    pisos,
    columnas: colsP1,
    columnas_piso2: colsP2,
    asientos: validSeats,
    capacidad: validSeats.length,
    capacidad_piso1: validSeats.filter((s) => floorOf(s) === 1).length,
    celdasBano: validBaths,
    celdasBloqueadas: validBlocked
  };
}

export function renumberSeats(seats) {
  const sorted = [...seats].sort((a, b) => {
    const fp = floorOf(a) - floorOf(b);
    if (fp !== 0) return fp;
    const fr = rowOf(a) - rowOf(b);
    if (fr !== 0) return fr;
    return Number(a.columna) - Number(b.columna);
  });
  return sorted.map((s, idx) => ({
    ...s,
    piso: floorOf(s),
    fila_piso: rowOf(s),
    fila: rowOf(s),
    columna: Number(s.columna),
    numero_asiento: idx + 1
  }));
}

export function findNextRearSlot(piso, cols, seats, baths, blocked, startRow = 1) {
  const occupied = new Set([
    ...seats.filter((s) => floorOf(s) === piso).map((s) => coordKey(piso, rowOf(s), Number(s.columna))),
    ...baths.filter((b) => floorOf(b) === piso).map((b) => coordKey(piso, Number(b.fila), Number(b.columna))),
    ...blocked.filter((b) => floorOf(b) === piso).map((b) => coordKey(piso, Number(b.fila), Number(b.columna)))
  ]);
  for (let r = Math.max(1, startRow); r <= 40; r++) {
    for (let c = 1; c <= cols; c++) {
      if (!occupied.has(coordKey(piso, r, c))) {
        return { fila: r, columna: c };
      }
    }
  }
  return null;
}

export function getFloorLastSeatRow(piso, seats) {
  let maxR = 1;
  for (const s of seats) {
    if (floorOf(s) === piso) {
      const r = rowOf(s);
      if (r > maxR) maxR = r;
    }
  }
  return maxR;
}

export function generateSeatsFromDesign(design) {
  const numCap = Math.max(1, Math.min(100, parseInt(design.capacidad, 10) || 40));
  const numPisos = Number(design.pisos) === 2 ? 2 : 1;
  const colsP1 = Math.max(2, Math.min(5, parseInt(design.columnas, 10) || 4));
  const colsP2 = Math.max(2, Math.min(5, parseInt(design.columnas_piso2, 10) || 4));

  const baths = Array.isArray(design.celdasBano) ? design.celdasBano : [];
  const blocked = Array.isArray(design.celdasBloqueadas) ? design.celdasBloqueadas : [];
  const bathSet = new Set(baths.map((c) => coordKey(floorOf(c), Number(c.fila), Number(c.columna))));
  const blockedSet = new Set(blocked.map((c) => coordKey(floorOf(c), Number(c.fila), Number(c.columna))));

  const vipSet = Array.isArray(design.asientosVip) ? new Set(design.asientosVip.map(Number)) : null;
  const largeSet = Array.isArray(design.asientosGrandes) ? new Set(design.asientosGrandes.map(Number)) : null;

  let capP1 = numCap;
  let capP2 = 0;
  if (numPisos === 2) {
    const parsedP1 = parseInt(design.capacidad_piso1, 10);
    capP1 = Number.isInteger(parsedP1) && parsedP1 >= 1 && parsedP1 < numCap
      ? parsedP1
      : Math.max(1, Math.min(numCap - 1, Math.round(numCap * 0.32)));
    capP2 = numCap - capP1;
  }

  const seats = [];
  let num = 1;

  function fill(piso, target, cols) {
    let count = 0;
    let fila = 1;
    while (count < target && fila <= 40) {
      for (let col = 1; col <= cols; col++) {
        if (count >= target) break;
        const key = coordKey(piso, fila, col);
        if (bathSet.has(key) || blockedSet.has(key)) continue;
        const isVip = vipSet ? vipSet.has(num) : (numPisos === 2 ? piso === 1 : num <= 4);
        const isLarge = largeSet ? largeSet.has(num) : isVip;
        seats.push({
          numero_asiento: num,
          piso,
          fila_piso: fila,
          fila,
          columna: col,
          categoria: isVip ? 'VIP' : 'NORMAL',
          tamano: isLarge ? 'GRANDE' : 'NORMAL'
        });
        num++;
        count++;
      }
      fila++;
    }
  }

  fill(1, capP1, colsP1);
  if (numPisos === 2) fill(2, capP2, colsP2);
  return seats;
}

export function buildInitialDesign(templateOrLayout, existingSeats = null) {
  const base = templateOrLayout || BUILTIN_BUS_TEMPLATES[0];
  const pisos = Number(base.pisos) === 2 ? 2 : 1;
  const columnas = Number(base.columnas) || 4;
  const columnas_piso2 = Number(base.columnas_piso2) || (pisos === 2 ? 4 : columnas);
  const celdasBano = Array.isArray(base.celdasBano)
    ? base.celdasBano.map((c) => ({ piso: floorOf(c), fila: Number(c.fila), columna: Number(c.columna) }))
    : [];
  const rawBlocked = Array.isArray(base.celdasBloqueadas)
    ? base.celdasBloqueadas.map((c) => ({ piso: floorOf(c), fila: Number(c.fila), columna: Number(c.columna), tipo: String(c.tipo || 'BLOQUEADO').toUpperCase() }))
    : [];

  let seats;
  if (Array.isArray(existingSeats) && existingSeats.length > 0 && existingSeats.some((s) => s.fila && s.columna)) {
    seats = existingSeats.map((s) => ({
      numero_asiento: Number(s.numero_asiento),
      piso: floorOf(s),
      fila_piso: rowOf(s),
      fila: rowOf(s),
      columna: Number(s.columna),
      categoria: String(s.categoria || 'NORMAL').toUpperCase() === 'VIP' ? 'VIP' : 'NORMAL',
      tamano: String(s.tamano || (String(s.categoria || '').toUpperCase() === 'VIP' ? 'GRANDE' : 'NORMAL')).toUpperCase() === 'GRANDE' ? 'GRANDE' : 'NORMAL'
    }));
  } else if (Array.isArray(base.asientosPersonalizados) && base.asientosPersonalizados.length > 0) {
    seats = base.asientosPersonalizados.map((s) => ({
      numero_asiento: Number(s.numero_asiento),
      piso: floorOf(s),
      fila_piso: rowOf(s),
      fila: rowOf(s),
      columna: Number(s.columna),
      categoria: String(s.categoria || 'NORMAL').toUpperCase() === 'VIP' ? 'VIP' : 'NORMAL',
      tamano: String(s.tamano || (String(s.categoria || '').toUpperCase() === 'VIP' ? 'GRANDE' : 'NORMAL')).toUpperCase() === 'GRANDE' ? 'GRANDE' : 'NORMAL'
    }));
  } else {
    seats = generateSeatsFromDesign({ ...base, celdasBloqueadas: rawBlocked });
  }

  const celdasBloqueadas = rawBlocked.filter((c) => c.tipo === 'PUERTA' || c.tipo === 'ESCALERA');

  return sanitizeDesign({
    plantilla_id: base.id || base.plantilla_id || null,
    plantilla_nombre: base.nombre || base.plantilla_nombre || 'Personalizada',
    pisos,
    capacidad: seats.length,
    capacidad_piso1: seats.filter((s) => floorOf(s) === 1).length || Math.min(seats.length, Number(base.capacidad_piso1) || seats.length),
    columnas,
    columnas_piso2,
    pasillo_despues_col: aisleAfterColumn(columnas, base.pasillo_despues_col),
    pasillo_despues_col_piso2: aisleAfterColumn(columnas_piso2, base.pasillo_despues_col_piso2),
    celdasBano,
    celdasBloqueadas,
    asientos: seats,
    extraRowsP1: 0,
    extraRowsP2: 0
  });
}

export function adjustCapacityPreservingLayout(design, targetCap, targetFloor = null) {
  const cap = Math.max(1, Math.min(100, parseInt(targetCap, 10) || 1));
  const seats = [...(design.asientos || [])];
  const baths = [...(design.celdasBano || [])];
  const blocked = [...(design.celdasBloqueadas || [])];

  if (seats.length === cap) return { ...design, capacidad: cap };

  const pisoDestino = targetFloor || (design.pisos === 2 ? 2 : 1);
  const colsDestino = pisoDestino === 2 ? design.columnas_piso2 : design.columnas;

  if (cap > seats.length) {
    const toAdd = cap - seats.length;
    for (let i = 0; i < toAdd; i++) {
      const startRow = getFloorLastSeatRow(pisoDestino, seats);
      const slot =
        findNextRearSlot(pisoDestino, colsDestino, seats, baths, blocked, startRow) ||
        findNextRearSlot(pisoDestino, colsDestino, seats, baths, blocked, 1);
      if (!slot) break;
      const isDefaultVip = design.pisos === 2 && pisoDestino === 1;
      seats.push({
        numero_asiento: seats.length + 1,
        piso: pisoDestino,
        fila_piso: slot.fila,
        fila: slot.fila,
        columna: slot.columna,
        categoria: isDefaultVip ? 'VIP' : 'NORMAL',
        tamano: isDefaultVip ? 'GRANDE' : 'NORMAL'
      });
    }
  } else {
    const ordered = renumberSeats(seats);
    ordered.length = cap;
    seats.length = 0;
    seats.push(...ordered);
  }

  const finalSeats = renumberSeats(seats);
  return {
    ...design,
    asientos: finalSeats,
    capacidad: finalSeats.length,
    capacidad_piso1: finalSeats.filter((s) => floorOf(s) === 1).length,
    extraRowsP1: 0,
    extraRowsP2: 0
  };
}

export function applyCellOperation(design, { tool, piso, fila, columna, autoCompensate = true }) {
  const seats = [...(design.asientos || [])];
  const baths = [...(design.celdasBano || [])];
  const blocked = [...(design.celdasBloqueadas || [])];
  const cols = piso === 2 ? design.columnas_piso2 : design.columnas;

  const seatIdx = seats.findIndex((s) => floorOf(s) === piso && rowOf(s) === fila && Number(s.columna) === columna);
  const bathIdx = baths.findIndex((b) => floorOf(b) === piso && Number(b.fila) === fila && Number(b.columna) === columna);
  const blkIdx = blocked.findIndex((b) => floorOf(b) === piso && Number(b.fila) === fila && Number(b.columna) === columna);

  const finalize = (nextSeats, nextBaths, nextBlocked, note = '', extraPatch = {}) => {
    const cleanSeats = renumberSeats(nextSeats);
    return {
      design: sanitizeDesign({
        ...design,
        ...extraPatch,
        celdasBano: nextBaths,
        celdasBloqueadas: nextBlocked,
        asientos: cleanSeats,
        capacidad: cleanSeats.length,
        capacidad_piso1: cleanSeats.filter((s) => floorOf(s) === 1).length
      }),
      note
    };
  };

  if (tool === 'borrar') {
    if (seatIdx !== -1) {
      if (seats.length <= 1) {
        return { design, note: 'El bus debe conservar al menos 1 asiento.' };
      }
      const removedNum = seats[seatIdx].numero_asiento;
      seats.splice(seatIdx, 1);
      return finalize(seats, baths, blocked, `Asiento #${removedNum} eliminado (quedan ${seats.length} plazas).`, {
        [piso === 2 ? 'extraRowsP2' : 'extraRowsP1']: 0
      });
    }
    if (bathIdx !== -1) {
      baths.splice(bathIdx, 1);
      return finalize(seats, baths, blocked, 'Baño WC retirado.');
    }
    if (blkIdx !== -1) {
      const removedTipo = blocked[blkIdx].tipo;
      blocked.splice(blkIdx, 1);
      return finalize(seats, baths, blocked, `${removedTipo === 'ESCALERA' ? 'Escalera' : 'Puerta'} retirada.`);
    }
    return { design, note: '' };
  }

  if (tool === 'vip') {
    if (seatIdx !== -1) {
      const current = seats[seatIdx];
      const nextIsVip = !(current.categoria === 'VIP' && current.tamano === 'GRANDE');
      seats[seatIdx] = {
        ...current,
        categoria: nextIsVip ? 'VIP' : 'NORMAL',
        tamano: nextIsVip ? 'GRANDE' : 'NORMAL'
      };
      return {
        design: { ...design, asientos: seats },
        note: `Asiento #${current.numero_asiento} cambiado a ${nextIsVip ? 'VIP Grande' : 'Normal'}.`
      };
    }
    if (seats.length >= 100) return { design, note: 'Límite máximo alcanzado (100 asientos).' };
    if (bathIdx !== -1) baths.splice(bathIdx, 1);
    if (blkIdx !== -1) blocked.splice(blkIdx, 1);
    seats.push({
      numero_asiento: seats.length + 1,
      piso,
      fila_piso: fila,
      fila,
      columna,
      categoria: 'VIP',
      tamano: 'GRANDE'
    });
    return finalize(seats, baths, blocked, `Asiento VIP Grande añadido en Fila ${fila}, Col ${columna}.`);
  }

  if (tool === 'normal') {
    if (seatIdx !== -1) {
      const current = seats[seatIdx];
      if (current.categoria === 'NORMAL' && current.tamano === 'NORMAL') {
        return { design, note: '' };
      }
      seats[seatIdx] = { ...current, categoria: 'NORMAL', tamano: 'NORMAL' };
      return {
        design: { ...design, asientos: seats },
        note: `Asiento #${current.numero_asiento} cambiado a Normal.`
      };
    }
    if (seats.length >= 100) return { design, note: 'Límite máximo alcanzado (100 asientos).' };
    if (bathIdx !== -1) baths.splice(bathIdx, 1);
    if (blkIdx !== -1) blocked.splice(blkIdx, 1);
    seats.push({
      numero_asiento: seats.length + 1,
      piso,
      fila_piso: fila,
      fila,
      columna,
      categoria: 'NORMAL',
      tamano: 'NORMAL'
    });
    return finalize(seats, baths, blocked, `Asiento Normal añadido en Fila ${fila}, Col ${columna}.`);
  }

  if (tool === 'bano' || tool === 'puerta') {
    const isBath = tool === 'bano';
    const targetTipo = isBath ? 'BANO' : (design.pisos === 2 && fila > 1 ? 'ESCALERA' : 'PUERTA');

    if (isBath && bathIdx !== -1) {
      baths.splice(bathIdx, 1);
      return finalize(seats, baths, blocked, 'Baño WC retirado.');
    }
    if (!isBath && blkIdx !== -1 && blocked[blkIdx].tipo === targetTipo) {
      blocked.splice(blkIdx, 1);
      return finalize(seats, baths, blocked, `${targetTipo === 'ESCALERA' ? 'Escalera' : 'Puerta'} retirada.`);
    }

    if (bathIdx !== -1) baths.splice(bathIdx, 1);
    if (blkIdx !== -1) blocked.splice(blkIdx, 1);
    if (isBath) {
      baths.push({ piso, fila, columna });
    } else {
      blocked.push({ piso, fila, columna, tipo: targetTipo });
    }

    if (seatIdx !== -1) {
      const displaced = seats[seatIdx];
      seats.splice(seatIdx, 1);
      if (autoCompensate) {
        const lastRow = Math.max(getFloorLastSeatRow(piso, seats), fila);
        const slot =
          findNextRearSlot(piso, cols, seats, baths, blocked, lastRow) ||
          findNextRearSlot(piso, cols, seats, baths, blocked, 1);
        if (slot) {
          seats.push({
            ...displaced,
            piso,
            fila_piso: slot.fila,
            fila: slot.fila,
            columna: slot.columna
          });
          return finalize(
            seats,
            baths,
            blocked,
            `${isBath ? 'Baño WC' : targetTipo === 'ESCALERA' ? 'Escalera' : 'Puerta'} colocado · Asiento compensado al final (Fila ${slot.fila}, Col ${slot.columna}) manteniendo ${seats.length} plazas.`
          );
        }
      }
      if (seats.length < 1) {
        return { design, note: 'No puedes reemplazar el último asiento del bus.' };
      }
    }

    return finalize(
      seats,
      baths,
      blocked,
      `${isBath ? 'Baño WC' : targetTipo === 'ESCALERA' ? 'Escalera' : 'Puerta'} ubicado en Fila ${fila}, Col ${columna}.`
    );
  }

  return { design, note: '' };
}

export function moveOrSwapCell(design, source, target) {
  if (!source || !target) return { design, note: '' };
  if (source.piso === target.piso && source.fila === target.fila && source.columna === target.columna) {
    return { design, note: '' };
  }

  const seats = [...(design.asientos || [])];
  const baths = [...(design.celdasBano || [])];
  const blocked = [...(design.celdasBloqueadas || [])];

  const findAt = (coord) => ({
    seatIdx: seats.findIndex((s) => floorOf(s) === coord.piso && rowOf(s) === coord.fila && Number(s.columna) === coord.columna),
    bathIdx: baths.findIndex((b) => floorOf(b) === coord.piso && Number(b.fila) === coord.fila && Number(b.columna) === coord.columna),
    blkIdx: blocked.findIndex((b) => floorOf(b) === coord.piso && Number(b.fila) === coord.fila && Number(b.columna) === coord.columna)
  });

  const src = findAt(source);
  const dst = findAt(target);

  const srcKind = src.seatIdx !== -1 ? 'seat' : src.bathIdx !== -1 ? 'bath' : src.blkIdx !== -1 ? 'blk' : null;
  if (!srcKind) return { design, note: '' };
  const dstKind = dst.seatIdx !== -1 ? 'seat' : dst.bathIdx !== -1 ? 'bath' : dst.blkIdx !== -1 ? 'blk' : null;

  if (srcKind === 'seat') {
    seats[src.seatIdx] = { ...seats[src.seatIdx], piso: target.piso, fila_piso: target.fila, fila: target.fila, columna: target.columna };
  } else if (srcKind === 'bath') {
    baths[src.bathIdx] = { ...baths[src.bathIdx], piso: target.piso, fila: target.fila, columna: target.columna };
  } else if (srcKind === 'blk') {
    blocked[src.blkIdx] = { ...blocked[src.blkIdx], piso: target.piso, fila: target.fila, columna: target.columna };
  }

  if (dstKind === 'seat') {
    seats[dst.seatIdx] = { ...seats[dst.seatIdx], piso: source.piso, fila_piso: source.fila, fila: source.fila, columna: source.columna };
  } else if (dstKind === 'bath') {
    baths[dst.bathIdx] = { ...baths[dst.bathIdx], piso: source.piso, fila: source.fila, columna: source.columna };
  } else if (dstKind === 'blk') {
    blocked[dst.blkIdx] = { ...blocked[dst.blkIdx], piso: source.piso, fila: source.fila, columna: source.columna };
  }

  return {
    design: {
      ...design,
      celdasBano: baths,
      celdasBloqueadas: blocked,
      asientos: seats,
      capacidad: seats.length,
      capacidad_piso1: seats.filter((s) => floorOf(s) === 1).length
    },
    note: dstKind ? 'Elementos intercambiados de posición.' : `Movido a Piso ${target.piso}, Fila ${target.fila}, Col ${target.columna}.`
  };
}

export function deleteEmptyRow(design, piso, fila) {
  const hasSeat = (design.asientos || []).some((s) => floorOf(s) === piso && rowOf(s) === fila);
  const hasBath = (design.celdasBano || []).some((b) => floorOf(b) === piso && Number(b.fila) === fila);
  const hasBlk = (design.celdasBloqueadas || []).some((b) => floorOf(b) === piso && Number(b.fila) === fila);
  if (hasSeat || hasBath || hasBlk) return design;

  const shiftRow = (r) => (r > fila ? r - 1 : r);
  const nextSeats = (design.asientos || []).map((s) => (
    floorOf(s) === piso
      ? { ...s, fila_piso: shiftRow(rowOf(s)), fila: shiftRow(rowOf(s)) }
      : s
  ));
  const nextBaths = (design.celdasBano || []).map((b) => (
    floorOf(b) === piso ? { ...b, fila: shiftRow(Number(b.fila)) } : b
  ));
  const nextBlocked = (design.celdasBloqueadas || []).map((b) => (
    floorOf(b) === piso ? { ...b, fila: shiftRow(Number(b.fila)) } : b
  ));
  const extraKey = piso === 2 ? 'extraRowsP2' : 'extraRowsP1';

  return {
    ...design,
    asientos: nextSeats,
    celdasBano: nextBaths,
    celdasBloqueadas: nextBlocked,
    [extraKey]: Math.max(0, (design[extraKey] || 0) - 1)
  };
}

export function applyFirstRowBus17(design) {
  const cols = design.columnas || 4;
  const seats = [...(design.asientos || [])];
  const baths = (design.celdasBano || []).filter((b) => !(floorOf(b) === 1 && Number(b.fila) === 1 && Number(b.columna) >= 2));
  const blocked = (design.celdasBloqueadas || []).filter((b) => !(floorOf(b) === 1 && Number(b.fila) === 1 && Number(b.columna) >= 2));

  blocked.push({ piso: 1, fila: 1, columna: cols, tipo: 'PUERTA' });

  const displaced = [];
  const keptSeats = [];
  for (const s of seats) {
    if (floorOf(s) === 1 && rowOf(s) === 1 && Number(s.columna) >= 2) {
      displaced.push(s);
    } else {
      keptSeats.push(s);
    }
  }

  const hasFrontSeat = keptSeats.some((s) => floorOf(s) === 1 && rowOf(s) === 1 && Number(s.columna) === 1);
  if (!hasFrontSeat && displaced.length > 0) {
    const first = displaced.shift();
    keptSeats.push({ ...first, piso: 1, fila_piso: 1, fila: 1, columna: 1 });
  }

  for (const s of displaced) {
    const startRow = Math.max(getFloorLastSeatRow(1, keptSeats), 2);
    const slot =
      findNextRearSlot(1, cols, keptSeats, baths, blocked, startRow) ||
      findNextRearSlot(1, cols, keptSeats, baths, blocked, 2);
    if (slot) {
      keptSeats.push({ ...s, piso: 1, fila_piso: slot.fila, fila: slot.fila, columna: slot.columna });
    }
  }

  const finalSeats = renumberSeats(keptSeats);
  return {
    design: {
      ...design,
      celdasBano: baths,
      celdasBloqueadas: blocked,
      asientos: finalSeats,
      capacidad: finalSeats.length,
      capacidad_piso1: finalSeats.filter((s) => floorOf(s) === 1).length
    },
    displacedCount: displaced.length
  };
}

export function switchDesignFloors(design, nextPisos) {
  const p = Number(nextPisos) === 2 ? 2 : 1;
  if (p === design.pisos) return design;

  if (p === 2) {
    const cap = Math.max(12, design.capacidad < 20 ? 48 : design.capacidad);
    const capP1 = Math.max(4, Math.min(cap - 4, Math.round(cap * 0.3)));
    const vipP1 = Array.from({ length: capP1 }, (_, i) => i + 1);
    const hadBath = (design.celdasBano || []).length > 0;
    const bathRowP1 = Math.ceil((capP1 + 1) / 3);
    const nextBaths = hadBath ? [{ piso: 1, fila: bathRowP1, columna: 3 }] : [];
    const nextBlocked = (design.celdasBloqueadas || []).filter((b) => floorOf(b) === 1 && Number(b.columna) <= 3 && Number(b.fila) <= bathRowP1);

    const nextBase = {
      ...design,
      pisos: 2,
      capacidad: cap,
      capacidad_piso1: capP1,
      columnas: 3,
      columnas_piso2: 4,
      pasillo_despues_col: 2,
      pasillo_despues_col_piso2: 2,
      celdasBano: nextBaths,
      celdasBloqueadas: nextBlocked,
      plantilla_nombre: `${design.plantilla_nombre || 'Estructura'} (2 Pisos)`
    };
    const seats = generateSeatsFromDesign({ ...nextBase, asientosVip: vipP1, asientosGrandes: vipP1 });
    return sanitizeDesign({ ...nextBase, asientos: seats, extraRowsP1: 0, extraRowsP2: 0 });
  }

  const cleanedBaths = (design.celdasBano || []).filter((c) => floorOf(c) === 1 && Number(c.columna) <= 4);
  const cleanedBlocked = (design.celdasBloqueadas || []).filter((c) => floorOf(c) === 1 && Number(c.columna) <= 4);
  const nextBase = {
    ...design,
    pisos: 1,
    capacidad_piso1: design.capacidad,
    columnas: 4,
    pasillo_despues_col: 2,
    celdasBano: cleanedBaths,
    celdasBloqueadas: cleanedBlocked
  };
  const seats = generateSeatsFromDesign({ ...nextBase, asientosVip: [1, 2, 3, 4], asientosGrandes: [1, 2, 3, 4] });
  return sanitizeDesign({ ...nextBase, asientos: seats, extraRowsP1: 0, extraRowsP2: 0 });
}

export function designToApiPayload(design) {
  const clean = sanitizeDesign(design);
  const asientos = (clean.asientos || []).map((s) => ({
    numero_asiento: Number(s.numero_asiento),
    piso: floorOf(s),
    fila_piso: rowOf(s),
    columna: Number(s.columna),
    categoria: s.categoria === 'VIP' ? 'VIP' : 'NORMAL',
    tamano: s.tamano === 'GRANDE' ? 'GRANDE' : 'NORMAL'
  }));
  return {
    plantilla_id: clean.plantilla_id || null,
    plantilla_nombre: clean.plantilla_nombre || 'Estructura personalizada',
    pisos: clean.pisos,
    capacidad: asientos.length,
    capacidad_piso1: asientos.filter((a) => a.piso === 1).length,
    columnas: clean.columnas,
    columnas_piso2: clean.columnas_piso2,
    pasillo_despues_col: clean.pasillo_despues_col,
    pasillo_despues_col_piso2: clean.pasillo_despues_col_piso2,
    celdasBano: clean.celdasBano || [],
    celdasBloqueadas: clean.celdasBloqueadas || [],
    asientosVip: asientos.filter((a) => a.categoria === 'VIP').map((a) => a.numero_asiento),
    asientosGrandes: asientos.filter((a) => a.tamano === 'GRANDE').map((a) => a.numero_asiento),
    asientosPersonalizados: asientos,
    tiene_bano_posterior: (clean.celdasBano || []).length > 0
  };
}
