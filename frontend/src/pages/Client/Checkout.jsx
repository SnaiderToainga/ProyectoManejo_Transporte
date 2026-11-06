// frontend/src/pages/Client/Checkout.jsx
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, FileUp, LockKeyhole, Mail } from 'lucide-react';
import ReservationTimer from '../../components/ReservationTimer.jsx';
import { api, isDemo } from '../../lib/api.js';
import { money, shortTime, travelDate } from '../../lib/format.js';
import { seatPrice, seatCategory } from '../../lib/seats.js';
import { rememberCode, reservationStatus, secondsRemaining } from '../../lib/reservation.js';
import { passengerError, receiptError } from '../../lib/validation.js';

export function PaymentPanel({ reservation, onUpdate, onDone }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [bank, setBank] = useState(null);
  const sending = useRef(false);
  const inputRef = useRef(null);
  const status = reservationStatus(reservation, now);

  useEffect(() => {
    const controller = new AbortController();
    api.cooperatives(controller.signal)
      .then(rows => {
        if (!controller.signal.aborted) {
          setBank(rows.find(row => row.nombre === reservation.cooperativa_nombre));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [reservation.cooperativa_nombre]);

  useEffect(() => {
    if (!['pending', 'review'].includes(status)) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      api.reservation(reservation.codigo_reserva, controller.signal)
        .then(next => {
          if (!controller.signal.aborted) onUpdate(next);
        })
        .catch(() => {});
    }, 15000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [reservation.codigo_reserva, status, onUpdate]);

  const upload = async (event) => {
    event.preventDefault();
    if (sending.current) return;
    if (reservationStatus(reservation) !== 'pending' || secondsRemaining(reservation.expira_en) === 0) {
      setNow(Date.now());
      setError('Tu reserva venció. Vuelve a elegir tus asientos antes de realizar un pago.');
      return;
    }
    const validation = receiptError(file);
    if (validation) {
      setError(validation);
      return;
    }
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api.receipt(reservation.codigo_reserva, file);
      const next = { ...reservation, ...result.reserva };
      onUpdate(next);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onDone?.(next.codigo_reserva);
    } catch (err) {
      setError(err.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const statuses = {
    paid: ['Pago registrado', 'Tu boleto está disponible para consultar y descargar. También se envió una copia a tu correo electrónico.'],
    review: ['Comprobante en revisión', 'La cooperativa está validando tu depósito. Cuando sea aprobado, recibirás tu boleto con código QR.'],
    expired: ['Reserva vencida', 'El tiempo terminó. Busca nuevamente tu viaje antes de realizar un pago.'],
    rejected: ['Pago rechazado', 'Contacta a la cooperativa para revisar tu comprobante.'],
    cancelled: ['Reserva cancelada', 'Esta reserva ya no permite enviar comprobantes.'],
    unknown: ['Estado por confirmar', 'Consulta nuevamente o comunícate con la cooperativa.'],
  };

  return (
    <div className="payment-panel">
      <div className="reservation-code">
        <span>Tu código de reserva</span>
        <strong>{reservation.codigo_reserva}</strong>
        <p>Guárdalo para consultar tu compra y boletos.</p>
      </div>
      {status === 'pending' ? (
        <>
          <ReservationTimer expiresAt={reservation.expira_en} onExpire={() => setNow(Date.now())} />
          <h2>Envía tu comprobante</h2>
          <p className="small-copy">
            Transferencia o depósito por <strong>{money(reservation.total)}</strong> a la cooperativa de tu viaje.
          </p>
          {isDemo ? (
            <div className="notice">
              <p>Esta es una demostración. Usa un archivo de prueba y no realices una transferencia.</p>
            </div>
          ) : bank?.banco && bank?.cuenta_bancaria ? (
            <dl className="bank-details">
              <div><dt>Beneficiario</dt><dd>{bank.nombre}</dd></div>
              <div><dt>Banco</dt><dd>{bank.banco}</dd></div>
              <div><dt>Cuenta</dt><dd>{bank.cuenta_bancaria}</dd></div>
            </dl>
          ) : (
            <p className="inline-error">
              No tenemos los datos bancarios confirmados. Consúltalos directamente con la cooperativa antes de transferir.
            </p>
          )}
          <form onSubmit={upload} className="receipt-form">
            <label className="file-field">
              <FileUp size={28} />
              <span>Comprobante de pago</span>
              <span className="small-copy">PNG, JPG o PDF · máximo 5 MB</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,application/pdf,.png,.jpg,.jpeg,.pdf"
                disabled={busy}
                onChange={event => {
                  const next = event.target.files?.[0];
                  setFile(next || null);
                  setError(next ? receiptError(next) : '');
                }}
              />
            </label>
            {file && <p className="file-name">{file.name}</p>}
            {error && <p className="inline-error" role="alert">{error}</p>}
            <button className="button primary full-width" disabled={busy || !file || Boolean(receiptError(file))}>
              {busy ? 'Enviando comprobante…' : 'Enviar comprobante'}
              <ArrowRight size={16} />
            </button>
          </form>
        </>
      ) : (
        <div className={`notice ${['expired', 'rejected', 'cancelled'].includes(status) ? 'error' : ''}`} role="status">
          <CheckCircle2 size={25} />
          <h3>{statuses[status][0]}</h3>
          <p>{statuses[status][1]}</p>
          {onDone && (
            <button className="button secondary" onClick={() => onDone(reservation.codigo_reserva)}>
              Consultar mi boleto
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Checkout({ trip, seats, onBack, onConsult }) {
  const [passengers, setPassengers] = useState(() =>
    seats.map(seat => ({ asiento_id: seat.asiento_id, nombre: '', cedula: '' }))
  );
  const [email, setEmail] = useState('');
  const [reservation, setReservation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const submitting = useRef(false);

  const total = seats.reduce((sum, seat) => sum + (seatPrice(seat, trip) || 0), 0);

  const updatePassenger = (index, key, value) => {
    setPassengers(previous =>
      previous.map((passenger, i) => (i === index ? { ...passenger, [key]: value } : passenger))
    );
  };

  const reserve = async (event) => {
    event.preventDefault();
    if (submitting.current) return;

    // Validar datos de pasajeros
    const validation = passengerError(passengers);
    if (validation) {
      setError(validation);
      return;
    }

    // Validar correo de contacto
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Por favor ingresa un correo electrónico válido para recibir tus boletos.');
      return;
    }

    if (seats.some(seat => seatPrice(seat, trip) === null)) {
      setError('La tarifa no está disponible. Vuelve a elegir tu viaje.');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError('');

    try {
      const result = await api.reserve({
        programacion_id: trip.programacion_id,
        email: email.trim(),
        asientos: seats.map(seat => seat.asiento_id),
        pasajeros: passengers.map((passenger, i) => ({
          ...passenger,
          nombre: passenger.nombre.trim(),
          cedula: passenger.cedula.trim(),
          precio: seatPrice(seats[i], trip)
        }))
      });

      if (!result.reserva?.codigo_reserva) {
        throw new Error('No recibimos el código de la reserva. Consulta con la cooperativa antes de reintentar.');
      }

      rememberCode(result.reserva.codigo_reserva);
      setReservation({ ...trip, ...result.reserva });
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) setConflict(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="flow-page">
      {!reservation && (
        <button className="back-link" disabled={busy} onClick={onBack}>
          <ArrowLeft size={17} /> Cambiar asientos
        </button>
      )}

      <div className="section-heading">
        <div>
          <p className="eyebrow">02 / CASI EN CAMINO</p>
          <h1 className="flow-title">{reservation ? 'Tu lugar está reservado.' : '¿Quiénes viajan?'}</h1>
          <p className="muted">
            {reservation
              ? 'Completa el pago dentro del tiempo disponible.'
              : 'Revisa los datos: aparecerán en el boleto de cada pasajero y se enviarán a tu correo.'}
          </p>
        </div>
      </div>

      <div className="flow-layout">
        <div className="panel">
          {reservation ? (
            <PaymentPanel reservation={reservation} onUpdate={setReservation} onDone={onConsult} />
          ) : (
            <form onSubmit={reserve}>
              {/* Sección de correo para notificaciones */}
              <fieldset className="passenger-fields">
                <legend>
                  <Mail size={15} className="inline-icon" /> Datos de Contacto y Envío
                </legend>
                <label>
                  Correo Electrónico (para recibir tus boletos y código QR)
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    disabled={busy}
                    placeholder="ejemplo@correo.com"
                  />
                </label>
              </fieldset>

              {/* Lista de pasajeros por asiento */}
              {passengers.map((passenger, i) => (
                <fieldset className="passenger-fields" key={passenger.asiento_id}>
                  <legend>
                    Pasajero {i + 1}
                    <span className="pill">
                      Asiento {seats[i].numero_asiento} · {seatCategory(seats[i])}
                    </span>
                  </legend>
                  <label>
                    Nombre completo
                    <input
                      autoComplete="name"
                      name={`nombre-${i}`}
                      required
                      minLength={3}
                      maxLength={100}
                      value={passenger.nombre}
                      onChange={event => updatePassenger(i, 'nombre', event.target.value)}
                      disabled={busy}
                      placeholder="Como aparece en tu cédula"
                    />
                  </label>
                  <label>
                    Cédula
                    <input
                      name={`cedula-${i}`}
                      inputMode="numeric"
                      required
                      pattern="[0-9]{10}"
                      maxLength={10}
                      title="Ingresa los 10 dígitos de la cédula"
                      value={passenger.cedula}
                      onChange={event => updatePassenger(i, 'cedula', event.target.value)}
                      disabled={busy}
                      placeholder="10 dígitos"
                    />
                  </label>
                </fieldset>
              ))}

              <p className="small-copy">
                <LockKeyhole size={13} className="inline-icon" /> Tus datos se utilizan para emitir los boletos de esta reserva.
              </p>

              {error && <p role="alert" className="inline-error">{error}</p>}

              {conflict ? (
                <button type="button" className="button secondary" onClick={onBack}>
                  Actualizar y elegir otros asientos
                </button>
              ) : (
                <button className="button primary full-width" disabled={busy}>
                  {busy ? 'Reservando…' : 'Reservar por 5 minutos'}
                  <ArrowRight size={17} />
                </button>
              )}
            </form>
          )}
        </div>

        <aside className="panel summary">
          <p className="eyebrow">RESUMEN DEL VIAJE</p>
          <h2>
            {trip.origen}
            <span className="summary-arrow">↓</span>
            {trip.destino}
          </h2>
          <p>{trip.cooperativa_nombre}</p>
          <p>
            {travelDate(trip.fecha_viaje)} · {shortTime(trip.hora_salida_programada)}
          </p>
          <hr />
          <ul className="selected-seats">
            {seats.map(seat => (
              <li key={seat.asiento_id}>
                <span>
                  Asiento {seat.numero_asiento} · {seatCategory(seat)}
                </span>
                <strong>{money(seatPrice(seat, trip))}</strong>
              </li>
            ))}
          </ul>
          <div className="total-row">
            <span>{reservation ? 'Total de la reserva' : 'Total base'}</span>
            <strong>{money(reservation?.total ?? total)}</strong>
          </div>
          <p className="small-copy">
            Si necesitas una tarifa preferencial que no aparece en línea, consúltala en taquilla antes de reservar.
          </p>
          {reservation && (
            <button className="button secondary full-width" onClick={() => onConsult(reservation.codigo_reserva)}>
              Consultar esta reserva
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}