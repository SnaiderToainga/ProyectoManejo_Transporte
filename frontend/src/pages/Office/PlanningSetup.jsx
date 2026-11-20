import { useState } from 'react';
import { planningRequest } from '../../lib/planningApi.js';
import { today } from '../../lib/format.js';

export default function PlanningSetup({ usuario, cooperativaId, catalogo, onChanged }) {
  const [group, setGroup] = useState({ clase: 'BUSES', nombre: '', tipo_operacion: 'INTERPROVINCIAL', inicio_ciclo: today(), miembros: [] });
  const [link, setLink] = useState({ grupo_buses_id: '', grupo_frecuencias_id: '' });
  const [branch, setBranch] = useState({ nombre: '', localidad: '' });
  const [staff, setStaff] = useState({ nombre: '', correo: '', telefono: '', password: '', sucursal_id: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const items = group.clase === 'BUSES' ? catalogo.buses : catalogo.frecuencias;

  async function submit(event, path, data, reset) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await planningRequest(usuario, path, { method: 'POST', data: { ...data, cooperativa_id: Number(cooperativaId) } });
      reset();
      setMessage('Registro guardado correctamente.');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <p>Configura primero los grupos compatibles y vincúlalos. Cada unidad y frecuencia pertenece a un solo grupo.</p>
    {error && <p role="alert" className="planning-error">{error}</p>}
    {message && <p role="status" className="planning-success">{message}</p>}
    <div className="planning-panels">
      <form onSubmit={e => submit(e, '/planificacion/grupos', group, () => setGroup({ ...group, nombre: '', miembros: [] }))}>
        <h3>Crear grupo operativo</h3>
        <fieldset disabled={busy}>
          <label>Clase de grupo<select value={group.clase} onChange={e => setGroup({ ...group, clase: e.target.value, miembros: [] })}>
            <option value="BUSES">Buses</option><option value="FRECUENCIAS">Frecuencias</option>
          </select></label>
          <label>Nombre del grupo<input required maxLength={100} value={group.nombre} onChange={e => setGroup({ ...group, nombre: e.target.value })} /></label>
          <label>Tipo de operación<select value={group.tipo_operacion} onChange={e => setGroup({ ...group, tipo_operacion: e.target.value })}>
            <option value="INTERPROVINCIAL">Interprovincial</option><option value="URBANO">Urbano</option>
          </select></label>
          {group.clase === 'BUSES' && <label>Inicio del ciclo de rotación<input required type="date" value={group.inicio_ciclo} onChange={e => setGroup({ ...group, inicio_ciclo: e.target.value })} /></label>}
          <div className="planning-members" aria-label="Miembros del grupo">
            {items.filter(item => !item.grupo_id).map(item => <label key={item.id} className="planning-check">
              <input type="checkbox" checked={group.miembros.includes(item.id)} onChange={e => setGroup({ ...group,
                miembros: e.target.checked ? [...group.miembros, item.id] : group.miembros.filter(id => id !== item.id)
              })} />
              {group.clase === 'BUSES' ? `Unidad #${item.numero_disco} · ${item.placa} · ${item.estado}` : `${item.origen} → ${item.destino} · ${item.hora_salida.slice(0, 5)}`}
            </label>)}
            {!items.some(item => !item.grupo_id) && <p>No hay miembros libres para esta clase de grupo.</p>}
          </div>
          <button disabled={!group.miembros.length} className="button primary">Crear grupo</button>
        </fieldset>
      </form>
      <form onSubmit={e => submit(e, '/planificacion/vinculos', link, () => setLink({ grupo_buses_id: '', grupo_frecuencias_id: '' }))}>
        <h3>Vincular grupos compatibles</h3>
        <fieldset disabled={busy}>
          <label>Grupo de buses<select required value={link.grupo_buses_id} onChange={e => setLink({ grupo_buses_id: e.target.value, grupo_frecuencias_id: '' })}>
            <option value="">Selecciona un grupo</option>
            {catalogo.grupos_buses.map(g => <option key={g.id} value={g.id}>{g.nombre} · {g.tipo_operacion}</option>)}
          </select></label>
          <label>Grupo de frecuencias<select required value={link.grupo_frecuencias_id} onChange={e => setLink({ ...link, grupo_frecuencias_id: e.target.value })}>
            <option value="">Selecciona un grupo</option>
            {catalogo.grupos_frecuencias.filter(g => g.tipo_operacion === catalogo.grupos_buses.find(b => b.id === Number(link.grupo_buses_id))?.tipo_operacion)
              .map(g => <option key={g.id} value={g.id}>{g.nombre} · {g.tipo_operacion}</option>)}
          </select></label>
          <button className="button primary">Guardar vínculo</button>
        </fieldset>
        <h4>Grupos registrados</h4>
        <ul>{catalogo.grupos_buses.map(g => <li key={g.id}>{g.nombre} · {catalogo.buses.filter(b => b.grupo_id === g.id).length} buses</li>)}</ul>
        <ul>{catalogo.grupos_frecuencias.map(g => <li key={g.id}>{g.nombre} · {catalogo.frecuencias.filter(f => f.grupo_id === g.id).length} frecuencias</li>)}</ul>
        <h4>Vínculos guardados</h4>
        <ul>{catalogo.vinculos.map(v => <li key={`${v.grupo_buses_id}-${v.grupo_frecuencias_id}`}>
          {catalogo.grupos_buses.find(g => g.id === v.grupo_buses_id)?.nombre} → {catalogo.grupos_frecuencias.find(g => g.id === v.grupo_frecuencias_id)?.nombre}
        </li>)}</ul>
      </form>
      <form onSubmit={e => submit(e, '/planificacion/sucursales', branch, () => setBranch({ nombre: '', localidad: '' }))}>
        <h3>Crear sucursal</h3>
        <fieldset disabled={busy}>
          <label>Nombre de la oficina<input required maxLength={100} value={branch.nombre} onChange={e => setBranch({ ...branch, nombre: e.target.value })} /></label>
          <label>Localidad<input required maxLength={100} value={branch.localidad} onChange={e => setBranch({ ...branch, localidad: e.target.value })} /></label>
          <button className="button primary">Crear sucursal</button>
        </fieldset>
        <ul>{catalogo.sucursales.map(s => <li key={s.id}>{s.nombre} · {s.localidad}</li>)}</ul>
      </form>
      <form onSubmit={e => submit(e, '/admin/usuarios', { ...staff, rol: 'OFICINISTA' }, () => setStaff({ nombre: '', correo: '', telefono: '', password: '', sucursal_id: '' }))}>
        <h3>Registrar oficinista</h3>
        <fieldset disabled={busy}>
          <label>Nombre completo<input required maxLength={100} autoComplete="name" value={staff.nombre} onChange={e => setStaff({ ...staff, nombre: e.target.value })} /></label>
          <label>Correo electrónico<input required type="email" maxLength={100} autoComplete="email" value={staff.correo} onChange={e => setStaff({ ...staff, correo: e.target.value })} /></label>
          <label>Teléfono<input maxLength={20} autoComplete="tel" value={staff.telefono} onChange={e => setStaff({ ...staff, telefono: e.target.value })} /></label>
          <label>Sucursal asignada<select required value={staff.sucursal_id} onChange={e => setStaff({ ...staff, sucursal_id: e.target.value })}>
            <option value="">Selecciona una sucursal</option>
            {catalogo.sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre} · {s.localidad}</option>)}
          </select></label>
          <label>Contraseña temporal<input required type="password" autoComplete="new-password" minLength={8} maxLength={128}
            pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,128}" value={staff.password} onChange={e => setStaff({ ...staff, password: e.target.value })} /></label>
          <p>Mínimo 8 caracteres con mayúscula, minúscula y número.</p>
          <button disabled={!catalogo.sucursales.length} className="button primary">Registrar oficinista</button>
        </fieldset>
      </form>
    </div>
  </div>;
}
