import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://transporte-uta-api.onrender.com/api';
const BACKEND_URL = (import.meta.env.VITE_API_URL || 'https://transporte-uta-api.onrender.com/api').replace(/\/api\/?$/, '');

const getComprobanteUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanBase = BACKEND_URL.replace(/\/$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
};

const ValidacionComprobantes = () => {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalImage, setModalImage] = useState(null);
  const [error, setError] = useState('');

  const fetchReservas = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_URL}/reservas-pendientes`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `No se pudieron cargar las reservas (${response.status}).`);
      }
      if (!Array.isArray(data)) {
        throw new Error('El servicio devolvió una lista de reservas no válida.');
      }
      setReservas(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudieron cargar las reservas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservas();
  }, []);

  const handleAccion = async (reserva_id, accion) => {
    if (!window.confirm(`¿Seguro que deseas ${accion} esta reserva?`)) return;

    try {
      const response = await fetch(`${API_URL}/reservas/${reserva_id}/${accion}`, {
        method: 'PUT',
      });

      if (response.ok) {
        alert(`Reserva ${accion === 'aprobar' ? 'aprobada' : 'rechazada'} correctamente.`);
        fetchReservas();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'No se pudo procesar'}`);
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión con el servidor.");
    }
  };

  if (loading) return <div className="text-center p-4">Cargando comprobantes...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Bandeja de Comprobantes Pendientes</h2>
      
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
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Reserva ID</th>
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
                  <td className="py-2 px-4 border-b text-sm text-gray-700">#{reserva.reserva_id}</td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">
                    <div className="font-medium">{reserva.cliente_nombre}</div>
                    <div className="text-xs text-gray-500">{reserva.cliente_cedula}</div>
                  </td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">
                    {reserva.origen} → {reserva.destino}
                    <div className="text-xs text-gray-500">{reserva.hora_salida}</div>
                  </td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">${reserva.total_pagado}</td>
                  <td className="py-2 px-4 border-b text-sm">
                    {reserva.comprobante_url ? (
                      <button 
                        onClick={() => setModalImage(getComprobanteUrl(reserva.comprobante_url))}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Ver imagen
                      </button>
                    ) : (
                      <span className="text-gray-400">Sin comprobante</span>
                    )}
                  </td>
                  <td className="py-2 px-4 border-b text-center">
                    <button
                      onClick={() => handleAccion(reserva.reserva_id, 'aprobar')}
                      className="bg-green-500 text-white px-3 py-1 rounded mr-2 hover:bg-green-600 transition text-sm"
                    >
                      Aprobar
                    </button>
                    <button
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

      {modalImage && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setModalImage(null)}>
          <div className="bg-white p-5 rounded-lg max-w-2xl max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800 text-lg">Comprobante de Pago</h3>
              <button onClick={() => setModalImage(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            
            <div className="text-center my-2">
              <img 
                src={modalImage} 
                alt="Comprobante de pago" 
                className="max-w-full max-h-[60vh] mx-auto rounded border border-gray-200"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fb = document.getElementById('comprobante-fallback-msg');
                  if (fb) fb.style.display = 'block';
                }}
              />
              <div id="comprobante-fallback-msg" style={{ display: 'none' }} className="p-4 bg-yellow-50 text-yellow-800 rounded border border-yellow-200 text-sm">
                <p>El comprobante es un archivo PDF o requiere visualización directa externa.</p>
              </div>
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
              onClick={() => setModalImage(null)}
              className="mt-4 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 w-full"
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
