const QRCode = require('qrcode');

// Sin contraseña a propósito: una etiqueta <img> no puede enviar la cabecera
// de admin, y el QR solo apunta a la misma página pública de historial.html
// (mismo nivel de acceso que historial-publico.js y historial-foto.js).
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: 'Falta el id' };

  const host = event.headers['x-forwarded-host'] || event.headers.host;
  const url = `https://${host}/historial.html?id=${id}`;

  const buffer = await QRCode.toBuffer(url, { type: 'png', width: 400, margin: 1 });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true,
  };
};
