const crypto = require('node:crypto');

let customFetchImpl = null;

function setFetchImpl(fn) {
  customFetchImpl = typeof fn === 'function' ? fn : null;
}

function getFetch() {
  return customFetchImpl || globalThis.fetch;
}

function makeError(message, status) {
  return Object.assign(new Error(message), { status });
}

function getGatewayConfig() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) {
    throw makeError('El pago con tarjeta en pasarela no está disponible en este momento.', 503);
  }

  const allowLive = process.env.ALLOW_LIVE_PAYMENTS === 'true';
  if (secretKey.startsWith('sk_live_') && !allowLive) {
    throw makeError('Modo live bloqueado por seguridad: configura una llave Stripe Sandbox (sk_test_...).', 503);
  }
  if (!allowLive && !secretKey.startsWith('sk_test_')) {
    throw makeError('Llave Stripe inválida: solo se aceptan credenciales Sandbox (sk_test_...).', 503);
  }

  const rawFrontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  let parsedFrontend;
  try {
    parsedFrontend = new URL(rawFrontendUrl);
  } catch {
    throw makeError('FRONTEND_URL configurado en el servidor no es válido.', 500);
  }
  if (!['http:', 'https:'].includes(parsedFrontend.protocol) || parsedFrontend.username || parsedFrontend.password) {
    throw makeError('FRONTEND_URL debe usar HTTP/HTTPS sin credenciales embebidas.', 500);
  }
  const frontendUrl = parsedFrontend.href.replace(/\/+$/, '');

  const rawApiBase = String(process.env.STRIPE_API_BASE || 'https://api.stripe.com').trim();
  let parsedApiBase;
  try {
    parsedApiBase = new URL(rawApiBase);
  } catch {
    throw makeError('STRIPE_API_BASE no es válido.', 500);
  }
  if (parsedApiBase.protocol !== 'https:') {
    throw makeError('STRIPE_API_BASE debe usar HTTPS.', 500);
  }

  return {
    secretKey,
    webhookSecret: String(process.env.STRIPE_WEBHOOK_SECRET || '').trim(),
    frontendUrl,
    apiBase: parsedApiBase.origin + parsedApiBase.pathname.replace(/\/+$/, ''),
    mode: secretKey.startsWith('sk_live_') ? 'LIVE' : 'SANDBOX'
  };
}

function validateHostedCheckoutUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch {
    throw makeError('La pasarela devolvió una URL inválida.', 502);
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.hostname.toLowerCase() !== 'checkout.stripe.com'
  ) {
    throw makeError('La pasarela devolvió un dominio de pago no autorizado.', 502);
  }

  return parsed.href;
}

async function createStripeCheckoutSession({ reservation, idempotencyKey, fetchImpl }) {
  const config = getGatewayConfig();
  const totalNumber = Number(reservation?.total);
  const amountCents = Math.round(totalNumber * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw makeError('El monto de la reserva debe ser mayor a cero para cobrar con tarjeta.', 400);
  }

  const codigo = String(reservation.codigo_reserva || '').trim();
  const params = new URLSearchParams({
    mode: 'payment',
    client_reference_id: codigo,
    'metadata[reserva_id]': String(reservation.id),
    'metadata[codigo_reserva]': codigo,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(amountCents),
    'line_items[0][price_data][product_data][name]': `Pasajes En Ruta (${codigo})`,
    'line_items[0][quantity]': '1',
    success_url: `${config.frontendUrl}/?reserva=${encodeURIComponent(codigo)}&pago=retorno`,
    cancel_url: `${config.frontendUrl}/?reserva=${encodeURIComponent(codigo)}&pago=cancelado`
  });

  if (reservation.email && typeof reservation.email === 'string' && reservation.email.trim()) {
    params.set('customer_email', reservation.email.trim().toLowerCase());
  }

  const runner = fetchImpl || getFetch();
  let response;
  try {
    response = await runner(`${config.apiBase}/v1/checkout/sessions`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey
      },
      body: params.toString()
    });
  } catch (err) {
    throw makeError(`No se pudo contactar a la pasarela de pago: ${err.message}`, 502);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id || !data?.url) {
    const detail = data?.error?.message || `Error HTTP ${response.status} al crear sesión de pago.`;
    throw makeError(detail, 502);
  }

  const checkoutUrl = validateHostedCheckoutUrl(data.url);
  return {
    sessionId: String(data.id),
    checkoutUrl,
    paymentIntentId: typeof data.payment_intent === 'string' ? data.payment_intent : null,
    amountCents,
    currency: 'USD',
    mode: config.mode,
    rawSummary: {
      id: data.id,
      status: data.status || null,
      payment_status: data.payment_status || null
    }
  };
}

function verifyStripeWebhookSignature(
  rawBody,
  signatureHeader,
  webhookSecret = process.env.STRIPE_WEBHOOK_SECRET,
  toleranceSec = 300
) {
  const secret = String(webhookSecret || '').trim();
  if (!secret) {
    throw makeError('El secreto de webhook Stripe no está configurado en el servidor.', 503);
  }
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    throw makeError('El cuerpo del webhook debe enviarse sin alterar (raw JSON).', 400);
  }
  if (typeof signatureHeader !== 'string' || !signatureHeader.trim()) {
    throw makeError('Falta la cabecera Stripe-Signature.', 400);
  }

  const parts = signatureHeader.split(',').map(p => p.trim());
  let timestamp = null;
  const signatures = [];

  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key === 't' && !timestamp) timestamp = val;
    if (key === 'v1' && val) signatures.push(val);
  }

  const tsNum = Number(timestamp);
  if (!timestamp || !Number.isInteger(tsNum) || signatures.length === 0) {
    throw makeError('Cabecera Stripe-Signature malformada.', 400);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > toleranceSec) {
    throw makeError('La firma del webhook Stripe ha expirado.', 400);
  }

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expectedHex = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  const validSig = signatures.some((sig) => {
    if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
    const actualBuf = Buffer.from(sig, 'hex');
    return actualBuf.length === expectedBuf.length && crypto.timingSafeEqual(actualBuf, expectedBuf);
  });

  if (!validSig) {
    throw makeError('Firma Stripe-Signature inválida.', 400);
  }

  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw makeError('JSON inválido en el webhook Stripe.', 400);
  }
}

async function retrieveStripeCheckoutSession(sessionId, { fetchImpl } = {}) {
  const config = getGatewayConfig();
  const cleanId = typeof sessionId === 'string' ? sessionId.trim() : '';
  if (!cleanId) {
    throw makeError('ID de sesión Stripe inválido.', 400);
  }

  const runner = fetchImpl || getFetch();
  let response;
  try {
    response = await runner(`${config.apiBase}/v1/checkout/sessions/${encodeURIComponent(cleanId)}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${config.secretKey}`
      }
    });
  } catch (err) {
    throw makeError(`No se pudo consultar la sesión de pago en Stripe: ${err.message}`, 502);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    const detail = data?.error?.message || `Error HTTP ${response.status} al consultar sesión de pago.`;
    throw makeError(detail, 502);
  }

  return {
    id: String(data.id),
    status: data.status || null,
    payment_status: data.payment_status || null,
    currency: data.currency || null,
    amount_total: data.amount_total,
    payment_intent: typeof data.payment_intent === 'string' ? data.payment_intent : null
  };
}

module.exports = {
  setFetchImpl,
  getGatewayConfig,
  validateHostedCheckoutUrl,
  createStripeCheckoutSession,
  retrieveStripeCheckoutSession,
  verifyStripeWebhookSignature
};
