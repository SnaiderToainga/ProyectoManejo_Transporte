import { useEffect, useState } from 'react';
import BusSeatGrid from '../../components/BusSeatGrid.jsx';
import { planningRequest } from '../../lib/planningApi.js';

// CR-01 organiza el acceso a las estructuras; no reemplaza el editor ni las reglas de CR-09.
export default function BusStructures({ buses, user }) {
  const [id, setId] = useState('');
  const [result, setResult] = useState(null);
  const selected = buses.find(bus => String(bus.id) === id);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController(); setResult(null);
    planningRequest(user, `/admin/buses/${encodeURIComponent(id)}/asientos`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) {
        const seats = Array.isArray(data) ? data : data.asientos;
        if (!Array.isArray(seats)) throw new Error('La estructura recibida no es válida.');
        setResult({ seats });
      } })
      .catch(error => { if (!controller.signal.aborted) setResult({ error: [404, 501].includes(error.status) ? 'La estructura no está disponible para consultar.' : error.message }); });
    return () => controller.abort();
  }, [id, user?.token]);
  return <section className="panel">
    <h2>Plantillas y estructuras de buses</h2>
    <p>Consulta la distribución de asientos registrada para cada unidad.</p>
    <label>Unidad para consultar estructura<select value={id} onChange={event => setId(event.target.value)}>
      <option value="">Selecciona una unidad</option>{buses.map(bus => <option key={bus.id} value={bus.id}>Unidad #{bus.numero_disco} · {bus.placa}</option>)}
    </select></label>
    {id && !result && <p role="status">Consultando estructura…</p>}
    {result?.error && <p role="alert" className="inline-error">{result.error}</p>}
    {result?.seats && (result.seats.length ? <div className="seat-map-scroll" role="region" aria-label="Estructura de la unidad" tabIndex={0}>
      <BusSeatGrid capacity={selected?.capacidad} seats={result.seats} selected={[]} disabled />
    </div> : <p>Esta unidad no tiene asientos registrados.</p>)}
  </section>;
}
