// frontend/src/pages/Admin/PersonalizacionBranding.jsx
import React, { useState } from 'react';

export default function PersonalizacionBranding({ cooperativas, onActualizarCoop }) {
  const [selectedId, setSelectedId] = useState(cooperativas[0]?.id || 1);
  const coop = cooperativas.find((c) => c.id === Number(selectedId)) || cooperativas[0];

  const [color, setColor] = useState(coop?.color_distintivo || '#1D4ED8');
  const [logoUrl, setLogoUrl] = useState(coop?.logo_url || '');
  const [telefono, setTelefono] = useState(coop?.telefono || '');
  const [direccion, setDireccion] = useState(coop?.direccion || '');
  const [guardadoMsg, setGuardadoMsg] = useState(false);

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
      setGuardadoMsg(false);
    }
  };

  const handleGuardarCambios = (e) => {
    e.preventDefault();
    if (onActualizarCoop && coop) {
      onActualizarCoop(coop.id, {
        color_distintivo: color,
        logo_url: logoUrl,
        telefono,
        direccion
      });
      setGuardadoMsg(true);
      setTimeout(() => setGuardadoMsg(false), 3000);
    }
  };

  if (!coop) {
    return <div style={{ padding: '20px' }}>No hay cooperativas registradas para personalizar.</div>;
  }

  return (
    <div style={styles.container}>
      {/* Selector de Cooperativa */}
      <div style={styles.selectorBar}>
        <label style={styles.selectorLabel}>Cooperativa seleccionada:</label>
        <select
          value={selectedId}
          onChange={(e) => handleSelectCoop(e.target.value)}
          style={styles.selectCoop}
        >
          {cooperativas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({c.ruc})
            </option>
          ))}
        </select>
      </div>

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
              <label style={styles.fieldLabel}>URL del Logotipo Institucional</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://ejemplo.com/logo-cooperativa.png"
                style={styles.textInput}
              />
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

            {guardadoMsg && (
              <div style={styles.alertSuccess}>
                ✓ Configuración institucional guardada exitosamente.
              </div>
            )}

            <button type="submit" style={styles.submitBtn}>
              Actualizar Identidad Institucional
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
                    src={logoUrl}
                    alt="Logo"
                    style={styles.ticketLogo}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <div style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: '13px' }}>
                  {coop.nombre.toUpperCase()}
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
                  <span style={styles.ticketLabel}>CÓDIGO RESERVA</span>
                  <div style={styles.ticketCode}>RES-9F3A1C</div>
                </div>
              </div>

              <div style={styles.ticketDivider} />

              <div style={styles.ticketRow}>
                <div>
                  <span style={styles.ticketLabel}>FECHA & HORA</span>
                  <div style={styles.ticketValue}>15/10/2026 | 07:00 AM</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={styles.ticketLabel}>BUS N° / DISCO</span>
                  <div style={styles.ticketValue}>Disco 15 (40 Asientos)</div>
                </div>
              </div>

              <div style={styles.ticketDivider} />

              <div style={styles.ticketRow}>
                <div>
                  <span style={styles.ticketLabel}>PASAJERO</span>
                  <div style={styles.ticketValue}>Joel (Estudiante UTA)</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>CI: 1803456789</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={styles.ticketLabel}>ASIENTO ASIGNADO</span>
                  <div style={{ ...styles.seatBadge, color: color }}>
                    N° 04 (VIP)
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
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
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
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '1px solid rgba(255,255,255,0.4)'
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
