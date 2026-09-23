const { fileStore, metaStore } = require('./_shared/lib');

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const id = params.id;
  const kind = params.kind === 'signed' ? 'signed' : 'original';

  if (!id) {
    return { statusCode: 400, body: 'Falta el id' };
  }

  const meta = await metaStore().get(id, { type: 'json' });
  if (!meta) {
    return { statusCode: 404, body: 'Orden no encontrada' };
  }
  if (kind === 'signed' && meta.estado !== 'firmado') {
    return { statusCode: 404, body: 'Esta orden todavía no está firmada' };
  }

  const bytes = await fileStore().get(`${id}/${kind}.pdf`, { type: 'arrayBuffer' });
  if (!bytes) {
    return { statusCode: 404, body: 'PDF no encontrado' };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="orden-${id}-${kind}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
    body: Buffer.from(bytes).toString('base64'),
    isBase64Encoded: true,
  };
};
