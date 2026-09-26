const { historialStore, historialFileStore } = require('./_shared/lib');

const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  const { id, visita } = event.queryStringParameters || {};
  if (!id || !visita) return { statusCode: 400, body: 'Faltan datos' };

  const registro = await historialStore().get(id, { type: 'json' });
  const v = registro && (registro.visitas || []).find((x) => x.id === visita);
  if (!v || !v.fotoExt) return { statusCode: 404, body: 'Foto no encontrada' };

  const bytes = await historialFileStore().get(`${id}/${visita}.${v.fotoExt}`, { type: 'arrayBuffer' });
  if (!bytes) return { statusCode: 404, body: 'Foto no encontrada' };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': CONTENT_TYPES[v.fotoExt] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
    body: Buffer.from(bytes).toString('base64'),
    isBase64Encoded: true,
  };
};
