import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const ValidacionComprobantes = () => {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalImage, setModalImage] = useState(null);

  const fetchReservas = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/reservas-pendientes`);
      const data = await response.json();
      setReservas(data);
    } catch (error) {
      console.error("Error al cargar reservas:", error);
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
      
      {reservas.length === 0 ? (
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
                        onClick={() => setModalImage(reserva.comprobante_url)}
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
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setModalImage(null)}>
          <div className="bg-white p-4 rounded-lg max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-2">Comprobante de Pago</h3>
            <img src={modalImage} alt="Comprobante" className="max-w-full h-auto" />
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