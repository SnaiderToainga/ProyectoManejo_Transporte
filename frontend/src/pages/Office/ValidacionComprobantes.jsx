import { officeRequest } from '../../lib/officeApi.js';
import { useEffect, useState } from 'react';
import { money, shortTime } from '../../lib/format.js';

const isLocalHost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  import.meta.env.DEV
);

const BACKEND_URL = (
  import.meta.env.VITE_API_URL ||
  (isLocalHost ? '' : 'https://transporte-uta-api.onrender.com/api')
).replace(/\/api\/?$/, '');

const getComprobanteUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const cleanBase = BACKEND_URL.replace(/\/$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
};

const isPdfUrl = (url) => /\.pdf($|\?)/i.test(String(url || ''));

const ValidacionComprobantes = ({ usuario }) => {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const handleAccion = async (reserva_id, accion) => {
    if (!window.confirm(`¿Seguro que deseas ${accion} esta reserva?`)) return;

    try {
      await officeRequest(usuario, `/reservas/${reserva_id}/${accion}`, { method: 'PUT' });
      alert(`Reserva ${accion === 'aprobar' ? 'aprobada' : 'rechazada'} correctamente.`);
      closeModal();
      fetchReservas();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error de conexión con el servidor.');
    }
  };

  if (loading) return <div className="text-center p-4">Cargando comprobantes…</div>;

  const modalUrl = selectedReserva ? getComprobanteUrl(selectedReserva.comprobante_url) : '';

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Bandeja de comprobantes pendientes</h2>

      {error ? (
        <div className="text-red-700" role="alert">
          <p>{error}</p>
          <button className="mt-3 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" onClick={fetchReservas}>
            Reintentar
          </button>
        </div>
      ) : reservas.length === 0 ? (
        <p className="text-gray-500">No hay comprobantes pendientes por validar. 🎉</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">ID de reserva</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Cliente</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Ruta</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Total</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Comprobante</th>
                <th className="py-2 px-4 border-b text-center text-sm font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((reserva) => (
                <tr key={reserva.reserva_id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b text-sm text-gray-700">
                    <div>#{reserva.reserva_id}</div>
                    {reserva.codigo_reserva && (
                      <div className="text-xs text-gray-500 font-mono">{reserva.codigo_reserva}</div>
                    )}
                  </td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">
                    <div className="font-medium">{reserva.cliente_nombre}</div>
                    <div className="text-xs text-gray-500">{reserva.cliente_cedula}</div>
                  </td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">
                    {reserva.origen} → {reserva.destino}
                    <div className="text-xs text-gray-500">{shortTime(reserva.hora_salida)}</div>
                  </td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">{money(reserva.total_pagado)}</td>
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
                  <td className="py-2 px-4 border-b text-center">
                    <button
                      type="button"
                      onClick={() => handleAccion(reserva.reserva_id, 'aprobar')}
                      className="bg-green-500 text-white px-3 py-1 rounded mr-2 hover:bg-green-600 transition text-sm"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAccion(reserva.reserva_id, 'rechazar')}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition text-sm"
                    >
                      Rechazar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedReserva && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white p-5 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl" role="dialog" aria-label="Comprobante de Pago" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800 text-lg">
                Comprobante de Pago {selectedReserva.codigo_reserva ? `· ${selectedReserva.codigo_reserva}` : `#${selectedReserva.reserva_id}`}
              </h3>
              <button type="button" onClick={closeModal} aria-label="Cerrar comprobante" className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <div className="text-center my-2">
              {receiptState === 'fallback' ? (
                <div role="status" data-testid="comprobante-fallback" className="p-4 bg-amber-50 text-amber-950 rounded-lg border border-amber-300 text-left space-y-3">
                  <p className="font-semibold text-sm">
                    Respaldo local activado: la imagen del comprobante no está disponible en el disco temporal del servidor (error 404).
                  </p>
                  <p className="text-xs text-amber-900">
                    Esto puede ocurrir tras un reinicio en Render. Verifica el depósito o transferencia directamente en tu banca con los datos de abajo para aprobar o rechazar sin bloqueo:
                  </p>
                  <dl className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded border border-amber-200">
                    <div><dt className="text-gray-500">Reserva</dt><dd className="font-semibold text-gray-900">{selectedReserva.codigo_reserva || `#${selectedReserva.reserva_id}`}</dd></div>
                    <div><dt className="text-gray-500">Total a validar</dt><dd className="font-semibold text-gray-900">{money(selectedReserva.total_pagado)}</dd></div>
                    <div><dt className="text-gray-500">Pasajero</dt><dd className="font-semibold text-gray-900">{selectedReserva.cliente_nombre}</dd></div>
                    <div><dt className="text-gray-500">Cédula</dt><dd className="font-semibold text-gray-900">{selectedReserva.cliente_cedula}</dd></div>
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
                <div className="p-4 bg-blue-50 text-blue-900 rounded border border-blue-200 text-sm space-y-2">
                  <p>El comprobante adjunto es un documento PDF.</p>
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
                    className="max-w-full max-h-[60vh] mx-auto rounded border border-gray-200"
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
                onClick={() => handleAccion(selectedReserva.reserva_id, 'aprobar')}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold text-sm"
              >
                Aprobar reserva
              </button>
              <button
                type="button"
                onClick={() => handleAccion(selectedReserva.reserva_id, 'rechazar')}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold text-sm"
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
