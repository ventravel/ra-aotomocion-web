const pdfParse = require('pdf-parse');
const { requireAdmin, json } = require('./_shared/lib');
const { parseMovimiento } = require('./_shared/parse-movimiento');

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

  const { pdfBase64, tipo } = payload;
  if (!pdfBase64 || (tipo !== 'ingreso' && tipo !== 'gasto')) {
    return json(400, { error: 'Faltan datos (pdfBase64, tipo)' });
  }

  let texto;
  try {
    const parsed = await pdfParse(Buffer.from(pdfBase64, 'base64'));
    texto = parsed.text;
  } catch {
    return json(400, { error: 'No se ha podido leer el PDF (¿es un PDF con texto, no una foto escaneada?)' });
  }

  if (!texto || texto.trim().length < 10) {
    return json(200, {
      fecha: null, base: null, iva: null, total: null, manoObra: null, recambios: null,
      avisos: ['Este PDF parece ser una foto o escaneado sin texto. Rellena los datos a mano.'],
    });
  }

  return json(200, parseMovimiento(texto, tipo));
};
