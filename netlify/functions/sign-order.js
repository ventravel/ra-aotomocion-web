const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { metaStore, fileStore, json } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método no permitido' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: 'Cuerpo inválido' });
  }

  const { id, signatureDataUrl, nombreFirmante } = payload;
  if (!id || !signatureDataUrl || !nombreFirmante) {
    return json(400, { error: 'Faltan campos obligatorios' });
  }

  const meta = await metaStore().get(id, { type: 'json' });
  if (!meta) {
    return json(404, { error: 'Orden no encontrada' });
  }
  if (meta.estado === 'firmado') {
    return json(409, { error: 'Esta orden ya ha sido firmada anteriormente' });
  }

  const originalBytes = await fileStore().get(`${id}/original.pdf`, { type: 'arrayBuffer' });
  if (!originalBytes) {
    return json(404, { error: 'PDF original no encontrado' });
  }

  const pngMatch = /^data:image\/png;base64,(.+)$/.exec(signatureDataUrl);
  if (!pngMatch) {
    return json(400, { error: 'Firma inválida' });
  }
  const signaturePngBytes = Buffer.from(pngMatch[1], 'base64');

  const pdfDoc = await PDFDocument.load(originalBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const signatureImage = await pdfDoc.embedPng(signaturePngBytes);

  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width } = page.getSize();
  const margin = 56;
  let y = 780;

  page.drawText('CONFORMIDAD DEL CLIENTE', {
    x: margin,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 34;

  const now = new Date();
  const fecha = now.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

  const lines = [
    `Orden de reparación: ${id}`,
    `Cliente: ${meta.cliente}`,
    `Vehículo: ${meta.vehiculo}${meta.matricula ? ' — Matrícula: ' + meta.matricula : ''}`,
    '',
    'El cliente declara haber revisado el documento adjunto y autoriza la',
    'reparación conforme a lo descrito en el mismo.',
    '',
    `Firmado por: ${nombreFirmante}`,
    `Fecha y hora: ${fecha}`,
  ];

  for (const line of lines) {
    page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
  }

  y -= 20;
  const sigDims = signatureImage.scale(0.5);
  const maxSigWidth = width - margin * 2;
  const sigWidth = Math.min(sigDims.width, maxSigWidth);
  const sigHeight = sigDims.height * (sigWidth / sigDims.width);

  page.drawRectangle({
    x: margin,
    y: y - sigHeight - 10,
    width: sigWidth + 20,
    height: sigHeight + 20,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
  });
  page.drawImage(signatureImage, {
    x: margin + 10,
    y: y - sigHeight,
    width: sigWidth,
    height: sigHeight,
  });

  const signedBytes = await pdfDoc.save();
  await fileStore().set(`${id}/signed.pdf`, signedBytes, {
    metadata: { contentType: 'application/pdf' },
  });

  const updatedMeta = {
    ...meta,
    estado: 'firmado',
    firmado: now.toISOString(),
    nombreFirmante,
  };
  await metaStore().setJSON(id, updatedMeta);

  return json(200, { ok: true, meta: updatedMeta });
};
