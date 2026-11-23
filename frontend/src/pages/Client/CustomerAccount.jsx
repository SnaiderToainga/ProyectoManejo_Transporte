import { useState } from 'react';
import { ReceiptText, Ticket, LogOut } from 'lucide-react';
import { api } from '../../lib/api.js';
import { validarCedulaEcuador, validarPassword } from '../../lib/validation.js';

export default function CustomerAccount({ customer, onSession, onLogout, onHistory, onTicket, onContinue, initialRegister = false, compact = false }) {
  const [register, setRegister] = useState(initialRegister);
  const [form, setForm] = useState({ nombre: '', cedula: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = (key, label, props = {}) => <label key={key}>{label}<input name={key} value={form[key]} required disabled={busy} {...props}
    onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} /></label>;
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    if (register && (form.nombre.trim().length < 3 || !validarCedulaEcuador(form.cedula) || !validarPassword(form.password) || !/[^a-z0-9]/i.test(form.password))) {
      setError('Revisa tu nombre y cédula. La contraseña debe tener de 8 a 128 caracteres, mayúscula, minúscula, número y símbolo.'); return;
    }
    setBusy(true); setError('');
    try {
      const payload = { email: form.email.trim(), password: form.password,
        ...(register ? { nombre: form.nombre.trim(), cedula: form.cedula } : {}) };
      const result = await api.customerSession(register, payload);
      if (typeof result.token !== 'string' || !result.token || !result.cliente?.id) throw new Error('No se recibió una sesión válida. Intenta nuevamente.');
      onSession(result); setForm(previous => ({ ...previous, password: '' }));
    } catch (err) {
      setError([404, 501].includes(err.status) ? 'El acceso de clientes todavía no está disponible. Puedes seguir comprando como visitante.' : err.message);
    } finally { setBusy(false); }
  }
  return <section className={compact ? 'cr01-account-compact' : 'flow-page cr01-account'}>
    {!compact && <h1 className="flow-title">Mi cuenta de cliente</h1>}
    <p>Tu cuenta es independiente del acceso administrativo. También puedes comprar como visitante.</p>
    {customer ? <div className="panel">
      <h2>Hola, {customer.nombre}</h2>
      <p className="muted">{customer.email}{customer.cedula ? ` · Cédula ${customer.cedula}` : ''}</p>
      {!compact && (
        <div className="cr01-account-shortcuts">
          <div className="cr01-shortcut-card">
            <div className="cr01-shortcut-head">
              <ReceiptText size={18} aria-hidden="true" />
              <strong>Historial de compras</strong>
            </div>
            <p className="muted">Revisa todos tus viajes reservados, estado de pago y descarga tus boletos con QR.</p>
            <button type="button" className="button primary" onClick={onHistory}>Consultar mis compras</button>
          </div>
          {onTicket && (
            <div className="cr01-shortcut-card">
              <div className="cr01-shortcut-head">
                <Ticket size={18} aria-hidden="true" />
                <strong>Mi boleto por código</strong>
              </div>
              <p className="muted">Busca una reserva específica por su código, sube un comprobante o imprime tu boleto.</p>
              <button type="button" className="button secondary" onClick={onTicket}>Consultar mi boleto</button>
            </div>
          )}
        </div>
      )}
      <div className="cr01-actions">
        {compact && <button type="button" className="button primary" onClick={onHistory}>Consultar mis compras</button>}
        <button type="button" className="button secondary" onClick={onLogout}>
          <LogOut size={15} aria-hidden="true" /> Cerrar sesión de cliente
        </button>
      </div>
    </div> : <form className="panel" onSubmit={submit}>
      <h2>{register ? 'Crear cuenta de cliente' : 'Iniciar sesión de cliente'}</h2>
      <div className="cr01-fields">
        {register && field('nombre', 'Nombre completo', { autoComplete: 'name', minLength: 3, maxLength: 100 })}
        {register && field('cedula', 'Cédula', { inputMode: 'numeric', maxLength: 10 })}
        {field('email', 'Correo electrónico', { type: 'email', autoComplete: 'email', maxLength: 100 })}
        {field('password', 'Contraseña', { type: 'password', autoComplete: register ? 'new-password' : 'current-password', maxLength: 128 })}
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="cr01-actions"><button className="button primary" disabled={busy}>{busy ? 'Conectando…' : register ? 'Crear mi cuenta' : 'Entrar a mi cuenta'}</button>
        <button type="button" className="button secondary" disabled={busy} onClick={() => { setRegister(value => !value); setError(''); setForm(previous => ({ ...previous, password: '' })); }}>{register ? 'Ya tengo cuenta' : 'Registrarme'}</button></div>
    </form>}
    {!compact && !customer && onHistory && (
      <div className="panel cr01-guest-history">
        <h2>¿Compraste sin cuenta?</h2>
        <p className="muted">
          Puedes consultar tus compras y descargar tus boletos solicitando un enlace temporal a tu correo.
        </p>
        <div className="cr01-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onHistory}>
            Consultar mis compras por correo
          </button>
        </div>
      </div>
    )}
    {onContinue && <button type="button" className="back-link" disabled={busy} onClick={onContinue}>Continuar mi compra</button>}
  </section>;
}
