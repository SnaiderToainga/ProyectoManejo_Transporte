// frontend/src/pages/Admin/mockDataAdmin.js

export const initialCooperativas = [
  {
    id: 1,
    nombre: "Cooperativa de Transportes CITA",
    ruc: "1890012345001",
    resolucion_ant: "ANT-RES-2024-001",
    color_distintivo: "#1D4ED8", // Azul corporativo
    logo_url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=128&q=80",
    telefono: "032821456",
    direccion: "Av. Las Américas y Manuela Sáenz, Ambato",
    banco: "Banco Pichincha",
    cuenta_bancaria: "2200114455",
    activo: true,
    gerente: {
      nombre: "Ing. Carlos Mendoza",
      cedula: "1803456789",
      correo: "gerencia@cooperativacita.ec",
      telefono: "0998765432"
    },
    flota: {
      total_buses: 28,
      buses_40_asientos: 18,
      buses_41_asientos: 10
    }
  },
  {
    id: 2,
    nombre: "Flota Pelileo Express",
    ruc: "1890098765001",
    resolucion_ant: "ANT-RES-2024-104",
    color_distintivo: "#DC2626", // Rojo distintivo
    logo_url: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=128&q=80",
    telefono: "032871234",
    direccion: "Terminal Terrestre de Pelileo, Of. 04",
    banco: "Banco del Pacífico",
    cuenta_bancaria: "1055667788",
    activo: true,
    gerente: {
      nombre: "Lic. Andrea Morales",
      cedula: "1804123890",
      correo: "gerencia@pelileoexpress.com",
      telefono: "0987123456"
    },
    flota: {
      total_buses: 15,
      buses_40_asientos: 10,
      buses_41_asientos: 5
    }
  },
  {
    id: 3,
    nombre: "Cooperativa Baños Internacional",
    ruc: "1890123499001",
    resolucion_ant: "ANT-RES-2024-210",
    color_distintivo: "#059669", // Verde esmeralda
    logo_url: "https://images.unsplash.com/photo-1494515843206-f3117d3f51b7?w=128&q=80",
    telefono: "032740987",
    direccion: "Terminal Terrestre de Baños de Agua Santa",
    banco: "Banco de Guayaquil",
    cuenta_bancaria: "4400998877",
    activo: true,
    gerente: {
      nombre: "Sr. Patricio Freire",
      cedula: "1802987654",
      correo: "gerencia@coopbanos.com",
      telefono: "0991238765"
    },
    flota: {
      total_buses: 22,
      buses_40_asientos: 14,
      buses_41_asientos: 8
    }
  }
];

export const adminMetrics = {
  totalCooperativas: 3,
  cooperativasActivas: 3,
  totalFlotaNacional: 65,
  buses40Asientos: 42,
  buses41Asientos: 23,
  frecuenciasRegistradasANT: 18
};
