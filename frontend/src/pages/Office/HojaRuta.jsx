import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Bus,
  Route,
  Sparkles,
  RotateCcw,
  Save,
  AlertTriangle,
  Settings,
  ArrowLeft,
  ArrowRight,
  Eraser,
  CheckCircle2,
  Clock,
  Layers,
  Info,
  MapPin,
  X
} from 'lucide-react';
import { planningRequest } from '../../lib/planningApi.js';
import { shortTime, today } from '../../lib/format.js';
import PlanningSetup from './PlanningSetup.jsx';
import './planning.css';

const RouteMap = lazy(() => import('../../components/RouteMap.jsx'));

const cellKey = (frequency, date) => `${frequency}:${date}`;

function shiftIsoDate(iso, deltaDays) {
  const base = new Date(`${iso || today()}T12:00:00`);
  base.setDate(base.getDate() + deltaDays);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

function formatDayHeader(iso) {
  try {
    const d = new Date(`${iso}T12:00:00`);
    const weekday = d.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', '');
    const day = d.getDate();
    const month = d.toLocaleDateString('es-EC', { month: 'short' }).replace('.', '');
    return {
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      short: `${day} ${month}`,
      isToday: iso === today(),
      isPast: iso < today()
    };
  } catch {
    return { weekday: '', short: iso, isToday: false, isPast: false };
  }
}

const BUS_PALETTE = [
  { bg: '#DBEAFE', border: '#2563EB', text: '#1E3A8A', dot: '#2563EB' },
  { bg: '#DCFCE7', border: '#16A34A', text: '#14532D', dot: '#16A34A' },
  { bg: '#FEF3C7', border: '#D97706', text: '#78350F', dot: '#D97706' },
  { bg: '#F3E8FF', border: '#7C3AED', text: '#4C1D95', dot: '#7C3AED' },
  { bg: '#FCE7F3', border: '#DB2777', text: '#831843', dot: '#DB2777' },
  { bg: '#CFFAFE', border: '#0891B2', text: '#164E63', dot: '#0891B2' },
  { bg: '#FFEDD5', border: '#EA580C', text: '#7C2D12', dot: '#EA580C' },
  { bg: '#E0E7FF', border: '#4F46E5', text: '#312E81', dot: '#4F46E5' }
];

const QUICK_REASONS = [
  'Propuesta de rotación equitativa 3+2 con unidades de reserva.',
  'Reordenamiento operativo de hoja de ruta.',
  'Reemplazo preventivo por mantenimiento o disponibilidad.',
  'Reemplazo de emergencia por avería en unidad.'
];

export default function HojaRuta({ usuario }) {
  const manager = ['ADMIN_COOP', 'SUPERADMIN'].includes(usuario?.rol);
  const [cooperatives, setCooperatives] = useState([]);
  const [cooperativeId, setCooperativeId] = useState(usuario?.cooperativa_id || '');
  const [catalog, setCatalog] = useState(null);
  const [tab, setTab] = useState('matriz');
  const [filters, setFilters] = useState({
    grupo_buses_id: '',
    grupo_frecuencias_id: '',
    desde: today(),
    hasta: shiftIsoDate(today(), 4)
  });
  const [matrix, setMatrix] = useState(null);
  const [draft, setDraft] = useState({});
  const [reason, setReason] = useState('Asignación manual de hoja de ruta.');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapFrec, setMapFrec] = useState(null);
  const [reload, setReload] = useState(0);
  const [catalogReload, setCatalogReload] = useState(0);
  const prevCoopRef = useRef(cooperativeId);
  const prevMatrixKeyRef = useRef('');

  // Herramienta interactiva: pincel de unidad y Drag & Drop
  const [activeBrush, setActiveBrush] = useState(null); // null | 'CLEAR' | busId (number)
  const [dragPayload, setDragPayload] = useState(null); // { busId, sourceKey? }
  const [dragOverKey, setDragOverKey] = useState('');

  const changes = useMemo(
    () => Object.values(draft).filter(cell => cell.bus_id !== (cell.original_bus_id || null)),
    [draft]
  );
  const dirty = changes.length > 0;

  useEffect(() => {
    if (usuario?.rol !== 'SUPERADMIN') return;
    const abort = new AbortController();
    planningRequest(usuario, '/admin/cooperativas', { signal: abort.signal }).then(data => {
      setCooperatives(data);
      setCooperativeId(id => id || data[0]?.id || '');
    }).catch(err => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, [usuario?.token]);

  useEffect(() => {
    if (!cooperativeId) return;
    const abort = new AbortController();
    const coopChanged = String(prevCoopRef.current) !== String(cooperativeId);
    prevCoopRef.current = cooperativeId;
    if (coopChanged) {
      setCatalog(null);
      setMatrix(null);
      setDraft({});
      setActiveBrush(null);
    }
    setError('');
    planningRequest(usuario, `/planificacion/catalogo?cooperativa_id=${cooperativeId}`, { signal: abort.signal }).then(data => {
      setCatalog(data);
      setFilters(current => {
        const group = data.grupos_buses.find(g => String(g.id) === String(current.grupo_buses_id)) || data.grupos_buses[0];
        const linked = data.vinculos.find(v => v.grupo_buses_id === group?.id && String(v.grupo_frecuencias_id) === String(current.grupo_frecuencias_id))
          || data.vinculos.find(v => v.grupo_buses_id === group?.id);
        return { ...current, grupo_buses_id: group?.id || '', grupo_frecuencias_id: linked?.grupo_frecuencias_id || '' };
      });
    }).catch(err => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, [cooperativeId, usuario?.token, catalogReload]);

  useEffect(() => {
    if (!catalog || !filters.grupo_buses_id || !filters.grupo_frecuencias_id) {
      setMatrix(null);
      setDraft({});
      setActiveBrush(null);
      prevMatrixKeyRef.current = '';
      return;
    }
    const matrixKey = `${cooperativeId}:${filters.grupo_buses_id}:${filters.grupo_frecuencias_id}`;
    const switchedGroup = prevMatrixKeyRef.current && prevMatrixKeyRef.current !== matrixKey;
    prevMatrixKeyRef.current = matrixKey;
    if (switchedGroup) {
      setMatrix(null);
      setDraft({});
      setActiveBrush(null);
      setLoading(true);
    }
    const abort = new AbortController();
    setError('');
    const params = new URLSearchParams({ ...filters, cooperativa_id: cooperativeId });
    planningRequest(usuario, `/planificacion/matriz?${params}`, { signal: abort.signal }).then(data => {
      const cells = {};
      for (const frequency of data.frecuencias) {
        for (const date of data.fechas) {
          const trips = data.viajes.filter(v => v.frecuencia_id === frequency.id && v.fecha_viaje === date);
          if (trips.length > 1) throw new Error('Hay viajes duplicados para una frecuencia y fecha. Revisa la programación existente antes de editar.');
          const trip = trips[0];
          cells[cellKey(frequency.id, date)] = {
            frecuencia_id: frequency.id,
            fecha: date,
            bus_id: trip?.bus_id || null,
            original_bus_id: trip?.bus_id || null,
            programacion_id: trip?.id || null,
            version: trip?.version || null,
            estado: trip?.estado || 'PROGRAMADO',
            averia: false
          };
        }
      }
      setMatrix(data);
      setDraft(cells);
    }).catch(err => { if (!abort.signal.aborted) setError(err.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [catalog, cooperativeId, filters, reload, usuario?.token]);

  const busColorMap = useMemo(() => {
    const map = new Map();
    (matrix?.buses || []).forEach((b, idx) => {
      map.set(b.id, BUS_PALETTE[idx % BUS_PALETTE.length]);
    });
    return map;
  }, [matrix]);

  const busById = useMemo(() => {
    const map = new Map();
    (matrix?.buses || []).forEach(b => map.set(b.id, b));
    return map;
  }, [matrix]);

  function isBusUnavailableOnDate(bus, date) {
    if (!bus || !matrix) return false;
    return bus.estado === 'MANTENIMIENTO'
      || matrix.paradas.some(p => p.bus_id === bus.id && p.fecha === date && p.motivo === 'AVERIA');
  }

  function busyOnDate(bus, date) {
    if (!matrix) return false;
    const selectedFrequencyIds = matrix.frecuencias.map(f => f.id);
    return Object.values(draft).some(cell => cell.fecha === date && cell.bus_id === bus.id)
      || matrix.ocupaciones.some(v => v.bus_id === bus.id && v.fecha_viaje === date && !selectedFrequencyIds.includes(v.frecuencia_id));
  }

  // Asigna o intercambia automáticamente si el bus ya estaba en otra frecuencia ese mismo día
  function applyBusToCell(targetKey, nextBusId, sourceKey = null) {
    const target = draft[targetKey];
    if (!target || saving || target.fecha < today() || target.estado !== 'PROGRAMADO') return;

    if (nextBusId) {
      const busObj = busById.get(Number(nextBusId));
      if (isBusUnavailableOnDate(busObj, target.fecha)) {
        setError(`La Unidad #${busObj.numero_disco} está en mantenimiento o avería el ${target.fecha}.`);
        return;
      }
    }

    setError('');
    setDraft(current => {
      const next = { ...current };
      const currTarget = next[targetKey];
      const cleanBusId = nextBusId ? Number(nextBusId) : null;

      // Si viene arrastrado desde otra celda del mismo día → intercambio atómico
      if (sourceKey && sourceKey !== targetKey && next[sourceKey]) {
        const src = next[sourceKey];
        if (src.fecha === currTarget.fecha && src.estado === 'PROGRAMADO') {
          next[targetKey] = { ...currTarget, bus_id: cleanBusId, averia: false };
          next[sourceKey] = { ...src, bus_id: currTarget.bus_id || null, averia: false };
          setMessage(`Turnos intercambiados en ${currTarget.fecha}. Pulsa «Guardar asignaciones» para confirmar.`);
          return next;
        }
      }

      // Si ese bus ya está asignado a otra frecuencia el mismo día, intercambiar automáticamente
      if (cleanBusId) {
        const conflictKey = Object.keys(next).find(k =>
          k !== targetKey
          && next[k].fecha === currTarget.fecha
          && next[k].bus_id === cleanBusId
        );
        if (conflictKey) {
          if (next[conflictKey].estado !== 'PROGRAMADO') {
            setError(`La Unidad #${busById.get(cleanBusId)?.numero_disco || cleanBusId} ya tiene un viaje ${next[conflictKey].estado} ese día.`);
            return current;
          }
          const swappedBus = currTarget.bus_id || null;
          next[conflictKey] = { ...next[conflictKey], bus_id: swappedBus, averia: false };
          next[targetKey] = { ...currTarget, bus_id: cleanBusId, averia: false };
          setMessage(`Intercambio automático aplicado para Unidad #${busById.get(cleanBusId)?.numero_disco || cleanBusId} el ${currTarget.fecha}.`);
          return next;
        }
      }

      next[targetKey] = { ...currTarget, bus_id: cleanBusId, averia: false };
      return next;
    });
  }

  function applyRangePreset(days) {
    if (dirty || saving) return;
    const start = filters.desde || today();
    setFilters(prev => ({ ...prev, desde: start, hasta: shiftIsoDate(start, days - 1) }));
  }

  function shiftRange(delta) {
    if (dirty || saving) return;
    const span = Math.max(
      1,
      Math.round((new Date(`${filters.hasta}T12:00:00`) - new Date(`${filters.desde}T12:00:00`)) / 86400000)
    );
    const nextStart = delta === 0 ? today() : shiftIsoDate(filters.desde, delta);
    setFilters(prev => ({ ...prev, desde: nextStart, hasta: shiftIsoDate(nextStart, span) }));
  }

  async function propose() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await planningRequest(usuario, '/planificacion/propuesta', {
        method: 'POST',
        data: { ...filters, cooperativa_id: cooperativeId }
      });
      setDraft(current => {
        const next = { ...current };
        for (const assignment of result.asignaciones) {
          const key = cellKey(assignment.frecuencia_id, assignment.fecha);
          if (current[key]?.estado === 'PROGRAMADO' && assignment.fecha >= today()) {
            next[key] = { ...current[key], bus_id: assignment.bus_id, averia: false };
          }
        }
        return next;
      });
      setReason('Propuesta de rotación equitativa con al menos dos unidades de reserva.');
      setMessage('Propuesta 3+2 generada. Revisa el tablero interactivo y pulsa «Guardar asignaciones».');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await planningRequest(usuario, '/planificacion/matriz', {
        method: 'PUT',
        data: {
          ...filters,
          cooperativa_id: cooperativeId,
          motivo: reason,
          asignaciones: changes.map(({ original_bus_id, estado, ...cell }) => cell)
        }
      });
      setMessage(result.actualizados === 1 ? '✓ Se guardó 1 asignación.' : `✓ Se guardaron ${result.actualizados} asignaciones en la hoja de ruta.`);
      setActiveBrush(null);
      setReload(value => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Estadísticas en vivo del tablero
  const boardStats = useMemo(() => {
    const allCells = Object.values(draft);
    const assigned = allCells.filter(c => c.bus_id).length;
    return {
      totalCells: allCells.length,
      assignedCells: assigned,
      busesCount: matrix?.buses?.length || catalog?.buses?.length || 0,
      frecCount: matrix?.frecuencias?.length || catalog?.frecuencias?.length || 0
    };
  }, [draft, matrix, catalog]);

  const linkedFrecGroups = useMemo(() => {
    if (!catalog) return [];
    return catalog.grupos_frecuencias.filter(g =>
      catalog.vinculos.some(v =>
        v.grupo_buses_id === Number(filters.grupo_buses_id) && v.grupo_frecuencias_id === g.id
      )
    );
  }, [catalog, filters.grupo_buses_id]);

  return (
    <section className="planning" aria-label="Planificación de hojas de ruta">
      {/* 1. Cabecera superior y selector de cooperativa */}
      <div className="planning-hero">
        <div>
          <div className="planning-eyebrow">
            <Calendar size={14} />
            <span>Módulo de Planificación y Rotación 3+2</span>
          </div>
          <h2>Hojas de Ruta Interactivas</h2>
          <p className="planning-sub">
            Organiza tus grupos operativos, asigna buses arrastrando o con un clic, intercambia turnos al instante y controla las unidades en reserva.
          </p>
        </div>

        <div className="planning-hero-controls">
          {usuario?.rol === 'SUPERADMIN' && (
            <label className="planning-coop-select">
              <span>Cooperativa</span>
              <select
                disabled={dirty || saving}
                value={cooperativeId}
                onChange={e => setCooperativeId(e.target.value)}
              >
                <option value="">Selecciona una cooperativa</option>
                {cooperatives.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
          )}

          {manager && (
            <div className="planning-segmented" role="group" aria-label="Secciones de planificación">
              <button
                type="button"
                className={tab === 'matriz' ? 'active' : ''}
                aria-pressed={tab === 'matriz'}
                onClick={() => setTab('matriz')}
              >
                <Calendar size={15} />
                <span>1. Matriz de Hoja de Ruta</span>
              </button>
              <button
                type="button"
                className={tab === 'grupos' ? 'active' : ''}
                disabled={dirty || saving}
                aria-pressed={tab === 'grupos'}
                onClick={() => setTab('grupos')}
              >
                <Settings size={15} />
                <span>2. Grupos, Sucursales y Taquilla</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Tarjetas KPI en vivo */}
      {catalog && (
        <div className="planning-kpis">
          <div className="planning-kpi">
            <div className="planning-kpi-icon blue"><Bus size={18} /></div>
            <div>
              <span className="planning-kpi-label">{matrix ? 'Buses en el grupo' : 'Buses disponibles'}</span>
              <strong className="planning-kpi-val">{boardStats.busesCount}</strong>
            </div>
          </div>
          <div className="planning-kpi">
            <div className="planning-kpi-icon violet"><Route size={18} /></div>
            <div>
              <span className="planning-kpi-label">{matrix ? 'Frecuencias vinculadas' : 'Frecuencias ANT'}</span>
              <strong className="planning-kpi-val">{boardStats.frecCount}</strong>
            </div>
          </div>
          <div className="planning-kpi">
            <div className="planning-kpi-icon green"><CheckCircle2 size={18} /></div>
            <div>
              <span className="planning-kpi-label">Turnos cubiertos</span>
              <strong className="planning-kpi-val">
                {boardStats.assignedCells} / {boardStats.totalCells}
              </strong>
            </div>
          </div>
          <div className={`planning-kpi ${dirty ? 'warn' : ''}`}>
            <div className={`planning-kpi-icon ${dirty ? 'amber' : 'slate'}`}><Save size={18} /></div>
            <div>
              <span className="planning-kpi-label">Cambios sin guardar</span>
              <strong className="planning-kpi-val">{changes.length}</strong>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="planning-error" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button type="button" className="button secondary" onClick={() => setCatalogReload(v => v + 1)}>
            Recargar datos
          </button>
        </div>
      )}

      {message && (
        <p className="planning-success" role="status">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </p>
      )}

      {!catalog && !error && <p role="status" className="planning-loading">Cargando grupos operativos…</p>}

      {/* VISTA 2: CONFIGURACIÓN PASO A PASO */}
      {catalog && tab === 'grupos' && manager && (
        <PlanningSetup
          key={cooperativeId}
          usuario={usuario}
          cooperativaId={cooperativeId}
          catalogo={catalog}
          onGoMatrix={() => setTab('matriz')}
          onChanged={async () => {
            const fresh = await planningRequest(usuario, `/planificacion/catalogo?cooperativa_id=${cooperativeId}`);
            setCatalog(fresh);
            setFilters(current => {
              const group = fresh.grupos_buses.find(g => String(g.id) === String(current.grupo_buses_id)) || fresh.grupos_buses[0];
              const linked = fresh.vinculos.find(v => v.grupo_buses_id === group?.id && String(v.grupo_frecuencias_id) === String(current.grupo_frecuencias_id))
                || fresh.vinculos.find(v => v.grupo_buses_id === group?.id);
              return { ...current, grupo_buses_id: group?.id || '', grupo_frecuencias_id: linked?.grupo_frecuencias_id || '' };
            });
          }}
        />
      )}

      {/* VISTA 1: MATRIZ INTERACTIVA DE HOJA DE RUTA */}
      {catalog && tab === 'matriz' && (
        <>
          {/* Barra compacta de filtros y rango de fechas */}
          <div className="planning-toolbar-card">
            <fieldset disabled={dirty || saving} className="planning-filters">
              <label>
                <span>Grupo de buses</span>
                <select
                  value={filters.grupo_buses_id}
                  onChange={e => {
                    const linked = catalog.vinculos.find(v => v.grupo_buses_id === Number(e.target.value));
                    setFilters({
                      ...filters,
                      grupo_buses_id: e.target.value,
                      grupo_frecuencias_id: linked?.grupo_frecuencias_id || ''
                    });
                  }}
                >
                  <option value="">Selecciona un grupo</option>
                  {catalog.grupos_buses.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre} · {g.tipo_operacion}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Grupo de frecuencias</span>
                <select
                  value={filters.grupo_frecuencias_id}
                  onChange={e => setFilters({ ...filters, grupo_frecuencias_id: e.target.value })}
                >
                  <option value="">Selecciona un grupo vinculado</option>
                  {linkedFrecGroups.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </label>

              <label>
                <span>Desde</span>
                <input
                  type="date"
                  value={filters.desde}
                  onChange={e => setFilters({ ...filters, desde: e.target.value })}
                />
              </label>

              <label>
                <span>Hasta</span>
                <input
                  type="date"
                  value={filters.hasta}
                  onChange={e => setFilters({ ...filters, hasta: e.target.value })}
                />
              </label>
            </fieldset>

            <div className="planning-date-shortcuts">
              <div className="planning-pill-group">
                <button type="button" disabled={dirty || saving} onClick={() => shiftRange(-5)} title="Rango anterior">
                  <ArrowLeft size={14} /> Anterior
                </button>
                <button type="button" disabled={dirty || saving} onClick={() => shiftRange(0)}>Hoy</button>
                <button type="button" disabled={dirty || saving} onClick={() => shiftRange(5)} title="Rango siguiente">
                  Siguiente <ArrowRight size={14} />
                </button>
              </div>
              <div className="planning-pill-group">
                <button type="button" disabled={dirty || saving} onClick={() => applyRangePreset(5)}>Ciclo 5 días (3+2)</button>
                <button type="button" disabled={dirty || saving} onClick={() => applyRangePreset(7)}>7 días</button>
                <button type="button" disabled={dirty || saving} onClick={() => applyRangePreset(14)}>14 días</button>
              </div>
              {dirty && <span className="planning-lock-hint">Guarda o descarta tus {changes.length} cambios para cambiar fechas o grupos.</span>}
            </div>
          </div>

          {!filters.grupo_frecuencias_id && (
            <div className="planning-empty-state">
              <Layers size={34} color="#2563EB" />
              <h3>Aún no hay un grupo de buses vinculado a frecuencias</h3>
              <p>
                Para activar la matriz de rotación 3+2, crea primero tu grupo de buses, tu grupo de frecuencias y vincúlalos en el asistente paso a paso.
              </p>
              {manager && (
                <button type="button" className="button primary" onClick={() => setTab('grupos')}>
                  <Settings size={16} /> Ir a Configurar Grupos (Paso 1 → 2)
                </button>
              )}
            </div>
          )}

          {loading && <p role="status" className="planning-loading">Cargando matriz de programación…</p>}

          {matrix && (
            <>
              {/* Paleta interactiva de unidades (Drag & Drop + Pincel clic-para-asignar) */}
              <div className="planning-palette-card">
                <div className="planning-palette-head">
                  <div>
                    <strong>🎨 Paleta rápida de unidades</strong>
                    <span className="planning-palette-hint">
                      Arrastra un bus a cualquier casilla, o haz clic aquí para activar el pincel y tocar las celdas (si el bus ya trabajaba ese día, intercambia turnos automáticamente).
                    </span>
                  </div>
                  <div className="planning-palette-actions">
                    <button
                      type="button"
                      className="button primary"
                      disabled={saving || dirty}
                      onClick={propose}
                      title="Genera automáticamente la rotación equitativa 3 días trabajo + 2 días descanso"
                    >
                      <Sparkles size={15} /> Proponer rotación 3+2
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={saving}
                      onClick={() => { setReload(v => v + 1); setMessage(''); setActiveBrush(null); }}
                    >
                      <RotateCcw size={15} /> {dirty ? 'Descartar cambios' : 'Recargar'}
                    </button>
                  </div>
                </div>

                <div className="planning-bus-chips">
                  {matrix.buses.map(b => {
                    const color = busColorMap.get(b.id) || BUS_PALETTE[0];
                    const workDays = matrix.fechas.filter(d => busyOnDate(b, d)).length;
                    const selected = activeBrush === b.id;
                    const disabled = b.estado === 'MANTENIMIENTO';
                    return (
                      <button
                        key={b.id}
                        type="button"
                        draggable={!disabled && !saving}
                        onDragStart={() => setDragPayload({ busId: b.id, sourceKey: null })}
                        onDragEnd={() => { setDragPayload(null); setDragOverKey(''); }}
                        onClick={() => !disabled && setActiveBrush(selected ? null : b.id)}
                        disabled={disabled || saving}
                        className={`planning-bus-chip ${selected ? 'is-active' : ''}`}
                        style={{
                          '--chip-bg': color.bg,
                          '--chip-border': color.border,
                          '--chip-text': color.text,
                          '--chip-dot': color.dot
                        }}
                      >
                        <span className="chip-dot" />
                        <span className="chip-main">
                          <strong>#{b.numero_disco}</strong> · {b.placa}
                        </span>
                        <span className="chip-count">
                          {disabled ? 'Mant.' : `${workDays}/${matrix.fechas.length}d`}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setActiveBrush(activeBrush === 'CLEAR' ? null : 'CLEAR')}
                    className={`planning-bus-chip clear-chip ${activeBrush === 'CLEAR' ? 'is-active' : ''}`}
                  >
                    <Eraser size={14} />
                    <span>Quitar asignación</span>
                  </button>

                  {activeBrush !== null && (
                    <span className="planning-brush-banner">
                      {activeBrush === 'CLEAR'
                        ? 'Modo borrador activo: haz clic en una celda para dejarla sin asignar.'
                        : `Pincel activo: Unidad #${busById.get(activeBrush)?.numero_disco} — haz clic en cualquier celda de la matriz.`}
                    </span>
                  )}
                </div>
              </div>

              <form onSubmit={save}>
                <div className="planning-scroll" tabIndex={0} role="region" aria-label="Matriz de frecuencias por fecha">
                  <table className="planning-table">
                    <caption>
                      <span>Frecuencias por fecha · {matrix.grupo.nombre}</span>
                      <span className="planning-caption-sub">Inicio del ciclo 3+2: {matrix.grupo.inicio_ciclo}</span>
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="planning-sticky-col">Frecuencia / Horario</th>
                        {matrix.fechas.map(date => {
                          const info = formatDayHeader(date);
                          return (
                            <th scope="col" key={date} className={info.isToday ? 'is-today-col' : info.isPast ? 'is-past-col' : ''}>
                              <div className="planning-day-head">
                                <span className="planning-day-name">{info.weekday} · {info.short}</span>
                                <span className="planning-day-iso">{date}</span>
                                {info.isToday && <span className="planning-today-pill">HOY</span>}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.frecuencias.map(f => (
                        <tr key={f.id}>
                          <th scope="row" className="planning-sticky-col">
                            <div className="planning-frec-title">{f.origen} → {f.destino}</div>
                            <div className="planning-frec-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <Clock size={12} /> <strong>{shortTime(f.hora_salida)}</strong> · {f.resolucion_ant}
                              <button
                                type="button"
                                className="planning-frec-map-btn"
                                onClick={() => setMapFrec(f)}
                                title={`Ver mapa de ${f.origen} a ${f.destino}`}
                              >
                                <MapPin size={11} aria-hidden="true" /> Mapa
                              </button>
                            </div>
                          </th>

                          {matrix.fechas.map(date => {
                            const key = cellKey(f.id, date);
                            const cell = draft[key];
                            if (!cell) return <td key={date} />;
                            const changed = cell.bus_id !== cell.original_bus_id;
                            const editable = !saving && date >= today() && cell.estado === 'PROGRAMADO';
                            const assignedBus = cell.bus_id ? busById.get(cell.bus_id) : null;
                            const color = assignedBus ? busColorMap.get(assignedBus.id) : null;
                            const isDropTarget = dragOverKey === key && editable;

                            return (
                              <td
                                key={date}
                                className={[
                                  'planning-cell',
                                  changed ? 'planning-changed' : '',
                                  editable && activeBrush !== null ? 'brush-ready' : '',
                                  isDropTarget ? 'is-drop-target' : ''
                                ].join(' ')}
                                onClick={(e) => {
                                  if (!editable || activeBrush === null) return;
                                  if (['SELECT', 'OPTION', 'INPUT', 'LABEL'].includes(e.target.tagName)) return;
                                  applyBusToCell(key, activeBrush === 'CLEAR' ? null : activeBrush);
                                }}
                                onDragOver={(e) => {
                                  if (!editable) return;
                                  e.preventDefault();
                                  if (dragOverKey !== key) setDragOverKey(key);
                                }}
                                onDragLeave={() => {
                                  if (dragOverKey === key) setDragOverKey('');
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setDragOverKey('');
                                  if (!editable || !dragPayload) return;
                                  applyBusToCell(key, dragPayload.busId, dragPayload.sourceKey);
                                  setDragPayload(null);
                                }}
                              >
                                {assignedBus && (
                                  <div
                                    draggable={editable}
                                    onDragStart={() => setDragPayload({ busId: assignedBus.id, sourceKey: key })}
                                    onDragEnd={() => { setDragPayload(null); setDragOverKey(''); }}
                                    className="planning-assigned-badge"
                                    style={color ? {
                                      background: color.bg,
                                      borderColor: color.border,
                                      color: color.text
                                    } : undefined}
                                    title={editable ? 'Arrastra a otra frecuencia de este día para intercambiar turnos' : undefined}
                                  >
                                    <span>🚌 Unidad #{assignedBus.numero_disco}</span>
                                    {changed && <span className="badge-edited">Editado</span>}
                                  </div>
                                )}

                                <select
                                  aria-label={`Bus para ${f.origen} a ${f.destino} ${shortTime(f.hora_salida)} el ${date}`}
                                  disabled={!editable}
                                  value={cell.bus_id || ''}
                                  onChange={e => applyBusToCell(key, Number(e.target.value) || null)}
                                  className="planning-cell-select"
                                >
                                  <option value="">Sin asignar</option>
                                  {cell.bus_id && !matrix.buses.some(b => b.id === cell.bus_id) && (
                                    <option value={cell.bus_id}>Bus fuera del grupo #{cell.bus_id}</option>
                                  )}
                                  {matrix.buses.map(b => (
                                    <option
                                      key={b.id}
                                      value={b.id}
                                      disabled={isBusUnavailableOnDate(b, date)}
                                    >
                                      Unidad #{b.numero_disco} · {b.placa}{b.estado === 'MANTENIMIENTO' ? ' · Mant.' : ''}
                                    </option>
                                  ))}
                                </select>

                                {cell.estado !== 'PROGRAMADO' && (
                                  <span className={`planning-state-pill state-${String(cell.estado).toLowerCase()}`}>
                                    {cell.estado}
                                  </span>
                                )}

                                {changed && cell.original_bus_id && cell.bus_id && (
                                  <label className="planning-averia-toggle">
                                    <input
                                      type="checkbox"
                                      checked={cell.averia}
                                      disabled={saving}
                                      onChange={e => setDraft({ ...draft, [key]: { ...cell, averia: e.target.checked } })}
                                    />
                                    <span>⚠️ Marcar reemplazo por avería</span>
                                  </label>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Fila inferior de reserva / parada */}
                      <tr className="planning-stops">
                        <th scope="row" className="planning-sticky-col">
                          <div>🅿️ En parada / Reserva</div>
                          <small>Mínimo recomendado: 2 unidades/día</small>
                        </th>
                        {matrix.fechas.map(date => {
                          const resting = matrix.buses.filter(b => !busyOnDate(b, date));
                          return (
                            <td key={date}>
                              <div className="planning-reserve-list">
                                {resting.length === 0 ? (
                                  <span className="reserve-pill warn">Sin reserva</span>
                                ) : resting.map(b => {
                                  const isAveria = matrix.paradas.some(p => p.bus_id === b.id && p.fecha === date && p.motivo === 'AVERIA')
                                    || Object.values(draft).some(c => c.fecha === date && c.original_bus_id === b.id && c.bus_id !== b.id && c.averia);
                                  const isMant = b.estado === 'MANTENIMIENTO';
                                  return (
                                    <span
                                      key={b.id}
                                      className={`reserve-pill ${isAveria ? 'danger' : isMant ? 'muted' : 'ok'}`}
                                    >
                                      #{b.numero_disco} · {isAveria ? 'Avería' : isMant ? 'Mant.' : 'Descanso'}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Barra de confirmación y guardado */}
                <div className={`planning-save-bar ${dirty ? 'is-dirty' : ''}`}>
                  <div className="planning-reason-col">
                    <label>
                      <span>Motivo de la programación o reemplazo</span>
                      <input
                        type="text"
                        required
                        minLength={3}
                        maxLength={300}
                        disabled={saving}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                      />
                    </label>
                    <div className="planning-reason-chips">
                      {QUICK_REASONS.map(txt => (
                        <button
                          key={txt}
                          type="button"
                          disabled={saving}
                          onClick={() => setReason(txt)}
                        >
                          {txt.slice(0, 38)}…
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="planning-save-actions">
                    <span className="planning-pending-count">
                      {dirty
                        ? `${changes.length} ${changes.length === 1 ? 'cambio listo' : 'cambios listos'} para guardar`
                        : 'Sin cambios pendientes'}
                    </span>
                    <button className="button primary" disabled={!dirty || saving}>
                      <Save size={16} />
                      <span>{saving ? 'Guardando…' : `Guardar asignaciones${dirty ? ` (${changes.length})` : ''}`}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Paneles analíticos lado a lado: Balance 3+2 y Auditoría */}
              <div className="planning-insights-grid">
                <div className="planning-insight-card">
                  <h4>📊 Balance de rotación 3+2 en el rango ({matrix.fechas.length} días)</h4>
                  <p className="planning-insight-sub">
                    <Info size={13} /> Cada unidad muestra sus días en operación vs. descanso real.
                  </p>
                  <div className="planning-balance-list">
                    {matrix.buses.map(b => {
                      const working = matrix.fechas.filter(date => busyOnDate(b, date)).length;
                      const rest = matrix.fechas.length - working;
                      const pct = matrix.fechas.length ? Math.round((working / matrix.fechas.length) * 100) : 0;
                      const color = busColorMap.get(b.id) || BUS_PALETTE[0];
                      return (
                        <div key={b.id} className="planning-balance-row">
                          <div className="planning-balance-top">
                            <strong>
                              <span className="chip-dot" style={{ background: color.dot, display: 'inline-block', marginRight: 6 }} />
                              Unidad #{b.numero_disco} ({b.placa})
                            </strong>
                            <span>{working} trab. · {rest} parada</span>
                          </div>
                          <div className="planning-bar-track">
                            <div className="planning-bar-fill" style={{ width: `${pct}%`, background: color.dot }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="planning-insight-card">
                  <h4>🕒 Historial de cambios guardados ({matrix.historial.length})</h4>
                  {matrix.historial.length === 0 ? (
                    <p className="planning-insight-sub">Aún no hay movimientos registrados en este rango de fechas.</p>
                  ) : (
                    <ul className="planning-timeline">
                      {matrix.historial.slice(0, 12).map(h => (
                        <li key={h.id}>
                          <div className="timeline-head">
                            <strong>{h.fecha_viaje}</strong>
                            <span>{h.autor}</span>
                          </div>
                          <div className="timeline-change">
                            Bus {h.bus_anterior_id || 'sin asignar'} → <strong>Bus {h.bus_nuevo_id || 'sin asignar'}</strong>
                          </div>
                          <div className="timeline-reason">{h.motivo}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {mapFrec && (
        <div className="planning-map-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Mapa de ruta ${mapFrec.origen} a ${mapFrec.destino}`} onClick={() => setMapFrec(null)}>
          <div className="planning-map-modal" onClick={(e) => e.stopPropagation()}>
            <div className="planning-map-modal-head">
              <div>
                <strong>{mapFrec.origen} → {mapFrec.destino}</strong>
                <div className="muted" style={{ fontSize: '0.82rem' }}>
                  Salida {shortTime(mapFrec.hora_salida)} · ANT {mapFrec.resolucion_ant || 'N/D'}
                </div>
              </div>
              <button type="button" className="button secondary" onClick={() => setMapFrec(null)} aria-label="Cerrar mapa">
                <X size={16} /> Cerrar
              </button>
            </div>
            <Suspense fallback={<p className="muted">Cargando mapa de ruta...</p>}>
              <RouteMap
                origen={mapFrec.origen}
                destino={mapFrec.destino}
                tipoServicio={mapFrec.tipo_servicio}
                cooperativa={cooperatives.find(c => String(c.id) === String(cooperativeId))?.nombre || usuario?.cooperativa_nombre || ''}
                horaSalida={shortTime(mapFrec.hora_salida)}
                paradasIntermedias={mapFrec.paradas_intermedias}
                compact
              />
            </Suspense>
          </div>
        </div>
      )}
    </section>
  );
}
