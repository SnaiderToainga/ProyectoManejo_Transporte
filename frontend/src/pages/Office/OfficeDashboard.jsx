import React, { useState } from 'react';
import ValidacionComprobantes from './ValidacionComprobantes';
import VentaVentanilla from './VentaVentanilla';
import HojaRuta from './HojaRuta';

const OfficeDashboard = () => {
  // Estado para controlar qué pestaña está activa
  const [activeTab, setActiveTab] = useState('comprobantes');

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Panel de Oficinista</h1>
        <p className="text-gray-500">Bienvenido al sistema de ventas y validación en ventanilla</p>
      </div>

      {/* Pestañas de Navegación */}
      <div className="flex space-x-4 mb-6 border-b border-gray-300 pb-2">
        <button
          onClick={() => setActiveTab('comprobantes')}
          className={`px-4 py-2 rounded-t-lg font-semibold transition-colors ${
            activeTab === 'comprobantes' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          Validación de Comprobantes
        </button>
        <button
          onClick={() => setActiveTab('ventanilla')}
          className={`px-4 py-2 rounded-t-lg font-semibold transition-colors ${
            activeTab === 'ventanilla' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          Venta en Ventanilla
        </button>
        <button
          onClick={() => setActiveTab('hojaruta')}
          className={`px-4 py-2 rounded-t-lg font-semibold transition-colors ${
            activeTab === 'hojaruta' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          Hoja de Ruta Diaria
        </button>
      </div>

      {/* Contenido Dinámico según la pestaña */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        {activeTab === 'comprobantes' && <ValidacionComprobantes />}
        {activeTab === 'ventanilla' && <VentaVentanilla />}
        {activeTab === 'hojaruta' && <HojaRuta />}
      </div>
    </div>
  );
};

export default OfficeDashboard;