import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const VentaVentanilla = () => {
  const [formData, setFormData] = useState({
    frecuencia_id: '',
    asientos_ids: '',
    usuario_id: '1', // ID temporal (puedes cambiarlo si tienen un usuario genérico de ventanilla)
    tipo_pasajero: 'NORMAL',
    metodo_pago: 'EFECTIVO'
  });
  
  const [mensaje, setMensaje] = useState(null);
  const [loading, setLoading] = useState(false);

  // Manejar cambios en los inputs
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Enviar el formulario al backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMensaje(null);

    // Convertir los asientos a un array de números
    const asientosArray = formData.asientos_ids
      .split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id)); // Elimina espacios vacíos o letras

    if (asientosArray.length === 0) {
      setMensaje({ tipo: 'error', texto: 'Debes ingresar al menos un número de asiento válido.' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/venta-ventanilla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frecuencia_id: parseInt(formData.frecuencia_id),
          asientos_ids: asientosArray,
          usuario_id: parseInt(formData.usuario_id),
          tipo_pasajero: formData.tipo_pasajero,
          metodo_pago: formData.metodo_pago
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje({ tipo: 'exito', texto: `✅ Venta registrada. Total: $${data.total}. Reserva ID: #${data.reserva_id}` });
        // Limpiar el formulario
        setFormData({ ...formData, frecuencia_id: '', asientos_ids: '' });
      } else {
        setMensaje({ tipo: 'error', texto: `❌ Error: ${data.error}` });
      }
    } catch (error) {
      console.error(error);
      setMensaje({ tipo: 'error', texto: '❌ Error de conexión con el servidor.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Venta en Ventanilla</h2>
      <p className="text-gray-500 mb-6">Registra una venta directa en taquilla. El boleto se generará como PAGADO automáticamente.</p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-6 rounded-lg border border-gray-200">
        
        {/* Frecuencia */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ID de Frecuencia (Viaje)</label>
          <input
            type="number"
            name="frecuencia_id"
            value={formData.frecuencia_id}
            onChange={handleChange}
            required
            placeholder="Ej: 1"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">En un futuro cercano podrás elegir la ruta de una lista.</p>
        </div>

        {/* Asientos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Números de Asiento</label>
          <input
            type="text"
            name="asientos_ids"
            value={formData.asientos_ids}
            onChange={handleChange}
            required
            placeholder="Ej: 5, 6, 7 (separados por coma)"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Si necesitas saber qué asientos están libres, revisa la Hoja de Ruta.</p>
        </div>

        {/* Tipo de Pasajero */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Pasajero</label>
          <select
            name="tipo_pasajero"
            value={formData.tipo_pasajero}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="NORMAL">Normal (Tarifa completa)</option>
            <option value="NIÑO">Niño / Menor de edad (50% desc.)</option>
            <option value="TERCERA_EDAD">Tercera Edad (50% desc.)</option>
            <option value="DISCAPACIDAD">Discapacidad (50% desc.)</option>
          </select>
        </div>

        {/* Método de Pago */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
          <select
            name="metodo_pago"
            value={formData.metodo_pago}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="DEPOSITO">Depósito</option>
          </select>
        </div>

        {/* Botón de envío */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded text-white font-semibold transition-colors ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Procesando...' : 'Registrar Venta'}
          </button>
        </div>

        {/* Mensaje de éxito o error */}
        {mensaje && (
          <div className={`mt-4 p-3 rounded text-sm ${
            mensaje.tipo === 'exito' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {mensaje.texto}
          </div>
        )}
      </form>
    </div>
  );
};

export default VentaVentanilla;