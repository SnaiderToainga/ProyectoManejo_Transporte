// frontend/src/pages/Client/Checkout.jsx
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, CreditCard, ExternalLink, FileUp, Landmark, LockKeyhole, Mail, Plus, ReceiptText, ShieldCheck, Sparkles, UserCheck, X } from 'lucide-react';
import ReservationTimer from '../../components/ReservationTimer.jsx';
import CustomerAccount from './CustomerAccount.jsx';
import { api, isDemo } from '../../lib/api.js';
import { money, shortTime, travelDate } from '../../lib/format.js';
import { seatPrice, seatCategory } from '../../lib/seats.js';
import { rememberCode, reservationStatus, secondsRemaining } from '../../lib/reservation.js';
import { passengerError, receiptError, validarCedulaEcuador } from '../../lib/validation.js';
import { hostedPaymentUrl } from '../../lib/purchaseFlow.js';
import { discountedPrice } from '../../lib/ticketDetails.js';

const BANK_PROVIDERS = [
  {
    id: 'pichincha',
    name: 'Banco Pichincha',
    accountType: 'Cuenta Transaccional',
    accountNumber: '2207575571',
    holder: 'Cesar Steven Carrasco Manotoa',
    idLabel: 'Cédula',
    idNumber: '0604588871',
    logoSrc: '/banks/pichincha.svg',
  },
  {
    id: 'guayaquil',
    name: 'Banco Guayaquil',
    accountType: 'Cuenta Corriente',
    accountNumber: '0045882190',
    holder: '',
    idLabel: 'RUC',
    idNumber: '1890012345001',
    logoSrc: '/banks/guayaquil.svg',
  },
  {
    id: 'pacifico',
    name: 'Banco del Pacífico',
    accountType: 'Cuenta de Ahorros',
    accountNumber: '1055667788',
    holder: '',
    idLabel: 'RUC',
    idNumber: '1890012345001',
    logoSrc: '/banks/pacifico.png',
  },
  {
    id: 'produbanco',
    name: 'Produbanco',
    accountType: 'Cuenta Corriente',
    accountNumber: '0200514920',
    holder: '',
    idLabel: 'RUC',
    idNumber: '1890012345001',
    logoSrc: '/banks/produbanco.png',
  },
  {
    id: 'bolivariano',
    name: 'Banco Bolivariano',
    accountType: 'Cuenta Corriente',
    accountNumber: '5005231840',
    holder: '',
    idLabel: 'RUC',
    idNumber: '1890012345001',
    logoSrc: '/banks/bolivariano.png',
  },
  {
    id: 'internacional',
    name: 'Banco Internacional',
    accountType: 'Cuenta Corriente',
    accountNumber: '4060912345',
    holder: '',
    idLabel: 'RUC',
    idNumber: '1890012345001',
    logoSrc: '/banks/internacional.png',
  },
];

export function PaymentPanel({ reservation, onUpdate, onDone }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [bank, setBank] = useState(null);
  const [selectedBankId, setSelectedBankId] = useState('pichincha');
  const [method, setMethod] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [copied, setCopied] = useState('');
  const sending = useRef(false);
  const copyTimer = useRef(null);
  const inputRef = useRef(null);
  const status = reservationStatus(reservation, now);

  useEffect(() => () => { clearTimeout(copyTimer.current); }, []);

  const copyText = async (text, kind) => {
    try {
      await navigator.clipboard?.writeText(String(text));
      setCopied(kind);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(''), 2000);
    } catch {}
  };

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
      const result = await api.receipt(reservation.codigo_reserva, file, method);
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

  const payByCard = async () => {
    if (sending.current || paymentUrl) return;
    if (reservationStatus(reservation) !== 'pending') { setNow(Date.now()); return; }
    sending.current = true; setBusy(true); setError('');
    try {
      const result = await api.cardPayment(reservation.codigo_reserva);
      const url = hostedPaymentUrl(result.checkout_url);
      if (!url) throw new Error('La pasarela no devolvió un enlace seguro. No se ha confirmado ningún pago.');
      setPaymentUrl(url);
    } catch (err) {
      setError([404, 501, 503].includes(err.status) ? 'El pago con tarjeta todavía no está disponible. Puedes utilizar depósito o transferencia.' : err.message);
    } finally { sending.current = false; setBusy(false); }
  };

  const statuses = {
    paid: ['Pago registrado', 'Tu boleto está disponible para consultar y descargar. También se envió una copia a tu correo electrónico.'],
    review: ['Comprobante en revisión', 'La cooperativa está validando tu depósito. Cuando sea aprobado, recibirás tu boleto con código QR.'],
    expired: ['Reserva vencida', 'El tiempo terminó. Busca nuevamente tu viaje antes de realizar un pago.'],
    rejected: ['Pago rechazado', 'Contacta a la cooperativa para revisar tu comprobante.'],
    cancelled: ['Reserva cancelada', 'Esta reserva ya no permite enviar comprobantes.'],
    unknown: ['Estado por confirmar', 'Consulta nuevamente o comunícate con la cooperativa.'],
  };

  const paymentOptions = [
    {
      value: 'TRANSFERENCIA',
      label: 'Transferencia bancaria',
      hint: 'Transferencia directa desde tu banca móvil o web · Validación en taquilla',
      Icon: Landmark,
    },
    {
      value: 'DEPOSITO',
      label: 'Depósito bancario',
      hint: 'Depósito en ventanilla o corresponsal no bancario · Validación en taquilla',
      Icon: ReceiptText,
    },
    {
      value: 'TARJETA',
      label: 'Tarjeta de débito o crédito',
      hint: 'Pasarela alojada Stripe Sandbox (USD) · Confirmación automática',
      Icon: CreditCard,
    },
  ];

  const selectMethod = (value) => {
    if (busy) return;
    setMethod(value);
    setError('');
  };

  const selectedBank = BANK_PROVIDERS.find(item => item.id === selectedBankId) || BANK_PROVIDERS[0];
  const resolvedHolder = selectedBank.holder || bank?.nombre || reservation.cooperativa_nombre || 'Cooperativa de Transporte';

  return (
    <div className="payment-panel">
      <div className="cr01-pay-top">
        <div className="reservation-code">
          <div className="cr01-code-row">
            <span>Tu código de reserva</span>
            <button
              type="button"
              className="cr01-copy-btn"
              aria-label="Copiar código de reserva"
              onClick={() => copyText(reservation.codigo_reserva, 'code')}
            >
              {copied === 'code' ? <><Check size={12} aria-hidden="true" /> Copiado</> : <><Copy size={12} aria-hidden="true" /> Copiar</>}
            </button>
          </div>
          <strong>{reservation.codigo_reserva}</strong>
          <p>Guárdalo para consultar tu compra y boletos.</p>
        </div>
        {status === 'pending' && <ReservationTimer expiresAt={reservation.expira_en} onExpire={() => setNow(Date.now())} />}
      </div>
      {status === 'pending' ? (
        <fieldset className="cr01-payment-methods" disabled={busy}>
          <legend className="cr01-pay-legend">Método de pago</legend>
          <div className="cr01-pay-accordion">
            {paymentOptions.map(({ value, label, hint, Icon }) => {
              const active = method === value;
              const radioId = `metodo-${value.toLowerCase()}`;
              return (
                <div key={value} className={`cr01-pay-item ${active ? 'is-selected' : ''}`}>
                  <div
                    className="cr01-pay-row"
                    onClick={(event) => {
                      if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'LABEL') {
                        selectMethod(value);
                      }
                    }}
                  >
                    <input
                      id={radioId}
                      type="radio"
                      name="metodo-pago"
                      className="cr01-pay-radio"
                      checked={active}
                      onChange={() => selectMethod(value)}
                    />
                    <span className="cr01-pay-icon-tile" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <div className="cr01-pay-meta">
                      <label htmlFor={radioId} className="cr01-pay-title">{label}</label>
                      <p className="cr01-pay-hint">{hint}</p>
                    </div>
                    <div className="cr01-pay-badges" aria-hidden="true">
                      {value === 'TARJETA' ? (
                        <>
                          <span className="cr01-brand-chip cr01-visa" title="Visa">
                            <svg width="30" height="10" viewBox="0 0 36 12" fill="none"><text x="1" y="10" fill="#1A1F71" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="11" letterSpacing="-0.5">VISA</text></svg>
                          </span>
                          <span className="cr01-brand-chip cr01-mc" title="Mastercard">
                            <svg width="24" height="14" viewBox="0 0 24 14"><circle cx="9" cy="7" r="6" fill="#EB001B" /><circle cx="15" cy="7" r="6" fill="#F79E1B" fillOpacity="0.88" /></svg>
                          </span>
                          <span className="cr01-instant-pill"><Sparkles size={11} /> Inmediato</span>
                        </>
                      ) : value === 'TRANSFERENCIA' ? (
                        <span className="cr01-subtle-pill">Sin comisión</span>
                      ) : (
                        <span className="cr01-subtle-pill">Ventanilla</span>
                      )}
                    </div>
                  </div>

                  {active && (
                    <div className="cr01-pay-body">
                      {value === 'TARJETA' ? (
                        <div className="cr01-card-payment">
                          <div className="cr01-card-header">
                            <h2>Pago con tarjeta</h2>
                            <span className="cr01-security-pill"><ShieldCheck size={14} aria-hidden="true" /> Pasarela segura · USD</span>
                          </div>
                          <div className="cr01-amount-box">
                            <span>Importe de la reserva</span>
                            <strong>{money(reservation.total)}</strong>
                          </div>
                          <div className="cr01-trust-strip" aria-hidden="true">
                            <span><Check size={13} /> Confirmación automática</span>
                            <span><LockKeyhole size={13} /> Cifrado SSL externo</span>
                            <span><Sparkles size={13} /> Boleto QR al instante</span>
                          </div>
                          <p className="small-copy">Ingresa los datos de tu tarjeta únicamente en la pasarela de pago.</p>
                          {paymentUrl ? (
                            <div className="cr01-gateway-ready">
                              <a className="button primary full-width" href={paymentUrl} target="_blank" rel="noopener noreferrer">
                                Continuar en la pasarela <ExternalLink size={16} aria-hidden="true" />
                              </a>
                              <p className="cr01-gateway-note">
                                <Check size={14} aria-hidden="true" /> Sesión segura generada en Stripe Checkout (checkout.stripe.com).
                              </p>
                            </div>
                          ) : (
                            <button type="button" className="button primary full-width" disabled={busy || isDemo} onClick={payByCard}>
                              {busy ? 'Conectando…' : 'Pagar con tarjeta'}
                            </button>
                          )}
                          <p className="cr01-card-footnote small-copy">
                            <LockKeyhole size={14} aria-hidden="true" /> No almacenamos números de tarjeta ni CVV. El boleto estará disponible cuando la cooperativa confirme el pago. Puedes consultar el estado con tu código de reserva.
                          </p>
                          {isDemo && <p role="status">El pago con tarjeta no está disponible en la demostración.</p>}
                          {error && <p role="alert" className="inline-error">{error}</p>}
                        </div>
                      ) : (
                        <div className="cr01-bank-panel">
                          <div className="cr01-card-header">
                            <h2>Envía tu comprobante</h2>
                            <span className="cr01-security-pill cr01-bank-badge">
                              {method === 'DEPOSITO' ? 'Depósito' : 'Transferencia'} · USD
                            </span>
                          </div>
                          <div className="cr01-amount-box">
                            <span>Total a transferir o depositar</span>
                            <strong>{money(reservation.total)}</strong>
                          </div>
                          <p className="small-copy">
                            Transferencia o depósito por <strong>{money(reservation.total)}</strong> a la cooperativa de tu viaje.
                          </p>
                          {isDemo ? (
                            <div className="notice">
                              <p>Esta es una demostración. Usa un archivo de prueba y no realices una transferencia.</p>
                            </div>
                          ) : (
                            <>
                              <div className="cr01-bank-selector" role="group" aria-label="Selecciona el banco">
                                <span className="cr01-bank-selector-label">Selecciona tu banco</span>
                                <div className="cr01-bank-grid">
                                  {BANK_PROVIDERS.map(provider => {
                                    const picked = provider.id === selectedBank.id;
                                    return (
                                      <button
                                        key={provider.id}
                                        type="button"
                                        className={`cr01-bank-card ${picked ? 'is-selected' : ''}`}
                                        aria-label={provider.name}
                                        title={provider.name}
                                        aria-pressed={picked}
                                        onClick={() => setSelectedBankId(provider.id)}
                                      >
                                        <img
                                          src={provider.logoSrc}
                                          alt={provider.name}
                                          className="cr01-bank-img"
                                          loading="lazy"
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <dl className="bank-details">
                                <div><dt>Banco</dt><dd><strong>{selectedBank.name}</strong></dd></div>
                                <div><dt>Tipo</dt><dd>{selectedBank.accountType}</dd></div>
                                <div>
                                  <dt>Cuenta</dt>
                                  <dd className="cr01-account-copy">
                                    <span>{selectedBank.accountNumber}</span>
                                    <button
                                      type="button"
                                      className="cr01-copy-btn"
                                      aria-label="Copiar número de cuenta"
                                      onClick={() => copyText(selectedBank.accountNumber, 'account')}
                                    >
                                      {copied === 'account' ? <><Check size={12} aria-hidden="true" /> Copiado</> : <><Copy size={12} aria-hidden="true" /> Copiar</>}
                                    </button>
                                  </dd>
                                </div>
                                <div><dt>Titular</dt><dd>{resolvedHolder}</dd></div>
                                <div>
                                  <dt>{selectedBank.idLabel}</dt>
                                  <dd className="cr01-account-copy">
                                    <span>{selectedBank.idNumber}</span>
                                    <button
                                      type="button"
                                      className="cr01-copy-btn"
                                      aria-label={`Copiar ${selectedBank.idLabel}`}
                                      onClick={() => copyText(selectedBank.idNumber, 'id')}
                                    >
                                      {copied === 'id' ? <><Check size={12} aria-hidden="true" /> Copiado</> : <><Copy size={12} aria-hidden="true" /> Copiar</>}
                                    </button>
                                  </dd>
                                </div>
                                {bank?.nombre && selectedBank.id === 'pichincha' && (
                                  <div><dt>Cooperativa</dt><dd>{bank.nombre}</dd></div>
                                )}
                              </dl>

                              <p className="small-copy">
                                Realiza tu {method === 'DEPOSITO' ? 'depósito' : 'transferencia'} y adjunta el comprobante para validación en taquilla.
                              </p>
                            </>
                          )}
                          <form onSubmit={upload} className="receipt-form">
                            <label className="file-field">
                              <FileUp size={26} />
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
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
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

export default function Checkout({ trip, seats, onBack, onConsult, draft, onDraftChange, customer, customerToken, onAccount, onCustomerSession, onCustomerLogout, onHistory, onReserved }) {
  const [passengers, setPassengers] = useState(() =>
    seats.map(seat => draft?.passengers?.find(passenger => passenger.asiento_id === seat.asiento_id) || ({
      asiento_id: seat.asiento_id,
      nombre: '',
      cedula: '',
      tipo_pasajero: 'NORMAL'
    }))
  );
  const [email, setEmail] = useState(draft?.email || '');
  const [lookupMessages, setLookupMessages] = useState({});
  const [lookingUp, setLookingUp] = useState({});
  const [accountModal, setAccountModal] = useState(null);
  const accountDialogRef = useRef(null);
  const lookupControllers = useRef({});
  const automaticLookup = useRef(new Set());
  const [reservation, setReservation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    const dialog = accountDialogRef.current;
    if (!dialog) return;
    if (accountModal && !dialog.open) dialog.showModal();
    if (!accountModal && dialog.open) dialog.close();
  }, [accountModal]);
  useEffect(() => { onDraftChange?.({ email, passengers }); }, [email, passengers, onDraftChange]);
  useEffect(() => {
    if (!customer) return;
    setEmail(previous => previous || customer.email || '');
    setPassengers(previous => previous.map((passenger, index) => index === 0 && !passenger.cedula && !passenger.nombre
      ? { ...passenger, nombre: customer.nombre || '', cedula: customer.cedula || '' } : passenger));
  }, [customer]);
  useEffect(() => () => Object.values(lookupControllers.current).forEach(controller => controller.abort()), []);
  const passengerIdentities = passengers.map(passenger => passenger.cedula).join('|');
  useEffect(() => {
    if (!customerToken) return;
    const timer = setTimeout(() => {
      passengers.forEach((passenger, index) => {
        const key = `${index}:${passenger.cedula}`;
        if (validarCedulaEcuador(passenger.cedula) && !automaticLookup.current.has(key)) {
          automaticLookup.current.add(key); lookupPassenger(index, true);
        }
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [customerToken, passengerIdentities]);

  // Función de cálculo con tarifa preferencial (50% de ley para Tercera Edad, Niños y Discapacidad)
  const getPassengerPrice = (seat, tipo) => {
    const base = seatPrice(seat, trip) || 0;
    if (tipo && tipo !== 'NORMAL') {
      return discountedPrice(base, tipo);
    }
    return base;
  };

  const total = seats.reduce((sum, seat, i) => sum + getPassengerPrice(seat, passengers[i]?.tipo_pasajero), 0);

  const updatePassenger = (index, key, value) => {
    lookupControllers.current[index]?.abort();
    setLookingUp(previous => ({ ...previous, [index]: false }));
    setLookupMessages(previous => ({ ...previous, [index]: '' }));
    setPassengers(previous =>
      previous.map((passenger, i) => (i === index ? { ...passenger, [key]: value } : passenger))
    );
  };

  const lookupPassenger = async (index, automatic = false) => {
    const passenger = passengers[index];
    if (!validarCedulaEcuador(passenger.cedula)) {
      setLookupMessages(previous => ({ ...previous, [index]: 'Ingresa primero una cédula ecuatoriana válida.' })); return;
    }
    lookupControllers.current[index]?.abort();
    const controller = new AbortController(); lookupControllers.current[index] = controller;
    setLookingUp(previous => ({ ...previous, [index]: true }));
    try {
      const result = await api.passenger(passenger.cedula, customerToken, controller.signal);
      if (controller.signal.aborted) return;
      if (!result.cliente?.nombre || result.cliente.cedula !== passenger.cedula) throw new Error('No se encontraron datos coincidentes. Puedes ingresarlos manualmente.');
      setPassengers(previous => previous.map((current, i) => i === index && current.cedula === passenger.cedula && current.nombre === passenger.nombre && (!automatic || !current.nombre)
        ? { ...current, nombre: result.cliente.nombre } : current));
      if (index === 0 && typeof result.cliente.email === 'string') setEmail(previous => previous || result.cliente.email);
      // El descuento se confirma por el comprador, no se infiere de la cédula.
      setLookupMessages(previous => ({ ...previous, [index]: 'Nombre precargado. Revisa los datos antes de reservar.' }));
    } catch (err) {
      if (!controller.signal.aborted) setLookupMessages(previous => ({ ...previous, [index]: err.status === 404 ? 'No se encontraron datos disponibles. Puedes ingresarlos manualmente.' : err.message }));
    } finally {
      if (lookupControllers.current[index] === controller) setLookingUp(previous => ({ ...previous, [index]: false }));
    }
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
        ...(trip.tramo && { tramo: trip.tramo }),
        email: email.trim(),
        asientos: seats.map(seat => seat.asiento_id),
        pasajeros: passengers.map((passenger, i) => {
          const tipo = passenger.tipo_pasajero || 'NORMAL';
          const nombreFinal = passenger.nombre.trim();
          return {
            ...passenger,
            nombre: nombreFinal,
            cedula: passenger.cedula.trim(),
            precio: getPassengerPrice(seats[i], tipo)
          };
        })
      }, customerToken);

      if (!result.reserva?.codigo_reserva) {
        throw new Error('No recibimos el código de la reserva. Consulta con la cooperativa antes de reintentar.');
      }

      rememberCode(result.reserva.codigo_reserva);
      onReserved?.();
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
        <div className="panel checkout-panel">
          {reservation ? (
            <PaymentPanel
              key={reservation.codigo_reserva}
              reservation={reservation}
              onUpdate={setReservation}
              onDone={onConsult}
            />
          ) : (
            <form onSubmit={reserve} className="checkout-form">
              {customer ? (
                <div className="cr01-checkout-account is-signed-in">
                  <UserCheck size={18} aria-hidden="true" />
                  <span>
                    Sesión activa: <strong>{customer.nombre}</strong> · Tus datos se completaron automáticamente para el Pasajero 1.
                  </span>
                </div>
              ) : (
                <div className="cr01-checkout-account">
                  <div>
                    <strong>¿Quieres guardar tu historial de boletos?</strong>
                    <p className="muted">
                      Inicia sesión o regístrate para autocompletar tus datos y consultar tus compras cuando quieras, o continúa como visitante.
                    </p>
                  </div>
                  <div className="cr01-checkout-account-actions">
                    <button
                      type="button"
                      className="button primary"
                      disabled={busy}
                      onClick={() => (onCustomerSession ? setAccountModal('login') : onAccount?.())}
                    >
                      Entrar a mi cuenta de cliente
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() => (onCustomerSession ? setAccountModal('register') : onAccount?.())}
                    >
                      Crear cuenta
                    </button>
                  </div>
                </div>
              )}
              {/* Correo de contacto principal */}
              <fieldset className="passenger-fields cr01-email-fieldset">
                <legend>
                  <Mail size={16} className="inline-icon" /> Correo de notificación
                </legend>
                <label className="cr01-span-full">
                  Correo electrónico para recibir los boletos con QR
                  <input
                    type="email"
                    required
                    autoComplete="email"
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
                  <label>
                    Tipo de tarifa / descuento legal
                    <select
                      name={`tipo-${i}`}
                      value={passenger.tipo_pasajero || 'NORMAL'}
                      onChange={event => updatePassenger(i, 'tipo_pasajero', event.target.value)}
                      disabled={busy}
                    >
                      <option value="NORMAL">Tarifa regular (100 %)</option>
                      <option value="TERCERA_EDAD">Tercera edad (50 % de descuento)</option>
                      <option value="NIÑO">Niño / menor de edad (50 % de descuento)</option>
                      <option value="DISCAPACIDAD">Persona con discapacidad (50 % de descuento)</option>
                    </select>
                  </label>
                  <div className="cr01-lookup-cell">
                    <button type="button" className="button secondary cr01-lookup-btn" disabled={busy || lookingUp[i]} onClick={() => lookupPassenger(i)}>
                      {lookingUp[i] ? 'Consultando datos…' : 'Completar por cédula'}
                    </button>
                    {lookupMessages[i] && <p role="status" className="small-copy">{lookupMessages[i]}</p>}
                  </div>
                </fieldset>
              ))}

              <div className="cr01-add-ticket-row">
                <button type="button" className="button secondary" disabled={busy} onClick={onBack}>
                  <Plus size={16} aria-hidden="true" /> Añadir otro boleto
                </button>
                <span className="small-copy">Tus datos actuales se conservarán al elegir un asiento adicional.</span>
              </div>

              <p className="small-copy">
                <LockKeyhole size={13} className="inline-icon" /> Descuentos del 50 % aplicados conforme a la normativa ecuatoriana de transporte. Se valida con la cédula al abordar.
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
            {seats.map((seat, i) => {
              const pPrice = getPassengerPrice(seat, passengers[i]?.tipo_pasajero);
              const isDiscount = passengers[i]?.tipo_pasajero && passengers[i]?.tipo_pasajero !== 'NORMAL';
              return (
                <li key={seat.asiento_id}>
                  <span>
                    Asiento {seat.numero_asiento} · {seatCategory(seat)}
                    {isDiscount && (
                      <span className="pill text-xs ml-1" style={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: 'bold' }}>
                        -50 %
                      </span>
                    )}
                  </span>
                  <strong>{money(pPrice)}</strong>
                </li>
              );
            })}
          </ul>
          <div className="total-row">
            <span>{reservation ? 'Total de la reserva' : 'Total a pagar'}</span>
            <strong>{money(reservation?.total ?? total)}</strong>
          </div>
          <p className="small-copy">
            Tarifas preferenciales del 50 % aplicadas de forma directa. Se requerirá documento habilitante al abordar.
          </p>
          {reservation && (
            <button className="button secondary full-width" onClick={() => onConsult(reservation.codigo_reserva)}>
              Consultar esta reserva
            </button>
          )}
        </aside>
      </div>

      <dialog
        ref={accountDialogRef}
        className="cr01-modal"
        aria-label="Cuenta de cliente"
        onClose={() => setAccountModal(null)}
        onCancel={(event) => { event.preventDefault(); setAccountModal(null); }}
      >
        <div className="cr01-modal-header">
          <h2>Mi cuenta de cliente</h2>
          <button type="button" className="button secondary" aria-label="Cerrar ventana" onClick={() => setAccountModal(null)}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {accountModal && (
          <CustomerAccount
            key={accountModal}
            initialRegister={accountModal === 'register'}
            compact
            customer={customer}
            onSession={onCustomerSession}
            onLogout={onCustomerLogout}
            onHistory={() => { setAccountModal(null); onHistory?.(); }}
            onContinue={() => setAccountModal(null)}
          />
        )}
      </dialog>
    </section>
  );
}
