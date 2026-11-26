import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import ImageUploadControl from '../../components/ImageUploadControl.jsx';
import BusTemplateDesigner, {
  BUILTIN_BUS_TEMPLATES,
  adjustCapacityPreservingLayout,
  buildInitialDesign,
  designToApiPayload
} from '../../components/BusTemplateDesigner.jsx';
import { safeImageUrl } from '../../lib/cooperativeForm.js';
import { resolveMediaUrl } from '../../lib/env.js';
import { planningRequest } from '../../lib/planningApi.js';

export default function BusForm({ bus, cooperativas, cooperativeId, isManager, user, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    cooperativa_id: cooperativeId || cooperativas[0]?.id || '',
    numero_disco: '',
    placa: '',
    capacidad: 40,
    tiene_bano_posterior: true,
    estado: 'OPERATIVO',
    marca_chasis: '',
    carroceria: '',
    socio_nombre: '',
    ...bus,
    fotos: (Array.isArray(bus?.fotos)
      ? bus.fotos.map((photo) => (typeof photo === 'string' ? photo : photo.url))
      : bus?.foto_url ? [bus.foto_url] : []
    ).join('\n')
  }));

  const [templates, setTemplates] = useState(BUILTIN_BUS_TEMPLATES);
  const [design, setDesign] = useState(() => buildInitialDesign(bus?.layout || BUILTIN_BUS_TEMPLATES[0]));
  const [designDirty, setDesignDirty] = useState(!bus);
  const [showDesigner, setShowDesigner] = useState(!bus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.token) return;
    const controller = new AbortController();
    planningRequest(user, '/admin/plantillas', { signal: controller.signal })
      .then((list) => {
        if (!controller.signal.aborted && Array.isArray(list) && list.length > 0) {
          setTemplates(list);
        }
      })
      .catch(() => {});

    if (bus?.id) {
      planningRequest(user, `/admin/buses/${encodeURIComponent(bus.id)}/asientos`, { signal: controller.signal })
        .then((data) => {
          if (!controller.signal.aborted && Array.isArray(data?.asientos) && data.asientos.length > 0) {
            setDesign(buildInitialDesign(data.layout || { capacidad: bus.capacidad, pisos: 1, columnas: 4 }, data.asientos));
          }
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [bus?.id, user?.token]);

  const change = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (key === 'capacidad') {
      const cap = parseInt(value, 10);
      if (Number.isInteger(cap) && cap >= 1 && cap <= 100) {
        setDesign((prev) => adjustCapacityPreservingLayout(prev, cap));
        setDesignDirty(true);
      }
    }
  };

  const handleDesignChange = (nextDesign) => {
    setDesign(nextDesign);
    setDesignDirty(true);
    setForm((prev) => ({
      ...prev,
      capacidad: nextDesign.capacidad,
      tiene_bano_posterior: (nextDesign.celdasBano || []).length > 0
    }));
  };

  const field = (key, label, options = {}) => (
    <label key={key}>
      {label}
      <input value={form[key] ?? ''} {...options} onChange={(event) => change(key, event.target.value)} />
    </label>
  );

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const photos = form.fotos.split('\n').map((value) => value.trim()).filter(Boolean);
    const targetCap = designDirty ? design.capacidad : Number(form.capacidad);

    if (!Number.isSafeInteger(Number(targetCap)) || Number(targetCap) < 1 || !Number.isSafeInteger(Number(form.numero_disco)) || Number(form.numero_disco) < 1) {
      setError('La capacidad y el número de disco deben ser enteros positivos.');
      return;
    }
    if (photos.some((photo) => !safeImageUrl(photo))) {
      setError('Las fotografías deben usar direcciones HTTP o HTTPS.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        cooperativa_id: Number(isManager ? cooperativeId : form.cooperativa_id),
        numero_disco: Number(form.numero_disco),
        capacidad: Number(targetCap),
        placa: form.placa.trim().toUpperCase(),
        fotos: photos,
        foto_url: photos[0] || '',
        marca_chasis: form.marca_chasis.trim(),
        carroceria: form.carroceria.trim(),
        socio_nombre: form.socio_nombre.trim()
      };

      if (designDirty) {
        const structurePayload = designToApiPayload(design);
        Object.assign(payload, structurePayload, { estructura_personalizada: structurePayload });
      }

      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la unidad.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={bus ? `Editar unidad #${bus.numero_disco}` : 'Registrar nueva unidad y diseñar estructura'} onClose={busy ? undefined : onClose} wide>
      <form onSubmit={submit}>
        <fieldset className="cr01-fields" disabled={busy}>
          <legend>1. Ficha técnica de la unidad</legend>
          {!isManager && (
            <label>
              Cooperativa
              <select required value={form.cooperativa_id} onChange={(event) => change('cooperativa_id', event.target.value)}>
                <option value="">Selecciona una cooperativa</option>
                {cooperativas.map((cooperative) => (
                  <option key={cooperative.id} value={cooperative.id}>{cooperative.nombre}</option>
                ))}
              </select>
            </label>
          )}
          {field('numero_disco', 'Número de disco', { type: 'number', min: 1, step: 1, required: true })}
          {field('placa', 'Placa', { maxLength: 10, required: true })}
          {field('capacidad', 'Cantidad de asientos', { type: 'number', min: 1, max: 100, step: 1, required: true })}
          {field('marca_chasis', 'Marca del chasis', { maxLength: 100, required: true })}
          {field('carroceria', 'Marca de la carrocería', { maxLength: 100, required: true })}
          {field('socio_nombre', 'Socio / propietario', { maxLength: 150 })}
          <label>
            Estado
            <select value={form.estado} onChange={(event) => change('estado', event.target.value)}>
              <option value="OPERATIVO">Operativo</option>
              <option value="MANTENIMIENTO">Mantenimiento</option>
              <option value="PARADA">En parada</option>
            </select>
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <ImageUploadControl
              user={user}
              multiple
              disabled={busy}
              buttonLabel="Subir fotografías del bus desde tu dispositivo"
              onUploaded={(urls) => {
                const current = form.fotos.split('\n').map((v) => v.trim()).filter(Boolean);
                const merged = [...new Set([...current, ...urls])];
                change('fotos', merged.join('\n'));
              }}
            />

            {(() => {
              const photoList = form.fotos.split('\n').map((v) => v.trim()).filter(Boolean);
              if (!photoList.length) return null;
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                  {photoList.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      style={{
                        position: 'relative',
                        width: '92px',
                        height: '66px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid #CBD5E1',
                        background: '#F1F5F9',
                        flexShrink: 0
                      }}
                    >
                      {safeImageUrl(url) ? (
                        <img
                          src={resolveMediaUrl(url)}
                          alt={`Vista previa foto ${idx + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', color: '#DC2626', padding: '4px', textAlign: 'center' }}>
                          URL inválida
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        title="Quitar fotografía"
                        aria-label={`Quitar fotografía ${idx + 1}`}
                        onClick={() => {
                          const next = photoList.filter((_, i) => i !== idx);
                          change('fotos', next.join('\n'));
                        }}
                        style={{
                          position: 'absolute',
                          top: '3px',
                          right: '3px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '999px',
                          border: 'none',
                          background: 'rgba(15, 23, 42, 0.78)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}

            <label>
              Fotografías del bus (una URL por línea)
              <textarea
                rows={2}
                placeholder="Pega una o más URLs (una por línea) o sube imágenes desde tu dispositivo arriba"
                value={form.fotos}
                onChange={(event) => change('fotos', event.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <section className="bus-form-designer-section">
          <div className="bus-form-designer-header">
            <div>
              <h3>2. Diseño físico de asientos (1 o 2 pisos · VIP grandes · Baño WC)</h3>
              <p className="muted" style={{ margin: 0 }}>
                Elige una plantilla base y personaliza asientos VIP más amplios, baños, puertas o mueve posiciones a tu gusto.
              </p>
            </div>
            {bus && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setShowDesigner((prev) => !prev)}
              >
                {showDesigner ? 'Ocultar editor' : 'Modificar estructura del bus'}
              </button>
            )}
          </div>

          {showDesigner && (
            <BusTemplateDesigner
              templates={templates}
              value={design}
              onChange={handleDesignChange}
              compact
            />
          )}
        </section>

        {error && <p role="alert" className="inline-error">{error}</p>}
        <div className="cr01-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Guardando…' : (bus ? 'Guardar cambios' : `Guardar unidad y ${design.capacidad} asientos`)}
          </button>
        </div>
      </form>
    </Modal>
  );
}
