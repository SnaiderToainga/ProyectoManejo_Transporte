import { validarCedulaEcuador, validarCelularEcuador, validarPassword, validarResolucionANT } from './validation.js';

export function cooperativeDraft(cooperative = {}) {
  const manager = cooperative.gerente || {};
  return {
    nombre: cooperative.nombre || '', ruc: cooperative.ruc || '',
    resolucion_ant: cooperative.resolucion_ant || '', telefono: cooperative.telefono || '',
    direccion: cooperative.direccion || '', correo: cooperative.correo || '', color_distintivo: cooperative.color_distintivo || '#1D4ED8',
    logo_url: cooperative.logo_url || '', banco: cooperative.banco || 'Banco Pichincha',
    cuenta_bancaria: cooperative.cuenta_bancaria || '',
    gerente_nombre: manager.nombre || '', gerente_cedula: manager.cedula || '',
    gerente_correo: manager.correo || '', gerente_telefono: manager.telefono || '', gerente_password: '',
  };
}

export function safeImageUrl(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    const url = new URL(value, 'https://local.invalid');
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? value : '';
  } catch { return ''; }
}

export function cooperativeErrors(form, step, editing = false) {
  const errors = {};
  if (step === 0) {
    if (!form.nombre.trim()) errors.nombre = 'Escribe el nombre de la cooperativa.';
    if (!/^\d{10}001$/.test(form.ruc)) errors.ruc = 'El RUC debe tener 13 dígitos y terminar en 001.';
    if (!validarResolucionANT(form.resolucion_ant)) errors.resolucion_ant = 'Ingresa una resolución ANT válida (ej. ANT-RES-2026-001).';
    if (!validarCelularEcuador(form.telefono)) errors.telefono = 'Ingresa un celular de 10 dígitos que empiece por 09.';
    if (!form.direccion.trim()) errors.direccion = 'Escribe la dirección de la matriz.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim())) errors.correo = 'Ingresa el correo institucional de la cooperativa.';
  }
  if (step === 2 && !editing) {
    if (form.gerente_nombre.trim().length < 3) errors.gerente_nombre = 'Escribe el nombre completo del gerente.';
    if (!validarCedulaEcuador(form.gerente_cedula)) errors.gerente_cedula = 'La cédula no supera la validación Módulo 10.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.gerente_correo.trim())) errors.gerente_correo = 'Ingresa un correo válido.';
    if (!validarCelularEcuador(form.gerente_telefono)) errors.gerente_telefono = 'Ingresa un celular válido que empiece por 09.';
    if (!validarPassword(form.gerente_password) || !/[^a-z0-9]/i.test(form.gerente_password)) errors.gerente_password = 'Usa de 8 a 128 caracteres, mayúscula, minúscula, número y símbolo.';
  }
  if (step === 1) {
    if (!/^#[0-9a-f]{6}$/i.test(form.color_distintivo)) errors.color_distintivo = 'Ingresa un color HEX de seis dígitos.';
    if (form.logo_url && !safeImageUrl(form.logo_url)) errors.logo_url = 'Usa una dirección HTTP o HTTPS para el logo.';
    if (!form.banco.trim()) errors.banco = 'Especifica el banco.';
    if (!/^\d{6,30}$/.test(form.cuenta_bancaria)) errors.cuenta_bancaria = 'Ingresa de 6 a 30 dígitos para la cuenta.';
  }
  return errors;
}

export function cooperativePayload(form, cooperative) {
  const payload = Object.fromEntries(['nombre', 'ruc', 'resolucion_ant', 'telefono', 'direccion', 'correo',
    'color_distintivo', 'logo_url', 'banco', 'cuenta_bancaria'].map(key => [key, form[key].trim()]));
  if (cooperative) return { ...payload, id: cooperative.id };
  return { ...payload, gerente: { nombre: form.gerente_nombre.trim(), cedula: form.gerente_cedula,
    correo: form.gerente_correo.trim().toLowerCase(), telefono: form.gerente_telefono,
    password: form.gerente_password, rol: 'ADMIN_COOP' } };
}
