const pdfParse = require('pdf-parse');
const { recordatoriosStore, requireAdmin, json } = require('./_shared/lib');
const { getCatalogo } = require('./_shared/catalogo');
const { extraerDatosFactura } = require('./_shared/parse-factura-core');

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

  const { pdfBase64 } = payload;
  if (!pdfBase64) {
    return json(400, { error: 'Falta el PDF' });
  }

  let texto;
  try {
    const parsed = await pdfParse(Buffer.from(pdfBase64, 'base64'));
    texto = parsed.text;
  } catch {
    return json(400, { error: 'No se ha podido leer el PDF (¿es un PDF con texto, no una foto escaneada?)' });
  }

  const catalogo = await getCatalogo(recordatoriosStore());
  return json(200, extraerDatosFactura(texto, catalogo));
};
