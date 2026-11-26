// Redes sociales y canales de soporte de una cooperativa (CR-14).
// Solo se generan enlaces http/https, wa.me y mailto validados para evitar XSS (javascript:, data:, etc.).

export function safeExternalUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || /[\s<>"']/.test(trimmed)) return '';
  try {
    const url = new URL(trimmed);
    return ['https:', 'http:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function normalizeWhatsapp(value) {
  if (!value) return '';
  const cleaned = String(value).trim().replace(/[\s().-]/g, '');
  return /^\+?\d{9,15}$/.test(cleaned) ? cleaned : '';
}

export function whatsappLink(value) {
  const phone = normalizeWhatsapp(value);
  if (!phone) return '';
  // Números ecuatorianos locales (09XXXXXXXX) se convierten al formato internacional 593.
  const digits = phone.replace(/^\+/, '');
  const international = /^0\d{9}$/.test(digits) ? `593${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

export function safeEmail(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length <= 120 && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(trimmed) ? trimmed : '';
}

export function supportChannelErrors(fields = {}) {
  const errors = {};
  if (fields.facebook_url && !safeExternalUrl(fields.facebook_url)) errors.facebook_url = 'La URL de Facebook debe empezar con https://';
  if (fields.instagram_url && !safeExternalUrl(fields.instagram_url)) errors.instagram_url = 'La URL de Instagram debe empezar con https://';
  if (fields.whatsapp_soporte && !normalizeWhatsapp(fields.whatsapp_soporte)) errors.whatsapp_soporte = 'Usa un número de 9 a 15 dígitos (ej. 0991234567).';
  if (fields.correo_soporte && !safeEmail(fields.correo_soporte)) errors.correo_soporte = 'Escribe un correo de soporte válido.';
  return errors;
}

export function supportChannels(cooperative = {}) {
  const channels = [];
  const facebook = safeExternalUrl(cooperative.facebook_url);
  if (facebook) channels.push({ key: 'facebook', label: 'Facebook', href: facebook, external: true });
  const instagram = safeExternalUrl(cooperative.instagram_url);
  if (instagram) channels.push({ key: 'instagram', label: 'Instagram', href: instagram, external: true });
  const whatsapp = whatsappLink(cooperative.whatsapp_soporte);
  if (whatsapp) channels.push({ key: 'whatsapp', label: `WhatsApp ${normalizeWhatsapp(cooperative.whatsapp_soporte)}`, href: whatsapp, external: true });
  const email = safeEmail(cooperative.correo_soporte);
  if (email) channels.push({ key: 'email', label: email, href: `mailto:${email}`, external: false });
  return channels;
}
