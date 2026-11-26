// frontend/src/pages/Admin/PersonalizacionBranding.jsx
import React, { useState } from 'react';
import ImageUploadControl from '../../components/ImageUploadControl.jsx';
import { resolveMediaUrl } from '../../lib/env.js';
import { supportChannelErrors } from '../../lib/supportChannels.js';
import SupportChannels from '../../components/SupportChannels.jsx';

const SOCIAL_FIELDS = [
  { key: 'facebook_url', label: 'Facebook (URL)', placeholder: 'https://facebook.com/tu-cooperativa', type: 'url' },
  { key: 'instagram_url', label: 'Instagram (URL)', placeholder: 'https://instagram.com/tu-cooperativa', type: 'url' },
  { key: 'whatsapp_soporte', label: 'WhatsApp de soporte', placeholder: '0991234567', type: 'tel' },
  { key: 'correo_soporte', label: 'Correo de soporte', placeholder: 'soporte@cooperativa.com', type: 'email' }
];
const socialFrom = (cooperative) => Object.fromEntries(SOCIAL_FIELDS.map(({ key }) => [key, cooperative?.[key] || '']));

export default function PersonalizacionBranding({ cooperativas = [], onActualizarCoop, cooperativa = null, onClose = null, onGuardar = null, user = null }) {
  const lista = cooperativas && cooperativas.length > 0 ? cooperativas : (cooperativa ? [cooperativa] : []);
  const [selectedId, setSelectedId] = useState(cooperativa?.id || lista[0]?.id || 1);
  const coop = cooperativa || lista.find((c) => c.id === Number(selectedId)) || lista[0];

  const [color, setColor] = useState(coop?.color_distintivo || '#1D4ED8');
  const [logoUrl, setLogoUrl] = useState(coop?.logo_url || '');
  const [telefono, setTelefono] = useState(coop?.telefono || '');
  const [direccion, setDireccion] = useState(coop?.direccion || '');
  const [social, setSocial] = useState(() => socialFrom(coop));
  const socialErrors = supportChannelErrors(social);
  const [guardadoMsg, setGuardadoMsg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Paleta de colores institucionales sugeridos
  const coloresSugeridos = [
    { nombre: 'Azul Real', hex: '#1D4ED8' },
    { nombre: 'Rojo Carmesí', hex: '#DC2626' },
    { nombre: 'Verde Esmeralda', hex: '#059669' },
    { nombre: 'Ámbar Dorado', hex: '#D97706' },
    { nombre: 'Índigo Profundo', hex: '#4338CA' },
    { nombre: 'Púrpura Imperial', hex: '#7E22CE' }
  ];

  const handleSelectCoop = (id) => {
    const seleccionada = cooperativas.find((c) => c.id === Number(id));
    if (seleccionada) {
      setSelectedId(id);
      setColor(seleccionada.color_distintivo);
      setLogoUrl(seleccionada.logo_url || '');
      setTelefono(seleccionada.telefono || '');
      setDireccion(seleccionada.direccion || '');
      setSocial(socialFrom(seleccionada));
      setGuardadoMsg(false);
    }
  };

  const handleGuardarCambios = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (Object.keys(socialErrors).length) {
      setSaveError('Revisa las redes sociales y canales de soporte antes de guardar.');
      return;
    }
    if (coop) {
      const datosActualizados = {
        ...coop,
        color_distintivo: color,
        logo_url: logoUrl,
        telefono,
        direccion,
        ...Object.fromEntries(Object.entries(social).map(([key, value]) => [key, value.trim()]))
      };
      setSaving(true); setSaveError(''); setGuardadoMsg(false);
      try {
        if (onGuardar) await onGuardar(datosActualizados);
        if (onActualizarCoop) await onActualizarCoop(coop.id, datosActualizados);
        setGuardadoMsg(true);
      } catch (error) { setSaveError(error.message || 'No se pudo guardar la identidad visual.'); }
      finally { setSaving(false); }
    }
  };

  if (!coop) {
    return <div style={{ padding: '20px' }}>No hay cooperativas registradas para personalizar.</div>;
  }

  return (
    <div style={onClose ? styles.modalWrapper : {}} onClick={onClose || undefined}>
      <div
        role={onClose ? 'dialog' : undefined}
        aria-modal={onClose ? 'true' : undefined}
        style={onClose ? { ...styles.container, ...styles.modalSurface } : styles.container}
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0F172A', fontWeight: '800' }}>Personalización de Identidad Visual · {coop?.nombre}</h2>
            <button
              type="button"
              onClick={onClose}
              style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontWeight: '700', color: '#0F172A' }}
            >
              ✕ Cerrar
            </button>
          </div>
        )}
      {/* Selector de Cooperativa (Solo visible si no está fijada una cooperativa única - COOP-17) */}
      {!cooperativa && lista.length > 1 && (
        <div style={styles.selectorBar}>
          <label style={styles.selectorLabel}>Cooperativa seleccionada:</label>
          <select
            value={selectedId}
            onChange={(e) => handleSelectCoop(e.target.value)}
            style={styles.selectCoop}
          >
            {lista.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.ruc})
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={styles.layoutGrid}>
        {/* PANEL IZQUIERDO: FORMULARIO DE PERSONALIZACIÓN */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Identidad Corporativa y Canales</h3>
            <p style={styles.cardSubtitle}>
              Configura el color y marca que identifican los boletos emitidos por esta cooperativa
            </p>
          </div>

          <form onSubmit={handleGuardarCambios} style={styles.form}>
            {/* Color Distintivo */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Color Corporativo Oficial (HEX)</label>
              <div style={styles.colorRow}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={styles.colorInput}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={styles.hexInput}
                />
              </div>

              {/* Muestras predefinidas */}
              <div style={styles.swatchesContainer}>
                {coloresSugeridos.map((sug) => (
                  <button
                    key={sug.hex}
                    type="button"
                    onClick={() => setColor(sug.hex)}
                    style={{
                      ...styles.swatchBtn,
                      backgroundColor: sug.hex,
                      outline: color === sug.hex ? '3px solid #0F172A' : 'none'
                    }}
                    title={sug.nombre}
                  />
                ))}
              </div>
            </div>

            {/* Logotipo */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Logotipo Institucional (subir archivo o pegar URL)</label>
              <ImageUploadControl
                user={user}
                compact
                disabled={saving}
                buttonLabel="Subir logotipo desde tu dispositivo"
                onUploaded={(urls) => {
                  if (urls[0]) setLogoUrl(urls[0]);
                }}
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://ejemplo.com/logo-cooperativa.png o sube un archivo arriba"
                  style={{ ...styles.textInput, flex: 1 }}
                />
                {logoUrl && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setLogoUrl('')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #FCA5A5',
                      background: '#FEF2F2',
                      color: '#B91C1C',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Quitar
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px', padding: '12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                {logoUrl ? (
                  <img
                    key={`logo-form-${logoUrl}`}
                    src={resolveMediaUrl(logoUrl)}
                    alt={`Vista previa ${coop?.nombre}`}
                    style={{ width: '84px', height: '84px', borderRadius: '14px', objectFit: 'contain', backgroundColor: '#FFFFFF', border: `3px solid ${color}`, padding: '4px', boxShadow: '0 4px 10px rgba(0,0,0,0.08)' }}
                    onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div style={{ width: '84px', height: '84px', borderRadius: '14px', backgroundColor: color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.6rem' }}>
                    {String(coop?.nombre || 'CO').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0F172A' }}>Vista Previa del Logotipo Institucional</div>
                  <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '2px' }}>
                    Este logotipo se mostrará en grande en el encabezado de gerencia, en el directorio de cooperativas y en los resultados de búsqueda del cliente.
                  </div>
                </div>
              </div>
            </div>

            {/* Teléfono y Dirección */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Teléfono de Atención al Cliente</label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="032820000"
                style={styles.textInput}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Dirección de Matriz / Boletería Central</label>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Av. Principal y Terminal Terrestre"
                style={styles.textInput}
              />
            </div>

            {/* Redes sociales y canales de soporte (CR-14) */}
            <fieldset style={{ ...styles.fieldGroup, border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px' }}>
              <legend style={styles.fieldLabel}>Redes sociales y soporte</legend>
              {SOCIAL_FIELDS.map(({ key, label, placeholder, type }) => (
                <div key={key} style={{ display: 'grid', gap: '4px', marginBottom: '8px' }}>
                  <label htmlFor={`branding-${key}`} style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>{label}</label>
                  <input
                    id={`branding-${key}`}
                    type={type}
                    value={social[key]}
                    maxLength={key === 'correo_soporte' ? 120 : 500}
                    onChange={(e) => setSocial((previous) => ({ ...previous, [key]: e.target.value }))}
                    placeholder={placeholder}
                    aria-invalid={Boolean(socialErrors[key])}
                    style={styles.textInput}
                  />
                  {socialErrors[key] && <small role="alert" style={{ color: '#B91C1C' }}>{socialErrors[key]}</small>}
                </div>
              ))}
            </fieldset>

            {guardadoMsg && (
              <div style={styles.alertSuccess}>
                ✓ Configuración institucional guardada exitosamente.
              </div>
            )}

            {saveError && <p role="alert" className="inline-error">{saveError}</p>}
            <button type="submit" style={styles.submitBtn} disabled={saving}>
              {saving ? 'Guardando…' : 'Actualizar Identidad Institucional'}
            </button>
          </form>
        </div>

        {/* PANEL DERECHO: VISTA PREVIA EN VIVO DEL BOLETO PDF */}
        <div style={styles.previewContainer}>
          <div style={styles.previewHeader}>
            <span style={styles.liveBadge}>● VISTA PREVIA EN VIVO</span>
            <span style={styles.previewTitle}>Boleto Digital QR (Formato A6)</span>
          </div>

          <div style={styles.ticketCard}>
            {/* Cabecera dinámica con el color corporativo */}
            <div style={{ ...styles.ticketTopBanner, backgroundColor: color }}>
              <div style={styles.ticketCoopInfo}>
                {logoUrl && (
                  <img
                    key={`logo-ticket-${logoUrl}`}
                    src={resolveMediaUrl(logoUrl)}
                    alt="Logo"
                    style={styles.ticketLogo}
                    onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <div style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: '13px' }}>
                  {String(coop?.nombre || '').toUpperCase()}
                </div>
              </div>
              <div style={styles.ticketAntText}>
                {coop.resolucion_ant}
              </div>
            </div>

            {/* Cuerpo del Boleto */}
            <div style={styles.ticketBody}>
              <div style={styles.ticketRow}>
                <div>
                  <span style={styles.ticketLabel}>ORIGEN - DESTINO</span>
                  <div style={styles.ticketRoute}>AMBATO ➔ QUITO (QUITUMBE)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={styles.ticketLabel}>CÓDIGO DE RESERVA</span>
                  <div style={styles.ticketCode}>RES-9F3A1C</div>
                </div>
              </div>

              <div style={styles.ticketDivider} />

              <div style={styles.ticketRow}>
                <div>
                  <span style={styles.ticketLabel}>FECHA Y HORA</span>
                  <div style={styles.ticketValue}>15/10/2026 | 07:00</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={styles.ticketLabel}>BUS N.º / DISCO</span>
                  <div style={styles.ticketValue}>Disco 15 (40 asientos)</div>
                </div>
              </div>

              <div style={styles.ticketDivider} />

              <div style={styles.ticketRow}>
                <div>
                  <span style={styles.ticketLabel}>PASAJERO</span>
                  <div style={styles.ticketValue}>Joel (Estudiante UTA)</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Cédula: 1803456789</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={styles.ticketLabel}>ASIENTO ASIGNADO</span>
                  <div style={{ ...styles.seatBadge, color: color }}>
                    N.º 04 (VIP)
                  </div>
                </div>
              </div>

              {/* QR Code Simulado de Abordaje */}
              <div style={styles.qrSection}>
                <div style={styles.qrBox}>
                  <div style={{ fontSize: '32px' }}>📱</div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>
                    QR Dinámico ANT
                  </div>
                </div>
                <div style={styles.qrInstructions}>
                  Presente este boleto digital con código QR al oficinista o conductor al momento de abordar la unidad.
                </div>
              </div>
            </div>

            <div style={styles.ticketFooter}>
              <span>Atención: {telefono || '032820000'}</span>
              <span>RUC: {coop.ruc}</span>
            </div>
            <div style={{ padding: '8px 14px 12px' }}>
              <SupportChannels cooperative={social} title="Canales de soporte" compact />
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

const styles = {
  modalWrapper: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '1.5rem 1rem',
    overflowY: 'auto'
  },
  modalSurface: {
    width: 'min(980px, 100%)',
    backgroundColor: '#F8FAFC',
    borderRadius: '18px',
    padding: '1.5rem',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
    margin: 'auto 0'
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  selectorBar: {
    backgroundColor: '#FFFFFF',
    padding: '14px 20px',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  selectorLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#334155'
  },
  selectCoop: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '14px',
    color: '#0F172A',
    fontWeight: '500',
    minWidth: '320px'
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '24px'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    padding: '24px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
  },
  cardHeader: {
    marginBottom: '20px'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0F172A',
    margin: 0
  },
  cardSubtitle: {
    fontSize: '13px',
    color: '#64748B',
    marginTop: '4px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  fieldLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#334155'
  },
  colorRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  colorInput: {
    width: '46px',
    height: '42px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    backgroundColor: 'transparent'
  },
  hexInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  swatchesContainer: {
    display: 'flex',
    gap: '10px',
    marginTop: '6px'
  },
  swatchBtn: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
  },
  textInput: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '14px'
  },
  alertSuccess: {
    backgroundColor: '#ECFDF5',
    color: '#065F46',
    border: '1px solid #A7F3D0',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500'
  },
  submitBtn: {
    marginTop: '10px',
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer'
  },
  previewContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'center'
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: '380px',
    alignItems: 'center'
  },
  liveBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#10B981',
    letterSpacing: '0.05em'
  },
  previewTitle: {
    fontSize: '12px',
    color: '#64748B',
    fontWeight: '500'
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '380px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    border: '1px solid #E2E8F0'
  },
  ticketTopBanner: {
    padding: '14px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background-color 0.3s'
  },
  ticketCoopInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  ticketLogo: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    objectFit: 'cover',
    backgroundColor: '#FFFFFF',
    padding: '2px',
    border: '2px solid rgba(255,255,255,0.85)'
  },
  ticketAntText: {
    fontSize: '9px',
    color: '#FFFFFF',
    opacity: 0.9,
    fontWeight: '500'
  },
  ticketBody: {
    padding: '18px'
  },
  ticketRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  ticketLabel: {
    fontSize: '10px',
    color: '#94A3B8',
    fontWeight: 'bold',
    letterSpacing: '0.04em'
  },
  ticketRoute: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: '2px'
  },
  ticketCode: {
    fontSize: '13px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#2563EB',
    marginTop: '2px'
  },
  ticketDivider: {
    height: '1px',
    backgroundColor: '#F1F5F9',
    margin: '12px 0'
  },
  ticketValue: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1E293B',
    marginTop: '2px'
  },
  seatBadge: {
    fontSize: '14px',
    fontWeight: '800',
    marginTop: '2px'
  },
  qrSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: '12px',
    padding: '12px',
    marginTop: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    padding: '6px',
    textAlign: 'center',
    width: '60px',
    height: '60px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  qrInstructions: {
    fontSize: '11px',
    color: '#64748B',
    lineHeight: '1.4'
  },
  ticketFooter: {
    backgroundColor: '#F1F5F9',
    padding: '10px 18px',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    color: '#64748B'
  }
};
