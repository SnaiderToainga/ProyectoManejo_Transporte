// backend/src/utils/validators.js

// 1. Algoritmo oficial ecuatoriano Módulo 10 para Cédula
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

// 2. Validación de RUC oficial (13 dígitos terminado en 001)
exports.validarRucEcuatoriano = (ruc) => {
  if (!ruc || typeof ruc !== 'string') return false;
  const clean = ruc.trim();
  if (!/^\d{13}$/.test(clean)) return false;
  if (!clean.endsWith('001')) return false;
  return exports.validarCedulaEcuatoriana(clean.substring(0, 10));
};

// 3. Contraseña Segura (mínimo 8 caracteres, mayúscula, minúscula y número)
exports.validarPasswordSeguro = (password) => {
  if (!password || typeof password !== 'string') return false;
  // Mínimo 8 caracteres, al menos 1 letra mayúscula, 1 minúscula y 1 número
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
  return regex.test(password);
};