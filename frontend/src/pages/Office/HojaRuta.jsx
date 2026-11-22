import { useEffect, useState } from 'react';
import { planningRequest } from '../../lib/planningApi.js';
import { shortTime, today } from '../../lib/format.js';
import PlanningSetup from './PlanningSetup.jsx';
import './planning.css';

const cellKey = (frequency, date) => `${frequency}:${date}`;
const endOfCycle = () => {
  const date = new Date(`${today()}T12:00:00`);
  date.setDate(date.getDate() + 4);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function HojaRuta({ usuario }) {
  const manager = ['ADMIN_COOP', 'SUPERADMIN'].includes(usuario?.rol);
  const [cooperatives, setCooperatives] = useState([]);
  const [cooperativeId, setCooperativeId] = useState(usuario?.cooperativa_id || '');
  const [catalog, setCatalog] = useState(null);
  const [tab, setTab] = useState('matriz');
  const [filters, setFilters] = useState({ grupo_buses_id: '', grupo_frecuencias_id: '', desde: today(), hasta: endOfCycle() });
  const [matrix, setMatrix] = useState(null);
  const [draft, setDraft] = useState({});
  const [reason, setReason] = useState('Asignación manual de hoja de ruta.');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [catalogReload, setCatalogReload] = useState(0);
  const changes = Object.values(draft).filter(cell => cell.bus_id !== (cell.original_bus_id || null));
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
    setCatalog(null);
    setMatrix(null);
    setDraft({});
    setError('');
    planningRequest(usuario, `/planificacion/catalogo?cooperativa_id=${cooperativeId}`, { signal: abort.signal }).then(data => {
      setCatalog(data);
      setFilters(current => {
        const group = data.grupos_buses.find(g => String(g.id) === String(current.grupo_buses_id)) || data.grupos_buses[0];
        const linked = data.vinculos.find(v => v.grupo_buses_id === group?.id);
        return { ...current, grupo_buses_id: group?.id || '', grupo_frecuencias_id: linked?.grupo_frecuencias_id || '' };
      });
    }).catch(err => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, [cooperativeId, usuario?.token, catalogReload]);

  useEffect(() => {
    setMatrix(null);
    setDraft({});
    if (!catalog || !filters.grupo_buses_id || !filters.grupo_frecuencias_id) return;
    const abort = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ ...filters, cooperativa_id: cooperativeId });
    planningRequest(usuario, `/planificacion/matriz?${params}`, { signal: abort.signal }).then(data => {
      const cells = {};
      for (const frequency of data.frecuencias) {
        for (const date of data.fechas) {
          const trips = data.viajes.filter(v => v.frecuencia_id === frequency.id && v.fecha_viaje === date);
          if (trips.length > 1) throw new Error('Hay viajes duplicados para una frecuencia y fecha. Revisa la programación existente antes de editar.');
          const trip = trips[0];
          cells[cellKey(frequency.id, date)] = { frecuencia_id: frequency.id, fecha: date,
            bus_id: trip?.bus_id || null, original_bus_id: trip?.bus_id || null,
            programacion_id: trip?.id || null, version: trip?.version || null, estado: trip?.estado || 'PROGRAMADO', averia: false };
        }
      }
      setMatrix(data);
      setDraft(cells);
    }).catch(err => { if (!abort.signal.aborted) setError(err.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [catalog, cooperativeId, filters, reload, usuario?.token]);

  async function propose() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await planningRequest(usuario, '/planificacion/propuesta', { method: 'POST', data: { ...filters, cooperativa_id: cooperativeId } });
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
      setMessage('Propuesta preparada. Revisa la matriz y pulsa Guardar asignaciones.');
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
      const result = await planningRequest(usuario, '/planificacion/matriz', { method: 'PUT', data: {
        ...filters, cooperativa_id: cooperativeId, motivo: reason,
        asignaciones: changes.map(({ original_bus_id, estado, ...cell }) => cell)
      } });
      setMessage(result.actualizados === 1 ? 'Se guardó 1 asignación.' : `Se guardaron ${result.actualizados} asignaciones.`);
      setReload(value => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function busyOnDate(bus, date) {
    const selectedFrequencyIds = matrix.frecuencias.map(f => f.id);
    return Object.values(draft).some(cell => cell.fecha === date && cell.bus_id === bus.id)
      || matrix.ocupaciones.some(v => v.bus_id === bus.id && v.fecha_viaje === date && !selectedFrequencyIds.includes(v.frecuencia_id));
  }

  return <section className="planning" aria-label="Planificación de hojas de ruta">
    <h2>Hojas de ruta · Matriz de programación</h2>
    <p>Selecciona grupos vinculados, revisa la rotación y guarda las unidades de cada frecuencia y fecha.</p>
    {usuario?.rol === 'SUPERADMIN' && <label>Cooperativa de planificación<select disabled={dirty || saving} value={cooperativeId}
      onChange={e => setCooperativeId(e.target.value)}>
      <option value="">Selecciona una cooperativa</option>
      {cooperatives.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
    </select></label>}
    {manager && <div className="planning-actions" role="group" aria-label="Secciones de planificación">
      <button type="button" className="button secondary" aria-pressed={tab === 'matriz'} onClick={() => setTab('matriz')}>Matriz de rutas</button>
      <button type="button" className="button secondary" disabled={dirty || saving} aria-pressed={tab === 'grupos'} onClick={() => setTab('grupos')}>Grupos, sucursales y oficinistas</button>
    </div>}
    {error && <div className="planning-error" role="alert">{error} <button type="button" onClick={() => setCatalogReload(v => v + 1)}>Recargar datos</button></div>}
    {message && <p className="planning-success" role="status">{message}</p>}
    {!catalog && !error && <p role="status">Cargando grupos operativos…</p>}
    {catalog && tab === 'grupos' && manager && <PlanningSetup key={cooperativeId} usuario={usuario} cooperativaId={cooperativeId}
      catalogo={catalog} onChanged={() => { setMessage('Configuración guardada correctamente.'); setCatalogReload(v => v + 1); }} />}
    {catalog && tab === 'matriz' && <>
      <fieldset disabled={dirty || saving} className="planning-filters">
        <label>Grupo de buses<select value={filters.grupo_buses_id} onChange={e => {
          const linked = catalog.vinculos.find(v => v.grupo_buses_id === Number(e.target.value));
          setFilters({ ...filters, grupo_buses_id: e.target.value, grupo_frecuencias_id: linked?.grupo_frecuencias_id || '' });
        }}><option value="">Selecciona un grupo</option>{catalog.grupos_buses.map(g => <option key={g.id} value={g.id}>{g.nombre} · {g.tipo_operacion}</option>)}</select></label>
        <label>Grupo de frecuencias<select value={filters.grupo_frecuencias_id} onChange={e => setFilters({ ...filters, grupo_frecuencias_id: e.target.value })}>
          <option value="">Selecciona un grupo vinculado</option>{catalog.grupos_frecuencias.filter(g => catalog.vinculos.some(v =>
            v.grupo_buses_id === Number(filters.grupo_buses_id) && v.grupo_frecuencias_id === g.id))
            .map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select></label>
        <label>Desde<input type="date" value={filters.desde} onChange={e => setFilters({ ...filters, desde: e.target.value })} /></label>
        <label>Hasta<input type="date" value={filters.hasta} onChange={e => setFilters({ ...filters, hasta: e.target.value })} /></label>
      </fieldset>
      {!filters.grupo_frecuencias_id && <p>Crea y vincula los grupos antes de programar. El gerente puede configurarlos en «Grupos, sucursales y oficinistas».</p>}
      {loading && <p role="status">Cargando matriz…</p>}
      {matrix && <>
        <div className="planning-actions">
          <button type="button" className="button secondary" disabled={saving || dirty} onClick={propose}>Proponer rotación 3+2</button>
          <button type="button" className="button secondary" disabled={saving} onClick={() => { setReload(v => v + 1); setMessage(''); }}>Descartar cambios / Recargar</button>
          <span>{changes.length} cambios pendientes</span>
        </div>
        <p>La propuesta rota las unidades desde el {matrix.grupo.inicio_ciclo}. Con 5 buses y 3 frecuencias, cada unidad trabaja 3 días y descansa 2 por ciclo. Los reemplazos manuales actualizan el descanso real.</p>
        <form onSubmit={save}>
          <div className="planning-scroll" tabIndex={0} role="region" aria-label="Matriz de frecuencias por fecha">
            <table className="planning-table">
              <caption>Frecuencias por fecha · {matrix.grupo.nombre}</caption>
              <thead><tr><th scope="col">Frecuencia / Fecha</th>{matrix.fechas.map(date => <th scope="col" key={date}>{date}</th>)}</tr></thead>
              <tbody>{matrix.frecuencias.map(f => <tr key={f.id}>
                <th scope="row">{f.origen} → {f.destino}<small>{shortTime(f.hora_salida)} · {f.resolucion_ant}</small></th>
                {matrix.fechas.map(date => {
                  const key = cellKey(f.id, date);
                  const cell = draft[key];
                  if (!cell) return <td key={date} />;
                  const changed = cell.bus_id !== cell.original_bus_id;
                  return <td key={date} className={changed ? 'planning-changed' : ''}>
                    <select aria-label={`Bus para ${f.origen} a ${f.destino} ${shortTime(f.hora_salida)} el ${date}`}
                      disabled={saving || date < today() || cell.estado !== 'PROGRAMADO'} value={cell.bus_id || ''}
                      onChange={e => setDraft({ ...draft, [key]: { ...cell, bus_id: Number(e.target.value) || null, averia: Boolean(cell.original_bus_id && e.target.value) } })}>
                      <option value="">Sin asignar</option>
                      {cell.bus_id && !matrix.buses.some(b => b.id === cell.bus_id) && <option value={cell.bus_id}>Bus fuera del grupo #{cell.bus_id}</option>}
                      {matrix.buses.map(b => <option key={b.id} value={b.id} disabled={b.estado === 'MANTENIMIENTO'
                        || matrix.paradas.some(p => p.bus_id === b.id && p.fecha === date && p.motivo === 'AVERIA')}>
                        Unidad #{b.numero_disco} · {b.placa}{b.estado === 'MANTENIMIENTO' ? ' · Mantenimiento' : ''}
                      </option>)}
                    </select>
                    {cell.estado !== 'PROGRAMADO' && <small>{cell.estado}</small>}
                    {changed && cell.original_bus_id && cell.bus_id && <label className="planning-check">
                      <input type="checkbox" checked={cell.averia} disabled={saving}
                        onChange={e => setDraft({ ...draft, [key]: { ...cell, averia: e.target.checked } })} />Por avería
                    </label>}
                  </td>;
                })}
              </tr>)}
              <tr className="planning-stops"><th scope="row">En parada / Reserva</th>{matrix.fechas.map(date => <td key={date}>
                {matrix.buses.filter(b => !busyOnDate(b, date)).map(b => <small key={b.id}>Unidad #{b.numero_disco}
                  {matrix.paradas.some(p => p.bus_id === b.id && p.fecha === date && p.motivo === 'AVERIA')
                    || Object.values(draft).some(c => c.fecha === date && c.original_bus_id === b.id && c.bus_id !== b.id && c.averia)
                    ? ' · Avería' : b.estado === 'MANTENIMIENTO' ? ' · Mantenimiento' : ' · Descanso'}</small>)}
              </td>)}</tr></tbody>
            </table>
          </div>
          <label>Motivo de la programación o reemplazo<textarea required minLength={3} maxLength={300} disabled={saving} value={reason} onChange={e => setReason(e.target.value)} /></label>
          <button className="button primary" disabled={!dirty || saving}>{saving ? 'Guardando…' : 'Guardar asignaciones'}</button>
        </form>
        <details><summary>Rotación real en el rango seleccionado</summary><ul>{matrix.buses.map(b => {
          const working = matrix.fechas.filter(date => busyOnDate(b, date)).length;
          return <li key={b.id}>Unidad #{b.numero_disco} · {working} días asignados · {matrix.fechas.length - working} días en parada</li>;
        })}</ul></details>
        <details><summary>Historial de cambios guardados ({matrix.historial.length})</summary><ul>{matrix.historial.map(h => <li key={h.id}>
          {h.fecha_viaje} · {h.autor} · Bus {h.bus_anterior_id || 'sin asignación'} → {h.bus_nuevo_id || 'sin asignación'} · {h.motivo}
        </li>)}</ul></details>
      </>}
    </>}
  </section>;
}
