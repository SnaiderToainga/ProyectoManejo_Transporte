import { useEffect, useState } from 'react';
import { Search, Ticket, ArrowLeft, RefreshCw } from 'lucide-react';
import { api, isDemo } from '../../lib/api.js';
import { recalledCode, rememberCode, reservationStatus } from '../../lib/reservation.js';
import { PaymentPanel } from './Checkout.jsx';
import TicketCard from '../../components/TicketCard.jsx';

export default function TicketLookup({ initialCode = '', onBack }) {
  const [input, setInput] = useState(initialCode || recalledCode());
  const [query, setQuery] = useState({ code: initialCode });
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!query.code) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setReservation(null);
    api.reservation(query.code, controller.signal).then(data => {
      if (!controller.signal.aborted) { setReservation(data); rememberCode(data.codigo_reserva); }
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query]);
  const submit = (event) => { event.preventDefault(); setQuery({ code: input.trim().toUpperCase() }); };
  const paid = reservation && reservationStatus(reservation) === 'paid';
  return <section className="flow-page lookup-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Buscar un viaje</button>
    <div className="section-heading"><div><p className="eyebrow">03 / TODO LISTO PARA SALIR</p><h1 className="flow-title">Tu boleto, a la mano.</h1><p className="muted">Consulta tu reserva, completa el pago o descarga tu boleto.</p></div><Ticket size={38} strokeWidth={1.3} /></div>
    <form className="lookup-form panel" onSubmit={submit}><label>Código de reserva<input name="codigo" required maxLength={30} pattern="[A-Za-z0-9-]+" value={input} onChange={event => setInput(event.target.value.toUpperCase())} placeholder="Ej. RES-ABC123" autoComplete="off" spellCheck={false} /></label><button className="button primary" disabled={loading}><Search size={17} />{loading ? 'Consultando…' : 'Consultar reserva'}</button></form>
    {isDemo && <p className="small-copy">Puedes explorar un boleto ficticio con el código <button className="inline-link" onClick={() => { setInput('DEMO-PAGADO'); setQuery({ code: 'DEMO-PAGADO' }); }}>DEMO-PAGADO</button>. Las otras reservas de prueba duran hasta recargar la página.</p>}
    {error && <div className="notice error" role="alert"><h3>No pudimos consultar tu reserva</h3><p>{error}</p><button className="button secondary" onClick={() => setQuery({ ...query })}>Reintentar consulta</button></div>}
    {loading && <p role="status" className="empty-state">Consultando el estado de tu reserva…</p>}
    {reservation && <><div className="lookup-heading"><h2>{paid ? 'Tu viaje está confirmado' : 'Estado de tu reserva'}</h2><button className="button secondary" onClick={() => setQuery({ ...query })}><RefreshCw size={15} />Actualizar estado</button></div>
      {paid ? <>{reservation.boletos?.length ? reservation.boletos.map(ticket => <TicketCard key={ticket.id} reservation={reservation} ticket={ticket} />) : <div className="notice"><p>El pago está registrado, pero todavía no recibimos el detalle de tus boletos. Actualiza el estado o contacta a la cooperativa.</p></div>}</>
        : <div className="panel payment-lookup"><PaymentPanel key={reservation.codigo_reserva} reservation={reservation} onUpdate={setReservation} /></div>}
    </>}
  </section>;
}
