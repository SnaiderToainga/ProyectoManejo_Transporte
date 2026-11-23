import { officeRequest } from '../../lib/officeApi.js';
import { useEffect, useState } from 'react';
import { money, shortTime, travelDate } from '../../lib/format.js';

const isLocalHost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.') ||
  import.meta.env?.DEV
);

const BACKEND_URL = (
  import.meta.env.VITE_API_URL ||
  (isLocalHost ? '' : 'https://transporte-uta-api.onrender.com/api')
).replace(/\/api\/?$/, '');

const getComprobanteUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanBase = BACKEND_URL.replace(/\/$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
};

const ValidacionComprobantes = ({ usuario }) => {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [modalImage, setModalImage] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);
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

  const openReceipt = (url) => {
    setImgFailed(false);
    setModalImage(getComprobanteUrl(url));
  };

  const handleAccion = async (reserva, accion) => {
    if (processingId) return;
    if (accion === 'aprobar' && !reserva.comprobante_url) {
      alert('Esta reserva aún no tiene comprobante bancario adjunto.');
      return;
    }
    if (!window.confirm(`¿Seguro que deseas ${accion} la reserva ${reserva.codigo_reserva || '#' + reserva.reserva_id}?`)) return;

    setProcessingId(reserva.reserva_id);
    try {
      await officeRequest(usuario, `/reservas/${reserva.reserva_id}/${accion}`, { method: 'PUT' });
      alert(`Reserva ${accion === 'aprobar' ? 'aprobada y boletos emitidos' : 'rechazada'} correctamente.`);
      await fetchReservas();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error de conexión con el servidor.');
    } finally {
      setProcessingId(null);
    }
  };

  const isPdfUrl = (url) => Boolean(url) && /\.pdf(\?|$)/i.test(url);

  if (loading) return <div className="text-center p-4">Cargando comprobantes…</div>;

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
                      <div className="font-bold">{reserva.codigo_reserva || `#${reserva.reserva_id}`}</div>
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
                        {travelDate(reserva.fecha_viaje)} · {shortTime(reserva.hora_salida)} · Unidad #{reserva.numero_disco}
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b text-sm font-semibold text-gray-800">{money(reserva.total_pagado)}</td>
                    <td className="py-2 px-4 border-b text-sm">
                      {reserva.comprobante_url ? (
                        <button
                          type="button"
                          onClick={() => openReceipt(reserva.comprobante_url)}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Ver comprobante
                        </button>
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

      {modalImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Comprobante de Pago"
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setModalImage(null)}
        >
          <div className="bg-white p-5 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800 text-lg m-0">Comprobante de Pago</h3>
              <button type="button" onClick={() => setModalImage(null)} className="text-gray-500 hover:text-gray-800 text-xl font-bold px-2">&times;</button>
            </div>

            <div className="text-center my-2">
              {isPdfUrl(modalImage) ? (
                <iframe
                  src={modalImage}
                  title="Vista previa PDF del comprobante"
                  className="w-full h-[60vh] rounded border border-gray-200"
                />
              ) : !imgFailed ? (
                <img
                  key={modalImage}
                  src={modalImage}
                  alt="Comprobante de pago"
                  className="max-w-full max-h-[60vh] mx-auto rounded border border-gray-200 object-contain"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="p-4 bg-yellow-50 text-yellow-800 rounded border border-yellow-200 text-sm">
                  <p className="m-0">No se pudo previsualizar la imagen directamente aquí. Usa el enlace inferior para abrir el archivo original.</p>
                </div>
              )}
              <a
                href={modalImage}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-blue-600 hover:text-blue-800 underline font-medium"
              >
                ↗ Abrir comprobante original en nueva pestaña
              </a>
            </div>

            <button
              type="button"
              onClick={() => setModalImage(null)}
              className="mt-4 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 w-full"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidacionComprobantes;
