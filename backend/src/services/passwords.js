const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const derive = require('node:util').promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (!stored || stored === 'invitado_sin_password') return false;
  if (!stored.startsWith('scrypt:')) return stored === password || stored === `hash_${password}`;
  const [, salt, hash] = stored.split(':');
  if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hash || '')) return false;
  return timingSafeEqual(await derive(password, salt, 64), Buffer.from(hash, 'hex'));
}

module.exports = { hashPassword, verifyPassword };
