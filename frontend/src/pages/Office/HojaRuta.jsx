import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const HojaRuta = () => {
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. Cargar los viajes del día al montar el componente
  const fetchViajes = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_URL}/hoja-ruta`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `No se pudo cargar la hoja de ruta (${response.status}).`);
      }
      if (!Array.isArray(data)) {
        throw new Error('El servicio devolvió una lista de viajes no válida.');
      }
      setViajes(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo cargar la hoja de ruta.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViajes();
  }, []);

  // 2. Función para actualizar el estado de un viaje
  const handleCambiarEstado = async (programacion_id, nuevoEstado) => {
    try {
      const response = await fetch(`${API_URL}/hoja-ruta/${programacion_id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_viaje: nuevoEstado })
      });

      if (response.ok) {
        // Actualizar el estado localmente sin recargar toda la página
        setViajes(viajes.map(v => 
          v.programacion_id === programacion_id ? { ...v, estado_viaje: nuevoEstado } : v
        ));
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'No se pudo actualizar'}`);
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión con el servidor.");
    }
  };

  // Función auxiliar para pintar los colores según el estado
  const getBadgeColor = (estado) => {
    switch (estado) {
      case 'PROGRAMADO': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'EN_RUTA': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'FINALIZADO': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) return <div className="text-center p-4">Cargando hoja de ruta...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Hoja de Ruta Diaria</h2>
      <p className="text-gray-500 mb-6">Viajes programados para el día de hoy. Actualiza el estado a medida que avanzan.</p>

      {error ? (
        <div className="text-red-700" role="alert">
          <p>{error}</p>
          <button className="mt-3 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" onClick={fetchViajes}>
            Reintentar
          </button>
        </div>
      ) : viajes.length === 0 ? (
        <p className="text-gray-500">No hay viajes programados para hoy. 🚌</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Hora Salida</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Ruta</th>
                <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Bus (Disco/Placa)</th>
                <th className="py-2 px-4 border-b text-center text-sm font-semibold text-gray-600">Estado Actual</th>
                <th className="py-2 px-4 border-b text-center text-sm font-semibold text-gray-600">Cambiar Estado</th>
              </tr>
            </thead>
            <tbody>
              {viajes.map((viaje) => (
                <tr key={viaje.programacion_id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b text-sm text-gray-700 font-medium">
                    {viaje.hora_salida}
                  </td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">
                    {viaje.origen} → {viaje.destino}
                    <div className="text-xs text-gray-500">{viaje.tipo_servicio}</div>
                  </td>
                  <td className="py-2 px-4 border-b text-sm text-gray-700">
                    {viaje.numero_disco} 
                    <div className="text-xs text-gray-500">{viaje.placa}</div>
                  </td>
                  <td className="py-2 px-4 border-b text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeColor(viaje.estado_viaje)}`}>
                      {viaje.estado_viaje}
                    </span>
                  </td>
                  <td className="py-2 px-4 border-b text-center">
                    <select
                      value={viaje.estado_viaje}
                      onChange={(e) => handleCambiarEstado(viaje.programacion_id, e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PROGRAMADO">PROGRAMADO</option>
                      <option value="EN_RUTA">EN_RUTA</option>
                      <option value="FINALIZADO">FINALIZADO</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HojaRuta;