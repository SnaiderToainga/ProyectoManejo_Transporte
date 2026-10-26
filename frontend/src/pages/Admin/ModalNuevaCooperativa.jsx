// frontend/src/pages/Admin/ModalNuevaCooperativa.jsx
import React, { useState } from 'react';

export default function ModalNuevaCooperativa({ isOpen, onClose, onGuardar }) {
  const [formData, setFormData] = useState({
    nombre: '',
    ruc: '',
    resolucion_ant: '',
    color_distintivo: '#1D4ED8',
    telefono: '',
    direccion: '',
    banco: 'Banco Pichincha',
    cuenta_bancaria: '',
    // Datos del Gerente
    gerente_nombre: '',
    gerente_cedula: '',
    gerente_correo: '',
    gerente_password: 'Gerente' + Math.floor(1000 + Math.random() * 9000) + '!'
  });

  const [errores, setErrores] = useState({});

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errores[name]) {
      setErrores((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validarFormulario = () => {
    const nuevosErrores = {};

    if (!formData.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio';
    if (!formData.ruc.trim() || formData.ruc.length !== 13) {
      nuevosErrores.ruc = 'El RUC debe tener exactamente 13 dígitos numéricos';
    }
    if (!formData.resolucion_ant.trim()) {
      nuevosErrores.resolucion_ant = 'La resolución ANT es requerida';
    }
    if (!formData.gerente_nombre.trim()) {
      nuevosErrores.gerente_nombre = 'El nombre del gerente es obligatorio';
    }
    if (!formData.gerente_cedula.trim() || formData.gerente_cedula.length !== 10) {
      nuevosErrores.gerente_cedula = 'La cédula debe contener 10 dígitos';
    }
    if (!formData.gerente_correo.trim() || !formData.gerente_correo.includes('@')) {
      nuevosErrores.gerente_correo = 'Ingrese un correo electrónico válido';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    const nuevaCoop = {
      id: Date.now(),
      nombre: formData.nombre,
      ruc: formData.ruc,
      resolucion_ant: formData.resolucion_ant,
      color_distintivo: formData.color_distintivo,
      telefono: formData.telefono || 'Sin registrar',
      direccion: formData.direccion || 'Ambato, Ecuador',
      banco: formData.banco,
      cuenta_bancaria: formData.cuenta_bancaria || 'No especificada',
      activo: true,
      gerente: {
        nombre: formData.gerente_nombre,
        cedula: formData.gerente_cedula,
        correo: formData.gerente_correo,
        telefono: formData.telefono
      },
      flota: {
        total_buses: 0,
        buses_40_asientos: 0,
        buses_41_asientos: 0
      }
    };

    onGuardar(nuevaCoop, {
      correo: formData.gerente_correo,
      password: formData.gerente_password,
      rol: 'ADMIN_COOP'
    });

    onClose();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modalCard}>
        {/* Cabecera del Modal */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Alta de Cooperativa y Credenciales</h2>
            <p style={styles.subtitle}>
              Registro oficial de cooperativa de transporte interprovincial y cuenta de Gerente
            </p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.formContainer}>
          {/* SECCIÓN 1: DATOS DE LA COOPERATIVA */}
          <div style={styles.sectionHeader}>
            <span style={styles.sectionBadge}>1</span>
            <h3 style={styles.sectionTitle}>Datos Institucionales y Normativa ANT</h3>
          </div>

          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Nombre de la Cooperativa *</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Ej. Cooperativa Flota Tungurahua"
                style={errores.nombre ? { ...styles.input, ...styles.inputError } : styles.input}
              />
              {errores.nombre && <span style={styles.errorText}>{errores.nombre}</span>}
            </div>

            <div>
              <label style={styles.label}>RUC de la Empresa (13 dígitos) *</label>
              <input
                type="text"
                name="ruc"
                maxLength="13"
                value={formData.ruc}
                onChange={handleChange}
                placeholder="1890012345001"
                style={errores.ruc ? { ...styles.input, ...styles.inputError } : styles.input}
              />
              {errores.ruc && <span style={styles.errorText}>{errores.ruc}</span>}
            </div>

            <div>
              <label style={styles.label}>Resolución Oficial ANT *</label>
              <input
                type="text"
                name="resolucion_ant"
                value={formData.resolucion_ant}
                onChange={handleChange}
                placeholder="Ej. ANT-RES-2024-550"
                style={errores.resolucion_ant ? { ...styles.input, ...styles.inputError } : styles.input}
              />
              {errores.resolucion_ant && <span style={styles.errorText}>{errores.resolucion_ant}</span>}
            </div>

            <div>
              <label style={styles.label}>Color Corporativo Distintivo (HEX)</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  name="color_distintivo"
                  value={formData.color_distintivo}
                  onChange={handleChange}
                  style={styles.colorPicker}
                />
                <input
                  type="text"
                  name="color_distintivo"
                  value={formData.color_distintivo}
                  onChange={handleChange}
                  style={{ ...styles.input, fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div>
              <label style={styles.label}>Teléfono de Contacto</label>
              <input
                type="text"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="032820000"
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.label}>Dirección Matriz</label>
              <input
                type="text"
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                placeholder="Av. 12 de Noviembre y Américas"
                style={styles.input}
              />
            </div>
          </div>

          {/* SECCIÓN 2: DATOS BANCARIOS */}
          <div style={styles.sectionHeader}>
            <span style={styles.sectionBadge}>2</span>
            <h3 style={styles.sectionTitle}>Cuenta para Recaudación de Boletos</h3>
          </div>

          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Entidad Bancaria</label>
              <select
                name="banco"
                value={formData.banco}
                onChange={handleChange}
                style={styles.input}
              >
                <option value="Banco Pichincha">Banco Pichincha</option>
                <option value="Banco del Pacífico">Banco del Pacífico</option>
                <option value="Banco de Guayaquil">Banco de Guayaquil</option>
                <option value="Produbanco">Produbanco</option>
                <option value="Cooperativa Mushuc Runa">Cooperativa Mushuc Runa</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>Número de Cuenta</label>
              <input
                type="text"
                name="cuenta_bancaria"
                value={formData.cuenta_bancaria}
                onChange={handleChange}
                placeholder="2200113344 (Ahorros o Corriente)"
                style={styles.input}
              />
            </div>
          </div>

          {/* SECCIÓN 3: CREDENCIALES DEL GERENTE */}
          <div style={styles.sectionHeader}>
            <span style={styles.sectionBadge}>3</span>
            <h3 style={styles.sectionTitle}>Generación de Credenciales de Gerencia (ADMIN_COOP)</h3>
          </div>

          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Nombre Completo del Gerente *</label>
              <input
                type="text"
                name="gerente_nombre"
                value={formData.gerente_nombre}
                onChange={handleChange}
                placeholder="Ej. Ing. Marco Paredes"
                style={errores.gerente_nombre ? { ...styles.input, ...styles.inputError } : styles.input}
              />
              {errores.gerente_nombre && <span style={styles.errorText}>{errores.gerente_nombre}</span>}
            </div>

            <div>
              <label style={styles.label}>Cédula del Gerente (10 dígitos) *</label>
              <input
                type="text"
                name="gerente_cedula"
                maxLength="10"
                value={formData.gerente_cedula}
                onChange={handleChange}
                placeholder="1801234567"
                style={errores.gerente_cedula ? { ...styles.input, ...styles.inputError } : styles.input}
              />
              {errores.gerente_cedula && <span style={styles.errorText}>{errores.gerente_cedula}</span>}
            </div>

            <div>
              <label style={styles.label}>Correo Electrónico Oficial *</label>
              <input
                type="email"
                name="gerente_correo"
                value={formData.gerente_correo}
                onChange={handleChange}
                placeholder="gerencia@transporte.ec"
                style={errores.gerente_correo ? { ...styles.input, ...styles.inputError } : styles.input}
              />
              {errores.gerente_correo && <span style={styles.errorText}>{errores.gerente_correo}</span>}
            </div>

            <div>
              <label style={styles.label}>Contraseña Temporal de Acceso</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="gerente_password"
                  value={formData.gerente_password}
                  readOnly
                  style={{ ...styles.input, backgroundColor: '#F3F4F6', fontWeight: 'bold' }}
                />
                <span style={styles.tagRol}>Rol: ADMIN_COOP</span>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div style={styles.footer}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancelar
            </button>
            <button type="submit" style={styles.saveBtn}>
              Guardar y Emitir Credenciales
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    maxWidth: '750px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #E5E7EB',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#0F172A',
    margin: 0
  },
  subtitle: {
    fontSize: '13px',
    color: '#64748B',
    margin: '4px 0 0 0'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#94A3B8'
  },
  formContainer: {
    padding: '20px 24px'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '18px 0 12px 0'
  },
  sectionBadge: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1E293B',
    margin: 0
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#334155',
    marginBottom: '4px'
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '14px',
    color: '#1E293B',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2'
  },
  colorPicker: {
    width: '42px',
    height: '38px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: 'transparent'
  },
  tagRol: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    backgroundColor: '#DBEAFE',
    color: '#1E40AF',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  errorText: {
    color: '#DC2626',
    fontSize: '11px',
    marginTop: '2px',
    display: 'block'
  },
  footer: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #E5E7EB',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  cancelBtn: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#475569',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  saveBtn: {
    padding: '10px 22px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1E40AF',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  }
};
