// backend/src/services/emailService.js
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

/**
 * Genera el código QR en formato DataURL (Base64) con la información del boleto
 */
async function generarCodigoQR(datosBoleto) {
  try {
    const payload = JSON.stringify({
      reservaId: datosBoleto.reservaId,
      cooperativa: datosBoleto.cooperativa,
      origen: datosBoleto.origen,
      destino: datosBoleto.destino,
      fecha: datosBoleto.fecha,
      hora: datosBoleto.hora,
      asientos: datosBoleto.asientos
    });

    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 1,
      color: { dark: '#1e3a8a', light: '#ffffff' },
      width: 250
    });

    return qrDataUrl;
  } catch (error) {
    console.error('Error generando código QR:', error);
    throw error;
  }
}

/**
 * Guarda el boleto como archivo HTML local
 */
function guardarBoletoLocal(htmlContent) {
  const dir = path.join(__dirname, '../../uploads/boletos-html');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fileName = `boleto-${Date.now()}.html`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, htmlContent, 'utf8');
  return { filePath, fileName };
}

/**
 * Despacha el boleto digital por correo electrónico
 */
async function enviarBoletoEmail(datos) {
  const { emailDestinatario, cooperativa, origen, destino, fecha, hora, asientos, total, reservaId } = datos;

  try {
    const qrDataUrl = await generarCodigoQR({
      reservaId,
      cooperativa,
      origen,
      destino,
      fecha,
      hora,
      asientos: Array.isArray(asientos) ? asientos.join(', ') : asientos
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"/></head>
      <body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: Arial, sans-serif;">
        <div style="max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #cbd5e1;">
          <div style="background-color: #1e3a8a; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px;">🚌 En ruta - Transporte UTA</h1>
            <p style="margin: 5px 0 0; font-size: 13px; opacity: 0.9;">Comprobante Oficial de Abordaje</p>
          </div>
          
          <div style="padding: 24px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="background-color: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 12px;">PAGO VALIDADO</span>
              <h2 style="color: #0f172a; margin: 10px 0 0; font-size: 20px;">${origen} ➔ ${destino}</h2>
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
              <p style="margin: 0 0 10px; font-weight: bold; color: #1e293b; font-size: 13px;">Presenta este código QR al momento de abordar:</p>
              <img src="${qrDataUrl}" alt="Código QR del Boleto" style="width: 200px; height: 200px; border-radius: 8px; border: 3px solid #1e3a8a;" />
              <p style="margin: 8px 0 0; color: #94a3b8; font-size: 11px;">Válido únicamente para la fecha y hora indicadas</p>
            </div>
          </div>

          <div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
            Universidad Técnica de Ambato (FISEI) · Carrera de Software
          </div>
        </div>
      </body>
      </html>
    `;

    // Si hay credenciales SMTP configuradas en .env, enviar a la bandeja real
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transportador = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS.replace(/\s+/g, '') // Elimina espacios si el usuario pegó bloques
          }
        });

        const info = await transportador.sendMail({
          from: `"En ruta - Transporte UTA" <${process.env.SMTP_USER}>`,
          to: emailDestinatario,
          subject: `🎫 Boleto Confirmado: ${origen} a ${destino} - ${cooperativa}`,
          html: htmlContent
        });

        console.log(`📨 [GMAIL ENVIADO] Boleto despachado a la bandeja real de: ${emailDestinatario} (ID: ${info.messageId})`);
        return { exito: true, enviadoReal: true, messageId: info.messageId, qrDataUrl };
      } catch (smtpErr) {
        console.warn(`⚠️ No se pudo enviar por SMTP Gmail (${smtpErr.message}). Generando copia HTML local...`);
      }
    }

    // Si no hay SMTP o falló, respaldo en archivo HTML local
    const local = guardarBoletoLocal(htmlContent);
    console.log(`✅ [NOTIFICACIÓN LOCAL] Boleto procesado para: ${emailDestinatario || 'pasajero@correo.com'}`);
    console.log(`📄 [BOLETO CON QR GENERADO]: ${local.filePath}`);

    return { exito: true, enviadoReal: false, filePath: local.filePath, qrDataUrl };
  } catch (error) {
    console.error('Error al procesar boleto:', error);
    return { exito: false, error: error.message };
  }
}

module.exports = {
  generarCodigoQR,
  enviarBoletoEmail
};
