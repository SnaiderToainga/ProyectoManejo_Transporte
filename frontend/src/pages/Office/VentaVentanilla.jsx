import { useEffect, useRef, useState } from 'react';
import { money, shortTime, today } from '../../lib/format.js';
import { isAvailable, seatPrice, uniqueSeats } from '../../lib/seats.js';
import { passengerError } from '../../lib/validation.js';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const emptyPassenger = () => ({ asiento_id: '', nombre: '', cedula: '', tipo: 'NORMAL' });
const inputClass = 'block w-full rounded border border-gray-300 px-3 py-2';

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(data?.error || 'No se pudo completar la solicitud.');
    error.status = response.status;
    error.occupied = data?.asientos_ocupados;
    throw error;
  }
  return data;
}

function passengerPrice(seat, trip, type) {
  if (!seat || !trip) return null;
  const price = seatPrice(seat, trip);
  return price === null || type === 'NORMAL' ? price : Number((price / 2).toFixed(2));
}

export default function VentaVentanilla() {
  const [date, setDate] = useState(today);
  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState('');
  const [seats, setSeats] = useState([]);
  const [passengers, setPassengers] = useState(() => [emptyPassenger()]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [seatRefresh, setSeatRefresh] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    request(`/viajes?fecha=${encodeURIComponent(date)}`, { signal: controller.signal })
      .then(data => setTrips(data.filter(trip => trip.estado === 'PROGRAMADO')))
      .catch(error => { if (!controller.signal.aborted) setCatalogError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingTrips(false); });
    return () => controller.abort();
  }, [date]);

  useEffect(() => {
    if (!tripId) return;
    const controller = new AbortController();
    request(`/viajes/${encodeURIComponent(tripId)}/asientos`, { signal: controller.signal })
      .then(data => setSeats(uniqueSeats(data).filter(isAvailable)))
      .catch(error => { if (!controller.signal.aborted) setCatalogError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingSeats(false); });
    return () => controller.abort();
  }, [tripId, seatRefresh]);

  const trip = trips.find(item => String(item.programacion_id) === tripId);
  const seatFor = id => seats.find(seat => String(seat.asiento_id) === id);
  const total = passengers.reduce((sum, passenger) => (
    sum + (passengerPrice(seatFor(passenger.asiento_id), trip, passenger.tipo) ?? 0)
  ), 0);

  function changeTrip(value) {
    setTripId(value);
    setSeats([]);
    setPassengers([emptyPassenger()]);
    setLoadingSeats(Boolean(value));
    setCatalogError('');
    setMessage(null);
  }

  function changeDate(value) {
    setDate(value);
    setTrips([]);
    setLoadingTrips(Boolean(value));
    changeTrip('');
  }

  function updatePassenger(index, field, value) {
    setPassengers(current => current.map((passenger, i) => (
      i === index ? { ...passenger, [field]: value } : passenger
    )));
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;

    const details = passengers.map(({ asiento_id, nombre, cedula, tipo }) => ({
      asiento_id: Number(asiento_id),
      nombre: nombre.trim(),
      cedula: cedula.trim(),
      precio: passengerPrice(seatFor(asiento_id), trip, tipo),
    }));
    const error = passengerError(details) || (
      !trip || details.some(item => !item.asiento_id || item.precio === null)
        || new Set(details.map(item => item.asiento_id)).size !== details.length
        ? 'Elige un asiento disponible y distinto para cada pasajero.'
        : ''
    );
    if (error) {
      setMessage({ error });
      return;
    }

    pending.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      const data = await request('/venta-ventanilla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programacion_id: trip.programacion_id,
          pasajeros: details,
          ...(email.trim() && { email: email.trim() }),
        }),
      });
      const code = data.codigo_reserva || data.reserva?.codigo_reserva;
      const saleTotal = data.reserva?.total;
      setMessage({
        success: code
          ? `Venta registrada. Código de reserva: ${code}.${saleTotal != null ? ` Total: ${money(saleTotal)}.` : ''}`
          : 'La API aceptó la venta, pero no devolvió el código de reserva.',
      });
      setPassengers([emptyPassenger()]);
      setEmail('');
      setSeats([]);
      setLoadingSeats(true);
      setSeatRefresh(value => value + 1);
    } catch (error) {
      setMessage({ error: error.message });
      if (error.status === 409) {
        const occupied = new Set((error.occupied || []).map(String));
        setPassengers(current => current.map(passenger => (
          occupied.has(passenger.asiento_id) ? { ...passenger, asiento_id: '' } : passenger
        )));
        setSeats([]);
        setLoadingSeats(true);
        setSeatRefresh(value => value + 1);
      }
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-2 text-2xl font-bold">Venta en Ventanilla</h2>
      <p className="mb-4 text-gray-600">Registra una venta en efectivo. El boleto queda pagado al confirmar.</p>

      <form onSubmit={submit} className="rounded border border-gray-200 bg-white p-6">
        <fieldset disabled={submitting} className="space-y-4">
          <label className="block">
            Fecha del viaje
            <input className={inputClass} type="date" value={date} min={today()} required onChange={event => changeDate(event.target.value)} />
          </label>
          <label className="block">
            Viaje programado
            <select className={inputClass} value={tripId} required disabled={loadingTrips} onChange={event => changeTrip(event.target.value)}>
              <option value="">{loadingTrips ? 'Cargando viajes…' : 'Selecciona un viaje'}</option>
              {trips.map(item => (
                <option key={item.programacion_id} value={item.programacion_id}>
                  {shortTime(item.hora_salida_programada)} · {item.origen} → {item.destino} · Unidad {item.numero_disco}
                </option>
              ))}
            </select>
          </label>
          {date && !loadingTrips && !trips.length && !catalogError && <p>No hay viajes programados para esta fecha.</p>}
          {catalogError && <p role="alert" className="text-red-700">{catalogError}</p>}
          {loadingSeats && <p role="status">Cargando asientos…</p>}
          {trip && !loadingSeats && !seats.length && !catalogError && <p>No hay asientos disponibles.</p>}

          {trip && passengers.map((passenger, index) => (
            <fieldset key={index} className="space-y-2 rounded border border-gray-200 p-3">
              <legend className="font-semibold">Pasajero {index + 1}</legend>
              <label className="block">
                Asiento
                <select className={inputClass} value={passenger.asiento_id} required disabled={loadingSeats} onChange={event => updatePassenger(index, 'asiento_id', event.target.value)}>
                  <option value="">Selecciona un asiento</option>
                  {seats.map(seat => {
                    const id = String(seat.asiento_id);
                    const taken = passengers.some((other, i) => i !== index && other.asiento_id === id);
                    return <option key={id} value={id} disabled={taken}>{seat.numero_asiento} · {seat.categoria}</option>;
                  })}
                </select>
              </label>
              <label className="block">
                Nombre completo
                <input className={inputClass} value={passenger.nombre} required onChange={event => updatePassenger(index, 'nombre', event.target.value)} />
              </label>
              <label className="block">
                Cédula
                <input className={inputClass} value={passenger.cedula} inputMode="numeric" pattern="[0-9]{10}" maxLength={10} required onChange={event => updatePassenger(index, 'cedula', event.target.value)} />
              </label>
              <label className="block">
                Tipo de pasajero
                <select className={inputClass} value={passenger.tipo} onChange={event => updatePassenger(index, 'tipo', event.target.value)}>
                  <option value="NORMAL">Tarifa completa</option>
                  <option value="MENOR">Menor de edad (50 %)</option>
                  <option value="TERCERA_EDAD">Tercera edad (50 %)</option>
                  <option value="DISCAPACIDAD">Persona con discapacidad (50 %)</option>
                </select>
              </label>
              {passengers.length > 1 && (
                <button type="button" className="text-blue-700" onClick={() => setPassengers(current => current.filter((_, i) => i !== index))}>
                  Quitar pasajero {index + 1}
                </button>
              )}
            </fieldset>
          ))}
          {trip && passengers.length < seats.length && (
            <button type="button" className="text-blue-700" onClick={() => setPassengers(current => [...current, emptyPassenger()])}>Añadir pasajero</button>
          )}
          <label className="block">
            Correo para el boleto (opcional)
            <input className={inputClass} type="email" value={email} onChange={event => setEmail(event.target.value)} />
          </label>
          <p className="font-semibold">Total: {money(total)}</p>
          <button type="submit" disabled={!trip || loadingSeats || !seats.length || submitting} className="w-full rounded bg-blue-700 px-3 py-2 font-semibold text-white disabled:opacity-50">
            {submitting ? 'Registrando…' : 'Registrar venta'}
          </button>
        </fieldset>
        {message?.error && <p role="alert" className="mt-4 text-red-700">{message.error}</p>}
        {message?.success && <p role="status" className="mt-4 text-green-800">{message.success}</p>}
      </form>
    </div>
  );
}
