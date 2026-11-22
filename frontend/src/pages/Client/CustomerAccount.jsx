import { useState } from 'react';
import { api } from '../../lib/api.js';
import { validarCedulaEcuador, validarPassword } from '../../lib/validation.js';

export default function CustomerAccount({ customer, onSession, onLogout, onHistory, onContinue }) {
  const [register, setRegister] = useState(false);
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
  return <section className="flow-page cr01-account">
    <h1 className="flow-title">Mi cuenta de cliente</h1>
    <p>Tu cuenta es independiente del acceso administrativo. También puedes comprar como visitante.</p>
    {customer ? <div className="panel">
      <h2>Hola, {customer.nombre}</h2><p>{customer.email}</p>
      <div className="cr01-actions"><button type="button" className="button primary" onClick={onHistory}>Consultar mis compras</button>
        <button type="button" className="button secondary" onClick={onLogout}>Cerrar sesión de cliente</button></div>
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
    {onContinue && <button type="button" className="back-link" disabled={busy} onClick={onContinue}>Continuar mi compra</button>}
  </section>;
}
