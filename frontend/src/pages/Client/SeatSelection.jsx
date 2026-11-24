import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, MapPin, RefreshCw } from 'lucide-react';
import BusSeatGrid, { SeatLegend } from '../../components/BusSeatGrid.jsx';
import { api } from '../../lib/api.js';
import { money, shortTime, travelDate } from '../../lib/format.js';
import { isAvailable, seatCategory, seatPrice, uniqueSeats } from '../../lib/seats.js';

export default function SeatSelection({ trip, initialCategory = '', initialSelectedIds = [], onSelectionChange, onBack, onContinue }) {
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState(initialSelectedIds);
  const [category, setCategory] = useState(initialCategory);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    if (!hasLoadedOnce.current) setLoading(true);
    else setRefreshing(true);

    api.seats(trip.programacion_id, controller.signal).then(rows => {
      if (controller.signal.aborted) return;
      const next = uniqueSeats(rows);
      hasLoadedOnce.current = true;
      setSeats(next);
      setError('');
      setSelected(previous => {
        const remaining = previous.filter(id => next.some(seat => seat.asiento_id === id && isAvailable(seat)));
        if (remaining.length < previous.length) {
          setNotice('Uno de los asientos seleccionados acaba de ser ocupado y se liberó de tu selección.');
        }
        return remaining;
      });
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => controller.abort();
  }, [trip.programacion_id, refresh]);

  useEffect(() => {
    const id = setInterval(() => setRefresh(value => value + 1), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { onSelectionChange?.(selected); }, [selected, onSelectionChange]);

  const resolvedLayout = trip.bus_layout || seats.find(s => s?.bus_layout)?.bus_layout || null;
  const hasTwoFloors = resolvedLayout?.pisos === 2 || seats.some(s => Number(s.piso) === 2);
  const picked = seats.filter(seat => selected.includes(seat.asiento_id));
  const total = picked.reduce((sum, seat) => sum + (seatPrice(seat, trip) || 0), 0);
  const valid = picked.length > 0 && picked.every(seat => seatPrice(seat, trip) !== null);
  const toggle = (seat) => {
    setNotice('');
    setSelected(previous => previous.includes(seat.asiento_id)
      ? previous.filter(id => id !== seat.asiento_id)
      : [...previous, seat.asiento_id]);
  };

  return (
    <section className="flow-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Volver a los viajes</button>
      <div className="section-heading">
        <div>
          <p className="eyebrow">01 / TU LUGAR EN EL CAMINO</p>
          <h1 className="flow-title">Elige dónde viajar.</h1>
          <p className="muted">
            {trip.origen} → {trip.destino} · {trip.cooperativa_nombre}
            {trip.pasajeros_solicitados ? ` · Buscaste para ${trip.pasajeros_solicitados} ${trip.pasajeros_solicitados === 1 ? 'pasajero' : 'pasajeros'}` : ''}
          </p>
        </div>
        <span className="pill">
          Unidad {trip.numero_disco} · {trip.capacidad} asientos{hasTwoFloors ? ' · 2 Pisos' : ''}
        </span>
      </div>
      <div className="flow-layout">
        <div className="panel seat-panel">
          <div className="seat-toolbar">
            <label>
              Tipo de asiento
              <select aria-label="Tipo de asiento" value={category} onChange={event => { setCategory(event.target.value); setSelected([]); }}>
                <option value="">Todos</option>
                <option value="VIP">VIP (Más amplio)</option>
                <option value="NORMAL">Normal</option>
              </select>
            </label>
            <button className="button secondary" disabled={loading || refreshing} onClick={() => setRefresh(value => value + 1)}>
              <RefreshCw size={15} />{loading || refreshing ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          {seats.length ? (
            <>
              <SeatLegend hasTwoFloors={hasTwoFloors} />
              <div className="seat-map-scroll overflow-x-auto" role="region" aria-label="Mapa de asientos" tabIndex={0}>
                <BusSeatGrid
                  capacity={trip.capacidad}
                  seats={seats}
                  layout={resolvedLayout}
                  tieneBanoPosterior={trip.tiene_bano_posterior}
                  selected={selected}
                  category={category}
                  onToggle={toggle}
                  disabled={loading || Boolean(error)}
                  showLegend={false}
                />
              </div>
            </>
          ) : (
            <p role="status">{loading ? 'Consultando los asientos…' : 'No hay un mapa de asientos disponible para este viaje.'}</p>
          )}
        </div>
        <aside className="panel summary">
          <p className="eyebrow">TU VIAJE</p>
          <h2>{trip.origen}<span className="summary-arrow">↓</span>{trip.destino}</h2>
          <p><CalendarDays size={16} />{travelDate(trip.fecha_viaje)}</p>
          <p><Clock3 size={16} />Salida {shortTime(trip.hora_salida_programada)}</p>
          <p><MapPin size={16} />{trip.cooperativa_nombre}</p>
          <hr />
          <h3>Asientos seleccionados</h3>
          {!picked.length ? (
            <p className="muted">Toca un asiento disponible para empezar.</p>
          ) : (
            <ul className="selected-seats">
              {picked.map(seat => (
                <li key={seat.asiento_id}>
                  <span>
                    Asiento {seat.numero_asiento} · {seatCategory(seat)}
                    {hasTwoFloors ? ` (Piso ${seat.piso || 1})` : ''}
                  </span>
                  <strong>{money(seatPrice(seat, trip))}</strong>
                </li>
              ))}
            </ul>
          )}
          <div className="total-row"><span>Total base</span><strong>{money(total)}</strong></div>
          <p className="small-copy">En el siguiente paso podrás aplicar descuentos de Tercera Edad, Discapacidad o Menor de Edad (50 %) para cada pasajero.</p>
          <button className="button primary full-width" disabled={!valid || loading || Boolean(error)} onClick={() => onContinue?.(picked)}>
            Continuar <ArrowRight size={16} />
          </button>
          {!onContinue && <p className="small-copy">Formulario de pasajeros en preparación.</p>}
          <p className="small-copy">La selección todavía no bloquea los asientos. La reserva se confirma al enviar los datos del pasajero.</p>
          {notice && <p role="status" className="inline-error">{notice}</p>}
        </aside>
      </div>
    </section>
  );
}
