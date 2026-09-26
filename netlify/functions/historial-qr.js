const QRCode = require('qrcode');
const { requireAdmin } = require('./_shared/lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Método no permitido' };
  }
  const authError = await requireAdmin(event);
  if (authError) return { statusCode: authError.statusCode, body: JSON.parse(authError.body).error };

  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: 'Falta el id' };

  const host = event.headers['x-forwarded-host'] || event.headers.host;
  const url = `https://${host}/historial.html?id=${id}`;

  const buffer = await QRCode.toBuffer(url, { type: 'png', width: 400, margin: 1 });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true,
  };
};
