import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import TicketCard from './TicketCard.jsx';

export default function OfficeTickets({ code }) {
  const [input, setInput] = useState(code || '');
  const [query, setQuery] = useState({ code });
  const [reservation, setReservation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const section = useRef(null);
  useEffect(() => {
    if (reservation) section.current?.scrollIntoView({ block: 'start' });
  }, [reservation]);
  useEffect(() => {
    if (code) { setInput(code); setQuery({ code }); }
  }, [code]);
  useEffect(() => {
    setReservation(null); setError('');
    if (!query.code) return;
    const controller = new AbortController();
    setBusy(true);
    api.reservation(query.code, controller.signal).then(data => {
      if (!controller.signal.aborted) setReservation(data);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [query]);
  return <section ref={section} className="office-tickets" aria-label="Emisión y reimpresión de boletos">
    <h3>Boletos y reimpresión</h3>
    <p>Al vender, los boletos aparecen aquí. También puedes recuperar una compra anterior con su código.</p>
    <form className="office-ticket-search" onSubmit={event => { event.preventDefault(); setQuery({ code: input.trim().toUpperCase() }); }}>
      <label>Código de reserva<input value={input} onChange={event => setInput(event.target.value)} required maxLength={12} pattern="[A-Za-z0-9-]+" placeholder="TAQ-ABC123" /></label>
      <button className="button secondary" disabled={busy}>Consultar boletos</button>
    </form>
    {busy && <p role="status">Cargando boletos…</p>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {reservation && (reservation.estado === 'PAGADO'
      ? reservation.boletos?.length ? reservation.boletos.map(ticket => <TicketCard key={ticket.id} reservation={reservation} ticket={ticket} />)
        : <p>No hay detalle de boletos. Consulta nuevamente o contacta a la cooperativa.</p>
      : <p role="status">La reserva está {reservation.estado}. Solo se imprimen boletos pagados.</p>)}
    <p className="small-copy">Para imprimir, abre el PDF, selecciona papel de 80 mm y escala real (100 %). Reimprimir conserva el mismo QR y no registra otra venta.</p>
  </section>;
}
