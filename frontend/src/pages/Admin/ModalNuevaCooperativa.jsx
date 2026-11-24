import { useState } from 'react';
import {
  Building2,
  Palette,
  UserCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Copy,
  Check
} from 'lucide-react';
import { cooperativeDraft, cooperativeErrors, cooperativePayload, safeImageUrl } from '../../lib/cooperativeForm.js';
import { diagnosticarRucEcuador, validarCedulaEcuador } from '../../lib/validation.js';
import Modal from '../../components/Modal.jsx';
import ImageUploadControl from '../../components/ImageUploadControl.jsx';

const steps = [
  { label: 'Cooperativa', icon: Building2 },
  { label: 'Marca y banco', icon: Palette },
  { label: 'Gerente asignado', icon: UserCheck },
  { label: 'Confirmación', icon: CheckCircle2 }
];
const banks = ['Banco Pichincha', 'Banco del Pacífico', 'Banco de Guayaquil', 'Produbanco', 'Cooperativa Mushuc Runa'];

function suggestManagerEmail(coopName = '') {
  const slug = String(coopName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(cooperativa|de|transportes|transporte|flota|express|expreso|sa|cia|ltda)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);
  return `gerente@${slug || 'cooperativa'}.com`;
}

function generateSecurePassword(coopName = '') {
  const prefix = String(coopName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 4);
  const cleanPrefix = prefix
    ? prefix[0].toUpperCase() + prefix.slice(1).toLowerCase()
    : 'Coop';
  const rand = Math.floor(10 + Math.random() * 89);
  return `${cleanPrefix}2026*${rand}`;
}

export default function ModalNuevaCooperativa({ isOpen, onClose, onGuardar, cooperativa = null, user = null }) {
  const [form, setForm] = useState(() => cooperativeDraft(cooperativa || {}));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [otherBank, setOtherBank] = useState(!banks.includes(form.banco));
  const [showPwd, setShowPwd] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const editing = Boolean(cooperativa);
  if (!isOpen) return null;

  const NUMERIC_FIELDS = {
    ruc: 13,
    telefono: 10,
    cuenta_bancaria: 30,
    gerente_cedula: 10,
    gerente_telefono: 10
  };

  const rucCheck = form.ruc ? diagnosticarRucEcuador(form.ruc) : null;
  const cedulaClean = String(form.gerente_cedula || '').trim();
  const cedulaValida = cedulaClean.length === 10 && validarCedulaEcuador(cedulaClean);

  const brandColor = /^#[0-9a-f]{6}$/i.test(form.color_distintivo) ? form.color_distintivo : '#1D4ED8';
  const pwd = form.gerente_password || '';
  const pwdChecks = [
    { ok: pwd.length >= 8, text: '8+ caracteres' },
    { ok: /[A-Z]/.test(pwd), text: 'Mayúscula' },
    { ok: /[a-z]/.test(pwd), text: 'Minúscula' },
    { ok: /[0-9]/.test(pwd), text: 'Número' },
    { ok: /[^a-zA-Z0-9]/.test(pwd), text: 'Símbolo (*@#)' }
  ];

  const change = (key, value) => {
    let nextValue = value;
    if (NUMERIC_FIELDS[key]) {
      nextValue = String(value || '').replace(/\D/g, '').slice(0, NUMERIC_FIELDS[key]);
    }
    if (key === 'logo_url') setLogoBroken(false);
    setForm(previous => ({ ...previous, [key]: nextValue }));
    setErrors(previous => ({ ...previous, [key]: '' }));
    setError('');
  };

  const field = (key, label, options = {}) => {
    const { hint, ...inputOptions } = options;
    return (
      <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem', fontSize: '0.86rem', fontWeight: 600, color: '#1E293B' }}>
        <span>{label}</span>
        <input
          name={key}
          aria-label={label}
          value={form[key]}
          {...inputOptions}
          disabled={busy}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `error-${key}` : undefined}
          onChange={event => change(key, event.target.value)}
          style={{
            padding: inputOptions.type === 'color' ? '0.25rem' : '0.58rem 0.72rem',
            borderRadius: '8px',
            border: `1.5px solid ${errors[key] ? '#DC2626' : '#CBD5E1'}`,
            fontSize: '0.9rem',
            color: '#0F172A',
            background: '#FFFFFF',
            ...(inputOptions.type === 'color' ? { height: '42px', width: '76px', cursor: 'pointer' } : {}),
            ...(inputOptions.style || {})
          }}
        />
        {!errors[key] && hint}
        {errors[key] && <span id={`error-${key}`} className="inline-error" style={{ fontSize: '0.78rem' }}>{errors[key]}</span>}
      </label>
    );
  };

  const validate = current => {
    const next = cooperativeErrors(form, current, editing);
    setErrors(next);
    return !Object.keys(next).length;
  };

  const goToStep = (target) => {
    if (busy || target === step) return;
    if (target < step) {
      setErrors({});
      setStep(target);
      return;
    }
    for (let i = 0; i < target; i++) {
      if (!validate(i)) {
        setStep(i);
        return;
      }
    }
    setStep(target);
  };

  const handleGeneratePwd = () => {
    const generated = generateSecurePassword(form.nombre);
    change('gerente_password', generated);
    setShowPwd(true);
  };

  const handleCopyPwd = () => {
    if (!pwd) return;
    navigator.clipboard?.writeText(pwd).catch(() => {});
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 1800);
  };

  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    if (step < 3) {
      if (validate(step)) {
        // Al entrar al paso de Gerencia por primera vez, sugerimos correo si aún está vacío
        if (step === 1 && !editing && !form.gerente_correo && form.nombre.trim()) {
          setForm(prev => ({
            ...prev,
            gerente_correo: prev.gerente_correo || suggestManagerEmail(prev.nombre),
            gerente_telefono: prev.gerente_telefono || prev.telefono
          }));
        }
        setStep(step + 1);
      }
      return;
    }
    for (let index = 0; index < 3; index++) {
      if (!validate(index)) {
        setStep(index);
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      await onGuardar(cooperativePayload(form, cooperativa));
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar. Tus datos se conservan para reintentar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Editar perfil de cooperativa' : 'Nueva cooperativa con Gerente asignado'}
      onClose={busy ? undefined : onClose}
      wide
    >
      {/* Vista previa en vivo de la identidad institucional */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          padding: '0.85rem 1rem',
          borderRadius: '12px',
          background: `linear-gradient(135deg, ${brandColor}18 0%, #F8FAFC 100%)`,
          border: `1.5px solid ${brandColor}44`,
          marginBottom: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          {safeImageUrl(form.logo_url) && !logoBroken ? (
            <img
              className="cr01-logo"
              src={form.logo_url}
              alt={`Logo de ${form.nombre || 'la cooperativa'}`}
              onError={() => setLogoBroken(true)}
              style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 10, border: `2px solid ${brandColor}`, background: '#fff', margin: 0 }}
            />
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: 10, background: brandColor, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem'
            }}>
              {(form.nombre || 'CO').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>
              {form.nombre.trim() || 'Nombre de la nueva cooperativa'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
              {form.ruc ? `RUC ${form.ruc}` : 'RUC pendiente'} · {form.banco || 'Banco'}
            </div>
          </div>
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
          background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '999px',
          padding: '0.35rem 0.75rem', fontSize: '0.78rem', color: '#0F172A', fontWeight: 600
        }}>
          <UserCheck size={15} color={brandColor} />
          {editing ? (
            <span>Gerente: {cooperativa?.gerente_nombre || cooperativa?.gerente_correo || 'Asignado'}</span>
          ) : form.gerente_nombre.trim() ? (
            <span>Gerente: {form.gerente_nombre} ({form.gerente_correo || 'correo pendiente'})</span>
          ) : (
            <span style={{ color: '#64748B' }}>Gerente se asigna en el Paso 3</span>
          )}
        </div>
      </div>

      {/* Barra interactiva de 4 pasos clicables */}
      <ol
        className="cr01-steps"
        aria-label="Pasos del registro"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '0.5rem',
          listStyle: 'none',
          padding: 0,
          margin: '0 0 1rem'
        }}
      >
        {steps.map(({ label, icon: Icon }, index) => {
          const active = step === index;
          const completed = index < step;
          return (
            <li key={label} aria-current={active ? 'step' : undefined}>
              <button
                type="button"
                onClick={() => goToStep(index)}
                disabled={busy}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem 0.7rem',
                  borderRadius: '10px',
                  border: active ? `2px solid ${brandColor}` : completed ? '1.5px solid #86EFAC' : '1px solid #E2E8F0',
                  background: active ? `${brandColor}14` : completed ? '#F0FDF4' : '#F8FAFC',
                  color: active ? '#0F172A' : completed ? '#166534' : '#64748B',
                  fontWeight: active || completed ? 700 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? brandColor : completed ? '#16A34A' : '#CBD5E1',
                  color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 800
                }}>
                  {completed ? '✓' : index + 1}
                </span>
                <Icon size={14} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <p role="status" style={{ fontSize: '0.82rem', color: '#475569', margin: '0 0 0.75rem' }}>
        Paso {step + 1} de 4: <strong>{steps[step].label}</strong>
      </p>

      <form onSubmit={submit} noValidate>
        <fieldset disabled={busy} className="cr01-fields" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>{steps[step].label}</legend>

          {step === 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
              {field('nombre', 'Nombre de la cooperativa', { maxLength: 150, placeholder: 'Ej. Cooperativa Express Tungurahua' })}
              {field('ruc', 'RUC (13 dígitos, termina en 001)', {
                inputMode: 'numeric',
                maxLength: 13,
                placeholder: 'Ej. 1890012345001 (3.er dígito 9 para cooperativa)',
                hint: form.ruc ? (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: rucCheck?.valido ? '#15803D' : '#B45309' }}>
                    {rucCheck?.valido
                      ? `✓ RUC ecuatoriano válido (${rucCheck.tipo})`
                      : `${form.ruc.length}/13 dígitos · ${rucCheck?.error}`}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 500 }}>
                    Para cooperativas usa 3.er dígito 9 (ej. 1890012345001) o cédula válida + 001.
                  </span>
                )
              })}
              {field('resolucion_ant', 'Resolución ANT', { placeholder: 'ANT-RES-2026-001', maxLength: 30 })}
              {field('telefono', 'Celular de contacto (09...)', { inputMode: 'tel', maxLength: 10, placeholder: '0991234567' })}
              {field('correo', 'Correo institucional de la cooperativa', { type: 'email', maxLength: 100, placeholder: 'info@cooperativa.com' })}
              {field('direccion', 'Dirección de la matriz', { maxLength: 250, placeholder: 'Terminal Terrestre de Ambato' })}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
              <div>
                {field('color_distintivo', 'Color corporativo', { type: 'color' })}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {['#1D4ED8', '#059669', '#DC2626', '#D97706', '#7C3AED', '#0F172A'].map(hex => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => change('color_distintivo', hex)}
                      title={`Usar ${hex}`}
                      style={{
                        width: 24, height: 24, borderRadius: '50%', background: hex,
                        border: form.color_distintivo === hex ? '2.5px solid #0F172A' : '1px solid #CBD5E1',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {field('logo_url', 'URL del logo (opcional)', { type: 'text', maxLength: 2000, placeholder: 'https://…/logo.png o sube una imagen' })}
                <ImageUploadControl
                  user={user}
                  compact
                  disabled={busy}
                  buttonLabel="Subir logo desde tu dispositivo"
                  onUploaded={(urls) => {
                    if (urls[0]) change('logo_url', urls[0]);
                  }}
                />
                {form.logo_url && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => change('logo_url', '')}
                    style={{
                      alignSelf: 'flex-start',
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      color: '#B91C1C',
                      borderRadius: '7px',
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Quitar logo
                  </button>
                )}
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem', fontSize: '0.86rem', fontWeight: 600, color: '#1E293B' }}>
                <span>Entidad bancaria</span>
                <select
                  value={otherBank ? 'OTRO' : form.banco}
                  onChange={event => {
                    const other = event.target.value === 'OTRO';
                    setOtherBank(other);
                    change('banco', other ? '' : event.target.value);
                  }}
                  style={{ padding: '0.58rem 0.72rem', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '0.9rem', background: '#fff', color: '#0F172A' }}
                >
                  {banks.map(bank => <option key={bank}>{bank}</option>)}
                  <option value="OTRO">Otro banco</option>
                </select>
              </label>
              {otherBank && field('banco', 'Nombre del otro banco', { maxLength: 100 })}
              {errors.banco && !otherBank && <p className="inline-error">{errors.banco}</p>}
              {field('cuenta_bancaria', 'Número de cuenta bancaria', { inputMode: 'numeric', maxLength: 30, placeholder: '2200114455' })}
            </div>
          )}

          {step === 2 && (
            editing ? (
              <div style={{
                background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', padding: '1rem',
                display: 'flex', flexDirection: 'column', gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#166534' }}>
                  <ShieldCheck size={18} />
                  <span>Gerente actualmente asignado</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#0F172A' }}>
                  <strong>{cooperativa?.gerente_nombre || 'Gerente registrado'}</strong>
                  {cooperativa?.gerente_correo ? ` · ${cooperativa.gerente_correo}` : ''}
                  {cooperativa?.gerente_telefono ? ` · ${cooperativa.gerente_telefono}` : ''}
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569' }}>
                  La edición del perfil institucional conserva las credenciales y el rol del gerente actual.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{
                  background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '10px', padding: '0.75rem 0.9rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem'
                }}>
                  <div style={{ fontSize: '0.83rem', color: '#1E3A8A' }}>
                    <strong>Asignación directa e integrada:</strong> al finalizar este asistente, la cooperativa y la cuenta de su <strong>Gerente (ADMIN_COOP)</strong> se crean juntas automáticamente. No necesitas ir a «Crear Usuario».
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => change('gerente_correo', suggestManagerEmail(form.nombre))}
                      style={{
                        background: '#FFFFFF', border: '1px solid #93C5FD', color: '#1D4ED8',
                        borderRadius: '8px', padding: '0.32rem 0.65rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      Sugerir correo
                    </button>
                    {form.telefono && (
                      <button
                        type="button"
                        onClick={() => change('gerente_telefono', form.telefono)}
                        style={{
                          background: '#FFFFFF', border: '1px solid #93C5FD', color: '#1D4ED8',
                          borderRadius: '8px', padding: '0.32rem 0.65rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        Usar celular de coop
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                  {field('gerente_nombre', 'Nombre completo del gerente', { maxLength: 100, placeholder: 'Ej. Ing. María Fernanda López' })}
                  {field('gerente_cedula', 'Cédula del gerente (Módulo 10)', {
                    inputMode: 'numeric',
                    maxLength: 10,
                    placeholder: '1801234567',
                    hint: cedulaClean ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: cedulaValida ? '#15803D' : cedulaClean.length === 10 ? '#DC2626' : '#64748B' }}>
                        {cedulaValida
                          ? '✓ Cédula ecuatoriana válida (10 dígitos · Módulo 10)'
                          : cedulaClean.length === 10
                            ? '✕ Tiene 10 dígitos pero el dígito verificador Módulo 10 no coincide.'
                            : `${cedulaClean.length}/10 dígitos`}
                      </span>
                    ) : null
                  })}
                  {field('gerente_correo', 'Correo de acceso del gerente', { type: 'email', autoComplete: 'off', maxLength: 100, placeholder: 'gerente@cooperativa.com' })}
                  {field('gerente_telefono', 'Celular del gerente', { inputMode: 'tel', maxLength: 10, placeholder: '0991234567' })}
                </div>

                {/* Campo de contraseña interactivo con generador y checklist en vivo */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <label htmlFor="gerente-pwd-input" style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1E293B', margin: 0 }}>
                      Contraseña inicial del gerente
                    </label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={handleGeneratePwd}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4338CA',
                          borderRadius: '7px', padding: '0.3rem 0.65rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer'
                        }}
                      >
                        <Sparkles size={13} /> Generar clave segura
                      </button>
                      {pwd && (
                        <button
                          type="button"
                          onClick={handleCopyPwd}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#334155',
                            borderRadius: '7px', padding: '0.3rem 0.6rem', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          {copiedPwd ? <><Check size={13} color="#16A34A" /> Copiada</> : <><Copy size={13} /> Copiar</>}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="gerente-pwd-input"
                      name="gerente_password"
                      aria-label="Contraseña inicial del gerente"
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      maxLength={128}
                      value={form.gerente_password}
                      onChange={e => change('gerente_password', e.target.value)}
                      placeholder="Ej. Coop2026*15"
                      style={{
                        width: '100%', padding: '0.58rem 2.5rem 0.58rem 0.72rem',
                        borderRadius: '8px', border: `1.5px solid ${errors.gerente_password ? '#DC2626' : '#CBD5E1'}`,
                        fontSize: '0.9rem', background: '#FFFFFF', color: '#0F172A'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      title={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      style={{
                        position: 'absolute', right: '0.5rem', background: 'transparent', border: 'none',
                        color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center'
                      }}
                    >
                      {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {errors.gerente_password && <span id="error-gerente_password" className="inline-error" style={{ fontSize: '0.78rem', display: 'block', marginTop: '0.3rem' }}>{errors.gerente_password}</span>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.55rem' }}>
                    {pwdChecks.map(item => (
                      <span
                        key={item.text}
                        style={{
                          fontSize: '0.73rem', fontWeight: 700, padding: '0.18rem 0.55rem', borderRadius: '999px',
                          background: item.ok ? '#DCFCE7' : '#F1F5F9',
                          color: item.ok ? '#166534' : '#64748B',
                          border: `1px solid ${item.ok ? '#86EFAC' : '#E2E8F0'}`
                        }}
                      >
                        {item.ok ? '✓' : '○'} {item.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}

          {step === 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.9rem' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0.95rem' }}>
                <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.9rem', color: '#0F172A' }}>🏢 Cooperativa & Banco</h4>
                <dl className="bank-details" style={{ margin: 0 }}>
                  {[
                    ['Cooperativa', form.nombre],
                    ['RUC', form.ruc],
                    ['Resolución ANT', form.resolucion_ant],
                    ['Contacto', form.telefono],
                    ['Correo institucional', form.correo],
                    ['Dirección', form.direccion],
                    ['Banco', form.banco],
                    ['Cuenta', form.cuenta_bancaria]
                  ].map(([label, value]) => (
                    <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>
                  ))}
                </dl>
              </div>
              <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', padding: '0.95rem' }}>
                <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.9rem', color: '#166534' }}>👤 Gerente que quedará asignado</h4>
                {editing ? (
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#1E293B' }}>
                    Se conserva la cuenta y credenciales del gerente actual ({cooperativa?.gerente_nombre || 'ADMIN_COOP'}).
                  </p>
                ) : (
                  <dl className="bank-details" style={{ margin: 0 }}>
                    {[
                      ['Nombre', form.gerente_nombre],
                      ['Cédula', form.gerente_cedula],
                      ['Correo de login', form.gerente_correo],
                      ['Celular', form.gerente_telefono],
                      ['Rol asignado', 'ADMIN_COOP (Gerente)'],
                      ['Acceso inmediato', 'Listo en #login al guardar']
                    ].map(([label, value]) => (
                      <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          )}
        </fieldset>

        {error && <p role="alert" className="inline-error" style={{ marginTop: '0.75rem' }}>{error}</p>}

        <div className="cr01-actions" style={{ marginTop: '1.15rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {step > 0 && (
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => { setStep(step - 1); setErrors({}); }}
              >
                ← Anterior
              </button>
            )}
            <button className="button primary" disabled={busy}>
              {busy
                ? 'Guardando…'
                : step < 3
                  ? `Siguiente: ${steps[step + 1].label} →`
                  : editing
                    ? 'Guardar perfil'
                    : '✓ Registrar cooperativa y asignar gerente'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
