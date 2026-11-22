import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { safeImageUrl } from '../../lib/cooperativeForm.js';

export default function BusForm({ bus, cooperativas, cooperativeId, isManager, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ cooperativa_id: cooperativeId || cooperativas[0]?.id || '',
    numero_disco: '', placa: '', capacidad: 40, tiene_bano_posterior: true, estado: 'OPERATIVO',
    marca_chasis: '', carroceria: '', socio_nombre: '', ...bus,
    fotos: (Array.isArray(bus?.fotos) ? bus.fotos.map(photo => typeof photo === 'string' ? photo : photo.url) : bus?.foto_url ? [bus.foto_url] : []).join('\n') }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const field = (key, label, options = {}) => <label key={key}>{label}<input value={form[key]} {...options} onChange={event => change(key, event.target.value)} /></label>;
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const photos = form.fotos.split('\n').map(value => value.trim()).filter(Boolean);
    if (!Number.isSafeInteger(Number(form.capacidad)) || Number(form.capacidad) < 1 || !Number.isSafeInteger(Number(form.numero_disco)) || Number(form.numero_disco) < 1) {
      setError('La capacidad y el número de disco deben ser enteros positivos.'); return;
    }
    if (photos.some(photo => !safeImageUrl(photo))) { setError('Las fotografías deben usar direcciones HTTP o HTTPS.'); return; }
    setBusy(true); setError('');
    try {
      await onSave({ ...form, cooperativa_id: Number(isManager ? cooperativeId : form.cooperativa_id),
        numero_disco: Number(form.numero_disco), capacidad: Number(form.capacidad), placa: form.placa.trim().toUpperCase(),
        fotos: photos, foto_url: photos[0] || '', marca_chasis: form.marca_chasis.trim(), carroceria: form.carroceria.trim(), socio_nombre: form.socio_nombre.trim() });
      onClose();
    } catch (err) { setError(err.message || 'No se pudo guardar la unidad.'); }
    finally { setBusy(false); }
  }
  return <Modal title={bus ? 'Editar unidad' : 'Registrar unidad'} onClose={busy ? undefined : onClose}>
    <form onSubmit={submit}>
      <fieldset className="cr01-fields" disabled={busy}>
        <legend>Datos de la unidad</legend>
        {!isManager && <label>Cooperativa<select required value={form.cooperativa_id} onChange={event => change('cooperativa_id', event.target.value)}>
          <option value="">Selecciona una cooperativa</option>{cooperativas.map(cooperative => <option key={cooperative.id} value={cooperative.id}>{cooperative.nombre}</option>)}</select></label>}
        {field('numero_disco', 'Número de disco', { type: 'number', min: 1, step: 1, required: true })}
        {field('placa', 'Placa', { maxLength: 12, required: true })}
        {field('capacidad', 'Cantidad de asientos', { type: 'number', min: 1, step: 1, required: true })}
        {field('marca_chasis', 'Marca del chasis', { maxLength: 100, required: true })}
        {field('carroceria', 'Marca de la carrocería', { maxLength: 100, required: true })}
        {field('socio_nombre', 'Socio / propietario', { maxLength: 150 })}
        <label>Fotografías del bus (una URL por línea)<textarea rows={3} value={form.fotos} onChange={event => change('fotos', event.target.value)} /></label>
        <label>Baño posterior<select value={String(form.tiene_bano_posterior)} onChange={event => change('tiene_bano_posterior', event.target.value === 'true')}><option value="true">Sí</option><option value="false">No</option></select></label>
        <label>Estado<select value={form.estado} onChange={event => change('estado', event.target.value)}><option value="OPERATIVO">Operativo</option><option value="MANTENIMIENTO">Mantenimiento</option></select></label>
      </fieldset>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="cr01-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar unidad'}</button></div>
    </form>
  </Modal>;
}
