import { useState } from 'react';
import { cooperativeDraft, cooperativeErrors, cooperativePayload, safeImageUrl } from '../../lib/cooperativeForm.js';
import Modal from '../../components/Modal.jsx';

const steps = ['Cooperativa', 'Marca y banco', 'Gerencia', 'Confirmación'];
const banks = ['Banco Pichincha', 'Banco del Pacífico', 'Banco de Guayaquil', 'Produbanco', 'Cooperativa Mushuc Runa'];

export default function ModalNuevaCooperativa({ isOpen, onClose, onGuardar, cooperativa = null }) {
  const [form, setForm] = useState(() => cooperativeDraft(cooperativa || {}));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otherBank, setOtherBank] = useState(!banks.includes(form.banco));
  const editing = Boolean(cooperativa);
  if (!isOpen) return null;

  const change = (key, value) => {
    setForm(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: '' })); setError('');
  };
  const field = (key, label, options = {}) => <label key={key}>
    {label}
    <input name={key} aria-label={label} value={form[key]} {...options} disabled={busy}
      aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `error-${key}` : undefined}
      onChange={event => change(key, event.target.value)} />
    {errors[key] && <span id={`error-${key}`} className="inline-error">{errors[key]}</span>}
  </label>;
  const validate = current => {
    const next = cooperativeErrors(form, current, editing); setErrors(next);
    return !Object.keys(next).length;
  };
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    if (step < 3) { if (validate(step)) setStep(step + 1); return; }
    for (let index = 0; index < 3; index++) {
      if (!validate(index)) { setStep(index); return; }
    }
    setBusy(true); setError('');
    try { await onGuardar(cooperativePayload(form, cooperativa)); onClose(); }
    catch (err) { setError(err.message || 'No se pudo guardar. Tus datos se conservan para reintentar.'); }
    finally { setBusy(false); }
  };
  return <Modal title={editing ? 'Editar perfil de cooperativa' : 'Nueva cooperativa'} onClose={busy ? undefined : onClose}>
    <p>{editing ? 'Revisa y actualiza los datos precargados.' : 'Completa los cuatro pasos para registrar la cooperativa y su gerente.'}</p>
    {safeImageUrl(form.logo_url) && <img className="cr01-logo" src={form.logo_url} alt={`Logo de ${form.nombre || 'la cooperativa'}`} />}
    <ol className="cr01-steps" aria-label="Pasos del registro">{steps.map((name, index) => <li key={name} aria-current={step === index ? 'step' : undefined}>
      <span>{index + 1}</span> {name}
    </li>)}</ol>
    <p role="status">Paso {step + 1} de 4: {steps[step]}</p>
    <form onSubmit={submit} noValidate>
      <fieldset disabled={busy} className="cr01-fields">
        <legend>{steps[step]}</legend>
        {step === 0 && <>
          {field('nombre', 'Nombre de la cooperativa', { maxLength: 150 })}
          {field('ruc', 'RUC', { inputMode: 'numeric', maxLength: 13 })}
          {field('resolucion_ant', 'Resolución ANT', { placeholder: 'ANT-RES-2026-001', maxLength: 30 })}
          {field('telefono', 'Celular de contacto', { inputMode: 'tel', maxLength: 10 })}
          {field('correo', 'Correo institucional de la cooperativa', { type: 'email', maxLength: 100 })}
          {field('direccion', 'Dirección de la matriz', { maxLength: 250 })}
        </>}
        {step === 2 && (editing ? <p>La edición del perfil conserva las credenciales y el rol del gerente. Los usuarios se administran desde su módulo correspondiente.</p> : <>
          {field('gerente_nombre', 'Nombre completo del gerente', { maxLength: 100 })}
          {field('gerente_cedula', 'Cédula del gerente', { inputMode: 'numeric', maxLength: 10 })}
          {field('gerente_correo', 'Correo del gerente', { type: 'email', autoComplete: 'off', maxLength: 100 })}
          {field('gerente_telefono', 'Celular del gerente', { inputMode: 'tel', maxLength: 10 })}
          {field('gerente_password', 'Contraseña inicial del gerente', { type: 'password', autoComplete: 'new-password', maxLength: 128 })}
        </>)}
        {step === 1 && <>
          {field('color_distintivo', 'Color corporativo', { type: 'color' })}
          {field('logo_url', 'URL del logo', { type: 'url', maxLength: 2000, placeholder: 'https://…' })}
          <label>Entidad bancaria<select value={otherBank ? 'OTRO' : form.banco} onChange={event => {
            const other = event.target.value === 'OTRO'; setOtherBank(other); change('banco', other ? '' : event.target.value);
          }}>{banks.map(bank => <option key={bank}>{bank}</option>)}<option value="OTRO">Otro banco</option></select></label>
          {otherBank && field('banco', 'Nombre del otro banco', { maxLength: 100 })}
          {errors.banco && !otherBank && <p className="inline-error">{errors.banco}</p>}
          {field('cuenta_bancaria', 'Número de cuenta', { inputMode: 'numeric', maxLength: 30 })}
        </>}
        {step === 3 && <dl className="bank-details">
          {[['Cooperativa', form.nombre], ['RUC', form.ruc], ['Resolución ANT', form.resolucion_ant], ['Contacto', form.telefono],
            ['Dirección', form.direccion], ['Correo institucional', form.correo], ['Banco', form.banco], ['Cuenta', form.cuenta_bancaria],
            ['Gerencia', editing ? 'Conservar usuario y credenciales actuales' : `${form.gerente_nombre} · ${form.gerente_correo}`]].map(([label, value]) =>
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>}
      </fieldset>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="cr01-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
        {step > 0 && <button type="button" className="button secondary" disabled={busy} onClick={() => { setStep(step - 1); setErrors({}); }}>Anterior</button>}
        <button className="button primary" disabled={busy}>{busy ? 'Guardando…' : step < 3 ? 'Siguiente' : editing ? 'Guardar perfil' : 'Registrar cooperativa y gerente'}</button>
      </div>
    </form>
  </Modal>;
}
