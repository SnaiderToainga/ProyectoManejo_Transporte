import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { money, shortTime, travelDate } from '../../lib/format.js';
import { reservationStatus } from '../../lib/reservation.js';

const labels = {
  paid: 'Pagado', review: 'En revisión', pending: 'Pendiente de pago',
  rejected: 'Rechazado', cancelled: 'Cancelado', expired: 'Vencido', unknown: 'Estado no disponible',
};

export default function HistorialCompras({ token, onClearAccess, onVerBoleto }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [result, setResult] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    api.purchaseHistory(token, controller.signal)
      .then(rows => { if (!controller.signal.aborted) setResult({ token, rows }); })
      .catch(error => { if (!controller.signal.aborted) setResult({ token, error: error.message }); });
    return () => controller.abort();
  }, [token]);

  async function requestLink(event) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setSent(false);
    setSendError('');
    try {
      await api.requestHistoryLink(email.trim());
      setSent(true);
    } catch (error) {
      setSendError(error.message);
    } finally {
      setSending(false);
    }
  }

  const current = result?.token === token ? result : null;
  const visible = current?.rows?.filter(item => {
    const day = String(item.fecha_viaje).slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  });

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-bold">Mis compras y boletos</h1>
      {!token ? (
        <>
          <p>Ingresa el correo que usaste al reservar. Te enviaremos un enlace para consultar tus compras.</p>
          <form onSubmit={requestLink} className="flex flex-wrap items-end gap-3">
            <label className="grow">Correo electrónico
              <input className="block w-full rounded border p-2" type="email" autoComplete="email" maxLength={100} required value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <button className="button primary" disabled={sending}>{sending ? 'Enviando…' : 'Enviar enlace'}</button>
          </form>
          {sent && <p role="status">Revisa tu correo. El enlace vence en 15 minutos.</p>}
          {sendError && <p role="alert">{sendError}</p>}
        </>
      ) : (
        <>
          <button className="button secondary" type="button" onClick={onClearAccess}>Cerrar acceso al historial</button>
          {!current && <p role="status">Buscando tus compras…</p>}
          {current?.error && <p role="alert">{current.error}. Puedes solicitar otro enlace.</p>}
          {current?.rows?.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <label>Viajes desde <input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label>
              <label>Viajes hasta <input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
            </div>
          )}
          {visible?.length === 0 && <p>No encontramos compras para este correo o período.</p>}
          {visible?.map(item => (
            <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border bg-white p-4">
              <div>
                <p>{item.cooperativa_nombre} · {item.codigo_reserva}</p>
                <h2 className="text-xl font-semibold">{item.origen} → {item.destino}</h2>
                <p>{travelDate(item.fecha_viaje)} · {shortTime(item.hora_salida_programada)} · Pasajeros: {item.total_pasajeros}</p>
                <p>{labels[reservationStatus({ ...item, comprobante_url: item.tiene_comprobante })]} · {money(item.total)}</p>
              </div>
              <button type="button" className="button secondary" onClick={() => onVerBoleto(item.codigo_reserva)}>
                {item.estado === 'PAGADO' ? 'Ver boleto' : 'Ver reserva'}
              </button>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
