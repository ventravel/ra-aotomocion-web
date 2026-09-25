const { cuentasStore, cuentasFileStore, requireAdmin } = require('./_shared/lib');

const CONTENT_TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Método no permitido' };
  }
  const authError = await requireAdmin(event);
  if (authError) return { statusCode: authError.statusCode, body: JSON.parse(authError.body).error };

  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: 'Falta el id' };

  const movimiento = await cuentasStore().get(id, { type: 'json' });
  if (!movimiento || !movimiento.archivoExt) {
    return { statusCode: 404, body: 'No hay archivo para este movimiento' };
  }

  const bytes = await cuentasFileStore().get(`${id}/original.${movimiento.archivoExt}`, { type: 'arrayBuffer' });
  if (!bytes) return { statusCode: 404, body: 'Archivo no encontrado' };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[movimiento.archivoExt] || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
    },
    body: Buffer.from(bytes).toString('base64'),
    isBase64Encoded: true,
  };
};
