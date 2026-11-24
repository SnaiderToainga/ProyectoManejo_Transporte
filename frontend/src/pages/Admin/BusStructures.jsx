import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Save, Trash2, BusFront } from 'lucide-react';
import BusSeatGrid from '../../components/BusSeatGrid.jsx';
import BusTemplateDesigner, {
  BUILTIN_BUS_TEMPLATES,
  buildInitialDesign,
  designToApiPayload
} from '../../components/BusTemplateDesigner.jsx';
import { planningRequest } from '../../lib/planningApi.js';

export default function BusStructures({ buses, user, onBusStructureUpdated }) {
  const [templates, setTemplates] = useState(BUILTIN_BUS_TEMPLATES);
  const [design, setDesign] = useState(() => buildInitialDesign(BUILTIN_BUS_TEMPLATES[0]));
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [targetBusId, setTargetBusId] = useState('');
  const [inspectBusId, setInspectBusId] = useState('');
  const [inspectResult, setInspectResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const selectedInspectBus = buses.find((b) => String(b.id) === String(inspectBusId));

  async function refreshTemplates(signal) {
    try {
      const data = await planningRequest(user, '/admin/plantillas', { signal });
      if (!signal?.aborted && Array.isArray(data) && data.length > 0) {
        setTemplates(data);
      }
    } catch {}
  }

  useEffect(() => {
    const controller = new AbortController();
    refreshTemplates(controller.signal);
    return () => controller.abort();
  }, [user?.token]);

  useEffect(() => {
    if (!inspectBusId) {
      setInspectResult(null);
      return;
    }
    const controller = new AbortController();
    setInspectResult(null);
    planningRequest(user, `/admin/buses/${encodeURIComponent(inspectBusId)}/asientos`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          const seats = Array.isArray(data) ? data : data.asientos;
          if (!Array.isArray(seats)) throw new Error('La estructura recibida no es válida.');
          setInspectResult({ seats, layout: data.layout || null });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setInspectResult({ error: error.message || 'No se pudo consultar la estructura.' });
        }
      });
    return () => controller.abort();
  }, [inspectBusId, user?.token]);

  async function handleSaveTemplate() {
    const nombre = templateName.trim() || `${design.plantilla_nombre || 'Plantilla'} (${design.capacidad} plazas)`;
    setBusy(true);
    setFeedback(null);
    try {
      const payload = {
        ...designToApiPayload(design),
        nombre,
        descripcion: templateDesc.trim() || `Diseño de ${design.pisos} piso(s) y ${design.capacidad} asientos.`
      };
      const res = await planningRequest(user, '/admin/plantillas', { method: 'POST', data: payload });
      await refreshTemplates();
      if (res?.plantilla?.id) {
        setDesign((prev) => ({ ...prev, plantilla_id: res.plantilla.id, plantilla_nombre: res.plantilla.nombre }));
      }
      setTemplateName('');
      setTemplateDesc('');
      setFeedback({ ok: true, text: `Plantilla "${nombre}" guardada y lista para reutilizar en cualquier bus.` });
    } catch (err) {
      setFeedback({ ok: false, text: err.message || 'No se pudo guardar la plantilla.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTemplate(tpl) {
    if (tpl.es_sistema) return;
    if (!window.confirm(`¿Eliminar la plantilla personalizada "${tpl.nombre}"?`)) return;
    setBusy(true);
    setFeedback(null);
    try {
      await planningRequest(user, `/admin/plantillas/${encodeURIComponent(tpl.id)}`, { method: 'DELETE' });
      await refreshTemplates();
      setFeedback({ ok: true, text: `Plantilla "${tpl.nombre}" eliminada.` });
    } catch (err) {
      setFeedback({ ok: false, text: err.message || 'No se pudo eliminar la plantilla.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignToBus() {
    if (!targetBusId) {
      setFeedback({ ok: false, text: 'Selecciona primero la unidad a la cual quieres asignar esta estructura.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const payload = designToApiPayload(design);
      const res = await planningRequest(user, `/admin/buses/${encodeURIComponent(targetBusId)}/plantilla`, {
        method: 'POST',
        data: payload
      });
      setFeedback({ ok: true, text: res?.mensaje || 'Estructura asignada exitosamente al bus.' });
      setInspectBusId(String(targetBusId));
      onBusStructureUpdated?.();
    } catch (err) {
      setFeedback({ ok: false, text: err.message || 'No se pudo asignar la estructura a la unidad.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ marginBottom: '4px' }}>Diseñador de Plantillas y Estructuras de Buses</h2>
            <p className="muted" style={{ margin: 0 }}>
              Crea plantillas reutilizables de 1 o 2 pisos, configura asientos VIP más amplios, baños, escaleras y compénsalos automáticamente al final (BUS-11 a BUS-20).
            </p>
          </div>
        </div>

        {/* Catálogo de plantillas reutilizables */}
        <div className="template-cards-grid">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className={`template-chip-card ${design.plantilla_id === tpl.id ? 'is-selected' : ''}`}
            >
              <div className="template-chip-top">
                <strong>{tpl.nombre}</strong>
                <span className="pill">{tpl.pisos === 2 ? '2 Pisos' : '1 Piso'} · {tpl.capacidad} plazas</span>
              </div>
              {tpl.descripcion && <p className="muted" style={{ margin: '4px 0 8px' }}>{tpl.descripcion}</p>}
              <div className="template-chip-actions">
                <button
                  type="button"
                  className="button secondary"
                  style={{ minHeight: '34px', padding: '6px 10px', fontSize: '12px' }}
                  onClick={() => {
                    setDesign(buildInitialDesign(tpl));
                    setFeedback(null);
                  }}
                >
                  <Copy size={13} /> Cargar y adaptar
                </button>
                {!tpl.es_sistema && (
                  <button
                    type="button"
                    className="button secondary"
                    style={{ minHeight: '34px', padding: '6px 10px', fontSize: '12px', color: '#B91C1C' }}
                    disabled={busy}
                    onClick={() => handleDeleteTemplate(tpl)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Lienzo visual interactivo */}
        <BusTemplateDesigner
          templates={templates}
          value={design}
          onChange={setDesign}
        />

        {/* Acciones: Guardar plantilla reutilizable + Asignar a bus */}
        <div className="designer-save-bar">
          <div className="designer-save-card">
            <h3>Guardar como plantilla reutilizable</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <label>
                Nombre de la plantilla
                <input
                  value={templateName}
                  placeholder="Ej. Marcopolo G7 Doble Piso VIP"
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </label>
              <label>
                Descripción breve
                <input
                  value={templateDesc}
                  placeholder="Ej. 16 VIP cama abajo + 40 arriba"
                  onChange={(e) => setTemplateDesc(e.target.value)}
                />
              </label>
            </div>
            <button type="button" className="button secondary" disabled={busy} onClick={handleSaveTemplate}>
              <Save size={15} /> Guardar plantilla reutilizable
            </button>
          </div>

          <div className="designer-save-card">
            <h3>Asignar esta estructura a una unidad</h3>
            <label style={{ marginBottom: '10px' }}>
              Selecciona el bus destino
              <select value={targetBusId} onChange={(e) => setTargetBusId(e.target.value)}>
                <option value="">Selecciona una unidad</option>
                {buses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    Unidad #{bus.numero_disco} · {bus.placa} ({bus.capacidad} asientos)
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button primary" disabled={busy || !targetBusId} onClick={handleAssignToBus}>
              <BusFront size={15} /> Aplicar estructura al bus seleccionado
            </button>
          </div>
        </div>

        {feedback && (
          <p
            role={feedback.ok ? 'status' : 'alert'}
            className={feedback.ok ? 'designer-feedback-ok' : 'inline-error'}
            style={{ marginTop: '14px' }}
          >
            {feedback.ok && <CheckCircle2 size={16} />} {feedback.text}
          </p>
        )}
      </section>

      {/* Vista de verificación real de un bus ya guardado */}
      <section className="panel">
        <h3 style={{ marginBottom: '6px' }}>Verificar mapa publicado de una unidad (Vista del Cliente)</h3>
        <p className="muted" style={{ marginBottom: '12px' }}>
          Comprueba exactamente cómo se muestra la distribución física persistida al pasajero al comprar un boleto.
        </p>
        <label style={{ maxWidth: '420px', marginBottom: '16px' }}>
          Unidad registrada
          <select value={inspectBusId} onChange={(e) => setInspectBusId(e.target.value)}>
            <option value="">Selecciona una unidad para inspeccionar</option>
            {buses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                Unidad #{bus.numero_disco} · {bus.placa} ({bus.capacidad} asientos)
              </option>
            ))}
          </select>
        </label>
        {inspectBusId && !inspectResult && <p role="status">Consultando estructura real…</p>}
        {inspectResult?.error && <p role="alert" className="inline-error">{inspectResult.error}</p>}
        {inspectResult?.seats && (
          inspectResult.seats.length ? (
            <div className="seat-map-scroll overflow-x-auto" role="region" aria-label="Estructura publicada de la unidad" tabIndex={0}>
              <BusSeatGrid
                capacity={selectedInspectBus?.capacidad}
                seats={inspectResult.seats}
                layout={inspectResult.layout}
                tieneBanoPosterior={selectedInspectBus?.tiene_bano_posterior}
                selected={[]}
                disabled
              />
            </div>
          ) : (
            <p>Esta unidad no tiene asientos registrados.</p>
          )
        )}
      </section>
    </div>
  );
}
