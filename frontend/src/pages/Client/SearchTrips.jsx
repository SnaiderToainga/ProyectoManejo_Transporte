import CantonAutocomplete from '../../components/CantonAutocomplete.jsx';
import BusDetails from '../../components/BusDetails.jsx';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowRight, BusFront, CalendarDays, ChevronDown, ChevronUp, MapPin, RotateCcw, Search, SlidersHorizontal, Star, Users, X } from 'lucide-react';
import { api, isDemo } from '../../lib/api.js';
import { resolveMediaUrl } from '../../lib/env.js';
import SupportChannels from '../../components/SupportChannels.jsx';
import { supportChannels } from '../../lib/supportChannels.js';
import { calculateSegmentPrice, matchesTrip, money, resolveTripSegment, shortTime, today, travelDate } from '../../lib/format.js';
import { cantonOptions, countAvailableSeats, MAX_PASSENGERS, passengerCount, searchOptions, tripAvailability } from '../../lib/tripSearch.js';

const RouteMap = lazy(() => import('../../components/RouteMap.jsx'));

const initialFilters = () => ({ fecha: today(), origen: '', destino: '', cooperativa: '', desde: '', hasta: '', categoria: '', pasajeros: '1', marca_chasis: '', carroceria: '', tipo_servicio: '' });

function addDays(isoDate, days = 1) {
  const [y, m, d] = String(isoDate || today()).split('-').map(Number);
  if (!y || !m || !d) return today();
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export default function SearchTrips({ onChoose }) {
  const [busDetalle, setBusDetalle] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [query, setQuery] = useState(initialFilters);
  const [trips, setTrips] = useState([]);
  const [cooperatives, setCooperatives] = useState([]);
  const [frequencies, setFrequencies] = useState([]);
  const [catalogTrips, setCatalogTrips] = useState([]);
  const [customSegments, setCustomSegments] = useState({});
  const [openMaps, setOpenMaps] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advancedCount = [filters.marca_chasis, filters.carroceria, filters.desde, filters.hasta].filter(Boolean).length;
  const nextDay = addDays(query.fecha, 1);
  const routes = useMemo(() => [...frequencies, ...catalogTrips], [frequencies, catalogTrips]);
  const origins = useMemo(() => cantonOptions(routes, 'origen'), [routes]);
  const destinations = useMemo(() => cantonOptions(routes, 'destino'), [routes]);
  const chassis = useMemo(() => searchOptions(catalogTrips, 'marca_chasis'), [catalogTrips]);
  const bodyworks = useMemo(() => searchOptions(catalogTrips, 'carroceria'), [catalogTrips]);
  const operators = useMemo(() => searchOptions([
    ...cooperatives, ...catalogTrips.map(trip => ({ nombre: trip.cooperativa_nombre }))
  ], 'nombre'), [cooperatives, catalogTrips]);
  useEffect(() => {
    const controller = new AbortController();
    api.cooperatives(controller.signal).then(rows => { if (!controller.signal.aborted) setCooperatives(rows); }).catch(() => {});
    api.frequencies(controller.signal).then(rows => { if (!controller.signal.aborted) setFrequencies(rows); }).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    setCustomSegments({});
    setOpenMaps({});
    (async () => {
      try {
        const all = await api.trips(query.fecha, controller.signal);
        if (controller.signal.aborted) return;
        setCatalogTrips(all);
        let matching = all.filter(trip => matchesTrip(trip, query));
        matching = await Promise.all(matching.map(async trip => {
          // main publica los totales en una consulta. Compatibilidad con APIs anteriores.
          const published = tripAvailability(trip, query.categoria);
          const available = published ?? countAvailableSeats(await api.seats(trip.programacion_id, controller.signal), query.categoria);
          return { ...trip, disponibles_busqueda: available };
        }));
        matching = matching.filter(trip => trip.disponibles_busqueda >= passengerCount(query.pasajeros));
        matching.sort((a, b) => (b.es_destacada ? 1 : 0) - (a.es_destacada ? 1 : 0));
        if (!controller.signal.aborted) setTrips(matching);
      } catch (err) { if (!controller.signal.aborted) { setTrips([]); setError(err.message); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [query]);
  const change = (event) => {
    const { name, value } = event.target;
    setFilters(previous => {
      const next = { ...previous, [name]: value };
      if (['cooperativa', 'categoria', 'tipo_servicio'].includes(name)) {
        const validPassengers = passengerCount(next.pasajeros);
        const validTimes = !next.desde || !next.hasta || next.desde <= next.hasta;
        if (validPassengers && validTimes) setQuery(next);
      }
      return next;
    });
    setValidation('');
  };

  const swapRoute = () => {
    setFilters(previous => {
      const next = { ...previous, origen: previous.destino, destino: previous.origen };
      if (passengerCount(next.pasajeros) && (!next.desde || !next.hasta || next.desde <= next.hasta)) {
        setQuery(next);
      }
      return next;
    });
    setValidation('');
  };

  const clearAllFilters = () => {
    const next = initialFilters();
    next.fecha = filters.fecha || today();
    setFilters(next);
    setQuery(next);
    setValidation('');
  };

  const activeChips = useMemo(() => {
    const chips = [];
    if (query.origen) chips.push({ key: 'origen', label: `Origen: ${query.origen}`, reset: { origen: '' } });
    if (query.destino) chips.push({ key: 'destino', label: `Destino: ${query.destino}`, reset: { destino: '' } });
    if (query.cooperativa) chips.push({ key: 'cooperativa', label: query.cooperativa, reset: { cooperativa: '' } });
    if (query.categoria) chips.push({ key: 'categoria', label: `Asiento ${query.categoria === 'VIP' ? 'VIP' : 'Normal'}`, reset: { categoria: '' } });
    if (query.tipo_servicio) chips.push({ key: 'tipo_servicio', label: query.tipo_servicio === 'DIRECTO' ? 'Directo' : 'Con paradas', reset: { tipo_servicio: '' } });
    if (query.marca_chasis) chips.push({ key: 'marca_chasis', label: `Chasis: ${query.marca_chasis}`, reset: { marca_chasis: '' } });
    if (query.carroceria) chips.push({ key: 'carroceria', label: `Carrocería: ${query.carroceria}`, reset: { carroceria: '' } });
    if (query.desde || query.hasta) {
      chips.push({ key: 'horario', label: `Horario: ${query.desde || '00:00'}–${query.hasta || '23:59'}`, reset: { desde: '', hasta: '' } });
    }
    if (String(query.pasajeros) !== '1') chips.push({ key: 'pasajeros', label: `${query.pasajeros} pasajeros`, reset: { pasajeros: '1' } });
    return chips;
  }, [query]);

  const removeChip = (chip) => {
    const next = { ...filters, ...chip.reset };
    setFilters(next);
    setQuery(next);
    setValidation('');
  };

  const submit = (event) => {
    event.preventDefault();
    if (!passengerCount(filters.pasajeros)) { setValidation(`Indica entre 1 y ${MAX_PASSENGERS} pasajeros, sin decimales.`); return; }
    if (filters.desde && filters.hasta && filters.desde > filters.hasta) { setValidation('La hora inicial debe ser anterior a la hora final.'); return; }
    setValidation('');
    setQuery({ ...filters });
  };

  const handleSegmentChange = (progId, totalLen, field, val, segment) => {
    const numVal = Number(val);
    setCustomSegments(prev => {
      const current = prev[progId] || { startIdx: segment.startIdx, endIdx: segment.endIdx };
      if (field === 'startIdx') {
        const nextEnd = current.endIdx <= numVal ? Math.min(totalLen - 1, numVal + 1) : current.endIdx;
        return { ...prev, [progId]: { startIdx: numVal, endIdx: nextEnd } };
      }
      return { ...prev, [progId]: { ...current, endIdx: Math.max(current.startIdx + 1, numVal) } };
    });
  };
  return <>
    <section className="hero">
      <div><p className="eyebrow"><span className="status-dot" /> TU PRÓXIMO DESTINO EMPIEZA AQUÍ</p><h1>Menos filas.<br />Más camino.</h1><p className="hero-copy">Encuentra tu viaje, elige tu asiento y lleva<br className="desktop-break" /> tu boleto contigo. Así de sencillo.</p></div>
      <div className="journey-art" aria-hidden="true"><div className="route-line" /><span className="route-stop start">A</span><span className="route-stop end">B</span><div className="art-bus"><BusFront size={68} strokeWidth={1.3} /></div><span className="art-caption">Un asiento. Mil destinos.</span></div>
    </section>
    <form onSubmit={submit} className="search-panel" aria-label="Buscar viajes">
      <div className="search-main">
        <CantonAutocomplete name="origen" label="Origen" value={filters.origen} options={origins} onChange={change} placeholder="¿De dónde sales?" />
        <button
          type="button"
          className="swap-route-btn"
          onClick={swapRoute}
          aria-label="Intercambiar origen y destino"
          title="Intercambiar origen y destino"
        >
          <ArrowLeftRight size={16} aria-hidden="true" />
        </button>
        <CantonAutocomplete name="destino" label="Destino" value={filters.destino} options={destinations} onChange={change} placeholder="¿A dónde vamos?" />
        <label className="search-field-date"><span><CalendarDays size={15} /> Fecha de viaje</span><input name="fecha" type="date" required min={today()} value={filters.fecha} onChange={change} /></label>
        <label><span><Users size={15} /> Pasajeros</span><input name="pasajeros" type="number" required min="1" max={MAX_PASSENGERS} step="1" value={filters.pasajeros} onChange={change} /></label>
        <button className="button primary search-button" disabled={loading}><Search size={18} />{loading ? 'Buscando…' : 'Buscar viajes'}</button>
      </div>
      <div className="search-filters"><span className="filter-heading"><SlidersHorizontal size={16} /> Filtrar por</span>
        <label><span className="sr-only">Cooperativa</span><select aria-label="Cooperativa" name="cooperativa" value={filters.cooperativa} onChange={change}><option value="">Todas las cooperativas</option>{operators.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}</select></label>
        <label><span className="sr-only">Tipo de asiento</span><select aria-label="Tipo de asiento" name="categoria" value={filters.categoria} onChange={change}><option value="">Cualquier asiento</option><option value="NORMAL">Normal</option><option value="VIP">VIP</option></select></label>
        <label><span className="sr-only">Tipo de viaje</span><select aria-label="Tipo de viaje" name="tipo_servicio" value={filters.tipo_servicio} onChange={change}><option value="">Todos los tipos de viaje</option><option value="DIRECTO">Directo</option><option value="PARADAS">Con paradas</option></select></label>
        <div className="search-filter-actions">
          {activeChips.length > 0 && (
            <button type="button" className="clear-filters-btn" onClick={clearAllFilters}>
              <RotateCcw size={13} aria-hidden="true" /> Limpiar todo
            </button>
          )}
          <button
            type="button"
            className={`search-advanced-toggle ${showAdvanced ? 'is-open' : ''}`}
            aria-expanded={showAdvanced}
            aria-controls="filtros-avanzados"
            onClick={() => setShowAdvanced(open => !open)}
          >
            Filtros avanzados{advancedCount > 0 ? ` (${advancedCount})` : ''}
            {showAdvanced ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {activeChips.length > 0 && (
        <div className="active-filters-bar" aria-label="Filtros aplicados">
          <span className="active-filters-title">Activos:</span>
          {activeChips.map(chip => (
            <button
              key={chip.key}
              type="button"
              className="filter-chip"
              onClick={() => removeChip(chip)}
              title={`Quitar filtro ${chip.label}`}
            >
              <span>{chip.label}</span>
              <X size={12} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {showAdvanced && (
        <div id="filtros-avanzados" className="search-filters search-advanced-filters">
          <label><span className="sr-only">Marca de chasis</span><select aria-label="Marca de chasis" name="marca_chasis" value={filters.marca_chasis} onChange={change}><option value="">Cualquier marca de chasis</option>{searchOptions([...chassis.map(marca_chasis => ({ marca_chasis })), { marca_chasis: filters.marca_chasis }], 'marca_chasis').map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span className="sr-only">Carrocería</span><select aria-label="Carrocería" name="carroceria" value={filters.carroceria} onChange={change}><option value="">Cualquier carrocería</option>{searchOptions([...bodyworks.map(carroceria => ({ carroceria })), { carroceria: filters.carroceria }], 'carroceria').map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="time-filter"><span>Desde</span><input type="time" name="desde" value={filters.desde} onChange={change} /></label>
          <label className="time-filter"><span>Hasta</span><input type="time" name="hasta" value={filters.hasta} onChange={change} /></label>
        </div>
      )}
      {showAdvanced && !loading && catalogTrips.length > 0 && (!chassis.length || !bodyworks.length) && <p className="search-help">Los filtros de chasis y carrocería muestran únicamente marcas registradas para los viajes de la fecha consultada.</p>}
      {validation && <p className="inline-error search-help" role="alert">{validation}</p>}
    </form>
    <section className="results" aria-labelledby="results-heading" aria-busy={loading}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">ELIGE CÓMO LLEGAR</p>
          <h2 id="results-heading">Viajes disponibles</h2>
        </div>
        <div className="results-meta">
          {!loading && <span className="results-count-pill">{trips.length} {trips.length === 1 ? 'opción' : 'opciones'}</span>}
          <span className="muted">{travelDate(query.fecha)}</span>
        </div>
      </div>
      <p className="sr-only" role="status">{loading ? 'Consultando viajes' : `${trips.length} viajes encontrados`}</p>
      {error ? <div className="notice error" role="alert"><h3>No pudimos mostrar los viajes</h3><p>{error}</p><button className="button secondary" onClick={() => setQuery({ ...query })}>Reintentar</button>{!isDemo && <a className="text-link" href="?demo=1">Explorar una demostración</a>}</div>
        : loading ? <div className="empty-state">Buscando tu próximo destino…</div>
          : !trips.length ? (
            <div className="empty-state">
              <BusFront size={32} />
              <h3>No hay viajes con estos filtros</h3>
              <p>
                {catalogTrips.length === 0
                  ? <>No encontramos salidas programadas para el {travelDate(query.fecha)}. Te sugerimos consultar fechas cercanas como <strong>mañana ({travelDate(nextDay)})</strong>.</>
                  : <>No hay salidas que coincidan con tus filtros actuales. Puedes limpiar los filtros o consultar fechas cercanas como <strong>mañana ({travelDate(nextDay)})</strong>.</>}
              </p>
              <div className="empty-actions">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    const next = { ...filters, fecha: nextDay };
                    setFilters(next);
                    setQuery(next);
                  }}
                >
                  Consultar mañana
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    const next = initialFilters();
                    next.fecha = filters.fecha;
                    setFilters(next);
                    setQuery(next);
                  }}
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          )
            : <><div className="trip-list">{trips.map(trip => {
              const seg = resolveTripSegment(trip, query.origen, query.destino);
              const { itinerary, totalSegments } = seg;
              const custom = customSegments[trip.programacion_id];
              const startIdx = custom?.startIdx !== undefined ? custom.startIdx : seg.startIdx;
              const endIdx = custom?.endIdx !== undefined && custom.endIdx > startIdx ? custom.endIdx : Math.max(startIdx + 1, seg.endIdx);
              const esTramo = startIdx > 0 || endIdx < itinerary.length - 1;
              const tramoOrigen = itinerary[startIdx] || trip.origen;
              const tramoDestino = itinerary[endIdx] || trip.destino;
              const tramoParadas = itinerary.slice(startIdx + 1, endIdx);
              const mapOpen = Boolean(openMaps[trip.programacion_id]);
              const precioFinal = esTramo
                ? calculateSegmentPrice(trip.precio_base, totalSegments, endIdx - startIdx)
                : Number(trip.precio_base);

              return (
                <article className={`trip-card ${trip.es_destacada ? 'is-featured' : ''}`} key={trip.programacion_id}>
                  <div className="operator">
                    {trip.logo_url ? (
                      <img
                        key={`trip-logo-${trip.programacion_id}-${trip.logo_url}`}
                        src={resolveMediaUrl(trip.logo_url)}
                        alt={`Logo ${trip.cooperativa_nombre}`}
                        className="operator-logo"
                        style={{ borderColor: trip.color_distintivo || '#CBD5E1' }}
                        onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div
                        aria-label={`Emblema ${trip.cooperativa_nombre}`}
                        className="operator-emblem"
                        style={{ background: trip.color_distintivo || '#183f3d' }}
                      >
                        {String(trip.cooperativa_nombre || 'CO').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="operator-info">
                      <div className="operator-title-row">
                        <h3>{trip.cooperativa_nombre}</h3>
                        {trip.es_destacada && (
                          <span className="trip-badge-featured">
                            <Star size={11} aria-hidden="true" /> Ruta Destacada
                          </span>
                        )}
                      </div>
                      <div className="operator-unit-row">
                        <span className="unit-pill">Unidad #{trip.numero_disco}</span>
                        <span className="muted">{trip.capacidad} asientos{trip.bus_layout?.pisos === 2 ? ' · 2 Pisos' : ''}</span>
                        <button type="button" className="inline-link trip-details-link" aria-label={`Ver más del bus ${trip.numero_disco}`} onClick={() => setBusDetalle(trip)}>Ver más</button>
                      </div>
                    </div>
                  </div>

                  <div className="trip-route">
                    <strong>{shortTime(trip.hora_salida_programada)}</strong>
                    <div className="trip-route-badges">
                      <span className={`service-type-badge ${String(trip.tipo_servicio || '').toUpperCase() === 'PARADAS' ? 'is-stops' : 'is-direct'}`}>
                        {trip.tipo_servicio || 'Directo'}
                      </span>
                      {esTramo && (
                        <span className="trip-segment-pill">
                          Tramo de {trip.origen} → {trip.destino}
                        </span>
                      )}
                    </div>
                    <div className="trip-route-track">
                      <div className="route-point">
                        <span className="route-dot origin" aria-hidden="true" />
                        <span>{tramoOrigen}</span>
                      </div>
                      <div className="route-connector" aria-hidden="true">
                        <span className="route-line-bar" />
                        <span className="route-stops-caption">
                          {tramoParadas.length > 0 ? `${tramoParadas.length} ${tramoParadas.length === 1 ? 'parada' : 'paradas'}` : 'Directo'}
                        </span>
                      </div>
                      <div className="route-point end">
                        <span className="route-dot dest" aria-hidden="true" />
                        <span>{tramoDestino}</span>
                      </div>
                    </div>
                  </div>

                  <div className="trip-price">
                    <span className="muted">{esTramo ? 'Tarifa tramo' : 'Tarifa base'}</span>
                    <strong>{money(precioFinal)}</strong>
                    {esTramo && (
                      <span className="trip-price-original">
                        Ruta total: {money(trip.precio_base)}
                      </span>
                    )}
                    <button
                      className="button primary trip-choose-btn"
                      onClick={() => onChoose({
                        ...trip,
                        origen: tramoOrigen,
                        destino: tramoDestino,
                        precio_base: precioFinal,
                        ruta_completa_origen: trip.origen,
                        ruta_completa_destino: trip.destino,
                        es_tramo_intermedio: esTramo,
                        pasajeros_solicitados: passengerCount(query.pasajeros),
                        tramo: { inicio: startIdx, fin: endIdx }
                      }, query.categoria)}
                    >
                      Elegir asientos <ArrowRight size={16} />
                    </button>
                    <button
                      type="button"
                      className={`trip-map-toggle ${mapOpen ? 'is-open' : ''}`}
                      aria-expanded={mapOpen}
                      onClick={() => setOpenMaps(prev => ({ ...prev, [trip.programacion_id]: !prev[trip.programacion_id] }))}
                    >
                      <MapPin size={14} aria-hidden="true" />
                      {mapOpen ? 'Ocultar mapa' : 'Ver mapa de ruta'}
                    </button>
                  </div>

                  {itinerary.length > 2 && (
                    <div className="trip-segment-bar">
                      <strong className="trip-segment-title"><MapPin size={13} aria-hidden="true" /> Tramo intermedio:</strong>
                      <label className="trip-segment-select">
                        <span>Subida:</span>
                        <select
                          value={startIdx}
                          onChange={(e) => handleSegmentChange(trip.programacion_id, itinerary.length, 'startIdx', e.target.value, seg)}
                        >
                          {itinerary.slice(0, -1).map((stop, idx) => (
                            <option key={`start-${idx}`} value={idx}>{stop}</option>
                          ))}
                        </select>
                      </label>
                      <span className="trip-segment-arrow" aria-hidden="true">→</span>
                      <label className="trip-segment-select">
                        <span>Bajada:</span>
                        <select
                          value={endIdx}
                          onChange={(e) => handleSegmentChange(trip.programacion_id, itinerary.length, 'endIdx', e.target.value, seg)}
                        >
                          {itinerary.map((stop, idx) => idx > startIdx ? (
                            <option key={`end-${idx}`} value={idx}>{stop}</option>
                          ) : null)}
                        </select>
                      </label>
                      <span className="trip-itinerary-inline">
                        {itinerary.join(' · ')}
                      </span>
                    </div>
                  )}

                  <div className="trip-footer-meta">
                    <div className="trip-badges-primary">
                      <span className="pill-availability">
                        {trip.disponibles_busqueda} disponibles{query.categoria ? ` (${query.categoria === 'VIP' ? 'VIP' : 'Normal'})` : ''} · {query.pasajeros} {Number(query.pasajeros) === 1 ? 'pasajero' : 'pasajeros'}
                      </span>
                      <span className="pill">Normal / VIP</span>
                      {Array.isArray(trip.paradas_intermedias) && trip.paradas_intermedias.length > 0 && (
                        <span className="pill">Paradas: {trip.paradas_intermedias.join(' · ')}</span>
                      )}
                    </div>
                    <div className="trip-specs-line">
                      <span>Resolución ANT: {trip.resolucion_ant || 'No registrada'}</span>
                      <span>Chasis: {trip.marca_chasis || 'No registrado'}</span>
                      <span>Carrocería: {trip.carroceria || 'No registrada'}</span>
                      <span>{trip.tiene_bano_posterior === true ? 'Baño posterior' : trip.tiene_bano_posterior === false ? 'Sin baño posterior' : 'Baño posterior: no registrado'}</span>
                    </div>
                  </div>

                  {mapOpen && (
                    <div className="trip-map-drawer" style={{ gridColumn: '1 / -1' }}>
                      <Suspense fallback={<p className="muted" style={{ margin: '0.5rem 0' }}>Cargando mapa de ruta...</p>}>
                        <RouteMap
                          origen={tramoOrigen}
                          destino={tramoDestino}
                          tipoServicio={trip.tipo_servicio}
                          cooperativa={trip.cooperativa_nombre}
                          numeroDisco={trip.numero_disco}
                          horaSalida={shortTime(trip.hora_salida_programada)}
                          paradasIntermedias={tramoParadas}
                          compact
                        />
                      </Suspense>
                    </div>
                  )}
                </article>
              );
            })}</div>
            {/* Directorio de atención al cliente de las cooperativas mostradas (CR-14) */}
            {(() => {
              const seen = new Set();
              const coops = trips.filter(trip => supportChannels(trip).length && !seen.has(trip.cooperativa_nombre) && seen.add(trip.cooperativa_nombre));
              return coops.length ? <aside className="support-directory" aria-label="Atención al cliente de las cooperativas">
                <h3>¿Necesitas ayuda con tu viaje?</h3>
                {coops.map(trip => <SupportChannels key={trip.cooperativa_nombre} cooperative={trip} title={trip.cooperativa_nombre} compact />)}
              </aside> : null;
            })()}</>}
    </section>
    <div className="how-it-works">{[['01', 'Encuentra tu viaje', 'Compara rutas y horarios.'], ['02', 'Elige tu lugar', 'Un asiento a tu medida.'], ['03', 'Lleva tu boleto', 'Consulta y descarga tu PDF.']].map(([number, title, copy]) => <div key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></div>)}</div>
    {busDetalle && <BusDetails bus={busDetalle} onClose={() => setBusDetalle(null)} />}
  </>;
}
