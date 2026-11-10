const { createHmac, timingSafeEqual } = require('node:crypto');

const lifetime = 15 * 60 * 1000;
const attempts = new Map();

function allowRequest(ip, email) {
  const now = Date.now();
  for (const [key, limit] of attempts) {
    if (limit.until <= now) attempts.delete(key);
  }
  const keys = [['ip:' + ip, 10], ['email:' + email, 3]];
  if (attempts.size >= 10000 || keys.some(([key, max]) => (attempts.get(key)?.count || 0) >= max)) return false;
  for (const [key] of keys) {
    const limit = attempts.get(key) || { count: 0, until: now + lifetime };
    limit.count++;
    attempts.set(key, limit);
  }
  return true;
}

function sign(payload) {
  const secret = process.env.HISTORY_TOKEN_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('HISTORY_TOKEN_SECRET no configurado');
  return createHmac('sha256', secret).update(payload).digest();
}

function createToken(email) {
  const payload = Buffer.from(JSON.stringify({ purpose: 'purchase-history', email, expires: Date.now() + lifetime })).toString('base64url');
  return payload + '.' + sign(payload).toString('base64url');
}

function verifyToken(token) {
  try {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined || token.length > 1024) return null;
    const actual = Buffer.from(signature, 'base64url');
    const expected = sign(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.purpose === 'purchase-history' && data.expires > Date.now() ? data.email : null;
  } catch {
    return null;
  }
}

async function sendLink(email) {
  const url = new URL(process.env.FRONTEND_URL);
  url.hash = 'mis-compras?token=' + createToken(email);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: [email],
      subject: 'Consulta tus compras de En ruta',
      text: 'Abre este enlace para consultar tus compras. Caduca en 15 minutos.\n\n' + url.href
    })
  });
  if (!response.ok) throw new Error('Resend rechazó la solicitud');
}

module.exports = { allowRequest, sendLink, verifyToken };
