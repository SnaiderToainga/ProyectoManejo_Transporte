const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const db = require('../config/db');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const secret =
  process.env.CUSTOMER_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.HISTORY_TOKEN_SECRET ||
  randomBytes(32).toString('hex');

const signPayload = (payload) =>
  createHmac('sha256', secret).update(`cliente-uta:${payload}`).digest('base64url');

function createCustomerToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({
      purpose: 'customer-session',
      id: userId,
      exp: Date.now() + TOKEN_TTL_MS
    })
  ).toString('base64url');
  return `${payload}.${signPayload(payload)}`;
}

function verifyCustomerToken(token) {
  if (typeof token !== 'string' || !token || token.length > 1024) return null;
  const [payload, receivedSig, extra] = token.split('.');
  if (!payload || !receivedSig || extra !== undefined) return null;

  const expected = Buffer.from(signPayload(payload));
  const received = Buffer.from(receivedSig);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      data.purpose !== 'customer-session' ||
      !Number.isInteger(data.id) ||
      data.id <= 0 ||
      !Number.isFinite(data.exp) ||
      data.exp <= Date.now()
    ) {
      return null;
    }
    return data.id;
  } catch {
    return null;
  }
}

function extractBearerToken(req) {
  const match = /^Bearer (.+)$/i.exec(req.get('authorization') || '');
  return match ? match[1].trim() : null;
}

async function loadAuthenticatedCustomer(userId) {
  const result = await db.query(
    `SELECT id, nombre, cedula, correo, rol
     FROM usuarios
     WHERE id = $1
       AND rol = 'CLIENTE'
       AND password_hash <> 'invitado_sin_password'`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.nombre,
    cedula: row.cedula || '',
    email: row.correo
  };
}

async function requireCustomer(req, res, next) {
  const token = extractBearerToken(req);
  const userId = verifyCustomerToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Inicia sesión con tu cuenta de cliente para continuar.' });
  }
  try {
    const customer = await loadAuthenticatedCustomer(userId);
    if (!customer) {
      return res.status(401).json({ error: 'La sesión de cliente ya no es válida.' });
    }
    req.customer = customer;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCustomerToken,
  verifyCustomerToken,
  extractBearerToken,
  loadAuthenticatedCustomer,
  requireCustomer
};
