import { useState } from 'react';
import {
  Bus,
  Route,
  Link2,
  Building2,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { planningRequest } from '../../lib/planningApi.js';
import { shortTime, today } from '../../lib/format.js';

export default function PlanningSetup({ usuario, cooperativaId, catalogo, onChanged, onGoMatrix }) {
  const [group, setGroup] = useState({
    clase: 'BUSES',
    nombre: '',
    tipo_operacion: 'INTERPROVINCIAL',
    inicio_ciclo: today(),
    miembros: []
  });
  const [link, setLink] = useState({ grupo_buses_id: '', grupo_frecuencias_id: '' });
  const [branch, setBranch] = useState({ nombre: '', localidad: '' });
  const [staff, setStaff] = useState({ nombre: '', correo: '', telefono: '', password: '', sucursal_id: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const items = group.clase === 'BUSES' ? catalogo.buses : catalogo.frecuencias;
  const freeItems = items.filter(item => !item.grupo_id);
  const hasBusGroup = catalogo.grupos_buses.length > 0;
  const hasFrecGroup = catalogo.grupos_frecuencias.length > 0;
  const hasLink = catalogo.vinculos.length > 0;
  const hasBranch = catalogo.sucursales.length > 0;

  const pwd = staff.password || '';
  const pwdChecks = [
    { ok: pwd.length >= 8, label: '8+ caracteres' },
    { ok: /[A-Z]/.test(pwd), label: 'Mayúscula' },
    { ok: /[a-z]/.test(pwd), label: 'Minúscula' },
    { ok: /[0-9]/.test(pwd), label: 'Número' }
  ];

  async function submit(event, path, data, reset) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await planningRequest(usuario, path, { method: 'POST', data: { ...data, cooperativa_id: Number(cooperativaId) } });
      reset();
      setMessage('✓ Registro guardado correctamente.');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="planning-setup-wrap">
      {/* Barra de progreso paso a paso */}
      <div className="planning-setup-roadmap">
        <div className={`roadmap-step ${hasBusGroup && hasFrecGroup ? 'done' : 'active'}`}>
          <span>1</span>
          <div>
            <strong>Grupos operativos</strong>
            <small>{catalogo.grupos_buses.length} buses · {catalogo.grupos_frecuencias.length} frec.</small>
          </div>
        </div>
        <div className={`roadmap-step ${hasLink ? 'done' : hasBusGroup && hasFrecGroup ? 'active' : ''}`}>
          <span>2</span>
          <div>
            <strong>Vincular grupos</strong>
            <small>{catalogo.vinculos.length} vínculo(s)</small>
          </div>
        </div>
        <div className={`roadmap-step ${hasBranch ? 'done' : ''}`}>
          <span>3</span>
          <div>
            <strong>Sucursales</strong>
            <small>{catalogo.sucursales.length} oficina(s)</small>
          </div>
        </div>
        <div className="roadmap-step">
          <span>4</span>
          <div>
            <strong>Personal taquilla</strong>
            <small>Oficinistas</small>
          </div>
        </div>
        {hasLink && onGoMatrix && (
          <button type="button" className="button primary roadmap-cta" onClick={onGoMatrix}>
            <span>Ir a la Matriz</span>
            <ArrowRight size={15} />
          </button>
        )}
      </div>

      {error && <p role="alert" className="planning-error">{error}</p>}
      {message && (
        <p role="status" className="planning-success">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </p>
      )}

      {/* Reordenado en 2 bloques lógicos: Operación de Rutas (Pasos 1-2) y Oficinas/Taquilla (Pasos 3-4) */}
      <div className="planning-panels">
        {/* PASO 1 */}
        <form onSubmit={e => submit(e, '/planificacion/grupos', group, () => setGroup({ ...group, nombre: '', miembros: [] }))}>
          <div className="setup-card-head">
            <span className="setup-step-badge">Paso 1</span>
            <h3>Crear grupo operativo</h3>
          </div>
          <p className="setup-card-desc">
            Agrupa tus buses o frecuencias del mismo tipo de operación. Cada elemento pertenece a un solo grupo.
          </p>

          <fieldset disabled={busy}>
            <div className="setup-class-toggle" role="group" aria-label="Clase de grupo">
              <button
                type="button"
                className={group.clase === 'BUSES' ? 'active' : ''}
                onClick={() => setGroup({ ...group, clase: 'BUSES', miembros: [] })}
              >
                <Bus size={15} /> Buses ({catalogo.buses.filter(b => !b.grupo_id).length} libres)
              </button>
              <button
                type="button"
                className={group.clase === 'FRECUENCIAS' ? 'active' : ''}
                onClick={() => setGroup({ ...group, clase: 'FRECUENCIAS', miembros: [] })}
              >
                <Route size={15} /> Frecuencias ({catalogo.frecuencias.filter(f => !f.grupo_id).length} libres)
              </button>
            </div>

            <div className="setup-inline-grid">
              <label>
                <span>Nombre del grupo</span>
                <input
                  required
                  maxLength={100}
                  placeholder={group.clase === 'BUSES' ? 'Ej. Flota Interprovincial A' : 'Ej. Rutas Ambato - Quito'}
                  value={group.nombre}
                  onChange={e => setGroup({ ...group, nombre: e.target.value })}
                />
              </label>
              <label>
                <span>Tipo de operación</span>
                <select
                  value={group.tipo_operacion}
                  onChange={e => setGroup({ ...group, tipo_operacion: e.target.value })}
                >
                  <option value="INTERPROVINCIAL">Interprovincial</option>
                  <option value="URBANO">Urbano</option>
                </select>
              </label>
            </div>

            {group.clase === 'BUSES' && (
              <label>
                <span>Inicio del ciclo de rotación 3+2</span>
                <input
                  required
                  type="date"
                  value={group.inicio_ciclo}
                  onChange={e => setGroup({ ...group, inicio_ciclo: e.target.value })}
                />
              </label>
            )}

            <div className="setup-members-header">
              <span>Miembros disponibles ({group.miembros.length} seleccionados)</span>
              {freeItems.length > 0 && (
                <div className="setup-mini-actions">
                  <button
                    type="button"
                    onClick={() => setGroup({ ...group, miembros: freeItems.map(i => i.id) })}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroup({ ...group, miembros: [] })}
                  >
                    Ninguno
                  </button>
                </div>
              )}
            </div>

            <div className="planning-members" aria-label="Miembros del grupo">
              {freeItems.map(item => {
                const checked = group.miembros.includes(item.id);
                return (
                  <label key={item.id} className={`planning-member-pill ${checked ? 'is-selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => setGroup({
                        ...group,
                        miembros: e.target.checked
                          ? [...group.miembros, item.id]
                          : group.miembros.filter(id => id !== item.id)
                      })}
                    />
                    <span>
                      {group.clase === 'BUSES'
                        ? `🚌 Unidad #${item.numero_disco} · ${item.placa} (${item.estado})`
                        : `🛣️ ${item.origen} → ${item.destino} · ${shortTime(item.hora_salida)}`}
                    </span>
                  </label>
                );
              })}
              {!freeItems.length && (
                <p className="setup-empty-note">Todos los elementos de esta categoría ya pertenecen a un grupo.</p>
              )}
            </div>

            <button disabled={!group.miembros.length} className="button primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Crear grupo ({group.miembros.length})
            </button>
          </fieldset>
        </form>

        {/* PASO 2 */}
        <form onSubmit={e => submit(e, '/planificacion/vinculos', link, () => setLink({ grupo_buses_id: '', grupo_frecuencias_id: '' }))}>
          <div className="setup-card-head">
            <span className="setup-step-badge">Paso 2</span>
            <h3><Link2 size={16} style={{ verticalAlign: 'middle' }} /> Vincular grupos compatibles</h3>
          </div>
          <p className="setup-card-desc">
            Conecta un grupo de buses con un grupo de frecuencias del mismo tipo de operación para habilitar la Matriz.
          </p>

          <fieldset disabled={busy}>
            <label>
              <span>Grupo de buses</span>
              <select
                required
                value={link.grupo_buses_id}
                onChange={e => setLink({ grupo_buses_id: e.target.value, grupo_frecuencias_id: '' })}
              >
                <option value="">Selecciona un grupo de buses</option>
                {catalogo.grupos_buses.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre} · {g.tipo_operacion}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Grupo de frecuencias compatible</span>
              <select
                required
                value={link.grupo_frecuencias_id}
                onChange={e => setLink({ ...link, grupo_frecuencias_id: e.target.value })}
              >
                <option value="">Selecciona un grupo de frecuencias</option>
                {catalogo.grupos_frecuencias
                  .filter(g => g.tipo_operacion === catalogo.grupos_buses.find(b => b.id === Number(link.grupo_buses_id))?.tipo_operacion)
                  .map(g => <option key={g.id} value={g.id}>{g.nombre} · {g.tipo_operacion}</option>)}
              </select>
            </label>

            <button className="button primary" style={{ width: '100%' }}>Guardar vínculo</button>
          </fieldset>

          <div className="setup-summary-box">
            <h4>Vínculos activos ({catalogo.vinculos.length})</h4>
            {catalogo.vinculos.length === 0 ? (
              <p className="setup-empty-note">Aún no hay vínculos guardados.</p>
            ) : (
              <div className="setup-tags">
                {catalogo.vinculos.map(v => (
                  <span key={`${v.grupo_buses_id}-${v.grupo_frecuencias_id}`} className="setup-tag link-tag">
                    🚌 {catalogo.grupos_buses.find(g => g.id === v.grupo_buses_id)?.nombre} → 🛣️ {catalogo.grupos_frecuencias.find(g => g.id === v.grupo_frecuencias_id)?.nombre}
                  </span>
                ))}
              </div>
            )}

            <h4>Grupos registrados</h4>
            <div className="setup-tags">
              {catalogo.grupos_buses.map(g => (
                <span key={`b-${g.id}`} className="setup-tag">
                  🚌 {g.nombre} ({catalogo.buses.filter(b => b.grupo_id === g.id).length})
                </span>
              ))}
              {catalogo.grupos_frecuencias.map(g => (
                <span key={`f-${g.id}`} className="setup-tag">
                  🛣️ {g.nombre} ({catalogo.frecuencias.filter(f => f.grupo_id === g.id).length})
                </span>
              ))}
            </div>
          </div>
        </form>

        {/* PASO 3 */}
        <form onSubmit={e => submit(e, '/planificacion/sucursales', branch, () => setBranch({ nombre: '', localidad: '' }))}>
          <div className="setup-card-head">
            <span className="setup-step-badge slate">Paso 3</span>
            <h3><Building2 size={16} style={{ verticalAlign: 'middle' }} /> Sucursales de taquilla</h3>
          </div>
          <p className="setup-card-desc">
            Registra las boleterías físicas de la cooperativa para asignar oficinistas.
          </p>

          <fieldset disabled={busy}>
            <label>
              <span>Nombre de la oficina</span>
              <input
                required
                maxLength={100}
                placeholder="Ej. Boletería Terminal Sur"
                value={branch.nombre}
                onChange={e => setBranch({ ...branch, nombre: e.target.value })}
              />
            </label>
            <label>
              <span>Localidad / Ciudad</span>
              <input
                required
                maxLength={100}
                placeholder="Ej. Ambato"
                value={branch.localidad}
                onChange={e => setBranch({ ...branch, localidad: e.target.value })}
              />
            </label>
            <button className="button primary" style={{ width: '100%' }}>Crear sucursal</button>
          </fieldset>

          <div className="setup-summary-box">
            <h4>Sucursales registradas ({catalogo.sucursales.length})</h4>
            {catalogo.sucursales.length === 0 ? (
              <p className="setup-empty-note">Sin sucursales todavía.</p>
            ) : (
              <div className="setup-tags">
                {catalogo.sucursales.map(s => (
                  <span key={s.id} className="setup-tag">🏢 {s.nombre} · {s.localidad}</span>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* PASO 4 */}
        <form onSubmit={e => submit(e, '/admin/usuarios', { ...staff, rol: 'OFICINISTA' }, () => setStaff({ nombre: '', correo: '', telefono: '', password: '', sucursal_id: '' }))}>
          <div className="setup-card-head">
            <span className="setup-step-badge slate">Paso 4</span>
            <h3><UserPlus size={16} style={{ verticalAlign: 'middle' }} /> Registrar oficinista</h3>
          </div>
          <p className="setup-card-desc">
            Crea cuentas de taquilla vinculadas directamente a una sucursal de esta cooperativa.
          </p>

          <fieldset disabled={busy}>
            <label>
              <span>Nombre completo</span>
              <input required maxLength={100} autoComplete="name" placeholder="Ej. Ana Morales" value={staff.nombre} onChange={e => setStaff({ ...staff, nombre: e.target.value })} />
            </label>
            <div className="setup-inline-grid">
              <label>
                <span>Correo electrónico</span>
                <input required type="email" maxLength={100} autoComplete="email" placeholder="taquilla@coop.com" value={staff.correo} onChange={e => setStaff({ ...staff, correo: e.target.value })} />
              </label>
              <label>
                <span>Teléfono</span>
                <input maxLength={20} autoComplete="tel" placeholder="0991234567" value={staff.telefono} onChange={e => setStaff({ ...staff, telefono: e.target.value })} />
              </label>
            </div>
            <label>
              <span>Sucursal asignada</span>
              <select required value={staff.sucursal_id} onChange={e => setStaff({ ...staff, sucursal_id: e.target.value })}>
                <option value="">Selecciona una sucursal</option>
                {catalogo.sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre} · {s.localidad}</option>)}
              </select>
            </label>
            <label>
              <span>Contraseña temporal</span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  required
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,128}"
                  placeholder="Ej. Taquilla2026"
                  value={staff.password}
                  onChange={e => setStaff({ ...staff, password: e.target.value })}
                  style={{ paddingRight: '2.4rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: '0.5rem', background: 'transparent', border: 'none', color: '#64748B', display: 'flex' }}
                  title={showPwd ? 'Ocultar' : 'Mostrar'}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <div className="setup-pwd-pills">
              {pwdChecks.map(c => (
                <span key={c.label} className={c.ok ? 'ok' : ''}>{c.ok ? '✓' : '○'} {c.label}</span>
              ))}
            </div>
            <button disabled={!catalogo.sucursales.length} className="button primary" style={{ width: '100%', marginTop: '0.5rem' }}>
              Registrar oficinista
            </button>
            {!catalogo.sucursales.length && (
              <p className="setup-empty-note" style={{ marginTop: '0.35rem' }}>Crea primero una sucursal en el Paso 3.</p>
            )}
          </fieldset>
        </form>
      </div>
    </div>
  );
}
