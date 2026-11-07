const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

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
function guardarBoletoLocal(htmlContent) {
  try {
    const dir = path.join(__dirname, '../../uploads/boletos');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const fileName = `boleto-${Date.now()}.html`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, htmlContent, 'utf-8');
    return { exito: true, filePath: `/uploads/boletos/${fileName}` };
  } catch (error) {
    console.error('Error guardando boleto localmente:', error);
    return { exito: false, error: error.message };
  }
}

/**
 * Genera la plantilla HTML adaptable del boleto
 */
function generarPlantillaBoleto(datos, qrSrc, enlaceBoleto) {
  const { cooperativa, origen, destino, fecha, hora, asientos, total, reservaId } = datos;
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
              <td style="padding: 8px 0; color: #64748b;">Fecha y Hora:</td>
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

    // Opción 1: Resend vía HTTPS (puerto 443 estándar, compatible 100% con Render sin bloqueos de puerto)
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
            to: [emailDestinatario],
            subject: `🎫 Boleto Confirmado: ${origen} a ${destino} - ${cooperativa}`,
            html: generarPlantillaBoleto(datos, publicQrUrl, enlaceBoleto),
            attachments: [
              {
                filename: 'boleto-qr.png',
                content: qrBase64Clean
              }
            ]
          })
        });

        const resendJson = await resendRes.json();
        if (resendRes.ok) {
          console.log(`📨 [RESEND HTTPS ENVIADO] Boleto despachado a: ${emailDestinatario} (ID: ${resendJson.id})`);
          return { exito: true, enviadoReal: true, messageId: resendJson.id, qrDataUrl, enlaceBoleto };
        } else {
          console.warn(`⚠️ [RESEND API RECHAZO]:`, resendJson);
        }
      } catch (resendErr) {
        console.warn(`⚠️ Error en Resend HTTPS (${resendErr.message}). Probando transporte SMTP...`);
      }
    }

    // Opción 2: SMTP Relay (Brevo en puerto 2525 / host personalizado o Gmail directo)
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || (smtpHost ? 2525 : 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';
    const remitente = process.env.SMTP_FROM || `"En ruta - Transporte UTA" <${smtpUser}>`;

    if (smtpUser && smtpPass) {
      try {
        let transportador;
        if (smtpHost) {
          transportador = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: smtpPass
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000
          });
        } else {
          transportador = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: smtpUser,
              pass: smtpPass
            },
            connectionTimeout: 10000
          });
        }

        const info = await transportador.sendMail({
          from: remitente,
          to: emailDestinatario,
          subject: `🎫 Boleto Confirmado: ${origen} a ${destino} - ${cooperativa}`,
          html: generarPlantillaBoleto(datos, 'cid:codigo_qr_boleto', enlaceBoleto),
          attachments: [
            {
              filename: 'boleto-qr.png',
              content: qrBuffer,
              contentType: 'image/png',
              contentDisposition: 'inline',
              cid: 'codigo_qr_boleto'
            }
          ]
        });

        console.log(`📨 [SMTP ENVIADO] Boleto despachado con éxito a: ${emailDestinatario} (ID: ${info.messageId})`);
        return { exito: true, enviadoReal: true, messageId: info.messageId, qrDataUrl, enlaceBoleto };
      } catch (smtpErr) {
        console.warn(`⚠️ Error en despacho SMTP (${smtpErr.message}). Generando copia local...`);
      }
    }

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
  generarCodigoQR,
  enviarBoletoEmail
};
