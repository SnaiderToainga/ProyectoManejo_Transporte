import { officeRequest } from '../../lib/officeApi.js';
import { useEffect, useState } from 'react';
import { money, shortTime, travelDate } from '../../lib/format.js';
import { resolveMediaUrl } from '../../lib/env.js';

const getComprobanteUrl = (url) => resolveMediaUrl(url);

const isPdfUrl = (url) => Boolean(url) && /\.pdf(\?|$)/i.test(String(url));

const ValidacionComprobantes = ({ usuario }) => {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedReserva, setSelectedReserva] = useState(null);
  const [receiptState, setReceiptState] = useState('idle');
  const [retryKey, setRetryKey] = useState(0);
  const [error, setError] = useState('');

  const fetchReservas = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await officeRequest(usuario, '/reservas-pendientes');
      if (!Array.isArray(data)) {
        throw new Error('El servicio devolvió una lista de reservas no válida.');
      }
      setReservas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las reservas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservas();
  }, [usuario?.token]);

  const openModal = (reserva) => {
    setSelectedReserva(reserva);
    setRetryKey(0);
    if (reserva.comprobante_disponible === false) {
      setReceiptState('fallback');
    } else if (isPdfUrl(reserva.comprobante_url)) {
      setReceiptState('pdf');
    } else {
      setReceiptState('loading');
    }
  };

  const closeModal = () => {
    setSelectedReserva(null);
    setReceiptState('idle');
  };

  const handleAccion = async (reserva, accion) => {
    const reservaObj = typeof reserva === 'object' ? reserva : reservas.find(r => r.reserva_id === reserva) || { reserva_id: reserva };
    if (processingId) return;
    if (accion === 'aprobar' && !reservaObj.comprobante_url) {
      alert('Esta reserva aún no tiene comprobante bancario adjunto.');
      return;
    }
    if (!window.confirm(`¿Seguro que deseas ${accion} la reserva ${reservaObj.codigo_reserva || '#' + reservaObj.reserva_id}?`)) return;

    setProcessingId(reservaObj.reserva_id);
    try {
      await officeRequest(usuario, `/reservas/${reservaObj.reserva_id}/${accion}`, { method: 'PUT' });
      alert(`Reserva ${accion === 'aprobar' ? 'aprobada y boletos emitidos' : 'rechazada'} correctamente.`);
      closeModal();
      await fetchReservas();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error de conexión con el servidor.');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="text-center p-4">Cargando comprobantes…</div>;

  const modalUrl = selectedReserva ? getComprobanteUrl(selectedReserva.comprobante_url) : '';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-2xl font-bold text-gray-800 m-0">Bandeja de comprobantes pendientes</h2>
        <button
          type="button"
          onClick={fetchReservas}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Actualizar bandeja
        </button>
      </div>

      {error ? (
        <div className="text-red-700" role="alert">
          <p>{error}</p>
          <button className="mt-3 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" onClick={fetchReservas}>
            Reintentar
          </button>
        </div>
      ) : reservas.length === 0 ? (
        <p className="text-gray-500">No hay comprobantes pendientes por validar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Reserva</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Pasajeros</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Ruta y Fecha</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Total</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Comprobante</th>
                <th className="py-2 px-4 border-b text-center text-sm font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((reserva) => {
                const busy = processingId === reserva.reserva_id;
                const pasajeros = Array.isArray(reserva.pasajeros) ? reserva.pasajeros : [];
                return (
                  <tr key={reserva.reserva_id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-700">
                      <div className="font-bold font-mono">{reserva.codigo_reserva || `#${reserva.reserva_id}`}</div>
                      <div className="text-xs text-gray-500">{reserva.metodo_pago || 'TRANSFERENCIA'}</div>
                    </td>
                    <td className="py-2 px-4 border-b text-sm text-gray-700">
                      <div className="font-medium">{reserva.cliente_nombre}</div>
                      {reserva.cliente_cedula && <div className="text-xs text-gray-500">CI: {reserva.cliente_cedula}</div>}
                      {pasajeros.length > 0 && (
                        <div className="text-xs text-gray-500">
                          {pasajeros.length} {pasajeros.length === 1 ? 'asiento' : 'asientos'}: {pasajeros.map(p => `#${p.numero_asiento}${p.tipo_pasajero && p.tipo_pasajero !== 'NORMAL' ? ` (${p.tipo_pasajero})` : ''}`).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-4 border-b text-sm text-gray-700">
                      <div>{reserva.origen} → {reserva.destino}</div>
                      <div className="text-xs text-gray-500">
                        {reserva.fecha_viaje ? `${travelDate(reserva.fecha_viaje)} · ` : ''}{shortTime(reserva.hora_salida)}{reserva.numero_disco ? ` · Unidad #${reserva.numero_disco}` : ''}
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b text-sm font-semibold text-gray-800">{money(reserva.total_pagado)}</td>
                    <td className="py-2 px-4 border-b text-sm">
                      {reserva.comprobante_url ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openModal(reserva)}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            Ver imagen
                          </button>
                          {reserva.comprobante_disponible === false && (
                            <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              Respaldo local
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Sin comprobante</span>
                      )}
                    </td>
                    <td className="py-2 px-4 border-b text-center whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busy || !reserva.comprobante_url}
                        onClick={() => handleAccion(reserva, 'aprobar')}
                        className="bg-green-600 text-white px-3 py-1 rounded mr-2 hover:bg-green-700 transition text-sm disabled:opacity-40"
                      >
                        {busy ? 'Procesando…' : 'Aprobar'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAccion(reserva, 'rechazar')}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition text-sm disabled:opacity-40"
                      >
                        Rechazar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedReserva && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white p-5 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Comprobante de Pago"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800 text-lg m-0">
                Comprobante de Pago {selectedReserva.codigo_reserva ? `· ${selectedReserva.codigo_reserva}` : `#${selectedReserva.reserva_id}`}
              </h3>
              <button type="button" onClick={closeModal} aria-label="Cerrar comprobante" className="text-gray-500 hover:text-gray-800 text-xl font-bold px-2">&times;</button>
            </div>

            <div className="text-center my-2">
              {receiptState === 'fallback' ? (
                <div role="status" data-testid="comprobante-fallback" className="p-4 bg-amber-50 text-amber-950 rounded-lg border border-amber-300 text-left space-y-3">
                  <p className="font-semibold text-sm m-0">
                    Respaldo local activado: la imagen del comprobante no está disponible en el disco temporal del servidor (error 404).
                  </p>
                  <p className="text-xs text-amber-900 m-0">
                    Esto puede ocurrir tras un reinicio en Render. Verifica el depósito o transferencia directamente en tu banca con los datos de abajo para aprobar o rechazar sin bloqueo:
                  </p>
                  <dl className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded border border-amber-200">
                    <div><dt className="text-gray-500">Reserva</dt><dd className="font-semibold text-gray-900">{selectedReserva.codigo_reserva || `#${selectedReserva.reserva_id}`}</dd></div>
                    <div><dt className="text-gray-500">Total a validar</dt><dd className="font-semibold text-gray-900">{money(selectedReserva.total_pagado)}</dd></div>
                    <div><dt className="text-gray-500">Pasajero</dt><dd className="font-semibold text-gray-900">{selectedReserva.cliente_nombre}</dd></div>
                    <div><dt className="text-gray-500">Cédula</dt><dd className="font-semibold text-gray-900">{selectedReserva.cliente_cedula || 'No registrada'}</dd></div>
                    <div><dt className="text-gray-500">Ruta</dt><dd className="font-semibold text-gray-900">{selectedReserva.origen} → {selectedReserva.destino}</dd></div>
                    <div><dt className="text-gray-500">Salida</dt><dd className="font-semibold text-gray-900">{shortTime(selectedReserva.hora_salida)}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setRetryKey(k => k + 1); setReceiptState(isPdfUrl(modalUrl) ? 'pdf' : 'loading'); }}
                      className="rounded border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Reintentar carga
                    </button>
                  </div>
                </div>
              ) : receiptState === 'pdf' ? (
                <div className="space-y-2">
                  <iframe
                    src={modalUrl}
                    title="Vista previa PDF del comprobante"
                    className="w-full h-[55vh] rounded border border-gray-200"
                  />
                  <a
                    href={modalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm text-blue-700 hover:text-blue-900 underline font-semibold"
                  >
                    ↗ Abrir comprobante PDF en nueva pestaña
                  </a>
                </div>
              ) : (
                <>
                  <img
                    key={`${modalUrl}-${retryKey}`}
                    src={modalUrl}
                    alt="Comprobante de pago"
                    className="max-w-full max-h-[60vh] mx-auto rounded border border-gray-200 object-contain"
                    onLoad={() => setReceiptState('loaded')}
                    onError={() => setReceiptState('fallback')}
                  />
                  <a
                    href={modalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    ↗ Abrir comprobante original en nueva pestaña
                  </a>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={processingId === selectedReserva.reserva_id || !selectedReserva.comprobante_url}
                onClick={() => handleAccion(selectedReserva, 'aprobar')}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold text-sm disabled:opacity-40"
              >
                Aprobar reserva
              </button>
              <button
                type="button"
                disabled={processingId === selectedReserva.reserva_id}
                onClick={() => handleAccion(selectedReserva, 'rechazar')}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold text-sm disabled:opacity-40"
              >
                Rechazar reserva
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidacionComprobantes;
