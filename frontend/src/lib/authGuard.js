/**
 * Módulo de validación de control de acceso basado en roles (RBAC)
 * Mitigación OWASP A01:2021 - Broken Access Control
 */

export const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN_COOP: 'ADMIN_COOP',
  OFICINISTA: 'OFICINISTA',
  CLIENTE: 'CLIENTE'
};

/**
 * Valida si un usuario tiene permisos para ingresar al módulo de Taquilla / Oficina.
 * Permitido únicamente para OFICINISTA y SUPERADMIN.
 * @param {Object|null} user
 * @returns {boolean}
 */
export function canAccessOffice(user) {
  if (!user || typeof user !== 'object') return false;
  return user.rol === ROLES.OFICINISTA || user.rol === ROLES.SUPERADMIN;
}

/**
 * Valida si un usuario tiene permisos para el panel de administración general o de cooperativa.
 * @param {Object|null} user
 * @returns {boolean}
 */
export function canAccessAdmin(user) {
  if (!user || typeof user !== 'object') return false;
  return user.rol === ROLES.SUPERADMIN || user.rol === ROLES.ADMIN_COOP;
}

/**
 * Determina la ruta por defecto tras un inicio de sesión según el rol asignado.
 * @param {Object|null} user
 * @returns {string}
 */
export function getRedirectRouteForRole(user) {
  if (canAccessOffice(user) && user.rol === ROLES.OFICINISTA) {
    return 'oficina';
  }
  if (canAccessAdmin(user)) {
    return 'admin';
  }
  return 'buscar';
}
