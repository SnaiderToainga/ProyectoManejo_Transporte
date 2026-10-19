import { useState, useEffect } from 'react';
import {
  Building2,
  Bus,
  Route,
  Plus,
  Palette,
  ShieldCheck,
  CheckCircle2,
  Users,
  LogOut,
  RefreshCw,
  Clock,
  DollarSign
} from 'lucide-react';
import ModalNuevaCooperativa from './ModalNuevaCooperativa.jsx';
import PersonalizacionBranding from './PersonalizacionBranding.jsx';
import {
  mockCooperativas,
  mockMetricasAdmin,
  mockBuses,
  mockFrecuencias
} from './mockDataAdmin.js';

export default function GestionCooperativas({ onLogout }) {
  const [tabActiva, setTabActiva] = useState('cooperativas');
  const [cooperativas, setCooperativas] = useState(mockCooperativas);
  const [buses, setBuses] = useState(mockBuses);
  const [frecuencias, setFrecuencias] = useState(mockFrecuencias);
  const [metricas, setMetricas] = useState(mockMetricasAdmin);

  // Modales
  const [modalNuevaCoopAbierto, setModalNuevaCoopAbierto] = useState(false);
  const [modalBrandingAbierto, setModalBrandingAbierto] = useState(false);
  const [coopSeleccionadaBranding, setCoopSeleccionadaBranding] = useState(null);

  // Notificaciones de éxito
  const [alerta, setAlerta] = useState(null);

  // Formulario nuevo Bus
  const [formBus, setFormBus] = useState({
    cooperativa_id: 1,
    numero_disco: '',
    placa: '',
    capacidad: 40,
    tiene_bano_posterior: true,
    estado: 'OPERATIVO'
  });

  // Formulario nueva Frecuencia ANT
  const [formFrecuencia, setFormFrecuencia] = useState({
    cooperativa_id: 1,
    resolucion_ant: '',
    origen: 'Ambato',
    destino: '',
    hora_salida: '08:00',
    precio_base: '4.50',
    tipo_servicio: 'DIRECTO'
  });

  // Formulario nuevo Usuario
  const [modalUsuarioAbierto, setModalUsuarioAbierto] = useState(false);
  const [formUsuario, setFormUsuario] = useState({
    nombre: '',
    correo: '',
    telefono: '',
    rol: 'ADMIN_COOP',
    password: ''
  });

  // Cargar datos reales de la API (con fallback a mock)
  const cargarDatos = async () => {
    try {
      const [resCoop, resBuses, resFrec] = await Promise.all([
        fetch('/api/admin/cooperativas'),
        fetch('/api/admin/buses'),
        fetch('/api/admin/frecuencias')
      ]);

      if (resCoop.ok) {
        const dataCoop = await resCoop.json();
        if (dataCoop.length > 0) setCooperativas(dataCoop);
      }
      if (resBuses.ok) {
        const dataBuses = await resBuses.json();
        if (dataBuses.length > 0) setBuses(dataBuses);
      }
      if (resFrec.ok) {
        const dataFrec = await resFrec.json();
        if (dataFrec.length > 0) setFrecuencias(dataFrec);
      }
    } catch {
      // Mantiene datos locales de respaldo
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Recalcular métricas
  useEffect(() => {
    const totalBuses = buses.length;
    const buses40 = buses.filter(b => Number(b.capacidad) === 40).length;
    const buses41 = buses.filter(b => Number(b.capacidad) === 41).length;
    setMetricas({
      total_cooperativas: cooperativas.length,
      cooperativas_activas: cooperativas.filter(c => c.activo !== false).length,
      total_buses: totalBuses,
      buses_40_asientos: buses40,
      buses_41_asientos: buses41,
      total_frecuencias: frecuencias.length
    });
  }, [cooperativas, buses, frecuencias]);

  // Manejar creación de nueva cooperativa
  const handleGuardarNuevaCoop = (nuevaCoop) => {
    setCooperativas([nuevaCoop, ...cooperativas]);
    setModalNuevaCoopAbierto(false);
    mostrarAlerta(`Cooperativa "${nuevaCoop.nombre}" registrada exitosamente.`);
  };

  // Manejar actualización de branding
  const handleGuardarBranding = (coopActualizada) => {
    setCooperativas(cooperativas.map(c => c.id === coopActualizada.id ? coopActualizada : c));
    setModalBrandingAbierto(false);
    mostrarAlerta(`Identidad visual de "${coopActualizada.nombre}" actualizada.`);
  };

  // Guardar Bus (Disparador de Loop de 40/41 Asientos)
  const handleGuardarBus = async (e) => {
    e.preventDefault();
    if (!formBus.numero_disco || !formBus.placa) return;

    try {
      const resp = await fetch('/api/admin/buses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formBus)
      });
      const data = await resp.json();

      if (resp.ok) {
        const coopObj = cooperativas.find(c => c.id === Number(formBus.cooperativa_id));
        const nuevoBus = {
          ...data.bus,
          cooperativa_nombre: coopObj ? coopObj.nombre : 'Cooperativa',
          color_distintivo: coopObj ? coopObj.color_distintivo : '#1E40AF'
        };
        setBuses([...buses, nuevoBus]);
        mostrarAlerta(data.mensaje || `Bus #${formBus.numero_disco} registrado con sus ${formBus.capacidad} asientos.`);
      } else {
        throw new Error(data.error);
      }
    } catch {
      // Simulación local si backend no responde
      const coopObj = cooperativas.find(c => c.id === Number(formBus.cooperativa_id));
      const busSimulado = {
        id: Date.now(),
        cooperativa_id: Number(formBus.cooperativa_id),
        cooperativa_nombre: coopObj ? coopObj.nombre : 'Cooperativa',
        color_distintivo: coopObj ? coopObj.color_distintivo : '#1E40AF',
        numero_disco: Number(formBus.numero_disco),
        placa: formBus.placa.toUpperCase(),
        capacidad: Number(formBus.capacidad),
        tiene_bano_posterior: formBus.tiene_bano_posterior,
        estado: formBus.estado
      };
      setBuses([...buses, busSimulado]);
      mostrarAlerta(`Bus #${busSimulado.numero_disco} guardado localmente (${busSimulado.capacidad} asientos).`);
    }

    setFormBus({
      cooperativa_id: cooperativas[0]?.id || 1,
      numero_disco: '',
      placa: '',
      capacidad: 40,
      tiene_bano_posterior: true,
      estado: 'OPERATIVO'
    });
  };

  // Guardar Frecuencia ANT
  const handleGuardarFrecuencia = async (e) => {
    e.preventDefault();
    if (!formFrecuencia.resolucion_ant || !formFrecuencia.destino) return;

    try {
      const resp = await fetch('/api/admin/frecuencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formFrecuencia)
      });
      const data = await resp.json();

      if (resp.ok) {
        const coopObj = cooperativas.find(c => c.id === Number(formFrecuencia.cooperativa_id));
        const nuevaFrec = {
          ...data.frecuencia,
          cooperativa_nombre: coopObj ? coopObj.nombre : 'Cooperativa'
        };
        setFrecuencias([...frecuencias, nuevaFrec]);
        mostrarAlerta(`Frecuencia "${formFrecuencia.origen} - ${formFrecuencia.destino}" autorizada por ANT.`);
      } else {
        throw new Error(data.error);
      }
    } catch {
      const coopObj = cooperativas.find(c => c.id === Number(formFrecuencia.cooperativa_id));
      const frecSimulada = {
        id: Date.now(),
        ...formFrecuencia,
        cooperativa_nombre: coopObj ? coopObj.nombre : 'Cooperativa',
        activo: true
      };
      setFrecuencias([...frecuencias, frecSimulada]);
      mostrarAlerta(`Frecuencia ANT "${frecSimulada.resolucion_ant}" registrada localmente.`);
    }

    setFormFrecuencia({
      cooperativa_id: cooperativas[0]?.id || 1,
      resolucion_ant: '',
      origen: 'Ambato',
      destino: '',
      hora_salida: '08:00',
      precio_base: '4.50',
      tipo_servicio: 'DIRECTO'
    });
  };

  // Guardar Usuario
  const handleGuardarUsuario = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formUsuario)
      });
      mostrarAlerta(`Usuario ${formUsuario.nombre} creado con rol ${formUsuario.rol}.`);
      setModalUsuarioAbierto(false);
      setFormUsuario({ nombre: '', correo: '', telefono: '', rol: 'ADMIN_COOP', password: '' });
    } catch {
      mostrarAlerta(`Usuario ${formUsuario.nombre} simulado.`);
      setModalUsuarioAbierto(false);
    }
  };

  const mostrarAlerta = (msg) => {
    setAlerta(msg);
    setTimeout(() => setAlerta(null), 4000);
  };

  return (
    <div style={styles.container}>
      {/* Barra superior de encabezado */}
      <header style={styles.header}>
        <div>
          <div style={styles.badgeRol}>SUPERADMINISTRADOR & QA</div>
          <h1 style={styles.mainTitle}>Panel de Gestión y Flotas Interprovinciales</h1>
          <p style={styles.subtitle}>Supervisión de Cooperativas, Asignación ANT y Coherencia de Asientos</p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={cargarDatos} style={styles.btnSecondary} title="Recargar datos">
            <RefreshCw size={16} />
            <span>Sincronizar</span>
          </button>
          <button onClick={() => setModalUsuarioAbierto(true)} style={styles.btnSecondary}>
            <Users size={16} />
            <span>Crear Usuario</span>
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('transporte_auth');
              if (onLogout) onLogout();
              window.location.hash = 'login';
            }}
            style={styles.btnLogout}
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {alerta && (
        <div style={styles.alertSuccess}>
          <CheckCircle2 size={18} color="#065F46" />
          <span>{alerta}</span>
        </div>
      )}

      {/* Tarjetas KPI de control */}
      <section style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconWrapper, background: '#EFF6FF', color: '#1E40AF' }}>
            <Building2 size={24} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Cooperativas Activas</div>
            <div style={styles.kpiValue}>{metricas.cooperativas_activas} / {metricas.total_cooperativas}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconWrapper, background: '#F0FDF4', color: '#166534' }}>
            <Bus size={24} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Flota Total de Buses</div>
            <div style={styles.kpiValue}>{metricas.total_buses}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconWrapper, background: '#FEF3C7', color: '#92400E' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Control QA Asientos</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: '700', color: '#0F172A' }}>
              40 plazas (baño): <span style={{ color: '#1D4ED8' }}>{metricas.buses_40_asientos}</span> | 41 continuos: <span style={{ color: '#059669' }}>{metricas.buses_41_asientos}</span>
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconWrapper, background: '#FAF5FF', color: '#6B21A8' }}>
            <Route size={24} />
          </div>
          <div>
            <div style={styles.kpiLabel}>Frecuencias ANT</div>
            <div style={styles.kpiValue}>{metricas.total_frecuencias}</div>
          </div>
        </div>
      </section>

      {/* Navegación por pestañas */}
      <nav style={styles.tabsNav}>
        <button
          onClick={() => setTabActiva('cooperativas')}
          style={{ ...styles.tabBtn, ...(tabActiva === 'cooperativas' ? styles.tabBtnActive : {}) }}
        >
          <Building2 size={18} />
          <span>Cooperativas & Branding</span>
        </button>
        <button
          onClick={() => setTabActiva('buses')}
          style={{ ...styles.tabBtn, ...(tabActiva === 'buses' ? styles.tabBtnActive : {}) }}
        >
          <Bus size={18} />
          <span>Gestión de Buses (40/41 Asientos)</span>
        </button>
        <button
          onClick={() => setTabActiva('frecuencias')}
          style={{ ...styles.tabBtn, ...(tabActiva === 'frecuencias' ? styles.tabBtnActive : {}) }}
        >
          <Route size={18} />
          <span>Frecuencias Oficiales (ANT)</span>
        </button>
      </nav>

      {/* ==================================================== */}
      {/* PESTAÑA 1: COOPERATIVAS & BRANDING */}
      {/* ==================================================== */}
      {tabActiva === 'cooperativas' && (
        <section>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Directorio de Cooperativas Afiliadas</h2>
              <p style={styles.sectionSubtitle}>Administra las empresas autorizadas, configuración bancaria e identidad institucional.</p>
            </div>
            <button onClick={() => setModalNuevaCoopAbierto(true)} style={styles.btnPrimary}>
              <Plus size={18} />
              <span>Nueva Cooperativa</span>
            </button>
          </div>

          <div style={styles.coopGrid}>
            {cooperativas.map((coop) => (
              <div key={coop.id} style={styles.coopCard}>
                <div style={styles.coopCardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ ...styles.colorIndicator, backgroundColor: coop.color_distintivo || '#1E40AF' }} />
                    <div>
                      <h3 style={styles.coopName}>{coop.nombre}</h3>
                      <span style={styles.coopRuc}>RUC: {coop.ruc}</span>
                    </div>
                  </div>
                  <span style={coop.activo !== false ? styles.badgeActive : styles.badgeInactive}>
                    {coop.activo !== false ? 'Operativa' : 'Inactiva'}
                  </span>
                </div>

                <div style={styles.coopCardBody}>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Banco:</span>
                    <span style={styles.infoVal}>{coop.banco || 'Banco Pichincha'}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Cuenta:</span>
                    <span style={styles.infoVal}>{coop.cuenta_bancaria || 'No asignada'}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Color de Marca:</span>
                    <code style={styles.colorCode}>{coop.color_distintivo || '#1E40AF'}</code>
                  </div>
                </div>

                <div style={styles.coopCardFooter}>
                  <button
                    onClick={() => {
                      setCoopSeleccionadaBranding(coop);
                      setModalBrandingAbierto(true);
                    }}
                    style={styles.btnBranding}
                  >
                    <Palette size={16} />
                    <span>Personalizar Marca</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ==================================================== */}
      {/* PESTAÑA 2: GESTIÓN DE BUSES (40/41 ASIENTOS) */}
      {/* ==================================================== */}
      {tabActiva === 'buses' && (
        <section>
          <div style={styles.splitLayout}>
            {/* Formulario de registro de bus */}
            <div style={styles.panelForm}>
              <h2 style={styles.panelTitle}>Registrar Nueva Unidad</h2>
              <p style={styles.panelSubtitle}>El sistema generará automáticamente sus asientos en la base de datos.</p>

              <form onSubmit={handleGuardarBus} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={styles.formLabel}>Cooperativa Perteneciente</label>
                  <select
                    value={formBus.cooperativa_id}
                    onChange={(e) => setFormBus({ ...formBus, cooperativa_id: e.target.value })}
                    style={styles.formInput}
                  >
                    {cooperativas.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={styles.formLabel}>Número de Disco</label>
                    <input
                      type="number"
                      required
                      placeholder="Ej. 15"
                      value={formBus.numero_disco}
                      onChange={(e) => setFormBus({ ...formBus, numero_disco: e.target.value })}
                      style={styles.formInput}
                    />
                  </div>
                  <div>
                    <label style={styles.formLabel}>Placa</label>
                    <input
                      type="text"
                      required
                      placeholder="TAA-1515"
                      value={formBus.placa}
                      onChange={(e) => setFormBus({ ...formBus, placa: e.target.value })}
                      style={styles.formInput}
                    />
                  </div>
                </div>

                <div>
                  <label style={styles.formLabel}>Configuración Física de Asientos (Requisito)</label>
                  <div style={styles.capacityOptions}>
                    <label style={{
                      ...styles.capacityCard,
                      border: formBus.capacidad === 40 ? '2px solid #1E40AF' : '1px solid #CBD5E1',
                      background: formBus.capacidad === 40 ? '#EFF6FF' : '#FFFFFF'
                    }}>
                      <input
                        type="radio"
                        name="capacidad"
                        checked={formBus.capacidad === 40}
                        onChange={() => setFormBus({ ...formBus, capacidad: 40, tiene_bano_posterior: true })}
                      />
                      <div>
                        <strong>40 Asientos</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Con Baño posterior al fondo</div>
                      </div>
                    </label>

                    <label style={{
                      ...styles.capacityCard,
                      border: formBus.capacidad === 41 ? '2px solid #1E40AF' : '1px solid #CBD5E1',
                      background: formBus.capacidad === 41 ? '#EFF6FF' : '#FFFFFF'
                    }}>
                      <input
                        type="radio"
                        name="capacidad"
                        checked={formBus.capacidad === 41}
                        onChange={() => setFormBus({ ...formBus, capacidad: 41, tiene_bano_posterior: false })}
                      />
                      <div>
                        <strong>41 Asientos</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Asientos continuos sin baño</div>
                      </div>
                    </label>
                  </div>
                </div>

                <button type="submit" style={styles.btnPrimary}>
                  <Bus size={18} />
                  <span>Guardar Bus y Generar Asientos</span>
                </button>
              </form>
            </div>

            {/* Listado de buses */}
            <div style={styles.panelList}>
              <h2 style={styles.panelTitle}>Flota Registrada ({buses.length} unidades)</h2>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Disco</th>
                      <th style={styles.th}>Cooperativa</th>
                      <th style={styles.th}>Placa</th>
                      <th style={styles.th}>Capacidad / Configuración</th>
                      <th style={styles.th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buses.map((bus) => (
                      <tr key={bus.id} style={styles.tr}>
                        <td style={styles.td}>
                          <span style={styles.discoBadge}>#{bus.numero_disco}</span>
                        </td>
                        <td style={styles.td}>
                          <strong>{bus.cooperativa_nombre || 'CITA'}</strong>
                        </td>
                        <td style={styles.td}><code>{bus.placa}</code></td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.seatBadge,
                            background: bus.capacidad === 40 ? '#DBEAFE' : '#D1FAE5',
                            color: bus.capacidad === 40 ? '#1E40AF' : '#065F46'
                          }}>
                            {bus.capacidad} asientos {bus.tiene_bano_posterior ? '(Con Baño)' : '(Continuo)'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.badgeActive}>{bus.estado || 'OPERATIVO'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================== */}
      {/* PESTAÑA 3: FRECUENCIAS ANT */}
      {/* ==================================================== */}
      {tabActiva === 'frecuencias' && (
        <section>
          <div style={styles.splitLayout}>
            {/* Formulario de Frecuencia */}
            <div style={styles.panelForm}>
              <h2 style={styles.panelTitle}>Registrar Frecuencia ANT</h2>
              <p style={styles.panelSubtitle}>Resolución oficial emitida por la Agencia Nacional de Tránsito.</p>

              <form onSubmit={handleGuardarFrecuencia} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={styles.formLabel}>Cooperativa</label>
                  <select
                    value={formFrecuencia.cooperativa_id}
                    onChange={(e) => setFormFrecuencia({ ...formFrecuencia, cooperativa_id: e.target.value })}
                    style={styles.formInput}
                  >
                    {cooperativas.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.formLabel}>Resolución ANT</label>
                  <input
                    type="text"
                    required
                    placeholder="ANT-RES-2024-001"
                    value={formFrecuencia.resolucion_ant}
                    onChange={(e) => setFormFrecuencia({ ...formFrecuencia, resolucion_ant: e.target.value })}
                    style={styles.formInput}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={styles.formLabel}>Origen</label>
                    <input
                      type="text"
                      required
                      value={formFrecuencia.origen}
                      onChange={(e) => setFormFrecuencia({ ...formFrecuencia, origen: e.target.value })}
                      style={styles.formInput}
                    />
                  </div>
                  <div>
                    <label style={styles.formLabel}>Destino</label>
                    <input
                      type="text"
                      required
                      placeholder="Quito (Quitumbe)"
                      value={formFrecuencia.destino}
                      onChange={(e) => setFormFrecuencia({ ...formFrecuencia, destino: e.target.value })}
                      style={styles.formInput}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={styles.formLabel}>Hora Salida</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Clock size={16} style={{ position: 'absolute', left: 10, color: '#94A3B8' }} />
                      <input
                        type="time"
                        required
                        value={formFrecuencia.hora_salida}
                        onChange={(e) => setFormFrecuencia({ ...formFrecuencia, hora_salida: e.target.value })}
                        style={{ ...styles.formInput, paddingLeft: '2rem' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={styles.formLabel}>Tarifa Base ($)</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <DollarSign size={16} style={{ position: 'absolute', left: 10, color: '#94A3B8' }} />
                      <input
                        type="number"
                        step="0.25"
                        required
                        value={formFrecuencia.precio_base}
                        onChange={(e) => setFormFrecuencia({ ...formFrecuencia, precio_base: e.target.value })}
                        style={{ ...styles.formInput, paddingLeft: '2rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={styles.formLabel}>Modalidad de Servicio</label>
                  <select
                    value={formFrecuencia.tipo_servicio}
                    onChange={(e) => setFormFrecuencia({ ...formFrecuencia, tipo_servicio: e.target.value })}
                    style={styles.formInput}
                  >
                    <option value="DIRECTO">DIRECTO (Terminal a Terminal)</option>
                    <option value="PARADAS">PARADAS INTERMEDIAS</option>
                  </select>
                </div>

                <button type="submit" style={styles.btnPrimary}>
                  <Route size={18} />
                  <span>Registrar Frecuencia Oficial</span>
                </button>
              </form>
            </div>

            {/* Listado de Frecuencias */}
            <div style={styles.panelList}>
              <h2 style={styles.panelTitle}>Rutas Autorizadas ANT ({frecuencias.length})</h2>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Resolución</th>
                      <th style={styles.th}>Cooperativa</th>
                      <th style={styles.th}>Ruta</th>
                      <th style={styles.th}>Salida</th>
                      <th style={styles.th}>Tarifa</th>
                      <th style={styles.th}>Servicio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frecuencias.map((frec) => (
                      <tr key={frec.id} style={styles.tr}>
                        <td style={styles.td}><code>{frec.resolucion_ant}</code></td>
                        <td style={styles.td}><strong>{frec.cooperativa_nombre || 'Cooperativa'}</strong></td>
                        <td style={styles.td}>{frec.origen} ➔ {frec.destino}</td>
                        <td style={styles.td}>{frec.hora_salida}</td>
                        <td style={styles.td}><strong style={{ color: '#059669' }}>${Number(frec.precio_base).toFixed(2)}</strong></td>
                        <td style={styles.td}>
                          <span style={frec.tipo_servicio === 'DIRECTO' ? styles.badgeActive : styles.badgeInactive}>
                            {frec.tipo_servicio}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Modal de Nueva Cooperativa */}
      {modalNuevaCoopAbierto && (
        <ModalNuevaCooperativa
          onClose={() => setModalNuevaCoopAbierto(false)}
          onGuardar={handleGuardarNuevaCoop}
        />
      )}

      {/* Panel Lateral de Personalización Branding */}
      {modalBrandingAbierto && coopSeleccionadaBranding && (
        <PersonalizacionBranding
          cooperativa={coopSeleccionadaBranding}
          onClose={() => {
            setModalBrandingAbierto(false);
            setCoopSeleccionadaBranding(null);
          }}
          onGuardar={handleGuardarBranding}
        />
      )}

      {/* Modal rápido para Crear Usuario */}
      {modalUsuarioAbierto && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#0F172A' }}>Registrar Usuario Administrativo</h3>
            <form onSubmit={handleGuardarUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={styles.formLabel}>Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ing. Carlos Pérez"
                  value={formUsuario.nombre}
                  onChange={(e) => setFormUsuario({ ...formUsuario, nombre: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div>
                <label style={styles.formLabel}>Correo Institucional</label>
                <input
                  type="email"
                  required
                  placeholder="gerente@cita.com"
                  value={formUsuario.correo}
                  onChange={(e) => setFormUsuario({ ...formUsuario, correo: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div>
                <label style={styles.formLabel}>Rol Asignado</label>
                <select
                  value={formUsuario.rol}
                  onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value })}
                  style={styles.formInput}
                >
                  <option value="ADMIN_COOP">ADMIN_COOP (Gerente de Cooperativa)</option>
                  <option value="OFICINISTA">OFICINISTA (Taquilla / Ventas)</option>
                  <option value="SUPERADMIN">SUPERADMIN (Superintendencia)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setModalUsuarioAbierto(false)} style={styles.btnSecondary}>Cancelar</button>
                <button type="submit" style={styles.btnPrimary}>Guardar Usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  badgeRol: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#1E40AF',
    backgroundColor: '#EFF6FF',
    padding: '0.25rem 0.625rem',
    borderRadius: '9999px',
    marginBottom: '0.5rem',
    border: '1px solid #BFDBFE',
    letterSpacing: '0.05em'
  },
  mainTitle: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: '0 0 0.25rem 0'
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748B',
    margin: 0
  },
  headerActions: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center'
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
    padding: '0.625rem 1.125rem',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.875rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(30, 64, 175, 0.2)'
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#F8FAFC',
    color: '#334155',
    padding: '0.625rem 1rem',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.875rem',
    border: '1px solid #CBD5E1',
    cursor: 'pointer'
  },
  btnLogout: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#FEF2F2',
    color: '#991B1B',
    padding: '0.625rem 1rem',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.875rem',
    border: '1px solid #FECACA',
    cursor: 'pointer'
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    backgroundColor: '#ECFDF5',
    border: '1px solid #A7F3D0',
    color: '#065F46',
    padding: '0.875rem 1.25rem',
    borderRadius: '8px',
    marginBottom: '1.5rem',
    fontWeight: '500'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem'
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  kpiIconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  kpiLabel: {
    fontSize: '0.8125rem',
    color: '#64748B',
    fontWeight: '500',
    marginBottom: '0.25rem'
  },
  kpiValue: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#0F172A'
  },
  tabsNav: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '2px solid #E2E8F0',
    marginBottom: '2rem',
    flexWrap: 'wrap'
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    color: '#64748B',
    fontSize: '0.9375rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '-2px'
  },
  tabBtnActive: {
    color: '#1E40AF',
    borderBottom: '3px solid #1E40AF'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#0F172A',
    margin: '0 0 0.25rem 0'
  },
  sectionSubtitle: {
    fontSize: '0.875rem',
    color: '#64748B',
    margin: 0
  },
  coopGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1.25rem'
  },
  coopCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '1.25rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  coopCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem'
  },
  colorIndicator: {
    width: '16px',
    height: '40px',
    borderRadius: '4px'
  },
  coopName: {
    fontSize: '1.0625rem',
    fontWeight: '700',
    color: '#0F172A',
    margin: '0 0 0.125rem 0'
  },
  coopRuc: {
    fontSize: '0.75rem',
    color: '#64748B'
  },
  coopCardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    fontSize: '0.875rem',
    marginBottom: '1.25rem'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  infoLabel: {
    color: '#64748B'
  },
  infoVal: {
    fontWeight: '600',
    color: '#1E293B'
  },
  colorCode: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    padding: '0.125rem 0.375rem',
    backgroundColor: '#F1F5F9',
    borderRadius: '4px'
  },
  coopCardFooter: {
    borderTop: '1px solid #F1F5F9',
    paddingTop: '0.75rem'
  },
  btnBranding: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.5rem',
    backgroundColor: '#F8FAFC',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    color: '#1E293B',
    fontWeight: '600',
    fontSize: '0.8125rem',
    cursor: 'pointer'
  },
  splitLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr',
    gap: '1.5rem',
    alignItems: 'start'
  },
  panelForm: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
  },
  panelList: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '1.5rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
  },
  panelTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: '#0F172A',
    margin: '0 0 0.25rem 0'
  },
  panelSubtitle: {
    fontSize: '0.8125rem',
    color: '#64748B',
    margin: '0 0 1.25rem 0'
  },
  formLabel: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#334155',
    marginBottom: '0.375rem'
  },
  formInput: {
    width: '100%',
    padding: '0.5625rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #CBD5E1',
    fontSize: '0.875rem',
    boxSizing: 'border-box'
  },
  capacityOptions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem'
  },
  capacityCard: {
    padding: '0.625rem',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem'
  },
  tableWrapper: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
    textAlign: 'left'
  },
  th: {
    padding: '0.75rem 0.5rem',
    borderBottom: '2px solid #E2E8F0',
    color: '#475569',
    fontWeight: '600'
  },
  tr: {
    borderBottom: '1px solid #F1F5F9'
  },
  td: {
    padding: '0.75rem 0.5rem',
    color: '#1E293B'
  },
  discoBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    backgroundColor: '#F1F5F9',
    fontWeight: '700',
    borderRadius: '4px',
    fontSize: '0.8125rem'
  },
  seatBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '0.75rem'
  },
  badgeActive: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: '9999px',
    backgroundColor: '#DEF7EC',
    color: '#03543F',
    fontWeight: '600',
    fontSize: '0.75rem'
  },
  badgeInactive: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: '9999px',
    backgroundColor: '#F3F4F6',
    color: '#4B5563',
    fontWeight: '600',
    fontSize: '0.75rem'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '1.75rem',
    width: '100%',
    maxWidth: '460px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
  }
};
