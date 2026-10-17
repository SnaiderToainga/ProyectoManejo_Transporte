import { useEffect, useState } from 'react';
import { Download, BusFront } from 'lucide-react';
import { api, isDemo } from '../lib/api.js';
import { money, shortTime, travelDate } from '../lib/format.js';

export default function TicketCard({ reservation, ticket }) {
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(JSON.stringify({
      reserva: reservation.codigo_reserva, boleto_id: ticket.id,
      asiento: ticket.numero_asiento, cedula: ticket.cedula_pasajero,
    }), { width: 200, margin: 2 })).then(data => { if (active) setQr(data); }).catch(() => { if (active) setError('No se pudo mostrar el QR. Descarga el PDF para obtenerlo.'); });
    return () => { active = false; };
  }, [reservation.codigo_reserva, ticket.id, ticket.numero_asiento, ticket.cedula_pasajero]);
  const download = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const blob = await api.ticket(reservation.codigo_reserva, ticket.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `boleto-${reservation.codigo_reserva}-${ticket.numero_asiento}.pdf`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <article className="ticket-card">
    <div className="ticket-heading"><BusFront size={22} /><span>{reservation.cooperativa_nombre}</span><strong>{reservation.codigo_reserva}</strong></div>
    <div className="ticket-body"><div><p className="eyebrow">BOLETO DE VIAJE</p><h2>{reservation.origen} → {reservation.destino}</h2><p>{travelDate(reservation.fecha_viaje)} · {shortTime(reservation.hora_salida_programada)}</p><dl className="ticket-details"><div><dt>Pasajero</dt><dd>{ticket.nombre_pasajero}</dd></div><div><dt>Cédula</dt><dd>{ticket.cedula_pasajero}</dd></div><div><dt>Asiento</dt><dd>{ticket.numero_asiento} · {ticket.categoria}</dd></div><div><dt>Tarifa</dt><dd>{money(ticket.precio)}</dd></div></dl></div>
      <div className="ticket-qr">{qr ? <img src={qr} width="156" height="156" alt={`Código QR del boleto del asiento ${ticket.numero_asiento}`} /> : <p>Generando QR…</p>}<span>{isDemo ? 'EJEMPLO · NO VÁLIDO PARA VIAJAR' : ticket.validado_en_puerta ? 'BOLETO YA UTILIZADO' : 'Presenta este QR al abordar'}</span></div>
    </div><div className="ticket-bottom"><span>Unidad {reservation.numero_disco} · Asiento {ticket.numero_asiento}</span>{isDemo ? <span className="small-copy">La descarga PDF requiere una reserva real.</span> : <button className="button primary" onClick={download} disabled={busy}><Download size={16} />{busy ? 'Descargando…' : 'Descargar boleto PDF'}</button>}</div>{error && <p className="inline-error" role="alert">{error}</p>}
  </article>;
}
