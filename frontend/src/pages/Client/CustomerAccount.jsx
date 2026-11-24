import { Suspense, lazy, useEffect, useState } from 'react';
import {
  ReceiptText,
  Ticket,
  LogOut,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  UserCheck,
  BusFront,
  ArrowRight
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, shortTime, travelDate } from '../../lib/format.js';
import { reservationStatus } from '../../lib/reservation.js';
import { validarCedulaEcuador, validarPassword } from '../../lib/validation.js';

const TicketLookup = lazy(() => import('./TicketLookup.jsx'));

const STATUS_LABELS = {
  paid: { text: 'Pagado · QR listo', tone: 'ok' },
  review: { text: 'Comprobante en revisión', tone: 'warn' },
  pending: { text: 'Pendiente de pago', tone: 'warn' },
  rejected: { text: 'Rechazado', tone: 'bad' },
  cancelled: { text: 'Cancelado', tone: 'muted' },
  expired: { text: 'Vencido', tone: 'muted' },
  unknown: { text: 'Por confirmar', tone: 'muted' }
};

export default function CustomerAccount({
  customer,
  token = '',
  pendingTrip = null,
  requireTicketLogin = false,
  initialTab = 'compras',
  initialTicketCode = '',
  onSession,
  onLogout,
  onHistory,
  onSearch,
  onAdminLogin,
  onContinue,
  hasActiveTrip = false,
  initialRegister = false,
  compact = false
}) {
  const [register, setRegister] = useState(initialRegister);
  const [form, setForm] = useState({ nombre: '', cedula: '', email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recentTrips, setRecentTrips] = useState(null);
  const [accountTab, setAccountTab] = useState(initialTab === 'boleto' || initialTicketCode ? 'boleto' : 'compras');
  const [activeTicketCode, setActiveTicketCode] = useState(initialTicketCode);

  useEffect(() => {
    if (initialTab === 'boleto' || initialTicketCode) {
      setAccountTab('boleto');
      if (initialTicketCode) setActiveTicketCode(initialTicketCode);
    }
  }, [initialTab, initialTicketCode]);

  useEffect(() => {
    if (compact || !customer || !token) {
      setRecentTrips(null);
      return;
    }
    const controller = new AbortController();
    api.purchaseHistory(token, controller.signal)
      .then(rows => {
        if (!controller.signal.aborted) {
          setRecentTrips({ rows: Array.isArray(rows) ? rows : [] });
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setRecentTrips({ error: err.message });
        }
      });
    return () => controller.abort();
  }, [compact, customer?.id, token]);

  const pwd = form.password || '';
  const pwdChecks = [
    { ok: pwd.length >= 8, label: '8+ caracteres' },
    { ok: /[A-Z]/.test(pwd), label: 'Mayúscula' },
    { ok: /[a-z]/.test(pwd), label: 'Minúscula' },
    { ok: /[0-9]/.test(pwd), label: 'Número' },
    { ok: /[^a-zA-Z0-9]/.test(pwd), label: 'Símbolo' }
  ];
  const pwdScore = pwdChecks.filter(c => c.ok).length;
  const cedulaComplete = form.cedula.length === 10;
  const cedulaValid = cedulaComplete && validarCedulaEcuador(form.cedula);

  const updateField = (key, value) => {
    const clean = key === 'cedula' ? value.replace(/\D/g, '').slice(0, 10) : value;
    setForm(previous => ({ ...previous, [key]: clean }));
    setError('');
  };

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (
      register &&
      (form.nombre.trim().length < 3 ||
        !validarCedulaEcuador(form.cedula) ||
        !validarPassword(form.password) ||
        !/[^a-z0-9]/i.test(form.password))
    ) {
      setError('Revisa tu nombre, cédula válida (10 dígitos) y que tu contraseña cumpla los 5 requisitos.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        email: form.email.trim(),
        password: form.password,
        ...(register ? { nombre: form.nombre.trim(), cedula: form.cedula } : {})
      };
      const result = await api.customerSession(register, payload);
      if (typeof result.token !== 'string' || !result.token || !result.cliente?.id) {
        throw new Error('No se recibió una sesión válida. Intenta nuevamente.');
      }
      onSession(result);
      setForm(previous => ({ ...previous, password: '' }));
    } catch (err) {
      setError(
        [404, 501].includes(err.status)
          ? 'El servicio de cuentas de clientes no está disponible en este momento.'
          : err.message
      );
    } finally {
      setBusy(false);
    }
  }

  const openTicketInsideAccount = (codigo = '') => {
    if (codigo) setActiveTicketCode(codigo);
    setAccountTab('boleto');
  };

  return (
    <section className={compact ? 'cr01-account-compact' : 'flow-page cr01-account'}>
      {customer ? (
        <div className="client-dashboard">
          <div className="panel client-profile-card">
            <div className="client-profile-head">
              <div className="client-avatar" aria-hidden="true">
                {String(customer.nombre || 'CL').trim().slice(0, 2).toUpperCase()}
              </div>
              <div className="client-profile-info">
                <div className="client-profile-badge">
                  <UserCheck size={14} aria-hidden="true" /> Sesión activa
                </div>
                <h2>Hola, {customer.nombre}</h2>
                <p className="muted">
                  {customer.email}
                  {customer.cedula ? ` · CI ${customer.cedula}` : ''}
                </p>
              </div>
            </div>

            <div className="cr01-actions client-profile-actions">
              {hasActiveTrip && onContinue ? (
                <button type="button" className="button primary" onClick={onContinue}>
                  Continuar mi compra <ArrowRight size={15} aria-hidden="true" />
                </button>
              ) : onSearch ? (
                <button type="button" className="button primary" onClick={onSearch}>
                  <Search size={16} aria-hidden="true" /> Buscar nuevo viaje
                </button>
              ) : null}
              {compact && (
                <button type="button" className="button secondary" onClick={onHistory}>
                  <ReceiptText size={16} aria-hidden="true" /> Consultar mis compras
                </button>
              )}
              <button type="button" className="button secondary" onClick={onLogout}>
                <LogOut size={15} aria-hidden="true" /> Cerrar sesión de cliente
              </button>
            </div>
          </div>

          {!compact && (
            <>
              {/* Navegación interna de Mi cuenta: Mis viajes / Mi boleto */}
              <div className="client-account-tabs" role="tablist" aria-label="Secciones de mi cuenta">
                <button
                  type="button"
                  role="tab"
                  aria-selected={accountTab === 'compras'}
                  className={accountTab === 'compras' ? 'is-active' : ''}
                  onClick={() => setAccountTab('compras')}
                >
                  <ReceiptText size={16} aria-hidden="true" />
                  <span>Mis compras ({recentTrips?.rows?.length ?? 0})</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={accountTab === 'boleto'}
                  className={accountTab === 'boleto' ? 'is-active' : ''}
                  onClick={() => setAccountTab('boleto')}
                >
                  <Ticket size={16} aria-hidden="true" />
                  <span>Mi boleto</span>
                </button>
              </div>

              {accountTab === 'boleto' ? (
                <div className="panel client-ticket-embedded-panel">
                  <Suspense fallback={<p role="status" className="muted">Cargando consulta de boleto…</p>}>
                    <TicketLookup
                      key={activeTicketCode || 'lookup'}
                      initialCode={activeTicketCode}
                      embedded
                      onBack={() => setAccountTab('compras')}
                    />
                  </Suspense>
                </div>
              ) : (
                <div className="panel client-trips-panel">
                  <div className="client-trips-head">
                    <div>
                      <h3>🎫 Tus viajes y boletos</h3>
                      <p className="muted">Haz clic en cualquier compra para abrir tu boleto y código QR aquí mismo.</p>
                    </div>
                    <button type="button" className="inline-link" onClick={() => openTicketInsideAccount('')}>
                      Buscar por código →
                    </button>
                  </div>

                  {!recentTrips && <p role="status" className="muted">Cargando tus boletos…</p>}
                  {recentTrips?.error && <p role="alert" className="inline-error">{recentTrips.error}</p>}
                  {recentTrips?.rows && recentTrips.rows.length === 0 && (
                    <div className="client-trips-empty">
                      <p>Aún no tienes boletos registrados en esta cuenta.</p>
                      {onSearch && (
                        <button type="button" className="button primary" onClick={onSearch}>
                          <Search size={15} aria-hidden="true" /> Buscar mi primer viaje
                        </button>
                      )}
                    </div>
                  )}
                  {recentTrips?.rows && recentTrips.rows.length > 0 && (
                    <div className="client-trips-list">
                      {recentTrips.rows.map(item => {
                        const stKey = reservationStatus({ ...item, comprobante_url: item.tiene_comprobante });
                        const st = STATUS_LABELS[stKey] || STATUS_LABELS.unknown;
                        return (
                          <article key={item.id} className="client-trip-item">
                            <div>
                              <div className="client-trip-meta">
                                <strong>{item.cooperativa_nombre}</strong>
                                <span className="client-trip-code">{item.codigo_reserva}</span>
                                <span className={`client-trip-pill tone-${st.tone}`}>{st.text}</span>
                              </div>
                              <div className="client-trip-route">
                                {item.origen} → {item.destino}
                              </div>
                              <div className="muted" style={{ fontSize: '0.84rem' }}>
                                {travelDate(item.fecha_viaje)} · {shortTime(item.hora_salida_programada)} · {item.total_pasajeros}{' '}
                                {Number(item.total_pasajeros) === 1 ? 'pasajero' : 'pasajeros'} · <strong>{money(item.total)}</strong>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => openTicketInsideAccount(item.codigo_reserva)}
                            >
                              {item.estado === 'PAGADO' ? 'Ver boleto / QR' : 'Ver reserva'}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className={compact ? '' : 'client-auth-center'}>
          {!compact && pendingTrip && (
            <div className="client-pending-trip-banner" role="status">
              <span className="client-pending-pill">🔒 Inicia sesión para continuar tu compra</span>
              <div className="client-pending-route">
                <strong>{pendingTrip.origen} → {pendingTrip.destino}</strong>
                <span>{shortTime(pendingTrip.hora_salida_programada)} · {pendingTrip.cooperativa_nombre} · Bus #{pendingTrip.numero_disco}</span>
              </div>
            </div>
          )}

          {!compact && !pendingTrip && requireTicketLogin && (
            <div className="client-pending-trip-banner" role="status">
              <span className="client-pending-pill">🔒 Acceso requerido para ver boletos</span>
              <div className="client-pending-route">
                <strong>Inicia sesión como cliente para ver tu boleto</strong>
                <span>
                  {initialTicketCode
                    ? `Al ingresar abriremos automáticamente tu reserva ${initialTicketCode}.`
                    : 'Todos tus boletos y códigos QR se consultan desde tu cuenta personal.'}
                </span>
              </div>
            </div>
          )}

          <form className="panel client-auth-card" onSubmit={submit}>
            {!compact && (
              <div className="client-auth-brand">
                <span className="client-auth-icon" aria-hidden="true">
                  <BusFront size={22} />
                </span>
                <div>
                  <h1 className="client-auth-title">
                    {register ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}
                  </h1>
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    {register
                      ? 'Regístrate para comprar boletos y consultar tus códigos QR.'
                      : 'Ingresa como cliente para comprar viajes y ver tus boletos.'}
                  </p>
                </div>
              </div>
            )}

            <div className="client-auth-tabs" role="tablist" aria-label="Tipo de acceso de cliente">
              <button
                type="button"
                role="tab"
                aria-selected={!register}
                className={!register ? 'is-active' : ''}
                disabled={busy}
                onClick={() => {
                  setRegister(false);
                  setError('');
                  setForm(previous => ({ ...previous, password: '' }));
                }}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={register}
                className={register ? 'is-active' : ''}
                disabled={busy}
                onClick={() => {
                  setRegister(true);
                  setError('');
                  setForm(previous => ({ ...previous, password: '' }));
                }}
              >
                Registrarme
              </button>
            </div>

            <div className="cr01-fields">
              {register && (
                <label>
                  Nombre completo
                  <input
                    name="nombre"
                    value={form.nombre}
                    required
                    disabled={busy}
                    autoComplete="name"
                    minLength={3}
                    maxLength={100}
                    placeholder="Ej. María López"
                    onChange={e => updateField('nombre', e.target.value)}
                  />
                </label>
              )}

              {register && (
                <label>
                  <span className="client-field-row">
                    <span>Cédula</span>
                    {cedulaComplete && (
                      <span className={`client-inline-badge ${cedulaValid ? 'ok' : 'bad'}`}>
                        {cedulaValid ? '✓ Cédula válida' : '✗ Cédula inválida'}
                      </span>
                    )}
                  </span>
                  <input
                    name="cedula"
                    value={form.cedula}
                    required
                    disabled={busy}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10 dígitos ecuatorianos"
                    onChange={e => updateField('cedula', e.target.value)}
                  />
                </label>
              )}

              <label>
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  required
                  disabled={busy}
                  autoComplete="email"
                  maxLength={100}
                  placeholder="tucorreo@ejemplo.com"
                  onChange={e => updateField('email', e.target.value)}
                />
              </label>

              <label>
                Contraseña
                <div className="client-pwd-wrap">
                  <input
                    name="password"
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    required
                    disabled={busy}
                    autoComplete={register ? 'new-password' : 'current-password'}
                    maxLength={128}
                    placeholder={register ? 'Ej. Viaje2026*' : 'Tu contraseña'}
                    onChange={e => updateField('password', e.target.value)}
                  />
                  <button
                    type="button"
                    className="client-pwd-toggle"
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPwd(v => !v)}
                  >
                    {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              {register && (
                <div className="client-pwd-meter" aria-live="polite">
                  <div className="client-pwd-bar">
                    <div
                      className={`client-pwd-fill score-${pwdScore}`}
                      style={{ width: `${(pwdScore / 5) * 100}%` }}
                    />
                  </div>
                  <div className="client-pwd-checks">
                    {pwdChecks.map(item => (
                      <span key={item.label} className={item.ok ? 'is-ok' : ''}>
                        {item.ok ? <CheckCircle2 size={11} aria-hidden="true" /> : '○'} {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && <p className="inline-error" role="alert">{error}</p>}

            <button className="button primary full-width client-submit-btn" disabled={busy}>
              <span>{busy ? 'Conectando…' : register ? 'Crear mi cuenta' : 'Entrar a mi cuenta'}</span>
              {!busy && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </form>

          {!compact && (
            <div className="client-auth-footer">
              {onSearch && (
                <button type="button" className="inline-link" onClick={onSearch}>
                  ← Volver a buscar viajes
                </button>
              )}
              {onAdminLogin && (
                <button type="button" className="inline-link" onClick={onAdminLogin}>
                  Portal administrativo
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
