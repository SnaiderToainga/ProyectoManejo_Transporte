import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessOffice, canAccessAdmin, getRedirectRouteForRole, ROLES } from '../../src/lib/authGuard.js';

test('Seguridad RBAC: denegar acceso a taquilla para usuarios no autenticados o anónimos', () => {
  assert.equal(canAccessOffice(null), false);
  assert.equal(canAccessOffice(undefined), false);
  assert.equal(canAccessOffice({}), false);
  assert.equal(canAccessOffice('rol_invalido'), false);
});

test('Seguridad RBAC: denegar acceso a taquilla para clientes comunes', () => {
  const cliente = { id: 1, nombre: 'Juan Pérez', rol: ROLES.CLIENTE };
  assert.equal(canAccessOffice(cliente), false);
});

test('Seguridad RBAC: autorizar acceso a taquilla únicamente a oficinistas y superadmin', () => {
  const oficinista = { id: 2, nombre: 'Cajero Taquilla', rol: ROLES.OFICINISTA };
  const superadmin = { id: 3, nombre: 'Admin Global', rol: ROLES.SUPERADMIN };
  assert.equal(canAccessOffice(oficinista), true);
  assert.equal(canAccessOffice(superadmin), true);
});

test('Seguridad RBAC: verificar acceso al panel de administración', () => {
  assert.equal(canAccessAdmin({ rol: ROLES.SUPERADMIN }), true);
  assert.equal(canAccessAdmin({ rol: ROLES.ADMIN_COOP }), true);
  assert.equal(canAccessAdmin({ rol: ROLES.CLIENTE }), false);
  assert.equal(canAccessAdmin({ rol: ROLES.OFICINISTA }), false);
});

test('Seguridad RBAC: verificar redirección correcta según rol tras login', () => {
  assert.equal(getRedirectRouteForRole({ rol: ROLES.OFICINISTA }), 'oficina');
  assert.equal(getRedirectRouteForRole({ rol: ROLES.SUPERADMIN }), 'admin');
  assert.equal(getRedirectRouteForRole({ rol: ROLES.ADMIN_COOP }), 'admin');
  assert.equal(getRedirectRouteForRole({ rol: ROLES.CLIENTE }), 'buscar');
});
