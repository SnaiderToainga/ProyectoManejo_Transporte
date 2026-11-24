const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { purchaseDate, fareLines } = require('./receiptFormat');
const WIDTH = 80 * 72 / 25.4;
const MARGIN = 12;

exports.generarQR = texto => QRCode.toDataURL(texto);

async function buildTicketPdf(reserva, boleto) {
  const base = (process.env.FRONTEND_URL || 'https://proyecto-web.online').replace(/\/$/, '');
  const qrUrl = `${base}/validar?reserva=${encodeURIComponent(reserva.codigo_reserva)}&asiento=${encodeURIComponent(boleto.numero_asiento)}`;
  const qrBuffer = await QRCode.toBuffer(qrUrl, { width: 400, margin: 4, errorCorrectionLevel: 'M' });
  const date = reserva.fecha_viaje instanceof Date ? reserva.fecha_viaje.toISOString().slice(0, 10) : String(reserva.fecha_viaje).slice(0, 10);
  const rows = [
    [reserva.cooperativa_nombre || 'Transporte UTA', 12, true, 'center'],
    ['BOLETO DE VIAJE / PAGADO', 10, true, 'center'],
    [`Reserva: ${reserva.codigo_reserva}`, 10, true],
    [`Boleto: ${boleto.id} | Unidad: ${reserva.numero_disco}`, 9],
    [`Resolución ANT: ${reserva.resolucion_ant || 'No registrada'}`, 8],
    [reserva.comprado_en ? `Compra: ${purchaseDate(reserva.comprado_en)}` : `Compra: fecha exacta no registrada\nReserva: ${purchaseDate(reserva.creado_en)}`, 8],
    [`Origen: ${reserva.origen}`, 10, true],
    [`Destino: ${reserva.destino}`, 10, true],
    [`Salida: ${date} a las ${String(reserva.hora_salida_programada).slice(0,5)}`, 9],
    [`Pasajero: ${boleto.nombre_pasajero}`, 9],
    [`Cédula: ${boleto.cedula_pasajero}`, 9],
    [`Asiento: ${boleto.numero_asiento} (${boleto.categoria})`, 11, true],
    ...fareLines(boleto).map(line => [line, 9, true])
  ];
  const footer = `${boleto.validado_en_puerta ? 'BOLETO YA UTILIZADO.\n' : ''}Conserve su código de reserva para consultar y volver a descargar el boleto. Si proporcionó correo, la confirmación se envía a esa dirección. Reimprimir no genera otra compra ni habilita un segundo abordaje.`;
  const measure = new PDFDocument({ size: [WIDTH, 2000], margin: MARGIN });
  const textWidth = WIDTH - MARGIN * 2;
  const heights = rows.map(([text, size, bold]) => measure.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).heightOfString(String(text), { width: textWidth }) + 7);
  const footerHeight = measure.font('Helvetica').fontSize(7).heightOfString(footer, { width: textWidth });
  measure.end();
  const height = Math.ceil(MARGIN * 2 + heights.reduce((a,b) => a+b,0) + 126 + footerHeight + 12);
  const doc = new PDFDocument({ size: [WIDTH, height], margin: MARGIN,
    info: { Title: `Boleto ${reserva.codigo_reserva} - Asiento ${boleto.numero_asiento}`, Author: 'Transporte UTA' } });
  const chunks = [];
  const result = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  let y = MARGIN;
  rows.forEach(([text, size, bold, align], index) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor('black')
      .text(String(text), MARGIN, y, { width: textWidth, align: align || 'left' });
    y += heights[index];
  });
  doc.image(qrBuffer, (WIDTH - 112) / 2, y, { width: 112 });
  doc.font('Helvetica').fontSize(7).text(footer, MARGIN, y + 126, { width: textWidth, align: 'center' });
  doc.end();
  return result;
}

exports.buildTicketPdf = buildTicketPdf;
exports.generarPDFBoleto = async (reserva, boleto, res) => {
  const pdf = await buildTicketPdf(reserva, boleto);
  res.type('pdf');
  res.setHeader('Content-Disposition', `inline; filename="boleto-${reserva.codigo_reserva}-${boleto.numero_asiento}-80mm.pdf"`);
  res.send(pdf);
};
