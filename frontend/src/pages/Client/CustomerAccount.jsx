import { useEffect, useState } from 'react';
import {
  ReceiptText,
  Ticket,
  LogOut,
  Eye,
  EyeOff,
  Search,
  CheckCircle2,
  Shield,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { money, shortTime, travelDate } from '../../lib/format.js';
import { reservationStatus } from '../../lib/reservation.js';
import { validarCedulaEcuador, validarPassword } from '../../lib/validation.js';

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
  onSession,
  onLogout,
  onHistory,
  onTicket,
  onVerBoleto,
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
    { ok: /[^a-zA-Z0-9]/.test(pwd), label: 'Símbolo (*@#)' }
  ];

  const field = (key, label, props = {}) => (
    <label key={key}>
      {label}
      <input
        name={key}
        value={form[key]}
        required
        disabled={busy}
        {...props}
        onChange={event => {
          setForm(previous => ({ ...previous, [key]: event.target.value }));
          setError('');
        }}
      />
    </label>
  );

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
      setError('Revisa tu nombre y cédula ecuatoriana. La contraseña debe tener de 8 a 128 caracteres, mayúscula, minúscula, número y símbolo.');
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
          ? 'El acceso de clientes todavía no está disponible. Puedes seguir comprando como visitante.'
          : err.message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={compact ? 'cr01-account-compact' : 'flow-page cr01-account'}>
      {!compact && (
        <div className="client-account-hero">
          <div>
            <p className="eyebrow">CUENTA DE PASAJERO (OPCIONAL)</p>
            <h1 className="flow-title">Mi cuenta de cliente</h1>
            <p className="muted">
              Puedes comprar boletos como visitante sin registrarte, o crear tu cuenta gratuita para autocompletar tus datos y tener todos tus QR guardados.
            </p>
          </div>
          {!customer && onSearch && (
            <button type="button" className="button secondary" onClick={onSearch}>
              <Search size={16} aria-hidden="true" /> Comprar sin cuenta
            </button>
          )}
        </div>
      )}

      {customer ? (
        <div className="client-dashboard">
          {/* Cabecera del perfil activo */}
          <div className="panel client-profile-card">
            <div className="client-profile-head">
              <div className="client-avatar" aria-hidden="true">
                {String(customer.nombre || 'CL').trim().slice(0, 2).toUpperCase()}
              </div>
              <div className="client-profile-info">
                <div className="client-profile-badge">
                  <UserCheck size={14} aria-hidden="true" /> Sesión de pasajero activa
                </div>
                <h2>Hola, {customer.nombre}</h2>
                <p className="muted">
                  {customer.email}
                  {customer.cedula ? ` · Cédula ${customer.cedula}` : ''}
                </p>
              </div>
            </div>

            <div className="cr01-actions client-profile-actions">
              {hasActiveTrip && onContinue ? (
                <button type="button" className="button primary" onClick={onContinue}>
                  Continuar mi compra
                </button>
              ) : onSearch ? (
                <button type="button" className="button primary" onClick={onSearch}>
                  <Search size={16} aria-hidden="true" /> Buscar nuevo viaje
                </button>
              ) : null}
              <button type="button" className="button secondary" onClick={onHistory}>
                <ReceiptText size={16} aria-hidden="true" /> Consultar mis compras
              </button>
              {onTicket && !compact && (
                <button type="button" className="button secondary" onClick={onTicket}>
                  <Ticket size={16} aria-hidden="true" /> Buscar por código
                </button>
              )}
              <button type="button" className="button secondary" onClick={onLogout}>
                <LogOut size={15} aria-hidden="true" /> Cerrar sesión de cliente
              </button>
            </div>
          </div>

          {/* Historial en vivo cargado directamente en Mi Cuenta (VENT-09 / T-14) */}
          {!compact && (
            <div className="panel client-trips-panel">
              <div className="client-trips-head">
                <div>
                  <h3>🎫 Tus viajes y boletos recientes</h3>
                  <p className="muted">Historial sincronizado automáticamente con tu cuenta y tus compras previas con este correo.</p>
                </div>
                <button type="button" className="inline-link" onClick={onHistory}>
                  Ver historial completo →
                </button>
              </div>

              {!recentTrips && <p role="status" className="muted">Cargando tus boletos…</p>}
              {recentTrips?.error && <p role="alert" className="inline-error">{recentTrips.error}</p>}
              {recentTrips?.rows && recentTrips.rows.length === 0 && (
                <div className="client-trips-empty">
                  <p>Todavía no tienes boletos registrados en esta cuenta.</p>
                  {onSearch && (
                    <button type="button" className="button primary" onClick={onSearch}>
                      <Search size={15} aria-hidden="true" /> Buscar mi primer viaje
                    </button>
                  )}
                </div>
              )}
              {recentTrips?.rows && recentTrips.rows.length > 0 && (
                <div className="client-trips-list">
                  {recentTrips.rows.slice(0, 6).map(item => {
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
                          onClick={() => (onVerBoleto ? onVerBoleto(item.codigo_reserva) : onTicket?.())}
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
        </div>
      ) : (
        <div className="client-auth-grid">
          <form className="panel client-auth-card" onSubmit={submit}>
            {/* Pestañas claras Iniciar sesión | Registrarme */}
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

            <h2>{register ? 'Crear cuenta de cliente' : 'Iniciar sesión de cliente'}</h2>
            <p className="muted" style={{ marginTop: '-0.25rem', fontSize: '0.88rem' }}>
              {register
                ? 'Si ya compraste antes como visitante con el mismo correo, recuperaremos tu historial automáticamente.'
                : 'Accede con tu correo y contraseña para ver tus boletos y autocompletar tus datos al comprar.'}
            </p>

            <div className="cr01-fields">
              {register && field('nombre', 'Nombre completo', { autoComplete: 'name', minLength: 3, maxLength: 100, placeholder: 'Ej. María López' })}
              {register && field('cedula', 'Cédula', { inputMode: 'numeric', maxLength: 10, placeholder: '10 dígitos ecuatorianos' })}
              {field('email', 'Correo electrónico', { type: 'email', autoComplete: 'email', maxLength: 100, placeholder: 'tucorreo@ejemplo.com' })}

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
                    placeholder={register ? 'Mínimo 8 caracteres con símbolo' : 'Tu contraseña'}
                    onChange={event => {
                      setForm(previous => ({ ...previous, password: event.target.value }));
                      setError('');
                    }}
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
                <div className="client-pwd-checks" aria-live="polite">
                  {pwdChecks.map(item => (
                    <span key={item.label} className={item.ok ? 'is-ok' : ''}>
                      {item.ok ? '✓' : '○'} {item.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="inline-error" role="alert">{error}</p>}

            <div className="cr01-actions">
              <button className="button primary full-width" disabled={busy}>
                {busy ? 'Conectando…' : register ? 'Crear mi cuenta' : 'Entrar a mi cuenta'}
              </button>
            </div>
          </form>

          {!compact && (
            <aside className="client-auth-side">
              <div className="panel client-benefits-card">
                <h3><Sparkles size={17} aria-hidden="true" /> ¿Para qué sirve tu cuenta?</h3>
                <ul>
                  <li>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span><strong>No es obligatoria:</strong> siempre puedes comprar como visitante solo con tu correo.</span>
                  </li>
                  <li>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span><strong>Autocompletado rápido:</strong> tu nombre, cédula y acompañantes frecuentes se llenan solos.</span>
                  </li>
                  <li>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span><strong>Boletos y QR siempre a mano:</strong> consulta tu historial sin buscar correos viejos.</span>
                  </li>
                </ul>
              </div>

              {onHistory && (
                <div className="panel cr01-guest-history">
                  <h3>¿Compraste sin cuenta?</h3>
                  <p className="muted" style={{ fontSize: '0.88rem' }}>
                    Consulta tus boletos solicitando un enlace temporal a tu correo o buscando por código de reserva.
                  </p>
                  <div className="cr01-actions">
                    <button type="button" className="button secondary" disabled={busy} onClick={onHistory}>
                      Consultar mis compras por correo
                    </button>
                    {onTicket && (
                      <button type="button" className="button secondary" disabled={busy} onClick={onTicket}>
                        Buscar por código
                      </button>
                    )}
                  </div>
                </div>
              )}

              {onAdminLogin && (
                <p className="client-staff-hint">
                  <Shield size={14} aria-hidden="true" /> ¿Eres gerente, oficinista o chofer?{' '}
                  <button type="button" className="inline-link" onClick={onAdminLogin}>
                    Ir al Portal administrativo
                  </button>
                </p>
              )}
            </aside>
          )}
        </div>
      )}

      {hasActiveTrip && onContinue && !customer && (
        <button type="button" className="back-link" disabled={busy} onClick={onContinue}>
          ← Volver y continuar mi compra como visitante
        </button>
      )}
    </section>
  );
}
