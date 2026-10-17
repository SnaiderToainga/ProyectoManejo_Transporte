import { useEffect, useState } from 'react';
import { ArrowRight, BusFront, CalendarDays, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { api, isDemo } from '../../lib/api.js';
import { matchesTrip, money, shortTime, today, travelDate } from '../../lib/format.js';

const initialFilters = () => ({ fecha: today(), origen: '', destino: '', cooperativa: '', desde: '', hasta: '', categoria: '' });

export default function SearchTrips({ onChoose }) {
  const [filters, setFilters] = useState(initialFilters);
  const [query, setQuery] = useState(initialFilters);
  const [trips, setTrips] = useState([]);
  const [cooperatives, setCooperatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api.cooperatives(controller.signal).then(setCooperatives).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    (async () => {
      try {
        const all = await api.trips(query.fecha, controller.signal);
        let matching = all.filter(trip => matchesTrip(trip, query));
        if (query.categoria) {
          const availability = await Promise.all(matching.map(async trip => {
            const seats = await api.seats(trip.programacion_id, controller.signal);
            return seats.some(seat => seat.categoria === query.categoria && seat.estado_ocupacion === 'DISPONIBLE');
          }));
          matching = matching.filter((_, i) => availability[i]);
        }
        if (!controller.signal.aborted) setTrips(matching);
      } catch (err) { if (!controller.signal.aborted) { setTrips([]); setError(err.message); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [query]);
  const change = (event) => setFilters({ ...filters, [event.target.name]: event.target.value });
  const submit = (event) => {
    event.preventDefault();
    if (filters.desde && filters.hasta && filters.desde > filters.hasta) { setError('La hora inicial debe ser anterior a la hora final.'); return; }
    setQuery({ ...filters });
  };
  return <>
    <section className="hero">
      <div><p className="eyebrow"><span className="status-dot" /> TU PRÓXIMO DESTINO EMPIEZA AQUÍ</p><h1>Menos filas.<br />Más camino.</h1><p className="hero-copy">Encuentra tu viaje, elige tu asiento y lleva<br className="desktop-break" /> tu boleto contigo. Así de sencillo.</p></div>
      <div className="journey-art" aria-hidden="true"><div className="route-line" /><span className="route-stop start">A</span><span className="route-stop end">B</span><div className="art-bus"><BusFront size={68} strokeWidth={1.3} /></div><span className="art-caption">Un asiento. Mil destinos.</span></div>
    </section>
    <form onSubmit={submit} className="search-panel" aria-label="Buscar viajes">
      <div className="search-main">
        <label><span><MapPin size={15} /> Origen</span><input name="origen" value={filters.origen} onChange={change} placeholder="¿De dónde sales?" maxLength={80} /></label>
        <label><span><MapPin size={15} /> Destino</span><input name="destino" value={filters.destino} onChange={change} placeholder="¿A dónde vamos?" maxLength={80} /></label>
        <label><span><CalendarDays size={15} /> Fecha de viaje</span><input name="fecha" type="date" required min={today()} value={filters.fecha} onChange={change} /></label>
        <button className="button primary search-button" disabled={loading}><Search size={18} />{loading ? 'Buscando…' : 'Buscar viajes'}</button>
      </div>
      <div className="search-filters"><span className="filter-heading"><SlidersHorizontal size={16} /> Filtrar por</span>
        <label><span className="sr-only">Cooperativa</span><select aria-label="Cooperativa" name="cooperativa" value={filters.cooperativa} onChange={change}><option value="">Todas las cooperativas</option>{cooperatives.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></label>
        <label><span className="sr-only">Tipo de asiento</span><select aria-label="Tipo de asiento" name="categoria" value={filters.categoria} onChange={change}><option value="">Cualquier asiento</option><option value="NORMAL">Normal</option><option value="VIP">VIP</option></select></label>
        <label className="time-filter"><span>Desde</span><input type="time" name="desde" value={filters.desde} onChange={change} /></label>
        <label className="time-filter"><span>Hasta</span><input type="time" name="hasta" value={filters.hasta} onChange={change} /></label>
      </div>
    </form>
    <section className="results" aria-labelledby="results-heading" aria-busy={loading}>
      <div className="section-heading"><div><p className="eyebrow">ELIGE CÓMO LLEGAR</p><h2 id="results-heading">Viajes disponibles</h2></div><span className="muted">{travelDate(query.fecha)}</span></div>
      <p className="sr-only" role="status">{loading ? 'Consultando viajes' : `${trips.length} viajes encontrados`}</p>
      {error ? <div className="notice error" role="alert"><h3>No pudimos mostrar los viajes</h3><p>{error}</p><button className="button secondary" onClick={() => setQuery({ ...query })}>Reintentar</button>{!isDemo && <a className="text-link" href="?demo=1">Explorar una demostración</a>}</div>
        : loading ? <div className="empty-state">Buscando tu próximo destino…</div>
          : !trips.length ? <div className="empty-state"><BusFront size={32} /><h3>No hay viajes con estos filtros</h3><p>Prueba otra fecha, ruta u horario.</p><button className="button secondary" onClick={() => { const next = initialFilters(); next.fecha = filters.fecha; setFilters(next); setQuery(next); }}>Limpiar filtros</button></div>
            : <div className="trip-list">{trips.map(trip => <article className="trip-card" key={trip.programacion_id}>
              <div className="operator"><span className="operator-icon"><BusFront size={23} /></span><div><h3>{trip.cooperativa_nombre}</h3><span className="muted">Unidad {trip.numero_disco} · {trip.capacidad} asientos</span></div></div>
              <div className="trip-route"><strong>{shortTime(trip.hora_salida_programada)}</strong><span>{trip.origen}</span><ArrowRight size={22} className="route-arrow" /><span>{trip.destino}</span></div>
              <div className="trip-tags"><span>{trip.tiene_bano_posterior ? 'Baño a bordo' : 'Fila posterior continua'}</span><span>Normal / VIP</span></div>
              <div className="trip-price"><span className="muted">Tarifa base</span><strong>{money(trip.precio_base)}</strong><button className="button primary" onClick={() => onChoose(trip, query.categoria)}>Elegir asientos <ArrowRight size={16} /></button></div>
            </article>)}</div>}
    </section>
    <div className="how-it-works">{[['01', 'Encuentra tu viaje', 'Compara rutas y horarios.'], ['02', 'Elige tu lugar', 'Un asiento a tu medida.'], ['03', 'Lleva tu boleto', 'Consulta y descarga tu PDF.']].map(([number, title, copy]) => <div key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div>
  </>;
}
