import { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { shortTime, today } from '../../lib/format.js';
import { API_BASE } from '../../lib/env.js';
import { 
  Bus, QrCode, CheckCircle2, AlertTriangle, XCircle, Play, CheckCheck, 
  RefreshCw, Volume2, VolumeX, Camera, Search, Upload, LogOut
} from 'lucide-react';

const getApiBase = () => API_BASE;

// Generador de sonidos con Web Audio API para feedback auditivo en puerta
const playBeep = (type = 'success') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      // Tono agudo y positivo (dos beeps rápidos ascendentes)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Tono grave de alerta (dos pulsos graves)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
      osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.15); // E3
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 450);
  } catch {}
};

export default function ChoferPanel({ usuario = null, onVolverInicio, onLogout }) {
  const esChofer = usuario?.rol === 'CHOFER';
  const [viajes, setViajes] = useState([]);
  const [cargandoViajes, setCargandoViajes] = useState(true);
  const [viajeSeleccionado, setViajeSeleccionado] = useState(null);
  const [manifiesto, setManifiesto] = useState(null);
  const [cargandoManifiesto, setCargandoManifiesto] = useState(false);

  // Escaneo y validación de boletos
  const [inputCodigo, setInputCodigo] = useState('');
  const [resultadoValidacion, setResultadoValidacion] = useState(null);
  const [procesandoValidacion, setProcesandoValidacion] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [sonidoHabilitado, setSonidoHabilitado] = useState(true);
  const [filtroPasajeros, setFiltroPasajeros] = useState('TODOS'); // TODOS, VALIDADOS, PENDIENTES
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Filtros operativos del chofer (bloqueados y autoasignados si es Chofer con unidad)
  const [coopSeleccionada, setCoopSeleccionada] = useState(
    esChofer && usuario?.cooperativa_nombre ? usuario.cooperativa_nombre : 'TODAS'
  );
  const [discoSeleccionado, setDiscoSeleccionado] = useState(
    esChofer && usuario?.bus_disco ? String(usuario.bus_disco) : 'TODOS'
  );

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const animFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const camaraActivaRef = useRef(false);
  const viajeSeleccionadoRef = useRef(null);

  useEffect(() => {
    viajeSeleccionadoRef.current = viajeSeleccionado;
  }, [viajeSeleccionado]);

  const authHeaders = (extra = {}) => ({
    ...extra,
    ...(usuario?.token ? { Authorization: `Bearer ${usuario.token}` } : {}),
  });

  // 1. Cargar viajes del día
  const cargarViajes = async () => {
    setCargandoViajes(true);
    setErrorMsg('');
    try {
      let url = `${getApiBase()}/chofer/viajes`;
      const params = new URLSearchParams();
      params.append('fecha', today());
      if (esChofer && usuario?.cooperativa_id) {
        params.append('cooperativa_id', usuario.cooperativa_id);
        if (usuario.bus_id) params.append('bus_id', usuario.bus_id);
        else if (usuario.bus_disco) params.append('disco', usuario.bus_disco);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data?.error || 'Error al consultar viajes');
      const list = Array.isArray(data) ? data : [];
      setViajes(list);

      // Si no hay viaje seleccionado o el seleccionado ya no existe, seleccionar el primero activo
      if (list.length > 0) {
        const prev = viajeSeleccionadoRef.current;
        if (!prev) {
          const viajeEnRuta = list.find(v => v.estado === 'EN_RUTA') || list[0];
          setViajeSeleccionado(viajeEnRuta);
        } else {
          const actual = list.find(v => v.id === prev.id);
          if (actual) setViajeSeleccionado(actual);
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'No se pudieron cargar los viajes del día. Verifique la conexión.');
    } finally {
      setCargandoViajes(false);
    }
  };

  useEffect(() => {
    cargarViajes();
  }, [usuario?.token]);

  // 2. Cargar manifiesto cuando cambia el viaje seleccionado
  const cargarManifiesto = async (viajeId) => {
    if (!viajeId) return;
    setCargandoManifiesto(true);
    try {
      const res = await fetch(`${getApiBase()}/chofer/viajes/${viajeId}/manifiesto`, {
        headers: authHeaders()
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Error al cargar manifiesto');
      setManifiesto(data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'No se pudo cargar el manifiesto del viaje.');
    } finally {
      setCargandoManifiesto(false);
    }
  };

  useEffect(() => {
    if (viajeSeleccionado?.id) {
      cargarManifiesto(viajeSeleccionado.id);
    }
  }, [viajeSeleccionado?.id]);

  // 3. Iniciar Viaje (Requerimiento RUTA-16)
  const handleIniciarViaje = async (viajeId) => {
    if (!confirm('¿Confirmas el inicio de este trayecto? El estado cambiará a "EN RUTA".')) return;
    try {
      const res = await fetch(`${getApiBase()}/chofer/viajes/${viajeId}/iniciar`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al iniciar viaje');
      await cargarViajes();
      await cargarManifiesto(viajeId);
      if (sonidoHabilitado) playBeep('success');
    } catch (err) {
      alert(`No se pudo iniciar el viaje: ${err.message}`);
    }
  };

  // 4. Finalizar Viaje (Requerimiento RUTA-16)
  const handleFinalizarViaje = async (viajeId) => {
    if (!confirm('¿Deseas finalizar este viaje? El estado cambiará a "FINALIZADO" y concluirá el servicio.')) return;
    try {
      const res = await fetch(`${getApiBase()}/chofer/viajes/${viajeId}/finalizar`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al finalizar viaje');
      await cargarViajes();
      await cargarManifiesto(viajeId);
      if (sonidoHabilitado) playBeep('success');
    } catch (err) {
      alert(`No se pudo finalizar el viaje: ${err.message}`);
    }
  };

  // 5. Validar Boleto por QR o Código (Requerimiento VENT-05)
  const ejecutarValidacion = async (payloadTexto) => {
    if (!payloadTexto || !payloadTexto.trim()) return;
    const activeTrip = viajeSeleccionadoRef.current || viajeSeleccionado;
    setProcesandoValidacion(true);
    setResultadoValidacion(null);

    try {
      const res = await fetch(`${getApiBase()}/chofer/validar-qr`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          qr_payload: payloadTexto.trim(),
          programacion_id: activeTrip?.id
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.valido) {
        setResultadoValidacion({
          tipo: 'EXITO',
          mensaje: data.mensaje,
          pasajero: data.pasajero,
          asiento: data.asiento,
          cedula: data.cedula,
          codigo: data.codigo_reserva,
          ruta: data.ruta
        });
        if (sonidoHabilitado) playBeep('success');
        setInputCodigo('');
        // Recargar manifiesto para actualizar contadores
        if (activeTrip?.id) cargarManifiesto(activeTrip.id);
      } else {
        setResultadoValidacion({
          tipo: data.ya_usado ? 'DUPLICADO' : 'ERROR',
          mensaje: data.mensaje || data.error || 'Boleto inválido o no reconocido',
          pasajero: data.pasajero,
          asiento: data.asiento,
          cedula: data.cedula,
          codigo: data.codigo_reserva
        });
        if (sonidoHabilitado) playBeep('error');
      }
    } catch (err) {
      setResultadoValidacion({
        tipo: 'ERROR',
        mensaje: `Error de conexión: ${err.message}`
      });
      if (sonidoHabilitado) playBeep('error');
    } finally {
      setProcesandoValidacion(false);
    }
  };

  // 6. Alternar abordaje manual de emergencia
  const handleToggleManual = async (boletoId) => {
    try {
      const res = await fetch(`${getApiBase()}/chofer/boletos/${boletoId}/toggle-abordaje`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al actualizar');
      if (sonidoHabilitado) playBeep('success');
      if (viajeSeleccionadoRef.current?.id) cargarManifiesto(viajeSeleccionadoRef.current.id);
    } catch (err) {
      alert(err.message);
    }
  };

  // 7. Lector de QR universal optimizado (BarcodeDetector + jsQR con reescalado móvil)
  const handleFileCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesandoValidacion(true);
    setResultadoValidacion(null);

    try {
      const blobUrl = URL.createObjectURL(file);
      const img = new Image();

      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('No se pudo cargar la imagen tomada'));
        img.src = blobUrl;
      });

      let qrEncontrado = null;

      // 1. Intentar primero con BarcodeDetector nativo si está disponible
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(img);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            qrEncontrado = barcodes[0].rawValue;
          }
        } catch {}
      }

      // 2. Si no se detectó, reescalar a tamaño óptimo (máx 1000px) para escaneo ultra rápido con jsQR
      if (!qrEncontrado) {
        let width = img.width;
        let height = img.height;
        const maxDim = 1000;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (code && code.data) {
          qrEncontrado = code.data;
        }
      }

      URL.revokeObjectURL(blobUrl);

      if (qrEncontrado) {
        await ejecutarValidacion(qrEncontrado);
      } else {
        setProcesandoValidacion(false);
        alert('No se detectó ningún código QR legible en la imagen. Por favor toma la foto un poco más de cerca y enfocada.');
      }
    } catch (err) {
      setProcesandoValidacion(false);
      alert(err.message || 'Error al procesar la imagen del QR');
    } finally {
      e.target.value = '';
    }
  };

  const iniciarCamara = async () => {
    setResultadoValidacion(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Tu navegador no admite cámara en vivo aquí. Usa "Tomar Foto / Subir QR" o ingresa el código manualmente.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      camaraActivaRef.current = true;
      setCamaraActiva(true);
    } catch (err) {
      console.warn('No se pudo acceder a la cámara trasera:', err);
      alert('No se pudo iniciar la cámara en este navegador. Puedes usar "Tomar Foto / Subir QR" o ingresar el código manualmente.');
      detenerCamara();
    }
  };

  const detenerCamara = () => {
    camaraActivaRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCamaraActiva(false);
  };

  const escanearFrame = async () => {
    if (!videoRef.current || !camaraActivaRef.current) return;
    try {
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        if (detectorRef.current) {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            const qrVal = barcodes[0].rawValue;
            detenerCamara();
            ejecutarValidacion(qrVal);
            return;
          }
        } else {
          // Fallback con jsQR (Firefox y navegadores sin BarcodeDetector nativo)
          if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
          const canvas = canvasRef.current;
          canvas.width = videoRef.current.videoWidth || 640;
          canvas.height = videoRef.current.videoHeight || 480;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'dontInvert'
          });
          if (code && code.data) {
            detenerCamara();
            ejecutarValidacion(code.data);
            return;
          }
        }
      }
    } catch {}
    if (camaraActivaRef.current) {
      animFrameRef.current = requestAnimationFrame(escanearFrame);
    }
  };

  useEffect(() => {
    if (!camaraActiva || !streamRef.current || !videoRef.current) return;
    const videoEl = videoRef.current;
    videoEl.srcObject = streamRef.current;
    videoEl.play().catch(() => {});

    if ('BarcodeDetector' in window) {
      try {
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        detectorRef.current = null;
      }
    } else {
      detectorRef.current = null;
    }
    escanearFrame();
  }, [camaraActiva]);

  useEffect(() => {
    return () => detenerCamara();
  }, []);

  // Filtrado de pasajeros en manifiesto
  const pasajerosFiltrados = (manifiesto?.pasajeros || []).filter(p => {
    const cumpleFiltro = 
      filtroPasajeros === 'TODOS' ? true :
      filtroPasajeros === 'VALIDADOS' ? p.validado_en_puerta :
      !p.validado_en_puerta;

    const texto = busquedaTexto.toLowerCase();
    const cumpleBusqueda = !texto || 
      (p.nombre_pasajero && p.nombre_pasajero.toLowerCase().includes(texto)) ||
      (p.cedula_pasajero && p.cedula_pasajero.includes(texto)) ||
      (p.numero_asiento && String(p.numero_asiento).includes(texto)) ||
      (p.codigo_reserva && p.codigo_reserva.toLowerCase().includes(texto));

    return cumpleFiltro && cumpleBusqueda;
  });

  // Filtros operativos de cooperativa y unidad
  const listaCooperativas = ['TODAS', ...Array.from(new Set(viajes.map(v => v.cooperativa_nombre).filter(Boolean)))];
  const listaDiscos = ['TODOS', ...Array.from(new Set(viajes.map(v => v.numero_disco).filter(Boolean))).sort((a, b) => a - b)];

  const viajesFiltrados = viajes.filter(v => {
    const cumpleCoop = coopSeleccionada === 'TODAS' || v.cooperativa_nombre === coopSeleccionada;
    const cumpleDisco = discoSeleccionado === 'TODOS' || String(v.numero_disco) === String(discoSeleccionado);
    return cumpleCoop && cumpleDisco;
  });

  return (
    <div className="chofer-container" style={{ maxWidth: 860, margin: '0 auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* 1. Header Superior del Chofer */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 10px 25px -5px rgba(6, 78, 59, 0.3)',
        marginBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bus size={28} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', opacity: 0.9 }}>
                CABINA DEL CONDUCTOR · CR-04
              </div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                Control Operativo de Viaje
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setSonidoHabilitado(!sonidoHabilitado)}
              title={sonidoHabilitado ? 'Sonido activado' : 'Sonido silenciado'}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {sonidoHabilitado ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={cargarViajes}
              disabled={cargandoViajes}
              title="Actualizar viajes"
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              <RefreshCw size={16} className={cargandoViajes ? 'spin' : ''} />
              Refrescar
            </button>
            {usuario && onLogout && (
              <button
                onClick={onLogout}
                title="Cerrar sesión de cabina"
                style={{
                  background: 'rgba(239, 68, 68, 0.35)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                <LogOut size={16} />
                Salir
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mensaje de error si falla conexión o sesión */}
      {errorMsg && (
        <div role="alert" style={{
          marginBottom: '1rem',
          padding: '0.85rem 1rem',
          borderRadius: '12px',
          border: '1px solid #fecaca',
          background: '#fef2f2',
          color: '#991b1b',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem'
        }}>
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={cargarViajes}
            style={{ background: '#991b1b', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.35rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* 2. Selector de Turnos / Viajes Asignados (Requerimiento RUTA-16) */}
      <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>
              🚍 Mis Turnos Asignados de Hoy
            </h2>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Mostrando {viajesFiltrados.length} de {viajes.length} recorridos programados para hoy ({new Date().toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })})
            </div>
          </div>

          {/* Filtros de Cooperativa y Bus para que el chofer encuentre su turno de inmediato */}
          {esChofer ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#dcfce7', border: '1px solid #86efac', padding: '0.4rem 0.8rem', borderRadius: '10px' }}>
              <Bus size={18} color="#16a34a" />
              <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>
                {usuario?.bus_disco || viajeSeleccionado?.numero_disco
                  ? `Unidad #${usuario?.bus_disco || viajeSeleccionado?.numero_disco}${usuario?.bus_placa || viajeSeleccionado?.placa ? ` (${usuario?.bus_placa || viajeSeleccionado?.placa})` : ''}`
                  : 'Unidad asignada'}
                {usuario?.cooperativa_nombre ? ` · ${usuario.cooperativa_nombre}` : ''}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                value={coopSeleccionada}
                onChange={(e) => setCoopSeleccionada(e.target.value)}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '0.4rem 0.6rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b'
                }}
              >
                <option value="TODAS">🏢 Todas las Cooperativas</option>
                {listaCooperativas.filter(c => c !== 'TODAS').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={discoSeleccionado}
                onChange={(e) => setDiscoSeleccionado(e.target.value)}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '0.4rem 0.6rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b'
                }}
              >
                <option value="TODOS">🚌 Todas las Unidades</option>
                {listaDiscos.filter(d => d !== 'TODOS').map(d => (
                  <option key={d} value={d}>Unidad #{d}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {cargandoViajes ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Cargando turnos...</div>
        ) : viajesFiltrados.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', background: '#ffffff', borderRadius: '10px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.85rem' }}>
            No hay turnos para los filtros seleccionados. Pruebe seleccionando "Todas las Cooperativas".
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {viajesFiltrados.map((v) => {
              const seleccionado = viajeSeleccionado?.id === v.id;
              const enRuta = v.estado === 'EN_RUTA';
              const finalizado = v.estado === 'FINALIZADO';

              return (
                <div
                  key={v.id}
                  onClick={() => setViajeSeleccionado(v)}
                  style={{
                    border: seleccionado ? '2px solid #059669' : '1px solid #e2e8f0',
                    background: seleccionado ? '#f0fdf4' : '#ffffff',
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                    cursor: 'pointer',
                    boxShadow: seleccionado ? '0 4px 12px rgba(5, 150, 105, 0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '999px',
                      background: enRuta ? '#10b981' : finalizado ? '#94a3b8' : '#f59e0b',
                      color: '#ffffff'
                    }}>
                      {enRuta ? '● EN RUTA' : finalizado ? '✓ FINALIZADO' : '⏱ PROGRAMADO'}
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                      {shortTime(v.hora_salida_programada)}
                    </span>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.2rem' }}>
                    {v.origen} ➔ {v.destino}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span>🚌 Unidad #{v.numero_disco}</span>
                    <span>•</span>
                    <span>Placa: {v.placa}</span>
                    <span>•</span>
                    <span style={{ color: '#059669', fontWeight: 600 }}>{v.cooperativa_nombre}</span>
                  </div>

                  <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: '#475569' }}>
                      {seleccionado ? '👉 Turno Activo' : 'Clic para seleccionar'}
                    </span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>
                      Abordaje: {v.boletos_validados || 0}/{v.total_boletos || 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Panel de Operaciones del Viaje Seleccionado (RUTA-16 & VENT-05) */}
      {viajeSeleccionado && (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          marginBottom: '1.5rem'
        }}>
          {/* Cabecera del Viaje */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TURNO SELECCIONADO</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>
                {viajeSeleccionado.origen} ➔ {viajeSeleccionado.destino}
              </h3>
              <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span>🕒 Salida: <strong>{shortTime(viajeSeleccionado.hora_salida_programada)}</strong></span>
                <span>🚌 Bus #{viajeSeleccionado.numero_disco} ({viajeSeleccionado.placa})</span>
                <span>🏢 {viajeSeleccionado.cooperativa_nombre}</span>
              </div>
            </div>

            {/* Controles de Viaje: Iniciar y Finalizar (Exigencia RUTA-16 del Docente) */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {viajeSeleccionado.estado === 'PROGRAMADO' && (
                <button
                  onClick={() => handleIniciarViaje(viajeSeleccionado.id)}
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.75rem 1.25rem',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Play size={18} fill="#fff" />
                  Iniciar Viaje (En Ruta)
                </button>
              )}

              {viajeSeleccionado.estado === 'EN_RUTA' && (
                <button
                  onClick={() => handleFinalizarViaje(viajeSeleccionado.id)}
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.75rem 1.25rem',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <CheckCheck size={18} />
                  Finalizar Viaje (Llegada)
                </button>
              )}

              {viajeSeleccionado.estado === 'FINALIZADO' && (
                <span style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '0.6rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}>
                  ✓ Viaje Completado
                </span>
              )}
            </div>
          </div>

          {/* 4. Escáner QR de Boletos en Puerta (VENT-05) */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={22} style={{ color: '#059669' }} />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                  Validación de Boletos en Puerta (Escáner QR)
                </h4>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', background: '#d1fae5', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                VENT-05
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0' }}>
              Escanee el código QR del boleto del pasajero al abordar para autorizar el ingreso y prevenir fraude por doble uso.
            </p>

            {/* Opciones de Escaneo */}
            {viajeSeleccionado.estado === 'FINALIZADO' && (
              <div style={{ fontSize: '0.82rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.55rem 0.8rem', marginBottom: '0.85rem', fontWeight: 600 }}>
                Este viaje ya fue finalizado. La validación en puerta está deshabilitada.
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                type="button"
                disabled={viajeSeleccionado.estado === 'FINALIZADO'}
                onClick={camaraActiva ? detenerCamara : iniciarCamara}
                style={{
                  background: camaraActiva ? '#ef4444' : '#0f172a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.65rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: viajeSeleccionado.estado === 'FINALIZADO' ? 'not-allowed' : 'pointer',
                  opacity: viajeSeleccionado.estado === 'FINALIZADO' ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Camera size={16} />
                {camaraActiva ? 'Apagar Cámara' : 'Escanear con Cámara'}
              </button>

              <button
                type="button"
                disabled={viajeSeleccionado.estado === 'FINALIZADO'}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.65rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: viajeSeleccionado.estado === 'FINALIZADO' ? 'not-allowed' : 'pointer',
                  opacity: viajeSeleccionado.estado === 'FINALIZADO' ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
                }}
              >
                <Upload size={16} />
                Tomar Foto / Subir QR
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileCapture}
              />

              <form 
                onSubmit={(e) => { e.preventDefault(); if (viajeSeleccionado.estado !== 'FINALIZADO') ejecutarValidacion(inputCodigo); }}
                style={{ display: 'flex', flex: 1, minWidth: 240, gap: '0.35rem' }}
              >
                <input
                  type="text"
                  disabled={viajeSeleccionado.estado === 'FINALIZADO'}
                  placeholder="Pegar QR o Código Reserva (ej: RES-123456)..."
                  value={inputCodigo}
                  onChange={(e) => setInputCodigo(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.65rem 0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}
                />
                <button
                  type="submit"
                  disabled={viajeSeleccionado.estado === 'FINALIZADO' || procesandoValidacion || !inputCodigo.trim()}
                  style={{
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1rem',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: viajeSeleccionado.estado === 'FINALIZADO' ? 'not-allowed' : 'pointer',
                    opacity: viajeSeleccionado.estado === 'FINALIZADO' ? 0.5 : 1
                  }}
                >
                  {procesandoValidacion ? 'Validando...' : 'Validar'}
                </button>
              </form>
            </div>

            {/* Visor de Cámara de Video */}
            {camaraActiva && (
              <div style={{ textAlign: 'center', background: '#000', borderRadius: '12px', padding: '0.5rem', marginBottom: '1rem', overflow: 'hidden' }}>
                <video
                  ref={videoRef}
                  style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '8px' }}
                  playsInline
                  muted
                />
                <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                  Apunte la cámara al código QR impreso o en pantalla del pasajero
                </div>
              </div>
            )}

            {/* Resultado de la Validación (Alerta Visual Gigante) */}
            {resultadoValidacion && (
              <div style={{
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                border: resultadoValidacion.tipo === 'EXITO' 
                  ? '2px solid #10b981' 
                  : resultadoValidacion.tipo === 'DUPLICADO' 
                    ? '2px solid #f59e0b' 
                    : '2px solid #ef4444',
                background: resultadoValidacion.tipo === 'EXITO' 
                  ? '#ecfdf5' 
                  : resultadoValidacion.tipo === 'DUPLICADO' 
                    ? '#fffbeb' 
                    : '#fef2f2',
                animation: 'fadeIn 0.3s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  {resultadoValidacion.tipo === 'EXITO' ? (
                    <CheckCircle2 size={32} style={{ color: '#059669', flexShrink: 0 }} />
                  ) : resultadoValidacion.tipo === 'DUPLICADO' ? (
                    <AlertTriangle size={32} style={{ color: '#d97706', flexShrink: 0 }} />
                  ) : (
                    <XCircle size={32} style={{ color: '#dc2626', flexShrink: 0 }} />
                  )}

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 800,
                      fontSize: '1.05rem',
                      color: resultadoValidacion.tipo === 'EXITO' 
                        ? '#065f46' 
                        : resultadoValidacion.tipo === 'DUPLICADO' 
                          ? '#92400e' 
                          : '#991b1b'
                    }}>
                      {resultadoValidacion.tipo === 'EXITO' 
                        ? '¡ABORDAJE AUTORIZADO!' 
                        : resultadoValidacion.tipo === 'DUPLICADO' 
                          ? '¡ALERTA! BOLETO YA VALIDADO PREVIAMENTE' 
                          : 'ABORDAJE DENEGADO'}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.25rem' }}>
                      {resultadoValidacion.mensaje}
                    </div>

                    {resultadoValidacion.pasajero && (
                      <div style={{
                        marginTop: '0.5rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px dashed rgba(0,0,0,0.1)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '0.35rem',
                        fontSize: '0.8rem'
                      }}>
                        <div>👤 <strong>Pasajero:</strong> {resultadoValidacion.pasajero}</div>
                        <div>🎟 <strong>Asiento:</strong> #{resultadoValidacion.asiento}</div>
                        {resultadoValidacion.cedula && <div>🪪 <strong>Cédula:</strong> {resultadoValidacion.cedula}</div>}
                        {resultadoValidacion.codigo && <div>🔖 <strong>Reserva:</strong> {resultadoValidacion.codigo}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. Manifiesto de Pasajeros en Vivo */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                  📋 Manifiesto de Abordaje en Vivo
                </h4>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Lista de pasajeros con reserva confirmada para este trayecto
                </div>
              </div>

              {/* Filtros rápidos */}
              <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '0.2rem', borderRadius: '8px' }}>
                {['TODOS', 'VALIDADOS', 'PENDIENTES'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltroPasajeros(f)}
                    style={{
                      border: 'none',
                      background: filtroPasajeros === f ? '#ffffff' : 'transparent',
                      color: filtroPasajeros === f ? '#0f172a' : '#64748b',
                      fontWeight: filtroPasajeros === f ? 700 : 500,
                      fontSize: '0.75rem',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: filtroPasajeros === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Barra de progreso de abordaje */}
            {manifiesto?.resumen && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  <span>Pasajeros Abordados: {manifiesto.resumen.validados} de {manifiesto.resumen.total_pasajeros}</span>
                  <span>
                    {manifiesto.resumen.total_pasajeros > 0 
                      ? Math.round((manifiesto.resumen.validados / manifiesto.resumen.total_pasajeros) * 100) 
                      : 0}%
                  </span>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${manifiesto.resumen.total_pasajeros > 0 ? (manifiesto.resumen.validados / manifiesto.resumen.total_pasajeros) * 100 : 0}%`,
                    height: '100%',
                    background: '#10b981',
                    borderRadius: '999px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>
            )}

            {/* Buscador de pasajeros */}
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar por nombre, cédula o asiento..."
                value={busquedaTexto}
                onChange={(e) => setBusquedaTexto(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.5rem 0.5rem 2rem',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px'
                }}
              />
            </div>

            {/* Listado de Pasajeros */}
            {cargandoManifiesto ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>Cargando pasajeros...</div>
            ) : pasajerosFiltrados.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.85rem' }}>
                No se encontraron pasajeros para este filtro.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '360px', overflowY: 'auto' }}>
                {pasajerosFiltrados.map((p) => (
                  <div
                    key={p.boleto_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: p.validado_en_puerta ? '#f0fdf4' : '#ffffff',
                      border: p.validado_en_puerta ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: p.validado_en_puerta ? '#10b981' : '#f1f5f9',
                        color: p.validado_en_puerta ? '#fff' : '#475569',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {p.numero_asiento}
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                          {p.nombre_pasajero}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          🪪 {p.cedula_pasajero} • Reserva: {p.codigo_reserva}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '999px',
                        background: p.validado_en_puerta ? '#d1fae5' : '#fef3c7',
                        color: p.validado_en_puerta ? '#065f46' : '#92400e'
                      }}>
                        {p.validado_en_puerta ? '✓ ABORDÓ' : '⏳ PENDIENTE'}
                      </span>

                      {/* Botón de alternancia manual (para contingencias) */}
                      <button
                        disabled={viajeSeleccionado.estado === 'FINALIZADO'}
                        onClick={() => handleToggleManual(p.boleto_id)}
                        title={viajeSeleccionado.estado === 'FINALIZADO' ? 'Viaje finalizado' : (p.validado_en_puerta ? 'Desmarcar abordaje' : 'Validar abordaje manual')}
                        style={{
                          border: 'none',
                          background: p.validado_en_puerta ? '#e2e8f0' : '#10b981',
                          color: p.validado_en_puerta ? '#475569' : '#fff',
                          borderRadius: '6px',
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: viajeSeleccionado.estado === 'FINALIZADO' ? 'not-allowed' : 'pointer',
                          opacity: viajeSeleccionado.estado === 'FINALIZADO' ? 0.5 : 1
                        }}
                      >
                        {p.validado_en_puerta ? 'Desmarcar' : 'Validar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pie de página con acceso de retorno */}
      {onVolverInicio && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={onVolverInicio}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#059669',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            ← Volver a la pantalla principal de clientes
          </button>
        </div>
      )}
    </div>
  );
}

