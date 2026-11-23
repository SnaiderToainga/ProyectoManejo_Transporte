const { createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const db = require('../config/db');

// La clave efímera permite el desarrollo local. Una clave configurada conserva
// las sesiones entre reinicios; el prefijo separa este uso de los enlaces de historial.
const secret = process.env.SESSION_SECRET || process.env.HISTORY_TOKEN_SECRET || randomBytes(32).toString('hex');
const signature = payload => createHmac('sha256', secret).update(`sesion-uta:${payload}`).digest('base64url');

function createSession(userId) {
  const payload = Buffer.from(JSON.stringify({ id: userId, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

function sessionUserId(token) {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const [payload, signed, extra] = token.split('.');
  if (!payload || !signed || extra) return null;
  const expected = Buffer.from(signature(payload));
  const received = Buffer.from(signed);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number.isInteger(session.id) && session.id > 0 && Number.isFinite(session.exp) && session.exp > Date.now()
      ? session.id : null;
  } catch {
    return null;
  }
}

async function requireSession(req, res, next) {
  const userId = sessionUserId((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!userId) return res.status(401).json({ error: 'Inicia sesión nuevamente para continuar.' });
  try {
    const result = await db.query(`SELECT u.id, u.rol, u.cooperativa_id,
        CASE WHEN to_jsonb(u) ? 'bus_id' THEN (to_jsonb(u)->>'bus_id')::int ELSE NULL END AS bus_id
      FROM usuarios u LEFT JOIN cooperativas c ON c.id = u.cooperativa_id
      WHERE u.id = $1 AND (u.rol IN ('SUPERADMIN','CLIENTE') OR c.activo = TRUE)`, [userId]);
    if (!result.rows[0]) return res.status(401).json({ error: 'La sesión ya no está autorizada.' });
    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function requireRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.rol)
    ? next() : res.status(403).json({ error: 'Tu rol no puede realizar esta operación.' });
}

module.exports = { createSession, sessionUserId, requireSession, requireRoles };
