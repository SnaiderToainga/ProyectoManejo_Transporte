import { useEffect, useRef, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { formatCountdown, secondsRemaining } from '../lib/reservation.js';

export default function ReservationTimer({ expiresAt, onExpire }) {
  const [remaining, setRemaining] = useState(() => secondsRemaining(expiresAt));
  const callback = useRef(onExpire);
  callback.current = onExpire;
  useEffect(() => {
    let notified = false;
    const tick = () => {
      const seconds = secondsRemaining(expiresAt);
      setRemaining(seconds);
      if (seconds === 0 && !notified) { notified = true; callback.current?.(); }
    };
    tick();
    const interval = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [expiresAt]);
  return <div className={`reservation-timer ${remaining <= 60 ? 'urgent' : ''}`}>
    <Clock3 size={22} /><div><span>{remaining ? 'Tiempo para enviar tu comprobante' : 'El tiempo de reserva terminó'}</span><strong role="timer" aria-label="Tiempo restante de reserva">{formatCountdown(remaining)}</strong></div>
    <span className="sr-only" role="status">{remaining === 0 ? 'Reserva vencida. Selecciona nuevamente tus asientos.' : remaining <= 60 ? 'Queda menos de un minuto.' : 'Reserva temporal activa.'}</span>
  </div>;
}
