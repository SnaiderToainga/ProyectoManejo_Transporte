const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// Generar imagen QR en Base64 o Buffer
exports.generarQR = async (texto) => {
  try {
    return await QRCode.toDataURL(texto);
  } catch (err) {
    throw new Error('Error al generar código QR');
  }
};

// Generar el PDF del boleto digital en memoria y enviarlo al stream
exports.generarPDFBoleto = async (reserva, boleto, res) => {
  const doc = new PDFDocument({ size: 'A6', margin: 20 });

  // Configurar cabeceras de respuesta para descarga de PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename=boleto-${reserva.codigo_reserva}-${boleto.numero_asiento}.pdf`
  );

  doc.pipe(res);

  // Cabecera del Boleto
  doc.rect(0, 0, doc.page.width, 40).fill(reserva.color_distintivo || '#1E40AF');
  doc.fillColor('#FFFFFF').fontSize(12).text(reserva.cooperativa_nombre || 'COOPERATIVA DE TRANSPORTE', 10, 15, { align: 'center' });

  doc.moveDown(2);
  doc.fillColor('#111827').fontSize(10).text(`Código: ${reserva.codigo_reserva}`, { align: 'right' });
  doc.fontSize(8).fillColor('#6B7280').text(`Resolución ANT: ${reserva.resolucion_ant || 'AUTORIZADO'}`, { align: 'right' });

  doc.moveDown();
  doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(20, doc.y).lineTo(doc.page.width - 20, doc.y).stroke();
  doc.moveDown();

  // Datos del Viaje
  doc.fillColor('#111827').fontSize(10);
  doc.text(`Ruta: ${reserva.origen} ➔ ${reserva.destino}`, { bold: true });
  doc.text(`Fecha: ${new Date(reserva.fecha_viaje).toLocaleDateString()} | Hora: ${reserva.hora_salida_programada}`);
  doc.text(`Bus N°: ${reserva.numero_disco}`);

  doc.moveDown();
  doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(20, doc.y).lineTo(doc.page.width - 20, doc.y).stroke();
  doc.moveDown();

  // Datos del Pasajero y Asiento
  doc.text(`Pasajero: ${boleto.nombre_pasajero}`);
  doc.text(`Cédula: ${boleto.cedula_pasajero}`);
  doc.fontSize(12).fillColor('#B91C1C').text(`Asiento: ${boleto.numero_asiento} (${boleto.categoria})`, { bold: true });
  doc.fontSize(10).fillColor('#111827').text(`Precio: $${Number(boleto.precio).toFixed(2)}`);

  // Generar QR para validación en puerta
  const qrData = JSON.stringify({
    reserva: reserva.codigo_reserva,
    boleto_id: boleto.id,
    asiento: boleto.numero_asiento,
    cedula: boleto.cedula_pasajero
  });

  const qrBuffer = await QRCode.toBuffer(qrData, { width: 110, margin: 1 });
  doc.image(qrBuffer, (doc.page.width - 110) / 2, doc.y + 10, { width: 110 });

  doc.fontSize(7).fillColor('#6B7280').text('Presente este código QR al abordar el bus.', 10, doc.page.height - 25, { align: 'center' });

  doc.end();
};

