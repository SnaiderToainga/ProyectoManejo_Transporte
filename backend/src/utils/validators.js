// backend/src/utils/validators.js

// 1. Algoritmo oficial ecuatoriano Módulo 10 para Cédula (COOP-05)
exports.validarCedulaEcuatoriana = (cedula) => {
  if (!cedula || typeof cedula !== 'string') return false;
  const clean = cedula.trim();
  if (!/^\d{10}$/.test(clean)) return false;

  const provincia = parseInt(clean.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;

  const tercerDigito = parseInt(clean.charAt(2), 10);
  if (tercerDigito >= 6) return false; // Personas naturales

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let valor = parseInt(clean.charAt(i), 10) * coeficientes[i];
    if (valor >= 10) valor -= 9;
    suma += valor;
  }

  const digitoVerificador = (10 - (suma % 10)) % 10;
  return digitoVerificador === parseInt(clean.charAt(9), 10);
};

// 2. Validación de RUC oficial (13 dígitos terminado en 001) (COOP-01)
exports.validarRucEcuatoriano = (ruc) => {
  if (!ruc || typeof ruc !== 'string') return false;
  const clean = ruc.trim();
  if (!/^\d{13}$/.test(clean)) return false;
  if (!clean.endsWith('001')) return false;
  return exports.validarCedulaEcuatoriana(clean.substring(0, 10));
};

// 3. Validación de Teléfono Celular ecuatoriano (COOP-03: comienza con 09, 10 dígitos)
exports.validarCelularEcuatoriano = (telefono) => {
  if (!telefono || typeof telefono !== 'string') return false;
  return /^09\d{8}$/.test(telefono.trim());
};

// 4. Validación de Resolución Administrativa ANT (COOP-02)
exports.validarResolucionANT = (resolucion) => {
  if (!resolucion || typeof resolucion !== 'string') return false;
  return /^(ANT|RES|RESOL)-[A-Z0-9-]{3,20}$/i.test(resolucion.trim());
};

// 5. Validación de Correo Electrónico institucional / usuario (COOP-06)
exports.validarEmail = (correo) => {
  if (!correo || typeof correo !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
};

// 6. Validación de Banco y soporte de Banco "Otro" con texto libre (COOP-08, COOP-09)
exports.validarBanco = (banco, bancoOtro) => {
  if (!banco || typeof banco !== 'string') return false;
  if (banco.trim().toLowerCase() === 'otro') {
    return Boolean(bancoOtro && typeof bancoOtro === 'string' && bancoOtro.trim().length >= 3);
  }
  return true;
};

// 7. Contraseña Segura (COOP-07: mínimo 8 caracteres, mayúscula, minúscula y número)
exports.validarPasswordSeguro = (password) => {
  if (!password || typeof password !== 'string') return false;
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
  return regex.test(password);
};
