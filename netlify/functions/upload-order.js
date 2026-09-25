const { randomUUID } = require('crypto');
const { metaStore, fileStore, requireAdmin, json } = require('./_shared/lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método no permitido' });
  }
  const authError = await requireAdmin(event);
  if (authError) return authError;

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: 'Cuerpo inválido' });
  }

  const { cliente, telefono, vehiculo, matricula, pdfBase64 } = payload;
  if (!cliente || !vehiculo || !pdfBase64) {
    return json(400, { error: 'Faltan campos obligatorios (cliente, vehículo, PDF)' });
  }

  const id = randomUUID();
  const pdfBytes = Buffer.from(pdfBase64, 'base64');

  await fileStore().set(`${id}/original.pdf`, pdfBytes, {
    metadata: { contentType: 'application/pdf' },
  });

  const meta = {
    id,
    cliente,
    telefono: telefono || '',
    vehiculo,
    matricula: matricula || '',
    estado: 'pendiente',
    creado: new Date().toISOString(),
    firmado: null,
    nombreFirmante: null,
  };
  await metaStore().setJSON(id, meta);

  return json(200, { id, meta });
};
