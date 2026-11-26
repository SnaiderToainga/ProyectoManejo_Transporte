const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { escapeHtml, purchaseDate, fareLines } = require('./receiptFormat');

/**
 * Genera el código QR con el enlace directo para visualización móvil nativa
 */
async function generarCodigoQR(datosBoleto) {
  try {
    const frontendBase = (process.env.FRONTEND_URL || 'https://proyecto-web.online').replace(/\/$/, '');
    const enlaceBoleto = `${frontendBase}/?codigo=${encodeURIComponent(datosBoleto.reservaId)}#boleto`;

    const qrDataUrl = await QRCode.toDataURL(enlaceBoleto, {
      errorCorrectionLevel: 'H',
      margin: 1,
      color: { dark: '#1e3a8a', light: '#ffffff' },
      width: 250
    });

    return { qrDataUrl, enlaceBoleto };
  } catch (error) {
    console.error('Error generando código QR:', error);
    throw error;
  }
}

/**
 * Guarda una copia local del boleto en HTML para respaldo / desarrollo
 */
function guardarBoletoLocal(htmlContent, { carpeta = 'boletos', prefijo = 'boleto' } = {}) {
  try {
    const dir = path.join(__dirname, '../../uploads', carpeta);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const fileName = `${prefijo}-${Date.now()}.html`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, htmlContent, 'utf-8');
    return { exito: true, filePath: `/uploads/${carpeta}/${fileName}` };
  } catch (error) {
    console.error('Error guardando boleto localmente:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Genera la plantilla HTML adaptable del boleto
 */
function generarPlantillaBoleto(datos, qrSrc, enlaceBoleto) {
  const { cooperativa, origen, destino, fecha, hora, asientos, total, reservaId } = Object.fromEntries(
    Object.entries(datos).map(([key, value]) => [key, typeof value === 'string' ? escapeHtml(value) : value])
  );
  const breakdown = (datos.boletos || []).map(b => '<p><strong>Asiento ' + escapeHtml(b.numero_asiento) + ' · ' + escapeHtml(b.categoria) + '</strong><br>' + fareLines(b).map(escapeHtml).join('<br>') + '</p>').join('');
  const purchase = datos.comprado_en ? 'Compra: ' + purchaseDate(datos.comprado_en)
    : 'Compra: fecha exacta no registrada. Reserva: ' + purchaseDate(datos.creado_en);
  const linkWeb = enlaceBoleto || `https://proyecto-web.online/?codigo=${encodeURIComponent(reservaId)}#boleto`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Boleto Confirmado - ${cooperativa}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; margin: 0;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
        <div style="background-color: #1e3a8a; color: #ffffff; padding: 24px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">🚌 En ruta - Transporte UTA</h1>
          <p style="margin: 4px 0 0; opacity: 0.85; font-size: 13px;">Comprobante Oficial de Abordaje</p>
        </div>

        <div style="padding: 24px 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="background-color: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">Pago Validado</span>
            <h2 style="margin: 12px 0 0; color: #0f172a; font-size: 20px; font-weight: 700;">${origen} &rarr; ${destino}</h2>
            <p style="color: #64748b; margin: 4px 0 0; font-size: 14px;">${cooperativa}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Código de Reserva:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #1e3a8a;">${reservaId}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Salida del viaje:</td>
              <td style="padding: 8px 0; text-align: right; color: #334155;">${fecha} · ${hora}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Asientos:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #1e3a8a;">${Array.isArray(asientos) ? asientos.join(', ') : asientos}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Total Pagado:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #16a34a; font-size: 16px;">$${Number(total).toFixed(2)}</td>
            </tr>
          </table>
          <p style="font-size:12px;color:#475569">${escapeHtml(purchase)}</p>
          ${breakdown}

          <div style="text-align: center; padding: 16px; background-color: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
            <p style="margin: 0 0 10px; font-weight: bold; color: #1e293b; font-size: 13px;">Presenta este código QR o pulsa el enlace para ver tu boleto oficial:</p>
            <a href="${linkWeb}" target="_blank" style="text-decoration: none; display: inline-block;">
              <img src="${qrSrc}" alt="Código QR del Boleto" style="width: 200px; height: 200px; border-radius: 8px; border: 3px solid #1e3a8a; display: inline-block;" />
            </a>
            <div style="margin-top: 14px;">
              <a href="${linkWeb}" target="_blank" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 10px 22px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                Ver Boleto Digital en Línea
              </a>
            </div>
            <p style="margin: 10px 0 0; color: #94a3b8; font-size: 11px;">Al escanear con la cámara de tu celular se abrirá directamente tu boleto validado.</p>
          </div>
        </div>

        <div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Universidad Técnica de Ambato (FISEI) · Carrera de Software
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Transporte compartido (CR-14): Resend HTTPS (puerto 443, compatible con Render) y luego SMTP
 * (Brevo en 2525, host personalizado o Gmail). Devuelve null si no hubo envío real, para que
 * el llamador genere su respaldo local. Nunca lanza excepciones al flujo HTTP.
 */
async function despacharCorreo({ to, subject, resendHtml, smtpHtml = resendHtml, resendAttachments, smtpAttachments, etiqueta = 'Correo' }) {
  if (!to) return null;

  if (process.env.RESEND_API_KEY) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'En ruta - Transporte UTA <onboarding@resend.dev>',
          to: [to],
          subject,
          html: resendHtml,
          ...(resendAttachments ? { attachments: resendAttachments } : {})
        })
      });
      const resendJson = await resendRes.json().catch(() => ({}));
      if (resendRes.ok) {
        console.log(`📨 [RESEND HTTPS ENVIADO] ${etiqueta} despachado a: ${to} (ID: ${resendJson.id})`);
        return { exito: true, enviadoReal: true, messageId: resendJson.id };
      }
      console.warn('⚠️ [RESEND API RECHAZO]:', resendJson);
    } catch (resendErr) {
      console.warn(`⚠️ Error en Resend HTTPS (${resendErr.message}). Probando transporte SMTP...`);
    }
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT) || (smtpHost ? 2525 : 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';
  const remitente = process.env.SMTP_FROM || `"En ruta - Transporte UTA" <${smtpUser}>`;

  if (smtpUser && smtpPass) {
    try {
      const transportador = smtpHost
        ? nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
          connectionTimeout: 10000,
          greetingTimeout: 10000
        })
        : nodemailer.createTransport({
          service: 'gmail',
          auth: { user: smtpUser, pass: smtpPass },
          connectionTimeout: 10000
        });
      const info = await transportador.sendMail({
        from: remitente,
        to,
        subject,
        html: smtpHtml,
        ...(smtpAttachments ? { attachments: smtpAttachments } : {})
      });
      console.log(`📨 [SMTP ENVIADO] ${etiqueta} despachado con éxito a: ${to} (ID: ${info.messageId})`);
      return { exito: true, enviadoReal: true, messageId: info.messageId };
    } catch (smtpErr) {
      console.warn(`⚠️ Error en despacho SMTP (${smtpErr.message}). Generando copia local...`);
    }
  }
  return null;
}

const ESTADOS_NOTIFICACION = {
  COMPROBANTE_EN_REVISION: {
    asunto: (d) => `🕒 Comprobante recibido: ${d.origen} a ${d.destino} (${d.reservaId})`,
    etiqueta: 'Comprobante en revisión',
    colorFondo: '#fef3c7',
    colorTexto: '#b45309',
    titulo: 'Recibimos tu comprobante de pago',
    mensaje: 'Tu depósito o transferencia fue recibido y está siendo validado por el personal de la cooperativa. Te avisaremos por correo cuando el pago sea aprobado y tu boleto esté listo.',
    boton: 'Consultar el estado de mi reserva'
  },
  RECHAZADO: {
    asunto: (d) => `⚠️ Reserva rechazada: ${d.origen} a ${d.destino} (${d.reservaId})`,
    etiqueta: 'Reserva rechazada',
    colorFondo: '#fee2e2',
    colorTexto: '#b91c1c',
    titulo: 'No pudimos validar tu comprobante',
    mensaje: 'El comprobante enviado no pudo ser validado, por lo que la reserva fue rechazada y los asientos quedaron liberados. Puedes realizar una nueva compra cuando lo desees.',
    boton: 'Realizar una nueva compra'
  }
};

/**
 * Plantilla de cambio de estado de la reserva (CR-14). No es un boleto: no incluye QR de abordaje.
 */
function generarPlantillaEstadoReserva(datos, tipo) {
  const estado = ESTADOS_NOTIFICACION[tipo];
  if (!estado) throw new Error(`Tipo de notificación desconocido: ${tipo}`);
  const frontendBase = (process.env.FRONTEND_URL || 'https://proyecto-web.online').replace(/\/$/, '');
  const enlace = tipo === 'RECHAZADO'
    ? `${frontendBase}/#buscar`
    : `${frontendBase}/?codigo=${encodeURIComponent(datos.reservaId || '')}#boleto`;
  const e = (value) => escapeHtml(value == null ? '' : String(value));
  const asientos = Array.isArray(datos.asientos) ? datos.asientos.join(', ') : datos.asientos;
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>${e(estado.etiqueta)} - ${e(datos.cooperativa)}</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; margin: 0;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background-color: #1e3a8a; color: #ffffff; padding: 24px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800;">🚌 En ruta - Transporte UTA</h1>
          <p style="margin: 4px 0 0; opacity: 0.85; font-size: 13px;">Notificación de tu reserva</p>
        </div>
        <div style="padding: 24px 20px;">
          <div style="text-align: center; margin-bottom: 16px;">
            <span style="background-color: ${estado.colorFondo}; color: ${estado.colorTexto}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase;">${e(estado.etiqueta)}</span>
            <h2 style="margin: 12px 0 0; color: #0f172a; font-size: 20px;">${e(datos.origen)} &rarr; ${e(datos.destino)}</h2>
            <p style="color: #64748b; margin: 4px 0 0; font-size: 14px;">${e(datos.cooperativa)}</p>
          </div>
          <h3 style="color: #0f172a; font-size: 16px; margin: 0 0 8px;">${e(estado.titulo)}</h3>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">${e(estado.mensaje)}</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #64748b;">Código de reserva:</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">${e(datos.reservaId)}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Salida del viaje:</td><td style="padding: 6px 0; text-align: right;">${e(datos.fecha)} · ${e(datos.hora)}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Asientos:</td><td style="padding: 6px 0; text-align: right;">${e(asientos)}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Total:</td><td style="padding: 6px 0; text-align: right;">$${Number(datos.total || 0).toFixed(2)}</td></tr>
          </table>
          <div style="text-align: center;">
            <a href="${e(enlace)}" target="_blank" style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 14px; padding: 10px 22px; border-radius: 8px;">${e(estado.boton)}</a>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Universidad Técnica de Ambato (FISEI) · Carrera de Software
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Notifica al pasajero un cambio de estado que NO es la emisión del boleto (CR-14):
 * COMPROBANTE_EN_REVISION o RECHAZADO. Nunca lanza excepciones al flujo HTTP.
 */
async function enviarNotificacionEstadoReserva(datos, tipo) {
  try {
    const estado = ESTADOS_NOTIFICACION[tipo];
    if (!estado) return { exito: false, error: `Tipo de notificación desconocido: ${tipo}` };
    if (!datos?.emailDestinatario) return { exito: false, error: 'La reserva no tiene correo de destino.' };
    const html = generarPlantillaEstadoReserva(datos, tipo);
    const envio = await despacharCorreo({
      to: datos.emailDestinatario,
      subject: estado.asunto(datos),
      resendHtml: html,
      etiqueta: estado.etiqueta
    });
    if (envio) return { ...envio, tipo };
    const local = guardarBoletoLocal(html, { carpeta: 'notificaciones', prefijo: tipo.toLowerCase() });
    console.log(`✅ [NOTIFICACIÓN LOCAL] ${estado.etiqueta} para: ${datos.emailDestinatario} (${local.filePath || 'sin copia'})`);
    return { exito: true, enviadoReal: false, filePath: local.filePath, tipo };
  } catch (error) {
    console.error('Error al notificar estado de reserva:', error.message);
    return { exito: false, error: error.message };
  }
}

/**
 * Envía el correo electrónico con el boleto y código QR adjunto/embebido
 * Soporta Brevo (puerto 2525 para Render), Resend (HTTPS puerto 443) y Gmail SMTP directo.
 */
async function enviarBoletoEmail(datos) {
  const { emailDestinatario, cooperativa, origen, destino, fecha, hora, asientos, total, reservaId } = datos;

  try {
    const { qrDataUrl, enlaceBoleto } = await generarCodigoQR({
      reservaId,
      cooperativa,
      origen,
      destino,
      fecha,
      hora,
      asientos: Array.isArray(asientos) ? asientos.join(', ') : asientos
    });

    const qrBase64Clean = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const qrBuffer = Buffer.from(qrBase64Clean, 'base64');
    const publicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(enlaceBoleto)}&color=1e3a8a`;

    const envio = await despacharCorreo({
      to: emailDestinatario,
      subject: `🎫 Boleto Confirmado: ${origen} a ${destino} - ${cooperativa}`,
      resendHtml: generarPlantillaBoleto(datos, publicQrUrl, enlaceBoleto),
      resendAttachments: [{ filename: 'boleto-qr.png', content: qrBase64Clean }],
      smtpHtml: generarPlantillaBoleto(datos, 'cid:codigo_qr_boleto', enlaceBoleto),
      smtpAttachments: [{
        filename: 'boleto-qr.png',
        content: qrBuffer,
        contentType: 'image/png',
        contentDisposition: 'inline',
        cid: 'codigo_qr_boleto'
      }],
      etiqueta: 'Boleto'
    });
    if (envio) return { ...envio, qrDataUrl, enlaceBoleto };

    // Respaldo en archivo HTML local con Base64 para visualización en navegador
    const local = guardarBoletoLocal(generarPlantillaBoleto(datos, qrDataUrl, enlaceBoleto));
    console.log(`✅ [NOTIFICACIÓN LOCAL] Boleto procesado para: ${emailDestinatario || 'pasajero@correo.com'}`);
    console.log(`📄 [BOLETO CON QR GENERADO]: ${local.filePath}`);

    return { exito: true, enviadoReal: false, filePath: local.filePath, qrDataUrl, enlaceBoleto };
  } catch (error) {
    console.error('Error al procesar boleto:', error);
    return { exito: false, error: error.message };
  }
}

module.exports = {
  generarPlantillaBoleto,
  generarPlantillaEstadoReserva,
  generarCodigoQR,
  enviarBoletoEmail,
  enviarNotificacionEstadoReserva,
  ESTADOS_NOTIFICACION
};
