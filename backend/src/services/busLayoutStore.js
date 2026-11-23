// backend/src/services/busLayoutStore.js
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'bus_layouts.json');

function isTestRuntime() {
  return process.env.NODE_ENV === 'test' || process.execArgv.includes('--test') || process.argv.some(a => a.includes('.test.js'));
}

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-estandar-40',
    nombre: 'Estándar 40 (1 Piso + Baño posterior)',
    descripcion: 'Bus interprovincial clásico 2+2 con fila delantera VIP amplia y baño WC posterior compensado.',
    es_sistema: true,
    cooperativa_id: null,
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
    cooperativa_id: null,
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
    descripcion: 'Configuración 2+1 espaciosa con 12 asientos VIP grandes tipo cama al frente, puerta delantera y baño posterior.',
    es_sistema: true,
    cooperativa_id: null,
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
    descripcion: 'Piso 1 con 16 asientos VIP grandes (2+1), escalera y baño WC; Piso 2 panorámico con 40 asientos (2+2) y escalera.',
    es_sistema: true,
    cooperativa_id: null,
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
    nombre: 'MiniBus 24 (1 Piso · Primera fila con 1 asiento + compensación)',
    descripcion: 'Unidad compacta de 24 asientos con 3 posiciones bloqueadas en la fila 1 (compensadas al final automáticamente).',
    es_sistema: true,
    cooperativa_id: null,
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

let memoryState = null;

function emptyState() {
  return {
    customTemplates: [],
    busLayouts: {}
  };
}

function loadState() {
  if (isTestRuntime()) {
    if (!memoryState) memoryState = emptyState();
    return memoryState;
  }
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return emptyState();
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      customTemplates: Array.isArray(parsed?.customTemplates) ? parsed.customTemplates : [],
      busLayouts: parsed?.busLayouts && typeof parsed.busLayouts === 'object' ? parsed.busLayouts : {}
    };
  } catch {
    return emptyState();
  }
}

function saveState(state) {
  if (isTestRuntime()) {
    memoryState = state;
    return;
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn('No se pudo persistir bus_layouts.json:', err.message);
  }
}

function listTemplates(cooperativaId = null, isSuperAdmin = false) {
  const state = loadState();
  const custom = state.customTemplates.filter((tpl) => {
    if (isSuperAdmin || !cooperativaId) return true;
    return tpl.cooperativa_id === null || Number(tpl.cooperativa_id) === Number(cooperativaId);
  });
  return [...DEFAULT_TEMPLATES, ...custom];
}

function getTemplateById(id) {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;
  const builtin = DEFAULT_TEMPLATES.find((t) => t.id === cleanId);
  if (builtin) return builtin;
  const state = loadState();
  return state.customTemplates.find((t) => t.id === cleanId) || null;
}

function createTemplate(data, cooperativaId = null) {
  const state = loadState();
  const tpl = {
    id: `tpl-${crypto.randomBytes(4).toString('hex')}`,
    nombre: String(data.nombre || 'Plantilla personalizada').trim().slice(0, 120),
    descripcion: String(data.descripcion || '').trim().slice(0, 300),
    es_sistema: false,
    cooperativa_id: cooperativaId ? Number(cooperativaId) : null,
    pisos: Number(data.pisos) === 2 ? 2 : 1,
    capacidad: Number(data.capacidad) || 40,
    capacidad_piso1: Number(data.capacidad_piso1) || Number(data.capacidad) || 40,
    columnas: Number(data.columnas) || 4,
    columnas_piso2: Number(data.columnas_piso2) || Number(data.columnas) || 4,
    pasillo_despues_col: Number(data.pasillo_despues_col) || Math.max(1, Math.floor((Number(data.columnas) || 4) / 2)),
    pasillo_despues_col_piso2: Number(data.pasillo_despues_col_piso2) || Math.max(1, Math.floor((Number(data.columnas_piso2) || 4) / 2)),
    celdasBano: Array.isArray(data.celdasBano) ? data.celdasBano : [],
    celdasBloqueadas: Array.isArray(data.celdasBloqueadas) ? data.celdasBloqueadas : [],
    asientosVip: Array.isArray(data.asientosVip) ? data.asientosVip : [],
    asientosGrandes: Array.isArray(data.asientosGrandes) ? data.asientosGrandes : [],
    asientosPersonalizados: Array.isArray(data.asientosPersonalizados) ? data.asientosPersonalizados : null,
    actualizado_en: new Date().toISOString()
  };
  state.customTemplates.push(tpl);
  saveState(state);
  return tpl;
}

function updateTemplate(id, data, user) {
  const state = loadState();
  const idx = state.customTemplates.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const existing = state.customTemplates[idx];
  if (user?.rol === 'ADMIN_COOP' && existing.cooperativa_id !== null && Number(existing.cooperativa_id) !== Number(user.cooperativa_id)) {
    throw Object.assign(new Error('No tienes permiso para editar una plantilla de otra cooperativa.'), { status: 403 });
  }
  const updated = {
    ...existing,
    nombre: data.nombre !== undefined ? String(data.nombre).trim().slice(0, 120) : existing.nombre,
    descripcion: data.descripcion !== undefined ? String(data.descripcion).trim().slice(0, 300) : existing.descripcion,
    pisos: data.pisos !== undefined ? (Number(data.pisos) === 2 ? 2 : 1) : existing.pisos,
    capacidad: data.capacidad !== undefined ? Number(data.capacidad) : existing.capacidad,
    capacidad_piso1: data.capacidad_piso1 !== undefined ? Number(data.capacidad_piso1) : existing.capacidad_piso1,
    columnas: data.columnas !== undefined ? Number(data.columnas) : existing.columnas,
    columnas_piso2: data.columnas_piso2 !== undefined ? Number(data.columnas_piso2) : existing.columnas_piso2,
    pasillo_despues_col: data.pasillo_despues_col !== undefined ? Number(data.pasillo_despues_col) : existing.pasillo_despues_col,
    pasillo_despues_col_piso2: data.pasillo_despues_col_piso2 !== undefined ? Number(data.pasillo_despues_col_piso2) : existing.pasillo_despues_col_piso2,
    celdasBano: Array.isArray(data.celdasBano) ? data.celdasBano : existing.celdasBano,
    celdasBloqueadas: Array.isArray(data.celdasBloqueadas) ? data.celdasBloqueadas : existing.celdasBloqueadas,
    asientosVip: Array.isArray(data.asientosVip) ? data.asientosVip : existing.asientosVip,
    asientosGrandes: Array.isArray(data.asientosGrandes) ? data.asientosGrandes : existing.asientosGrandes,
    asientosPersonalizados: data.asientosPersonalizados !== undefined ? data.asientosPersonalizados : existing.asientosPersonalizados,
    actualizado_en: new Date().toISOString()
  };
  state.customTemplates[idx] = updated;
  saveState(state);
  return updated;
}

function deleteTemplate(id, user) {
  const state = loadState();
  const idx = state.customTemplates.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  const existing = state.customTemplates[idx];
  if (user?.rol === 'ADMIN_COOP' && existing.cooperativa_id !== null && Number(existing.cooperativa_id) !== Number(user.cooperativa_id)) {
    throw Object.assign(new Error('No tienes permiso para eliminar una plantilla de otra cooperativa.'), { status: 403 });
  }
  state.customTemplates.splice(idx, 1);
  saveState(state);
  return true;
}

function saveBusLayout(busId, estructura, extra = {}) {
  const state = loadState();
  const asientosMeta = {};
  for (const a of estructura.asientos || []) {
    asientosMeta[String(a.numero_asiento)] = {
      piso: a.piso || 1,
      fila_piso: a.fila_piso || a.fila,
      columna: a.columna,
      categoria: a.categoria || 'NORMAL',
      tamano: a.tamano || (a.categoria === 'VIP' ? 'GRANDE' : 'NORMAL')
    };
  }
  const layout = {
    plantilla_id: extra.plantilla_id || null,
    plantilla_nombre: extra.plantilla_nombre || null,
    pisos: estructura.pisos || 1,
    capacidad_total: estructura.capacidad_total,
    capacidad_piso1: estructura.capacidad_piso1 || estructura.capacidad_total,
    columnas: estructura.columnas || 4,
    columnas_piso2: estructura.columnas_piso2 || estructura.columnas || 4,
    pasillo_despues_col: estructura.pasillo_despues_col || 2,
    pasillo_despues_col_piso2: estructura.pasillo_despues_col_piso2 || 2,
    celdasBano: estructura.celdasBano || [],
    celdasBloqueadas: estructura.celdasBloqueadas || [],
    asientosMeta,
    actualizado_en: new Date().toISOString()
  };
  state.busLayouts[String(busId)] = layout;
  saveState(state);
  return layout;
}

function getBusLayout(busId) {
  const state = loadState();
  return state.busLayouts[String(busId)] || null;
}

function deleteBusLayout(busId) {
  const state = loadState();
  if (state.busLayouts[String(busId)]) {
    delete state.busLayouts[String(busId)];
    saveState(state);
  }
}

function enrichSeatsWithLayout(seats, busId) {
  const layout = getBusLayout(busId);
  if (!layout) {
    return { layout: null, seats };
  }
  const publicLayout = {
    plantilla_id: layout.plantilla_id,
    plantilla_nombre: layout.plantilla_nombre,
    pisos: layout.pisos,
    capacidad_total: layout.capacidad_total,
    capacidad_piso1: layout.capacidad_piso1,
    columnas: layout.columnas,
    columnas_piso2: layout.columnas_piso2,
    pasillo_despues_col: layout.pasillo_despues_col,
    pasillo_despues_col_piso2: layout.pasillo_despues_col_piso2,
    celdasBano: layout.celdasBano || [],
    celdasBloqueadas: layout.celdasBloqueadas || []
  };
  const enriched = seats.map((seat, idx) => {
    const meta = layout.asientosMeta?.[String(seat.numero_asiento)];
    return {
      ...seat,
      piso: meta?.piso || 1,
      fila_piso: meta?.fila_piso || seat.fila,
      tamano: meta?.tamano || (seat.categoria === 'VIP' ? 'GRANDE' : 'NORMAL'),
      ...(idx === 0 ? { bus_layout: publicLayout } : {})
    };
  });
  return { layout: publicLayout, seats: enriched };
}

module.exports = {
  DEFAULT_TEMPLATES,
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  saveBusLayout,
  getBusLayout,
  deleteBusLayout,
  enrichSeatsWithLayout
};
