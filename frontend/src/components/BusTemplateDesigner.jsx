import { useEffect, useMemo, useState } from 'react';
import {
  Armchair,
  ArrowUpDown,
  Bath,
  Ban,
  CircleGauge,
  Crown,
  DoorOpen,
  Layers,
  Move,
  Plus,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { aisleAfterColumn, gridColumnForLogical } from '../lib/seats.js';

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
    descripcion: 'Unidad compacta de 24 asientos con 3 posiciones bloqueadas en fila 1 compensadas atrás.',
    es_sistema: true,
    pisos: 1,
    capacidad: 24,
    capacidad_piso1: 24,
    columnas: 4,
    columnas_piso2: 4,
    pasillo_despues_col: 2,
    pasillo_despues_col_piso2: 2,
    celdasBano: [],
    celdasBloqueadas: [
      { piso: 1, fila: 1, columna: 2, tipo: 'BLOQUEADO' },
      { piso: 1, fila: 1, columna: 3, tipo: 'PUERTA' },
      { piso: 1, fila: 1, columna: 4, tipo: 'PUERTA' }
    ],
    asientosVip: [1],
    asientosGrandes: [1],
    asientosPersonalizados: null
  }
];

function coordKey(piso, fila, columna) {
  return `${piso}-${fila}-${columna}`;
}

export function generateSeatsFromDesign(design) {
  const numCap = Math.max(1, Math.min(100, parseInt(design.capacidad, 10) || 40));
  const numPisos = Number(design.pisos) === 2 ? 2 : 1;
  const colsP1 = Math.max(2, Math.min(5, parseInt(design.columnas, 10) || 4));
  const colsP2 = Math.max(2, Math.min(5, parseInt(design.columnas_piso2, 10) || 4));

  const baths = Array.isArray(design.celdasBano) ? design.celdasBano : [];
  const blocked = Array.isArray(design.celdasBloqueadas) ? design.celdasBloqueadas : [];
  const bathSet = new Set(baths.map((c) => coordKey(c.piso || 1, c.fila, c.columna)));
  const blockedSet = new Set(blocked.map((c) => coordKey(c.piso || 1, c.fila, c.columna)));

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
  const celdasBano = Array.isArray(base.celdasBano) ? base.celdasBano.map((c) => ({ piso: Number(c.piso) === 2 ? 2 : 1, fila: Number(c.fila), columna: Number(c.columna) })) : [];
  const celdasBloqueadas = Array.isArray(base.celdasBloqueadas) ? base.celdasBloqueadas.map((c) => ({ piso: Number(c.piso) === 2 ? 2 : 1, fila: Number(c.fila), columna: Number(c.columna), tipo: c.tipo || 'BLOQUEADO' })) : [];

  let seats;
  if (Array.isArray(existingSeats) && existingSeats.length > 0 && existingSeats.some((s) => s.fila && s.columna)) {
    seats = existingSeats.map((s) => ({
      numero_asiento: Number(s.numero_asiento),
      piso: Number(s.piso) === 2 ? 2 : 1,
      fila_piso: Number(s.fila_piso || s.fila),
      fila: Number(s.fila_piso || s.fila),
      columna: Number(s.columna),
      categoria: String(s.categoria || 'NORMAL').toUpperCase() === 'VIP' ? 'VIP' : 'NORMAL',
      tamano: String(s.tamano || (String(s.categoria || '').toUpperCase() === 'VIP' ? 'GRANDE' : 'NORMAL')).toUpperCase() === 'GRANDE' ? 'GRANDE' : 'NORMAL'
    }));
  } else if (Array.isArray(base.asientosPersonalizados) && base.asientosPersonalizados.length > 0) {
    seats = base.asientosPersonalizados.map((s) => ({
      numero_asiento: Number(s.numero_asiento),
      piso: Number(s.piso) === 2 ? 2 : 1,
      fila_piso: Number(s.fila_piso || s.fila),
      fila: Number(s.fila_piso || s.fila),
      columna: Number(s.columna),
      categoria: String(s.categoria || 'NORMAL').toUpperCase() === 'VIP' ? 'VIP' : 'NORMAL',
      tamano: String(s.tamano || (String(s.categoria || '').toUpperCase() === 'VIP' ? 'GRANDE' : 'NORMAL')).toUpperCase() === 'GRANDE' ? 'GRANDE' : 'NORMAL'
    }));
  } else {
    seats = generateSeatsFromDesign(base);
  }

  return {
    plantilla_id: base.id || base.plantilla_id || null,
    plantilla_nombre: base.nombre || base.plantilla_nombre || 'Personalizada',
    pisos,
    capacidad: seats.length,
    capacidad_piso1: seats.filter((s) => s.piso === 1).length || Math.min(seats.length, Number(base.capacidad_piso1) || seats.length),
    columnas,
    columnas_piso2,
    pasillo_despues_col: aisleAfterColumn(columnas, base.pasillo_despues_col),
    pasillo_despues_col_piso2: aisleAfterColumn(columnas_piso2, base.pasillo_despues_col_piso2),
    celdasBano,
    celdasBloqueadas,
    asientos: seats,
    extraRowsP1: 0,
    extraRowsP2: 0
  };
}

export function designToApiPayload(design) {
  const asientos = (design.asientos || []).map((s) => ({
    numero_asiento: Number(s.numero_asiento),
    piso: Number(s.piso) === 2 ? 2 : 1,
    fila_piso: Number(s.fila_piso || s.fila),
    columna: Number(s.columna),
    categoria: s.categoria === 'VIP' ? 'VIP' : 'NORMAL',
    tamano: s.tamano === 'GRANDE' ? 'GRANDE' : 'NORMAL'
  }));
  return {
    plantilla_id: design.plantilla_id || null,
    plantilla_nombre: design.plantilla_nombre || 'Estructura personalizada',
    pisos: design.pisos,
    capacidad: asientos.length,
    capacidad_piso1: asientos.filter((a) => a.piso === 1).length,
    columnas: design.columnas,
    columnas_piso2: design.columnas_piso2,
    pasillo_despues_col: design.pasillo_despues_col,
    pasillo_despues_col_piso2: design.pasillo_despues_col_piso2,
    celdasBano: design.celdasBano || [],
    celdasBloqueadas: design.celdasBloqueadas || [],
    asientosVip: asientos.filter((a) => a.categoria === 'VIP').map((a) => a.numero_asiento),
    asientosGrandes: asientos.filter((a) => a.tamano === 'GRANDE').map((a) => a.numero_asiento),
    asientosPersonalizados: asientos,
    tiene_bano_posterior: (design.celdasBano || []).length > 0
  };
}

function buildEditorGridTemplate(cols, aisleAfter, wideVipFloor) {
  const parts = [];
  for (let c = 1; c <= cols; c++) {
    parts.push(wideVipFloor ? 'minmax(62px, 1.25fr)' : 'minmax(50px, 1fr)');
    if (c === aisleAfter) parts.push('minmax(20px, 0.42fr)');
  }
  return parts.join(' ');
}

const TOOLS = [
  { id: 'vip', label: 'VIP Grande', hint: 'Marca/crea asiento VIP amplio', icon: Crown },
  { id: 'normal', label: 'Normal', hint: 'Coloca asiento estándar', icon: Armchair },
  { id: 'mover', label: 'Mover / Intercambiar', hint: 'Clic en origen y luego en destino', icon: Move },
  { id: 'bano', label: 'Baño WC', hint: 'Coloca o quita baño', icon: Bath },
  { id: 'puerta', label: 'Puerta / Escalera', hint: 'Acceso o escalera entre pisos', icon: DoorOpen },
  { id: 'bloquear', label: 'Quitar / Bloquear', hint: 'Libera espacio (compensa atrás)', icon: Ban }
];

export default function BusTemplateDesigner({
  templates = BUILTIN_BUS_TEMPLATES,
  value,
  onChange,
  compact = false
}) {
  const [tool, setTool] = useState('vip');
  const [autoCompensate, setAutoCompensate] = useState(true);
  const [moveSource, setMoveSource] = useState(null);

  const templateList = templates && templates.length > 0 ? templates : BUILTIN_BUS_TEMPLATES;
  const design = value || buildInitialDesign(templateList[0]);

  useEffect(() => {
    setMoveSource(null);
  }, [tool, design.pisos]);

  const stats = useMemo(() => {
    const seats = design.asientos || [];
    const vip = seats.filter((s) => s.categoria === 'VIP').length;
    const large = seats.filter((s) => s.tamano === 'GRANDE').length;
    const p1 = seats.filter((s) => (Number(s.piso) === 2 ? 2 : 1) === 1).length;
    const p2 = seats.filter((s) => Number(s.piso) === 2).length;
    return {
      total: seats.length,
      vip,
      normal: seats.length - vip,
      large,
      p1,
      p2,
      baths: (design.celdasBano || []).length,
      blocked: (design.celdasBloqueadas || []).length
    };
  }, [design]);

  function emit(next) {
    onChange?.(next);
  }

  function applyTemplate(tplId) {
    const found = templateList.find((t) => t.id === tplId);
    if (!found) return;
    setMoveSource(null);
    emit(buildInitialDesign(found));
  }

  function regenerateWithCompensation(partial) {
    const merged = { ...design, ...partial };
    const existingVipNums = (merged.asientos || []).filter((s) => s.categoria === 'VIP').map((s) => s.numero_asiento);
    const existingLargeNums = (merged.asientos || []).filter((s) => s.tamano === 'GRANDE').map((s) => s.numero_asiento);
    const nextSeats = generateSeatsFromDesign({
      ...merged,
      asientosVip: partial.asientosVip !== undefined ? partial.asientosVip : existingVipNums,
      asientosGrandes: partial.asientosGrandes !== undefined ? partial.asientosGrandes : existingLargeNums
    });
    emit({
      ...merged,
      capacidad: nextSeats.length,
      capacidad_piso1: nextSeats.filter((s) => s.piso === 1).length,
      asientos: nextSeats
    });
  }

  function handleCapacityChange(rawValue) {
    const cap = Math.max(1, Math.min(100, parseInt(rawValue, 10) || 1));
    const capP1 = design.pisos === 2
      ? Math.max(1, Math.min(cap - 1, Number(design.capacidad_piso1) || Math.round(cap * 0.32)))
      : cap;
    regenerateWithCompensation({ capacidad: cap, capacidad_piso1: capP1 });
  }

  function handleFloorsChange(nextPisos) {
    const p = Number(nextPisos) === 2 ? 2 : 1;
    if (p === design.pisos) return;
    if (p === 2) {
      const cap = Math.max(12, design.capacidad < 20 ? 48 : design.capacidad);
      const capP1 = Math.max(4, Math.min(cap - 4, Math.round(cap * 0.3)));
      const vipP1 = Array.from({ length: capP1 }, (_, i) => i + 1);
      regenerateWithCompensation({
        pisos: 2,
        capacidad: cap,
        capacidad_piso1: capP1,
        columnas: 3,
        columnas_piso2: 4,
        pasillo_despues_col: 2,
        pasillo_despues_col_piso2: 2,
        asientosVip: vipP1,
        asientosGrandes: vipP1,
        plantilla_nombre: `${design.plantilla_nombre || 'Estructura'} (2 Pisos)`
      });
    } else {
      const cleanedBaths = (design.celdasBano || []).filter((c) => Number(c.piso) !== 2);
      const cleanedBlocked = (design.celdasBloqueadas || []).filter((c) => Number(c.piso) !== 2);
      regenerateWithCompensation({
        pisos: 1,
        capacidad_piso1: design.capacidad,
        columnas: 4,
        pasillo_despues_col: 2,
        celdasBano: cleanedBaths,
        celdasBloqueadas: cleanedBlocked,
        asientosVip: [1, 2, 3, 4],
        asientosGrandes: [1, 2, 3, 4]
      });
    }
  }

  function handleColsChange(piso, rawCols) {
    const c = Math.max(2, Math.min(5, parseInt(rawCols, 10) || 4));
    const field = piso === 2 ? 'columnas_piso2' : 'columnas';
    const aisleField = piso === 2 ? 'pasillo_despues_col_piso2' : 'pasillo_despues_col';
    const cleanedBaths = (design.celdasBano || []).filter((b) => !(Number(b.piso) === piso && Number(b.columna) > c));
    const cleanedBlocked = (design.celdasBloqueadas || []).filter((b) => !(Number(b.piso) === piso && Number(b.columna) > c));
    regenerateWithCompensation({
      [field]: c,
      [aisleField]: aisleAfterColumn(c),
      celdasBano: cleanedBaths,
      celdasBloqueadas: cleanedBlocked
    });
  }

  function renumberSeats(seats) {
    const sorted = [...seats].sort((a, b) => {
      if (a.piso !== b.piso) return a.piso - b.piso;
      if ((a.fila_piso || a.fila) !== (b.fila_piso || b.fila)) return (a.fila_piso || a.fila) - (b.fila_piso || b.fila);
      return a.columna - b.columna;
    });
    return sorted.map((s, idx) => ({ ...s, numero_asiento: idx + 1 }));
  }

  function handleCellClick(piso, fila, columna) {
    const key = coordKey(piso, fila, columna);
    const seats = [...(design.asientos || [])];
    const baths = [...(design.celdasBano || [])];
    const blocked = [...(design.celdasBloqueadas || [])];

    const seatIdx = seats.findIndex((s) => (Number(s.piso) === 2 ? 2 : 1) === piso && Number(s.fila_piso || s.fila) === fila && Number(s.columna) === columna);
    const bathIdx = baths.findIndex((b) => (Number(b.piso) === 2 ? 2 : 1) === piso && Number(b.fila) === fila && Number(b.columna) === columna);
    const blkIdx = blocked.findIndex((b) => (Number(b.piso) === 2 ? 2 : 1) === piso && Number(b.fila) === fila && Number(b.columna) === columna);

    // MODO MOVER / INTERCAMBIAR
    if (tool === 'mover') {
      if (!moveSource) {
        if (seatIdx === -1) return;
        setMoveSource({ piso, fila, columna, numero: seats[seatIdx].numero_asiento });
        return;
      }
      if (moveSource.piso === piso && moveSource.fila === fila && moveSource.columna === columna) {
        setMoveSource(null);
        return;
      }
      const srcIdx = seats.findIndex(
        (s) => (Number(s.piso) === 2 ? 2 : 1) === moveSource.piso && Number(s.fila_piso || s.fila) === moveSource.fila && Number(s.columna) === moveSource.columna
      );
      if (srcIdx === -1) {
        setMoveSource(null);
        return;
      }
      if (seatIdx !== -1) {
        // Intercambiar dos asientos (conservando sus categorías/tamaños en las nuevas posiciones)
        const src = seats[srcIdx];
        const dst = seats[seatIdx];
        seats[srcIdx] = { ...src, piso: dst.piso, fila_piso: dst.fila_piso, fila: dst.fila_piso, columna: dst.columna };
        seats[seatIdx] = { ...dst, piso: src.piso, fila_piso: src.fila_piso, fila: src.fila_piso, columna: src.columna };
      } else {
        // Mover asiento a celda destino (limpiando baño/bloqueo si había)
        if (bathIdx !== -1) baths.splice(bathIdx, 1);
        if (blkIdx !== -1) blocked.splice(blkIdx, 1);
        seats[srcIdx] = { ...seats[srcIdx], piso, fila_piso: fila, fila, columna };
      }
      setMoveSource(null);
      emit({
        ...design,
        celdasBano: baths,
        celdasBloqueadas: blocked,
        asientos: seats,
        capacidad: seats.length,
        capacidad_piso1: seats.filter((s) => s.piso === 1).length
      });
      return;
    }

    // MODO VIP GRANDE
    if (tool === 'vip') {
      if (seatIdx !== -1) {
        const current = seats[seatIdx];
        const nextIsVip = !(current.categoria === 'VIP' && current.tamano === 'GRANDE');
        seats[seatIdx] = {
          ...current,
          categoria: nextIsVip ? 'VIP' : 'NORMAL',
          tamano: nextIsVip ? 'GRANDE' : 'NORMAL'
        };
        emit({ ...design, asientos: seats });
        return;
      }
      if (seats.length >= 100) return;
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
      const renumbered = renumberSeats(seats);
      emit({
        ...design,
        celdasBano: baths,
        celdasBloqueadas: blocked,
        asientos: renumbered,
        capacidad: renumbered.length,
        capacidad_piso1: renumbered.filter((s) => s.piso === 1).length
      });
      return;
    }

    // MODO ASIENTO NORMAL
    if (tool === 'normal') {
      if (seatIdx !== -1) {
        seats[seatIdx] = { ...seats[seatIdx], categoria: 'NORMAL', tamano: 'NORMAL' };
        emit({ ...design, asientos: seats });
        return;
      }
      if (bathIdx !== -1) baths.splice(bathIdx, 1);
      if (blkIdx !== -1) blocked.splice(blkIdx, 1);
      if (autoCompensate) {
        regenerateWithCompensation({ celdasBano: baths, celdasBloqueadas: blocked });
        return;
      }
      if (seats.length >= 100) return;
      seats.push({
        numero_asiento: seats.length + 1,
        piso,
        fila_piso: fila,
        fila,
        columna,
        categoria: 'NORMAL',
        tamano: 'NORMAL'
      });
      const renumbered = renumberSeats(seats);
      emit({
        ...design,
        celdasBano: baths,
        celdasBloqueadas: blocked,
        asientos: renumbered,
        capacidad: renumbered.length,
        capacidad_piso1: renumbered.filter((s) => s.piso === 1).length
      });
      return;
    }

    // MODO BAÑO WC
    if (tool === 'bano') {
      if (bathIdx !== -1) {
        baths.splice(bathIdx, 1);
      } else {
        if (blkIdx !== -1) blocked.splice(blkIdx, 1);
        baths.push({ piso, fila, columna });
      }
      if (autoCompensate) {
        regenerateWithCompensation({ celdasBano: baths, celdasBloqueadas: blocked });
      } else {
        const filtered = seats.filter((s) => coordKey(s.piso, s.fila_piso || s.fila, s.columna) !== key);
        const renumbered = renumberSeats(filtered);
        emit({
          ...design,
          celdasBano: baths,
          celdasBloqueadas: blocked,
          asientos: renumbered,
          capacidad: renumbered.length,
          capacidad_piso1: renumbered.filter((s) => s.piso === 1).length
        });
      }
      return;
    }

    // MODO PUERTA / ESCALERA o BLOQUEAR
    if (tool === 'puerta' || tool === 'bloquear') {
      const targetTipo = tool === 'puerta' ? (design.pisos === 2 && fila > 1 ? 'ESCALERA' : 'PUERTA') : 'BLOQUEADO';
      if (blkIdx !== -1 && blocked[blkIdx].tipo === targetTipo) {
        blocked.splice(blkIdx, 1);
      } else {
        if (bathIdx !== -1) baths.splice(bathIdx, 1);
        if (blkIdx !== -1) blocked[blkIdx] = { piso, fila, columna, tipo: targetTipo };
        else blocked.push({ piso, fila, columna, tipo: targetTipo });
      }
      if (autoCompensate) {
        regenerateWithCompensation({ celdasBano: baths, celdasBloqueadas: blocked });
      } else {
        const filtered = seats.filter((s) => coordKey(s.piso, s.fila_piso || s.fila, s.columna) !== key);
        if (filtered.length < 1) return;
        const renumbered = renumberSeats(filtered);
        emit({
          ...design,
          celdasBano: baths,
          celdasBloqueadas: blocked,
          asientos: renumbered,
          capacidad: renumbered.length,
          capacidad_piso1: renumbered.filter((s) => s.piso === 1).length
        });
      }
    }
  }

  function applyFirstRowDemo() {
    // Ejemplo exacto T-06 / BUS-17: bloquear 3 posiciones en primera fila y compensarlas al final
    const cols = design.columnas || 4;
    const extraBlocks = [];
    for (let c = 2; c <= cols; c++) {
      extraBlocks.push({ piso: 1, fila: 1, columna: c, tipo: c === cols ? 'PUERTA' : 'BLOQUEADO' });
    }
    const kept = (design.celdasBloqueadas || []).filter((b) => !(Number(b.piso) === 1 && Number(b.fila) === 1));
    regenerateWithCompensation({ celdasBloqueadas: [...kept, ...extraBlocks] });
  }

  const floors = design.pisos === 2 ? [1, 2] : [1];

  return (
    <div className={`bus-designer ${compact ? 'is-compact' : ''}`}>
      {/* Barra superior: selector de plantilla base + configuración física */}
      <div className="bus-designer-controls">
        <label className="designer-template-select">
          <span>Plantilla base del bus</span>
          <select
            value={templateList.some((t) => t.id === design.plantilla_id) ? design.plantilla_id : ''}
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="" disabled>Estructura personalizada</option>
            {templateList.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="designer-segmented" role="group" aria-label="Cantidad de pisos">
          <button
            type="button"
            className={design.pisos === 1 ? 'is-active' : ''}
            onClick={() => handleFloorsChange(1)}
          >
            <Layers size={14} /> 1 Piso
          </button>
          <button
            type="button"
            className={design.pisos === 2 ? 'is-active' : ''}
            onClick={() => handleFloorsChange(2)}
          >
            <Layers size={14} /> 2 Pisos
          </button>
        </div>

        <label className="designer-mini-field">
          <span>Total asientos</span>
          <input
            type="number"
            min={1}
            max={100}
            value={design.capacidad}
            onChange={(e) => handleCapacityChange(e.target.value)}
          />
        </label>

        {design.pisos === 2 && (
          <label className="designer-mini-field">
            <span>Plazas Piso 1</span>
            <input
              type="number"
              min={1}
              max={Math.max(1, design.capacidad - 1)}
              value={design.capacidad_piso1}
              onChange={(e) => {
                const p1 = Math.max(1, Math.min(design.capacidad - 1, parseInt(e.target.value, 10) || 1));
                regenerateWithCompensation({ capacidad_piso1: p1 });
              }}
            />
          </label>
        )}

        <label className="designer-mini-field">
          <span>{design.pisos === 2 ? 'Cols. Piso 1' : 'Distribución'}</span>
          <select value={design.columnas} onChange={(e) => handleColsChange(1, e.target.value)}>
            <option value={3}>2+1 (VIP Grande · 3 cols)</option>
            <option value={4}>2+2 (Clásico · 4 cols)</option>
            <option value={5}>2+3 (Alta cap. · 5 cols)</option>
          </select>
        </label>

        {design.pisos === 2 && (
          <label className="designer-mini-field">
            <span>Cols. Piso 2</span>
            <select value={design.columnas_piso2} onChange={(e) => handleColsChange(2, e.target.value)}>
              <option value={3}>2+1 (VIP Grande · 3 cols)</option>
              <option value={4}>2+2 (Clásico · 4 cols)</option>
              <option value={5}>2+3 (Alta cap. · 5 cols)</option>
            </select>
          </label>
        )}
      </div>

      {/* Paleta de herramientas de edición */}
      <div className="bus-designer-toolbar">
        <div className="designer-tools-row" role="group" aria-label="Herramientas de diseño">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={`designer-tool-btn ${tool === t.id ? 'is-active' : ''}`}
                title={t.hint}
                onClick={() => setTool(t.id)}
              >
                <Icon size={15} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="designer-quick-actions">
          <label className="designer-checkbox">
            <input
              type="checkbox"
              checked={autoCompensate}
              onChange={(e) => setAutoCompensate(e.target.checked)}
            />
            <span>Auto-compensar al final (BUS-17)</span>
          </label>
          <button type="button" className="designer-link-btn" onClick={applyFirstRowDemo} title="Bloquea 3 celdas de la fila 1 y las compensa atrás">
            <Sparkles size={14} /> Fila 1 (1 asiento)
          </button>
          <button
            type="button"
            className="designer-link-btn"
            onClick={() => applyTemplate(design.plantilla_id || templateList[0].id)}
          >
            <RotateCcw size={14} /> Restablecer
          </button>
        </div>
      </div>

      {/* Métricas vivas y guía de modo mover */}
      <div className="bus-designer-stats">
        <span className="designer-stat"><strong>{stats.total}</strong> asientos totales</span>
        <span className="designer-stat is-vip"><Crown size={13} /> <strong>{stats.vip}</strong> VIP Grandes</span>
        <span className="designer-stat"><strong>{stats.normal}</strong> Normales</span>
        <span className="designer-stat"><Bath size={13} /> <strong>{stats.baths}</strong> WC</span>
        {stats.blocked + stats.baths > 0 && (
          <span className="designer-stat is-comp">
            Compensación: <strong>{stats.blocked + stats.baths}</strong> espacios especiales
          </span>
        )}
      </div>

      {tool === 'mover' && (
        <p className="designer-move-banner" role="status">
          {moveSource
            ? `Asiento #${moveSource.numero} seleccionado (Piso ${moveSource.piso}, Fila ${moveSource.fila}). Haz clic en cualquier celda libre o en otro asiento para moverlo/intercambiarlo.`
            : 'Modo Mover activo: haz clic primero en el asiento que deseas mover o intercambiar.'}
        </p>
      )}

      {/* Lienzo interactivo por piso */}
      <div className={`bus-floors-wrapper ${design.pisos === 2 ? 'has-two-floors' : ''}`}>
        {floors.map((piso) => {
          const cols = piso === 2 ? design.columnas_piso2 : design.columnas;
          const aisleAfter = aisleAfterColumn(cols, piso === 2 ? design.pasillo_despues_col_piso2 : design.pasillo_despues_col);
          const floorSeats = (design.asientos || []).filter((s) => (Number(s.piso) === 2 ? 2 : 1) === piso);
          const floorBaths = (design.celdasBano || []).filter((b) => (Number(b.piso) === 2 ? 2 : 1) === piso);
          const floorBlocked = (design.celdasBloqueadas || []).filter((b) => (Number(b.piso) === 2 ? 2 : 1) === piso);

          const maxRow = Math.max(
            ...floorSeats.map((s) => Number(s.fila_piso || s.fila || 1)),
            ...floorBaths.map((b) => Number(b.fila || 1)),
            ...floorBlocked.map((b) => Number(b.fila || 1)),
            4
          ) + (piso === 2 ? (design.extraRowsP2 || 0) : (design.extraRowsP1 || 0));

          const seatMap = new Map(floorSeats.map((s) => [coordKey(piso, s.fila_piso || s.fila, s.columna), s]));
          const bathMap = new Map(floorBaths.map((b) => [coordKey(piso, b.fila, b.columna), b]));
          const blkMap = new Map(floorBlocked.map((b) => [coordKey(piso, b.fila, b.columna), b]));

          const wideVipFloor = cols === 3 || (design.pisos === 2 && piso === 1 && floorSeats.some((s) => s.tamano === 'GRANDE'));

          const cells = [];
          for (let r = 1; r <= maxRow; r++) {
            for (let c = 1; c <= cols; c++) {
              const key = coordKey(piso, r, c);
              const seat = seatMap.get(key);
              const bath = bathMap.get(key);
              const blk = blkMap.get(key);
              const isMoveOrigin = moveSource && moveSource.piso === piso && moveSource.fila === r && moveSource.columna === c;
              const style = { gridRow: r, gridColumn: gridColumnForLogical(c, aisleAfter) };

              if (seat) {
                const isVip = seat.categoria === 'VIP';
                const isLarge = seat.tamano === 'GRANDE';
                cells.push(
                  <button
                    key={key}
                    type="button"
                    style={style}
                    className={`seat designer-cell ${isVip ? 'vip' : ''} ${isLarge ? 'seat-large' : ''} ${isMoveOrigin ? 'is-move-origin' : ''}`}
                    onClick={() => handleCellClick(piso, r, c)}
                    title={`Asiento #${seat.numero_asiento} (${isVip ? 'VIP Grande' : 'Normal'}) · Fila ${r}, Col ${c}`}
                  >
                    {isVip ? (
                      <span className="seat-vip-head">
                        <Crown size={12} />
                        <Armchair size={isLarge ? 22 : 19} />
                      </span>
                    ) : (
                      <Armchair size={18} />
                    )}
                    <span className="seat-num">{seat.numero_asiento}</span>
                    {isVip && isLarge && <span className="seat-tag-vip">VIP</span>}
                  </button>
                );
              } else if (bath) {
                cells.push(
                  <button
                    key={key}
                    type="button"
                    style={style}
                    className="bus-bathroom designer-cell"
                    onClick={() => handleCellClick(piso, r, c)}
                    title={`Baño WC (Fila ${r}, Col ${c}) · Clic para editar`}
                  >
                    <Bath size={18} />
                    <span>WC</span>
                  </button>
                );
              } else if (blk) {
                const isStairs = blk.tipo === 'ESCALERA';
                const isDoor = blk.tipo === 'PUERTA';
                cells.push(
                  <button
                    key={key}
                    type="button"
                    style={style}
                    className={`bus-special-cell designer-cell ${isStairs ? 'is-stairs' : isDoor ? 'is-door' : 'is-blocked'}`}
                    onClick={() => handleCellClick(piso, r, c)}
                    title={`${blk.tipo} (Fila ${r}, Col ${c}) · Clic para editar`}
                  >
                    {isStairs ? <ArrowUpDown size={15} /> : isDoor ? <DoorOpen size={15} /> : <Ban size={14} />}
                    <span>{isStairs ? 'ESC' : isDoor ? 'PUERTA' : 'VACÍO'}</span>
                  </button>
                );
              } else {
                cells.push(
                  <button
                    key={key}
                    type="button"
                    style={style}
                    className="designer-empty-cell"
                    onClick={() => handleCellClick(piso, r, c)}
                    title={`Celda libre (Fila ${r}, Col ${c}) · Clic para colocar elemento`}
                  >
                    <span>+</span>
                  </button>
                );
              }
            }
          }

          return (
            <div key={`editor-floor-${piso}`} className={`bus-outline bus-outline-editor ${cols === 3 ? 'bus-outline-wide-vip' : ''}`}>
              <div className="bus-front">
                <CircleGauge size={20} />
                <span>
                  {design.pisos === 2
                    ? (piso === 1 ? 'PISO 1 · SALÓN INFERIOR' : 'PISO 2 · PANORÁMICO')
                    : 'FRENTE DEL BUS'}
                </span>
                <strong className="floor-pill">{floorSeats.length} plazas</strong>
              </div>

              <div
                className="seat-grid seat-grid-dynamic"
                style={{
                  gridTemplateColumns: buildEditorGridTemplate(cols, aisleAfter, wideVipFloor),
                  gridTemplateRows: `repeat(${maxRow}, minmax(54px, auto))`
                }}
              >
                {cells}
              </div>

              <div className="designer-floor-footer">
                <span className="bus-rear" style={{ margin: 0 }}>PARTE POSTERIOR</span>
                <button
                  type="button"
                  className="designer-add-row-btn"
                  onClick={() => emit({
                    ...design,
                    [piso === 2 ? 'extraRowsP2' : 'extraRowsP1']: (piso === 2 ? (design.extraRowsP2 || 0) : (design.extraRowsP1 || 0)) + 1
                  })}
                >
                  <Plus size={13} /> Fila
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
