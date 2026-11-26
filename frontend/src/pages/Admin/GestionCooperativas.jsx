import { useState, useEffect } from 'react';
import { money, shortTime } from '../../lib/format.js';
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
  DollarSign,
  Trash2,
  Edit2,
  Shield,
  Briefcase
} from 'lucide-react';
import ModalNuevaCooperativa from './ModalNuevaCooperativa.jsx';
import BusDetails from '../../components/BusDetails.jsx';
import BusForm from './BusForm.jsx';
import BusStructures from './BusStructures.jsx';
import PersonalizacionBranding from './PersonalizacionBranding.jsx';
import HojaRuta from '../Office/HojaRuta.jsx';
import { planningRequest } from '../../lib/planningApi.js';
import { API_BASE as API_URL, resolveMediaUrl } from '../../lib/env.js';


export default function GestionCooperativas({ usuario: propUsuario, onLogout }) {
  // Detección robusta de sesión y rol
  const authUser = propUsuario || (() => {
    try {
      return JSON.parse(localStorage.getItem('transporte_auth'));
    } catch {
      return null;
    }
  })();

  const userRole = (authUser?.rol || '').toUpperCase();
  const isGerente = userRole === 'ADMIN_COOP';
  const isSuperAdmin = userRole === 'SUPERADMIN';
  const esSuperAdmin = isSuperAdmin;
  const coopId = authUser?.cooperativa_id || null;
  const coopAsignadaNombre = authUser?.cooperativa_nombre || 'Sin cooperativa asignada';

  const [tabActiva, setTabActiva] = useState(isGerente ? 'buses' : 'cooperativas');
  const [cooperativas, setCooperativas] = useState([]);
  const [buses, setBuses] = useState([]);
  const [frecuencias, setFrecuencias] = useState([]);
  const [metricas, setMetricas] = useState({ total_cooperativas: 0, cooperativas_activas: 0, total_buses: 0, buses_40_asientos: 0, buses_41_asientos: 0, total_frecuencias: 0 });

  // Modales
  const [modalNuevaCoopAbierto, setModalNuevaCoopAbierto] = useState(false);
  const [coopEditando, setCoopEditando] = useState(null);
  const [busDetalle, setBusDetalle] = useState(null);
  const [busEditando, setBusEditando] = useState(null);
  const [modalBusAbierto, setModalBusAbierto] = useState(false);
  const [modalBrandingAbierto, setModalBrandingAbierto] = useState(false);
  const [coopSeleccionadaBranding, setCoopSeleccionadaBranding] = useState(null);

  // Notificaciones de éxito
  const [alerta, setAlerta] = useState(null);

  // Formulario nueva Frecuencia ANT y modo edición
  const [frecuenciaEditandoId, setFrecuenciaEditandoId] = useState(null);
  const [nuevaParadaTexto, setNuevaParadaTexto] = useState('');
  const [formFrecuencia, setFormFrecuencia] = useState({
    cooperativa_id: coopId || 1,
    resolucion_ant: '',
    origen: 'Ambato',
    destino: '',
    hora_salida: '08:00',
    precio_base: '4.50',
    tipo_servicio: 'DIRECTO',
    paradas_intermedias: '',
    es_destacada: false,
    patrocinio_inicio: '',
    patrocinio_fin: ''
  });

  // Formulario nuevo Usuario (Personal operativo)
  const [modalUsuarioAbierto, setModalUsuarioAbierto] = useState(false);
  const [sucursalesUsuario, setSucursalesUsuario] = useState([]);
  const [formUsuario, setFormUsuario] = useState({
    nombre: '',
    correo: '',
    telefono: '',
    rol: 'CHOFER',
    cooperativa_id: 1,
    password: ''
  });

  useEffect(() => {
    if (!modalUsuarioAbierto || formUsuario.rol !== 'OFICINISTA') return;
    const abort = new AbortController();
    setSucursalesUsuario([]);
    planningRequest(authUser, `/planificacion/catalogo?cooperativa_id=${isGerente ? coopId : formUsuario.cooperativa_id}`,
      { signal: abort.signal }).then(data => setSucursalesUsuario(data.sucursales))
      .catch(err => { if (!abort.signal.aborted) setAlerta(err.message); });
    return () => abort.abort();
  }, [modalUsuarioAbierto, formUsuario.rol, formUsuario.cooperativa_id, authUser?.token, isGerente, coopId]);

  // No presentar datos ficticios como registros persistidos cuando falla el catálogo.
  const cargarDatos = async () => {
    try {
      const [dataCoop, dataBuses, dataFrec] = await Promise.all(['cooperativas', 'buses', 'frecuencias'].map(async resource => {
        const response = await fetch(`${API_URL}/admin/${resource}`, {
          headers: { ...(authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {}),
            'x-user-role': authUser?.rol || '', 'x-user-cooperativa-id': String(coopId || '') }
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data)) throw new Error(data?.error || 'No se pudo cargar el catálogo administrativo.');
        return data;
      }));
      setCooperativas(dataCoop); setBuses(dataBuses); setFrecuencias(dataFrec);
      mostrarAlerta('Datos sincronizados con la nube de transporte.');
    } catch (err) {
      setAlerta(err.message || 'No se pudo cargar el catálogo administrativo. Intenta sincronizar nuevamente.');
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Actualizar cooperativa_id por defecto si es gerente
  useEffect(() => {
    if (isGerente && coopId) {
      setFormFrecuencia(prev => ({ ...prev, cooperativa_id: coopId }));
    }
  }, [isGerente, coopId]);

  // Filtrado según Rol (Gerente sólo gestiona su Cooperativa asignada)
  const cooperativasVisibles = isGerente
    ? cooperativas.filter(c => Number(c.id) === Number(coopId))
    : cooperativas;

  const busesVisibles = isGerente
    ? buses.filter(b => Number(b.cooperativa_id) === Number(coopId))
    : buses;

  const frecuenciasVisibles = isGerente
    ? frecuencias.filter(f => Number(f.cooperativa_id) === Number(coopId))
    : frecuencias;

  // Recalcular métricas
  useEffect(() => {
    const listadoBuses = isGerente ? busesVisibles : buses;
    const totalBuses = listadoBuses.length;
    const buses40 = listadoBuses.filter(b => Number(b.capacidad) === 40).length;
    const buses41 = listadoBuses.filter(b => Number(b.capacidad) === 41).length;
    setMetricas({
      total_cooperativas: cooperativasVisibles.length,
      cooperativas_activas: cooperativasVisibles.filter(c => c.activo !== false).length,
      total_buses: totalBuses,
      buses_40_asientos: buses40,
      buses_41_asientos: buses41,
      total_frecuencias: (isGerente ? frecuenciasVisibles : frecuencias).length
    });
  }, [cooperativas, buses, frecuencias, isGerente]);

  // Manejar creación de nueva cooperativa
  const handleGuardarNuevaCoop = async (payload) => {
    const editing = Boolean(coopEditando);
    if (!editing && !isSuperAdmin) throw new Error('Solo SuperAdmin puede registrar cooperativas.');
    if (editing && !isSuperAdmin && (!isGerente || Number(coopEditando.id) !== Number(coopId))) {
      throw new Error('Solo puedes editar tu cooperativa asignada.');
    }
    const resp = await fetch(`${API_URL}/admin/cooperativas${editing ? `/${coopEditando.id}` : ''}`, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json',
        ...(authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {}),
        'x-user-role': authUser?.rol || '', 'x-user-cooperativa-id': String(coopId || '') },
      body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.cooperativa?.id) throw new Error(data?.error || 'No se pudo guardar la cooperativa. Intenta nuevamente.');
    setCooperativas(previous => editing
      ? previous.map(item => Number(item.id) === Number(data.cooperativa.id) ? { ...item, ...data.cooperativa } : item)
      : [data.cooperativa, ...previous]);
    mostrarAlerta(
      editing
        ? `Cooperativa "${data.cooperativa.nombre}" actualizada correctamente.`
        : `Cooperativa "${data.cooperativa.nombre}" registrada y gerente ${data.gerente?.correo || ''} asignado automáticamente.`
    );
  };

  // Manejar eliminación de cooperativa
  const handleEliminarCoop = async (id, nombre) => {
    if (!confirm(`¿Confirmas la eliminación de la cooperativa "${nombre}" y su flota asociada?`)) return;
    try {
      const resp = await fetch(`${API_URL}/admin/cooperativas/${id}`, {
        method: 'DELETE',
        headers: {
          ...(authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {}),
          'x-user-role': authUser?.rol || 'SUPERADMIN',
          'x-user-cooperativa-id': String(coopId || '')
        }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setCooperativas(cooperativas.filter(c => c.id !== id));
      mostrarAlerta(`Cooperativa "${nombre}" eliminada correctamente.`);
    } catch (err) {
      mostrarAlerta(err.message || `No se pudo eliminar la cooperativa "${nombre}".`);
    }
  };

  // Guardar únicamente respuestas confirmadas por el backend.
  const handleGuardarBranding = async (coopActualizada) => {
    const resp = await fetch(`${API_URL}/admin/cooperativas/${coopActualizada.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json",
        ...(authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {}),
        "x-user-role": authUser?.rol || "", "x-user-cooperativa-id": String(coopId || "") },
      body: JSON.stringify(coopActualizada)
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.cooperativa?.id) throw new Error(data?.error || "No se pudo guardar la identidad visual.");
    setCooperativas(previous => previous.map(coop => Number(coop.id) === Number(data.cooperativa.id) ? { ...coop, ...data.cooperativa } : coop));
    setModalBrandingAbierto(false);
    mostrarAlerta("Identidad visual actualizada correctamente.");
  };

  const handleGuardarBus = async (payload) => {
    if (!isGerente && !isSuperAdmin) throw new Error("No tienes permiso para guardar unidades.");
    if (isGerente && (!coopId || (busEditando && Number(busEditando.cooperativa_id) !== Number(coopId)))) {
      throw new Error("Solo puedes gestionar tu cooperativa asignada.");
    }
    const resp = await fetch(`${API_URL}/admin/buses${busEditando ? `/${busEditando.id}` : ""}`, {
      method: busEditando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", ...(authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {}),
        "x-user-role": authUser?.rol || "", "x-user-cooperativa-id": String(coopId || "") },
      body: JSON.stringify({ ...payload, cooperativa_id: isGerente ? Number(coopId) : payload.cooperativa_id })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.bus?.id) throw new Error(data?.error || "No se pudo guardar la unidad. Tus datos se conservan para reintentar.");
    setBuses(previous => busEditando ? previous.map(bus => Number(bus.id) === Number(data.bus.id) ? data.bus : bus) : [...previous, data.bus]);
    mostrarAlerta("Unidad guardada correctamente.");
  };

  // Cambiar estado de Bus (OPERATIVO <-> MANTENIMIENTO)
  const handleToggleEstadoBus = async (bus) => {
    const nuevoEstado = bus.estado === 'OPERATIVO' ? 'MANTENIMIENTO' : 'OPERATIVO';
    try {
      await fetch(`${API_URL}/admin/buses/${bus.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {}),
          'x-user-role': authUser?.rol || '',
          'x-user-cooperativa-id': String(coopId || '')
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });
    } catch (e) {
      console.warn('Estado modificado localmente:', e);
    }
    setBuses(buses.map(b => b.id === bus.id ? { ...b, estado: nuevoEstado } : b));
    mostrarAlerta(`Bus #${bus.numero_disco} marcado como ${nuevoEstado}.`);
  };

  // Eliminar Bus
  const handleEliminarBus = async (id, disco) => {
    if (!confirm(`¿Seguro que deseas dar de baja y eliminar el bus #${disco}?`)) return;
    try {
      const resp = await fetch(`${API_URL}/admin/buses/${id}`, {
        method: 'DELETE',
        headers: {
          ...(authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {}),
          'x-user-role': authUser?.rol || '',
          'x-user-cooperativa-id': String(coopId || '')
        }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setBuses(buses.filter(b => b.id !== id));
      mostrarAlerta(`Bus #${disco} eliminado del sistema.`);
    } catch (err) {
      mostrarAlerta(err.message || `No se pudo eliminar el bus #${disco}.`);
    }
  };

  const esResolucionValida = (res) => /^(ANT|RES|RESOL)-[A-Z0-9-]{3,20}$/i.test(String(res || '').trim());

  const paradasListaFormulario = formFrecuencia.paradas_intermedias
    ? formFrecuencia.paradas_intermedias.split(',').map(p => p.trim()).filter(Boolean)
    : [];

  const handleAgregarParada = (nombreParada) => {
    const limpia = String(nombreParada || nuevaParadaTexto || '').trim();
    if (!limpia) return;
    if (limpia.toLowerCase() === formFrecuencia.origen.trim().toLowerCase() || limpia.toLowerCase() === formFrecuencia.destino.trim().toLowerCase()) {
      return mostrarAlerta('La parada intermedia no puede ser igual al punto de origen o destino final.');
    }
    if (paradasListaFormulario.some(p => p.toLowerCase() === limpia.toLowerCase())) {
      return mostrarAlerta(`La parada "${limpia}" ya está agregada en el recorrido.`);
    }
    const nuevaLista = [...paradasListaFormulario, limpia];
    setFormFrecuencia({ ...formFrecuencia, paradas_intermedias: nuevaLista.join(', ') });
    setNuevaParadaTexto('');
  };

  const handleQuitarParada = (idx) => {
    const nuevaLista = paradasListaFormulario.filter((_, i) => i !== idx);
    setFormFrecuencia({ ...formFrecuencia, paradas_intermedias: nuevaLista.join(', ') });
  };

  const handleMoverParada = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= paradasListaFormulario.length) return;
    const copia = [...paradasListaFormulario];
    const temp = copia[idx];
    copia[idx] = copia[target];
    copia[target] = temp;
    setFormFrecuencia({ ...formFrecuencia, paradas_intermedias: copia.join(', ') });
  };

  // Guardar o Actualizar Frecuencia ANT
  const handleGuardarFrecuencia = async (e) => {
    e.preventDefault();
    if (!formFrecuencia.resolucion_ant || !formFrecuencia.destino) return;

    if (!esResolucionValida(formFrecuencia.resolucion_ant)) {
      return mostrarAlerta('El formato de la Resolución ANT es inválido. Use ej: ANT-RES-2026-001');
    }
    if (formFrecuencia.origen.trim().toLowerCase() === formFrecuencia.destino.trim().toLowerCase()) {
      return mostrarAlerta('El origen y el destino de la frecuencia deben ser diferentes.');
    }

    if (isGerente && !coopId) return mostrarAlerta('Vuelve a iniciar sesión con una cooperativa asignada.');
    const coopTargetId = isGerente ? Number(coopId) : Number(formFrecuencia.cooperativa_id);
    const paradasList = formFrecuencia.tipo_servicio === 'PARADAS'
      ? paradasListaFormulario
      : [];

    if (formFrecuencia.tipo_servicio === 'PARADAS' && paradasList.length === 0) {
      return mostrarAlerta('Para la modalidad PARADAS INTERMEDIAS debes agregar al menos una parada en el recorrido (FREC-06).');
    }

    const payloadFrecuencia = {
      ...formFrecuencia,
      resolucion_ant: formFrecuencia.resolucion_ant.trim().toUpperCase(),
      cooperativa_id: coopTargetId,
      paradas_intermedias: paradasList,
      es_destacada: Boolean(formFrecuencia.es_destacada),
      patrocinio_inicio: formFrecuencia.patrocinio_inicio || null,
      patrocinio_fin: formFrecuencia.patrocinio_fin || null
    };

    const authHeaders = {
      'Content-Type': 'application/json',
      ...(authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {})
    };

    if (frecuenciaEditandoId) {
      // Modo Edición / Actualización
      try {
        const resp = await fetch(`${API_URL}/admin/frecuencias/${frecuenciaEditandoId}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(payloadFrecuencia)
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data?.frecuencia) {
          throw new Error(data?.error || 'No se pudo actualizar la frecuencia.');
        }
        const coopObj = cooperativas.find(c => c.id === coopTargetId);
        const frecActualizada = {
          ...data.frecuencia,
          cooperativa_nombre: coopObj ? coopObj.nombre : (isGerente ? coopAsignadaNombre : 'Cooperativa')
        };
        setFrecuencias(prev => prev.map(f => f.id === frecuenciaEditandoId ? frecActualizada : f));
        mostrarAlerta(`Frecuencia "${frecActualizada.resolucion_ant}" actualizada exitosamente.`);
        setFrecuenciaEditandoId(null);
      } catch (err) {
        mostrarAlerta(err.message || 'No se pudo actualizar la frecuencia.');
        return;
      }
    } else {
      // Modo Creación
      try {
        const resp = await fetch(`${API_URL}/admin/frecuencias`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payloadFrecuencia)
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data?.frecuencia) {
          throw new Error(data?.error || 'No se pudo registrar la frecuencia.');
        }
        const coopObj = cooperativas.find(c => c.id === coopTargetId);
        const nuevaFrec = {
          ...data.frecuencia,
          cooperativa_nombre: coopObj ? coopObj.nombre : (isGerente ? coopAsignadaNombre : 'Cooperativa')
        };
        setFrecuencias([...frecuencias, nuevaFrec]);
        mostrarAlerta(`Frecuencia "${formFrecuencia.origen} - ${formFrecuencia.destino}" autorizada por ANT.`);
      } catch (err) {
        mostrarAlerta(err.message || 'No se pudo registrar la frecuencia.');
        return;
      }
    }

    setNuevaParadaTexto('');
    setFormFrecuencia({
      cooperativa_id: coopTargetId,
      resolucion_ant: '',
      origen: 'Ambato',
      destino: '',
      hora_salida: '08:00',
      precio_base: '4.50',
      tipo_servicio: 'DIRECTO',
      paradas_intermedias: '',
      es_destacada: false,
      patrocinio_inicio: '',
      patrocinio_fin: ''
    });
  };

  const toLocalDateTimeInput = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Cargar Frecuencia para Edición
  const handleEditarFrecuenciaClick = (frec) => {
    setFrecuenciaEditandoId(frec.id);
    setFormFrecuencia({
      cooperativa_id: frec.cooperativa_id || (isGerente ? coopId : 1),
      resolucion_ant: frec.resolucion_ant || '',
      origen: frec.origen || 'Ambato',
      destino: frec.destino || '',
      hora_salida: frec.hora_salida ? frec.hora_salida.substring(0, 5) : '08:00',
      precio_base: frec.precio_base ? String(frec.precio_base) : '4.50',
      tipo_servicio: frec.tipo_servicio || 'DIRECTO',
      paradas_intermedias: Array.isArray(frec.paradas_intermedias) ? frec.paradas_intermedias.join(', ') : (frec.paradas_intermedias || ''),
      es_destacada: Boolean(frec.es_destacada),
      patrocinio_inicio: toLocalDateTimeInput(frec.patrocinio_inicio),
      patrocinio_fin: toLocalDateTimeInput(frec.patrocinio_fin)
    });
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  // Cancelar Edición
  const handleCancelarEdicionFrecuencia = () => {
    setFrecuenciaEditandoId(null);
    setFormFrecuencia({
      cooperativa_id: isGerente ? Number(coopId) : 1,
      resolucion_ant: '',
      origen: 'Ambato',
      destino: '',
      hora_salida: '08:00',
      precio_base: '4.50',
      tipo_servicio: 'DIRECTO',
      paradas_intermedias: '',
      es_destacada: false,
      patrocinio_inicio: '',
      patrocinio_fin: ''
    });
  };

  // Toggle rápido o Cancelación de Emergencia de Patrocinio
  const handleToggleDestacada = async (frecId, nuevoEstado) => {
    try {
      const resp = await fetch(`${API_URL}/admin/frecuencias/${frecId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {})
        },
        body: JSON.stringify({ es_destacada: nuevoEstado })
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.error || 'No se pudo actualizar el estado de patrocinio.');
      setFrecuencias(prev => prev.map(f => f.id === frecId ? { ...f, es_destacada: nuevoEstado } : f));
      mostrarAlerta(nuevoEstado ? '⭐ Ruta marcada como destacada con éxito.' : '🚫 Patrocinio cancelado de inmediato.');
    } catch (err) {
      mostrarAlerta(err.message || 'No se pudo actualizar el patrocinio.');
    }
  };

  // Eliminar Frecuencia
  const handleEliminarFrecuencia = async (id, resolucion) => {
    if (!confirm(`¿Deseas dar de baja la frecuencia oficial ${resolucion}?`)) return;
    try {
      const resp = await fetch(`${API_URL}/admin/frecuencias/${id}`, {
        method: 'DELETE',
        headers: authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : {}
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.error || 'No se pudo eliminar la frecuencia.');
      setFrecuencias(frecuencias.filter(f => f.id !== id));
      mostrarAlerta(`Frecuencia ${resolucion} eliminada con éxito.`);
    } catch (err) {
      mostrarAlerta(err.message || 'No se pudo eliminar la frecuencia.');
    }
  };

  // Guardar Usuario
  const handleGuardarUsuario = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formUsuario,
        cooperativa_id: isGerente ? authUser?.cooperativa_id : formUsuario.cooperativa_id
      };
      const response = await fetch(`${API_URL}/admin/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authUser?.token || ''}` },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.usuario) {
        throw new Error(data?.error || 'No se pudo crear el usuario.');
      }
      mostrarAlerta(`Usuario ${formUsuario.nombre} creado exitosamente con rol ${formUsuario.rol}.`);
      setModalUsuarioAbierto(false);
      setFormUsuario({ nombre: '', correo: '', telefono: '', rol: 'OFICINISTA', cooperativa_id: isGerente ? authUser?.cooperativa_id : 1, password: '', bus_id: '', sucursal_id: '' });
      if (typeof cargarUsuarios === 'function') cargarUsuarios();
    } catch (error) {
      mostrarAlerta(error.message);
    }
  };

  const mostrarAlerta = (msg) => {
    setAlerta(msg);
    setTimeout(() => setAlerta(null), 4000);
  };

  return (
    <div style={styles.container}>
      {/* Barra superior de encabezado adaptativa por Rol (Banner completo con imagen para Cooperativa - COOP-21) */}
      {(() => {
        const coopActiva = isGerente
          ? (cooperativas.find(c => Number(c.id) === Number(coopId)) || cooperativasVisibles[0])
          : null;
        const colorCoop = coopActiva?.color_distintivo || '#1D4ED8';
        const bgImage = resolveMediaUrl(coopActiva?.logo_url);

        return (
          <header
            style={
              isGerente
                ? {
                    ...styles.header,
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '18px',
                    padding: '1.75rem 2rem',
                    marginBottom: '1.75rem',
                    minHeight: '165px',
                    color: '#FFFFFF',
                    backgroundImage: bgImage
                      ? `linear-gradient(92deg, ${colorCoop}F2 0%, ${colorCoop}D9 48%, rgba(15, 23, 42, 0.35) 100%), url("${bgImage}")`
                      : `linear-gradient(120deg, ${colorCoop} 0%, #0F172A 100%)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: `2px solid ${colorCoop}`,
                    boxShadow: '0 12px 28px -6px rgba(15, 23, 42, 0.25)'
                  }
                : styles.header
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.35rem', flexWrap: 'wrap', zIndex: 1 }}>
              {isGerente && (
                bgImage ? (
                  <img
                    key={`banner-logo-${bgImage}`}
                    src={bgImage}
                    alt={coopAsignadaNombre}
                    style={{
                      width: '135px',
                      height: '100px',
                      borderRadius: '14px',
                      objectFit: 'contain',
                      padding: '4px',
                      background: '#FFFFFF',
                      border: '3px solid #FFFFFF',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.28)',
                      flexShrink: 0
                    }}
                    onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div
                    style={{
                      width: '110px',
                      height: '100px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.18)',
                      border: '3px solid #FFFFFF',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '2rem',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                      flexShrink: 0
                    }}
                  >
                    {coopAsignadaNombre.slice(0, 2).toUpperCase()}
                  </div>
                )
              )}
              <div>
                <div
                  style={{
                    ...styles.badgeRol,
                    background: isGerente ? 'rgba(255, 255, 255, 0.95)' : '#FEF3C7',
                    color: isGerente ? colorCoop : '#92400E',
                    borderColor: isGerente ? '#FFFFFF' : '#FDE68A',
                    boxShadow: isGerente ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
                  }}
                >
                  {isGerente ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800 }}>
                      <Briefcase size={14} /> GERENTE DE COOPERATIVA · {coopAsignadaNombre.toUpperCase()}
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Shield size={14} /> SUPERADMINISTRADOR & QA GLOBAL
                    </span>
                  )}
                </div>
                <h1
                  style={{
                    ...styles.mainTitle,
                    color: isGerente ? '#FFFFFF' : '#0F172A',
                    textShadow: isGerente ? '0 2px 10px rgba(0,0,0,0.35)' : 'none',
                    fontSize: isGerente ? '1.95rem' : styles.mainTitle.fontSize
                  }}
                >
                  {isGerente ? `Panel de Gerencia · ${coopAsignadaNombre}` : 'Panel de Gestión y Flotas Interprovinciales'}
                </h1>
                <p
                  style={{
                    ...styles.subtitle,
                    color: isGerente ? 'rgba(255, 255, 255, 0.92)' : '#64748B',
                    fontWeight: isGerente ? 500 : 400
                  }}
                >
                  {isGerente
                    ? `Supervisión exclusiva de unidades, frecuencias autorizadas y marca corporativa para ${coopAsignadaNombre}.`
                    : 'Supervisión de Cooperativas, Asignación ANT y Coherencia de Asientos'}
                </p>
              </div>
            </div>
            <div style={{ ...styles.headerActions, zIndex: 1 }}>
              <button
                onClick={cargarDatos}
                style={
                  isGerente
                    ? { ...styles.btnSecondary, background: 'rgba(255,255,255,0.95)', color: '#0F172A', border: 'none', fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
                    : styles.btnSecondary
                }
                title="Recargar datos"
              >
                <RefreshCw size={16} />
                <span>Sincronizar</span>
              </button>
              {(isSuperAdmin || isGerente) && (
                <button
                  onClick={() => {
                    const defaultCoop = isGerente ? (Number(coopId) || 1) : (Number(cooperativas[0]?.id) || 1);
                    setFormUsuario(prev => ({
                      ...prev,
                      rol: 'CHOFER',
                      cooperativa_id: defaultCoop,
                      bus_id: '',
                      sucursal_id: ''
                    }));
                    setModalUsuarioAbierto(true);
                  }}
                  style={
                    isGerente
                      ? { ...styles.btnSecondary, background: 'rgba(255,255,255,0.95)', color: '#0F172A', border: 'none', fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
                      : styles.btnSecondary
                  }
                  title="Registrar Chofer, Oficinista o personal adicional"
                >
                  <Users size={16} />
                  <span>Personal (Chofer / Taquilla)</span>
                </button>
              )}
              <button
                onClick={() => {
                  localStorage.removeItem('transporte_auth');
                  if (onLogout) onLogout();
                  window.location.hash = 'login';
                }}
                style={
                  isGerente
                    ? { ...styles.btnLogout, background: '#FEF2F2', color: '#DC2626', border: '2px solid #FECACA', fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
                    : styles.btnLogout
                }
              >
                <LogOut size={16} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </header>
        );
      })()}

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
            <div style={styles.kpiLabel}>
              {isGerente ? 'Cooperativa Gestionada' : 'Cooperativas Activas'}
            </div>
            <div style={styles.kpiValue}>
              {isGerente ? '1 Asignada' : `${metricas.cooperativas_activas} / ${metricas.total_cooperativas}`}
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIconWrapper, background: '#F0FDF4', color: '#166534' }}>
            <Bus size={24} />
          </div>
          <div>
            <div style={styles.kpiLabel}>
              {isGerente ? 'Flota de la Cooperativa' : 'Flota Total de Buses'}
            </div>
            <div style={styles.kpiValue}>{metricas.total_buses} unidades</div>
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
          <span>{isGerente ? 'Mi Cooperativa & Branding' : 'Cooperativas & Branding'}</span>
        </button>
        <button
          onClick={() => setTabActiva('buses')}
          style={{ ...styles.tabBtn, ...(tabActiva === 'buses' ? styles.tabBtnActive : {}) }}
        >
          <Bus size={18} />
          <span>Gestión de Buses</span>
        </button>
        <button
          onClick={() => setTabActiva('frecuencias')}
          style={{ ...styles.tabBtn, ...(tabActiva === 'frecuencias' ? styles.tabBtnActive : {}) }}
        >
          <Route size={18} />
          <span>Frecuencias Oficiales (ANT)</span>
        </button>
        {(isGerente || isSuperAdmin) && <button onClick={() => setTabActiva('planificacion')}
          style={{ ...styles.tabBtn, ...(tabActiva === 'planificacion' ? styles.tabBtnActive : {}) }}>
          <Clock size={18} /><span>Grupos y hojas de ruta</span>
        </button>}
        <button onClick={() => setTabActiva('estructuras')} style={{ ...styles.tabBtn, ...(tabActiva === 'estructuras' ? styles.tabBtnActive : {}) }}>
          <Bus size={18} /><span>Plantillas y estructuras</span>
        </button>
      </nav>

      {tabActiva === 'planificacion' && <HojaRuta usuario={authUser} />}
      {tabActiva === 'estructuras' && <BusStructures buses={busesVisibles} user={authUser} onBusStructureUpdated={cargarDatos} />}

      {/* ==================================================== */}
      {/* PESTAÑA 1: COOPERATIVAS & BRANDING */}
      {/* ==================================================== */}
      {tabActiva === 'cooperativas' && (
        <section>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                {isGerente ? 'Información Institucional de su Cooperativa' : 'Directorio de Cooperativas Afiliadas'}
              </h2>
              <p style={styles.sectionSubtitle}>
                {isGerente
                  ? 'Configura la identidad visual, colores corporativos y cuentas bancarias oficiales de su empresa.'
                  : 'Administra las empresas autorizadas, configuración bancaria e identidad institucional.'}
              </p>
            </div>
            {!isGerente && (
              <button onClick={() => { setCoopEditando(null); setModalNuevaCoopAbierto(true); }} style={styles.btnPrimary}>
                <Plus size={18} />
                <span>Nueva Cooperativa (+ Gerente)</span>
              </button>
            )}
          </div>

          <div style={styles.coopGrid}>
            {cooperativasVisibles.map((coop) => (
              <div key={coop.id} style={styles.coopCard}>
                <div style={styles.coopCardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                    {coop.logo_url ? (
                      <img
                        key={`card-logo-${coop.id}-${coop.logo_url}`}
                        src={resolveMediaUrl(coop.logo_url)}
                        alt={`Logo ${coop.nombre}`}
                        style={{
                          width: '72px',
                          height: '72px',
                          borderRadius: '14px',
                          objectFit: 'contain',
                          backgroundColor: '#FFFFFF',
                          border: `3px solid ${coop.color_distintivo || '#1E40AF'}`,
                          padding: '4px',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                          flexShrink: 0
                        }}
                        onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '14px',
                        backgroundColor: coop.color_distintivo || '#1E40AF',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '1.4rem',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                        flexShrink: 0
                      }}>
                        {String(coop.nombre || 'CO').slice(0, 2).toUpperCase()}
                      </div>
                    )}
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
                  <div style={{
                    background: coop.gerente_correo ? '#F0FDF4' : '#FFFBEB',
                    border: `1px solid ${coop.gerente_correo ? '#BBF7D0' : '#FDE68A'}`,
                    borderRadius: '8px',
                    padding: '0.45rem 0.65rem',
                    marginBottom: '0.35rem',
                    fontSize: '0.78rem',
                    color: coop.gerente_correo ? '#166534' : '#92400E',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.1rem'
                  }}>
                    <strong>👤 Gerente: {coop.gerente_nombre || 'Sin asignar'}</strong>
                    {coop.gerente_correo && <span style={{ opacity: 0.9 }}>{coop.gerente_correo}</span>}
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Banco:</span>
                    <span style={styles.infoVal}>{coop.banco || 'Banco Pichincha'}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Cuenta:</span>
                    <span style={styles.infoVal}>{coop.cuenta_bancaria || 'No asignada'}</span>
                  </div>
                  {coop.telefono && (
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Teléfono:</span>
                      <span style={styles.infoVal}>{coop.telefono}</span>
                    </div>
                  )}
                  {coop.direccion && (
                    <div style={styles.infoRow}>
                      <span style={styles.infoLabel}>Matriz:</span>
                      <span style={styles.infoVal}>{coop.direccion}</span>
                    </div>
                  )}
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Color de Marca:</span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: coop.color_distintivo || '#1E40AF', display: 'inline-block', border: '1px solid #CBD5E1' }} />
                      <code style={styles.colorCode}>{coop.color_distintivo || '#1E40AF'}</code>
                    </div>
                  </div>
                </div>

                <div style={{ ...styles.coopCardFooter, display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button className="button secondary" onClick={() => { setCoopEditando(coop); setModalNuevaCoopAbierto(true); }}>
                    <Edit2 size={16} /> Editar perfil
                  </button>
                  <button
                    onClick={() => {
                      setCoopSeleccionadaBranding(coop);
                      setModalBrandingAbierto(true);
                    }}
                    style={{ ...styles.btnBranding, flex: 1 }}
                  >
                    <Palette size={16} />
                    <span>Personalizar Marca</span>
                  </button>
                  {!isGerente && (
                    <button
                      onClick={() => handleEliminarCoop(coop.id, coop.nombre)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '38px',
                        height: '38px',
                        minWidth: '38px',
                        backgroundColor: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: '6px',
                        color: '#DC2626',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0
                      }}
                      title="Eliminar cooperativa"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
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
              <h2 style={styles.panelTitle}>Administrar unidades</h2>
              <p style={styles.panelSubtitle}>Registra los datos técnicos, las fotografías y el propietario de cada unidad.</p>
              <button type="button" className="button primary" onClick={() => { setBusEditando(null); setModalBusAbierto(true); }}>Registrar unidad</button>
            </div>

            {/* Listado de buses */}
            <div style={styles.panelList}>
              <h2 style={styles.panelTitle}>
                {isGerente ? `Flota de ${coopAsignadaNombre} (${busesVisibles.length} unidades)` : `Flota Registrada (${busesVisibles.length} unidades)`}
              </h2>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Disco</th>
                      <th style={styles.th}>Cooperativa</th>
                      <th style={styles.th}>Placa</th>
                      <th style={styles.th}>Capacidad / Configuración</th>
                      <th style={styles.th}>Estado</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {busesVisibles.map((bus) => (
                      <tr key={bus.id} style={styles.tr}>
                        <td style={styles.td}>
                          <span style={styles.discoBadge}>#{bus.numero_disco}</span>
                        </td>
                        <td style={styles.td}>
                          <strong>{bus.cooperativa_nombre || (isGerente ? coopAsignadaNombre : 'CITA')}</strong>
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
                          <span style={bus.estado === 'OPERATIVO' ? styles.badgeActive : styles.badgeInactive}>
                            {bus.estado || 'OPERATIVO'}
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button type="button" className="button secondary" onClick={() => setBusDetalle(bus)}>Ver más</button>
                            <button type="button" className="button secondary" onClick={() => { setBusEditando(bus); setModalBusAbierto(true); }}>Editar unidad</button>
                            <button
                              onClick={() => handleToggleEstadoBus(bus)}
                              title={bus.estado === 'OPERATIVO' ? 'Pasar a Mantenimiento' : 'Pasar a Operativo'}
                              style={{
                                background: '#F8FAFC',
                                border: '1px solid #CBD5E1',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}
                            >
                              {bus.estado === 'OPERATIVO' ? '🔧 Mant.' : '✅ Oper.'}
                            </button>
                            <button
                              onClick={() => handleEliminarBus(bus.id, bus.numero_disco)}
                              title="Dar de baja y eliminar bus"
                              style={{
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                color: '#DC2626',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
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
              <h2 style={styles.panelTitle}>
                {frecuenciaEditandoId ? '✏️ Editar Frecuencia Oficial' : 'Registrar Frecuencia ANT'}
              </h2>
              <p style={styles.panelSubtitle}>
                {frecuenciaEditandoId
                  ? 'Modifique datos operacionales, paradas o vigencia de patrocinio.'
                  : 'Resolución oficial emitida por la Agencia Nacional de Tránsito.'}
              </p>

              <form onSubmit={handleGuardarFrecuencia} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {!isGerente && (
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
                )}

                <div>
                    <label style={styles.formLabel}>Resolución ANT (formato oficial)</label>
                  <input
                    type="text"
                    required
                    placeholder="ANT-RES-2026-001"
                    value={formFrecuencia.resolucion_ant}
                    onChange={(e) => setFormFrecuencia({ ...formFrecuencia, resolucion_ant: e.target.value.toUpperCase() })}
                    style={{
                      ...styles.formInput,
                      borderColor: !formFrecuencia.resolucion_ant
                        ? '#CBD5E1'
                        : esResolucionValida(formFrecuencia.resolucion_ant)
                          ? '#10B981'
                          : '#F59E0B'
                    }}
                  />
                  {formFrecuencia.resolucion_ant && (
                    <span style={{
                      display: 'block',
                      marginTop: '4px',
                      fontSize: '0.73rem',
                      fontWeight: 600,
                      color: esResolucionValida(formFrecuencia.resolucion_ant) ? '#059669' : '#D97706'
                    }}>
                      {esResolucionValida(formFrecuencia.resolucion_ant)
                        ? '✓ Resolución administrativa ANT con formato válido'
                        : '⚠️ Usa el prefijo oficial ANT-, RES- o RESOL- (p. ej., ANT-RES-2026-001).'}
                    </span>
                  )}
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
                    <label style={styles.formLabel}>Hora de salida</label>
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
                    <label style={styles.formLabel}>Tarifa base (USD)</label>
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
                  <label style={styles.formLabel}>Modalidad de Servicio (FREC-05)</label>
                  <select
                    value={formFrecuencia.tipo_servicio}
                    onChange={(e) => setFormFrecuencia({
                      ...formFrecuencia,
                      tipo_servicio: e.target.value,
                      paradas_intermedias: e.target.value === 'DIRECTO' ? '' : formFrecuencia.paradas_intermedias
                    })}
                    style={styles.formInput}
                  >
                    <option value="DIRECTO">DIRECTO (Terminal a Terminal sin escalas)</option>
                    <option value="PARADAS">PARADAS INTERMEDIAS (Embarque y desembarque en ruta)</option>
                  </select>
                </div>

                {formFrecuencia.tipo_servicio === 'DIRECTO' ? (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#166534', fontWeight: 500 }}>
                    ⚡ <strong>Servicio Directo:</strong> Viaje expreso de <strong>{formFrecuencia.origen || 'Origen'}</strong> a <strong>{formFrecuencia.destino || 'Destino'}</strong> sin paradas intermedias.
                  </div>
                ) : (
                  <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ ...styles.formLabel, margin: 0, color: '#1E293B' }}>
                        📍 Módulo de Paradas Intermedias ({paradasListaFormulario.length} registradas)
                      </label>
                      <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>En orden de recorrido</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="text"
                        placeholder="Escribir ciudad/cantón de parada (ej: Latacunga)"
                        value={nuevaParadaTexto}
                        onChange={(e) => setNuevaParadaTexto(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAgregarParada();
                          }
                        }}
                        style={{ ...styles.formInput, flex: 1, fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAgregarParada()}
                        style={{ background: '#1D4ED8', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '0 0.85rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        + Añadir Parada
                      </button>
                    </div>

                    {/* Sugerencias rápidas de cantones frecuentes */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748B', marginRight: '2px' }}>Sugerencias rápidas:</span>
                      {['Latacunga', 'Salcedo', 'Machachi', 'Riobamba', 'Aloasí', 'El Pingue', 'Totoras', 'Baños', 'Cuenca'].map(canton => (
                        <button
                          key={canton}
                          type="button"
                          onClick={() => handleAgregarParada(canton)}
                          style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '2px 8px', fontSize: '0.7rem', color: '#334155', cursor: 'pointer' }}
                        >
                          + {canton}
                        </button>
                      ))}
                    </div>

                    {/* Lista ordenada de paradas con controles de orden */}
                    {paradasListaFormulario.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                        {paradasListaFormulario.map((parada, idx) => (
                          <div
                            key={`${parada}-${idx}`}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem' }}
                          >
                            <span style={{ fontWeight: 600, color: '#1E293B' }}>
                              <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', background: '#EFF6FF', color: '#1D4ED8', textAlign: 'center', lineHeight: '20px', fontSize: '0.7rem', marginRight: '6px' }}>
                                {idx + 1}
                              </span>
                              {parada}
                            </span>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoverParada(idx, -1)}
                                title="Subir orden"
                                style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '1px 5px', fontSize: '0.7rem', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.4 : 1 }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={idx === paradasListaFormulario.length - 1}
                                onClick={() => handleMoverParada(idx, 1)}
                                title="Bajar orden"
                                style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '1px 5px', fontSize: '0.7rem', cursor: idx === paradasListaFormulario.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === paradasListaFormulario.length - 1 ? 0.4 : 1 }}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuitarParada(idx)}
                                title="Quitar parada"
                                style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', borderRadius: '4px', padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: '#B45309', background: '#FEF3C7', padding: '6px 8px', borderRadius: '6px' }}>
                        ⚠️ Agregue al menos una parada intermedia para habilitar el servicio por tramos.
                      </div>
                    )}

                    {/* Vista previa visual del itinerario completo */}
                    <div style={{ fontSize: '0.74rem', color: '#475569', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '6px 8px' }}>
                      <strong>Itinerario completo:</strong>{' '}
                      🟢 {formFrecuencia.origen || 'Origen'}{' '}
                      {paradasListaFormulario.map((p, i) => `➔ 📍 ${p} (${i + 1})`).join(' ')}{' '}
                      ➔ 🔴 {formFrecuencia.destino || 'Destino'}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#FEF3C7', padding: '0.75rem', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <input
                      type="checkbox"
                      id="checkFrecDestacada"
                      checked={formFrecuencia.es_destacada}
                      onChange={(e) => setFormFrecuencia({ ...formFrecuencia, es_destacada: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#D97706' }}
                    />
                    <label htmlFor="checkFrecDestacada" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400E', cursor: 'pointer', margin: 0 }}>
                      ⭐ Frecuencia Destacada / Patrocinada (Prioridad en Búsqueda - VENT-14)
                    </label>
                  </div>

                  {formFrecuencia.es_destacada && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px dashed #FCD34D' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#92400E', display: 'block', marginBottom: '2px' }}>Inicio Patrocinio (Opcional)</label>
                        <input
                          type="datetime-local"
                          value={formFrecuencia.patrocinio_inicio}
                          onChange={(e) => setFormFrecuencia({ ...formFrecuencia, patrocinio_inicio: e.target.value })}
                          style={{ ...styles.formInput, padding: '4px 6px', fontSize: '0.78rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#92400E', display: 'block', marginBottom: '2px' }}>Fin / Expiración (Opcional)</label>
                        <input
                          type="datetime-local"
                          value={formFrecuencia.patrocinio_fin}
                          onChange={(e) => setFormFrecuencia({ ...formFrecuencia, patrocinio_fin: e.target.value })}
                          style={{ ...styles.formInput, padding: '4px 6px', fontSize: '0.78rem' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" style={styles.btnPrimary}>
                  <Route size={18} />
                  <span>{frecuenciaEditandoId ? 'Guardar Cambios de Frecuencia' : 'Registrar Frecuencia Oficial'}</span>
                </button>

                {frecuenciaEditandoId && (
                  <button
                    type="button"
                    onClick={handleCancelarEdicionFrecuencia}
                    style={{ ...styles.btnSecondary, width: '100%', justifyContent: 'center' }}
                  >
                    Cancelar Edición
                  </button>
                )}
              </form>
            </div>

            {/* Listado de Frecuencias */}
            <div style={styles.panelList}>
              <h2 style={styles.panelTitle}>
                {isGerente ? `Rutas Autorizadas ANT de ${coopAsignadaNombre} (${frecuenciasVisibles.length})` : `Rutas Autorizadas ANT (${frecuenciasVisibles.length})`}
              </h2>
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
                      <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {frecuenciasVisibles.map((frec) => (
                      <tr key={frec.id} style={styles.tr}>
                        <td style={styles.td}><code>{frec.resolucion_ant}</code></td>
                        <td style={styles.td}><strong>{frec.cooperativa_nombre || (isGerente ? coopAsignadaNombre : 'Cooperativa')}</strong></td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>{frec.origen} ➔ {frec.destino}</span>
                            {frec.es_destacada ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '0.7rem', background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>
                                  ⭐ Destacada
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleDestacada(frec.id, false)}
                                  title="Cancelar patrocinio inmediatamente ante contingencia"
                                  style={{
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    color: '#DC2626',
                                    fontSize: '0.65rem',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                  }}
                                >
                                  Cancelar Patrocinio
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleDestacada(frec.id, true)}
                                title="Activar patrocinio rápido"
                                style={{
                                  background: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  color: '#64748B',
                                  fontSize: '0.65rem',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                ☆ Destacar
                              </button>
                            )}
                          </div>
                          {Array.isArray(frec.paradas_intermedias) && frec.paradas_intermedias.length > 0 && (
                            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                              Paradas: {frec.paradas_intermedias.join(' ➔ ')}
                            </div>
                          )}
                          {frec.patrocinio_fin && (
                            <div style={{ fontSize: '0.68rem', color: '#B45309', marginTop: '1px' }}>
                              Vence: {new Date(frec.patrocinio_fin).toLocaleDateString()} {new Date(frec.patrocinio_fin).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}
                            </div>
                          )}
                        </td>
                        <td style={styles.td}>{shortTime(frec.hora_salida)}</td>
                        <td style={styles.td}><strong style={{ color: '#059669' }}>{money(frec.precio_base)}</strong></td>
                        <td style={styles.td}>
                          <span style={frec.tipo_servicio === 'DIRECTO' ? styles.badgeActive : styles.badgeInactive}>
                            {frec.tipo_servicio}
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                            <button
                              onClick={() => handleEditarFrecuenciaClick(frec)}
                              title="Editar frecuencia oficial"
                              style={{
                                background: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                color: '#2563EB',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                cursor: 'pointer'
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleEliminarFrecuencia(frec.id, frec.resolucion_ant)}
                              title="Eliminar frecuencia"
                              style={{
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                color: '#DC2626',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
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
          isOpen={true}
          onClose={() => { setModalNuevaCoopAbierto(false); setCoopEditando(null); }}
          onGuardar={handleGuardarNuevaCoop}
          cooperativa={coopEditando}
          user={authUser}
        />
      )}

      {/* Modal de Personalización Branding */}
      {busDetalle && <BusDetails bus={busDetalle} onClose={() => setBusDetalle(null)} />}
      {modalBusAbierto && <BusForm bus={busEditando} cooperativas={cooperativasVisibles} cooperativeId={coopId}
        isManager={isGerente} user={authUser} onSave={handleGuardarBus} onClose={() => { setModalBusAbierto(false); setBusEditando(null); }} />}
      {modalBrandingAbierto && coopSeleccionadaBranding && (
        <PersonalizacionBranding
          cooperativa={coopSeleccionadaBranding}
          cooperativas={cooperativas}
          user={authUser}
          onClose={() => {
            setModalBrandingAbierto(false);
            setCoopSeleccionadaBranding(null);
          }}
          onGuardar={handleGuardarBranding}
        />
      )}

      {/* Modal rápido para Registrar Personal Operativo */}
      {modalUsuarioAbierto && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.2rem', color: '#0F172A' }}>Registrar Personal Operativo</h3>
            <p style={{
              margin: '0 0 0.9rem', fontSize: '0.78rem', color: '#1E3A8A',
              background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '0.55rem 0.75rem'
            }}>
              Los <strong>Gerentes</strong> de cooperativas nuevas se asignan automáticamente dentro de <strong>«Nueva Cooperativa (+ Gerente)»</strong>. Usa este formulario para registrar <strong>Choferes</strong>, <strong>Oficinistas de taquilla</strong> o personal adicional.
            </p>
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
                <label style={styles.formLabel}>Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="carlos@transporteuta.com"
                  value={formUsuario.correo}
                  onChange={(e) => setFormUsuario({ ...formUsuario, correo: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div>
                <label style={styles.formLabel}>Teléfono</label>
                <input
                  type="text"
                  placeholder="0991234567"
                  value={formUsuario.telefono}
                  onChange={(e) => setFormUsuario({ ...formUsuario, telefono: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div>
                <label style={styles.formLabel}>Rol en el Sistema</label>
                <select
                  value={formUsuario.rol}
                  onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value, bus_id: '', sucursal_id: '' })}
                  style={styles.formInput}
                >
                  {esSuperAdmin && <option value="ADMIN_COOP">Gerente / Administrador de Cooperativa</option>}
                  <option value="OFICINISTA">Oficinista / Taquillero</option>
                  <option value="CHOFER">🚍 Chofer / Conductor de Unidad</option>
                  {esSuperAdmin && <option value="SUPERADMIN">SuperAdministrador General</option>}
                </select>
              </div>
              {formUsuario.rol === 'CHOFER' && (
                <div>
                  <label style={styles.formLabel}>Unidad / Bus Asignado (*)</label>
                  <select
                    required
                    value={formUsuario.bus_id || ''}
                    onChange={(e) => setFormUsuario({ ...formUsuario, bus_id: e.target.value })}
                    style={styles.formInput}
                  >
                    <option value="">Selecciona la unidad que conducirá</option>
                    {buses
                      .filter(b => isGerente
                        ? Number(b.cooperativa_id) === Number(coopId)
                        : (!formUsuario.cooperativa_id || Number(b.cooperativa_id) === Number(formUsuario.cooperativa_id)))
                      .map(b => (
                        <option key={b.id} value={b.id}>
                          Bus #{b.numero_disco} — Placa: {b.placa} ({b.capacidad} asientos)
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {esSuperAdmin && formUsuario.rol !== 'SUPERADMIN' && (
                <label style={styles.formLabel}>Cooperativa asignada
                  <select
                    required
                    value={cooperativas.some(c => Number(c.id) === formUsuario.cooperativa_id) ? formUsuario.cooperativa_id : ''}
                    onChange={e => setFormUsuario({ ...formUsuario, cooperativa_id: Number(e.target.value), bus_id: '', sucursal_id: '' })}
                    style={styles.formInput}
                  >
                    <option value="">Selecciona una cooperativa</option>
                    {cooperativas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </label>
              )}
              {formUsuario.rol === 'OFICINISTA' && <label style={styles.formLabel}>Sucursal asignada
                <select required style={styles.formInput} value={formUsuario.sucursal_id || ''}
                  onChange={e => setFormUsuario({ ...formUsuario, sucursal_id: e.target.value })}>
                  <option value="">Selecciona una sucursal</option>
                  {sucursalesUsuario.map(s => <option key={s.id} value={s.id}>{s.nombre} · {s.localidad}</option>)}
                </select>
                {!sucursalesUsuario.length && <small>Crea primero una sucursal en Grupos y hojas de ruta.</small>}
              </label>}
              <div>
                <label style={styles.formLabel}>Contraseña Temporal</label>
                <input
                  type="password"
                  required
                  minLength={formUsuario.rol === 'OFICINISTA' ? 8 : 6}
                  maxLength={128}
                  pattern={formUsuario.rol === 'OFICINISTA' ? '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,128}' : undefined}
                  placeholder={formUsuario.rol === 'OFICINISTA' ? 'Mayúscula, minúscula y número; mínimo 8 caracteres' : 'Mínimo 6 caracteres'}
                  value={formUsuario.password}
                  onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setModalUsuarioAbierto(false)}
                  style={{ ...styles.btnSecondary, background: '#F1F5F9' }}
                >
                  Cancelar
                </button>
                <button type="submit" style={styles.btnPrimary}>
                  Crear Usuario
                </button>
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
    padding: '1.5rem',
    maxWidth: '1280px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.75rem',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  badgeRol: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    border: '1px solid #FDE68A',
    fontWeight: '700',
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
    marginBottom: '0.5rem'
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
    padding: '0.625rem 1rem',
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    backgroundColor: '#FFFFFF',
    color: '#334155',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.875rem',
    cursor: 'pointer'
  },
  btnLogout: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    backgroundColor: '#FEF2F2',
    color: '#DC2626',
    border: '1px solid #FECACA',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '0.875rem',
    cursor: 'pointer'
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#D1FAE5',
    color: '#065F46',
    borderRadius: '8px',
    marginBottom: '1.25rem',
    fontSize: '0.875rem',
    fontWeight: '500'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1.75rem'
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
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
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#64748B',
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
    marginBottom: '1.5rem',
    overflowX: 'auto'
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
    color: '#64748B',
    fontWeight: '600',
    fontSize: '0.875rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  tabBtnActive: {
    color: '#1E40AF',
    borderBottomColor: '#1E40AF'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem'
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#0F172A',
    margin: '0 0 0.25rem 0'
  },
  sectionSubtitle: {
    fontSize: '0.8125rem',
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
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
  },
  coopCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem'
  },
  colorIndicator: {
    width: '12px',
    height: '36px',
    borderRadius: '4px',
    flexShrink: 0
  },
  coopName: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#0F172A',
    margin: 0
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
