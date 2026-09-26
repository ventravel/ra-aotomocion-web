const pdfParse = require('pdf-parse');
const { recordatoriosStore, requireAdmin, json } = require('./_shared/lib');
const { getCatalogo } = require('./_shared/catalogo');
const { extraerDatosFactura } = require('./_shared/parse-factura-core');
const { parseMovimiento } = require('./_shared/parse-movimiento');

// Lee la factura UNA vez y devuelve todo lo que hace falta para los tres
// sitios a la vez: recordatorios (avisos), cuentas (importes) e historial
// (matrícula/vehículo/km/trabajo). Así el taller no tiene que subir la
// misma factura tres veces en tres paneles distintos.
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
  const datosFactura = extraerDatosFactura(texto, catalogo);
  const datosMovimiento = parseMovimiento(texto, 'ingreso');

  return json(200, {
    // Recordatorios
    cliente: datosFactura.cliente,
    telefono: datosFactura.telefono,
    matricula: datosFactura.matricula,
    vehiculo: datosFactura.vehiculo,
    km: datosFactura.km,
    fechaFactura: datosFactura.fechaFactura,
    trabajo: datosFactura.trabajo,
    avisosDetectados: datosFactura.avisosDetectados,
    // Cuentas
    base: datosMovimiento.base,
    iva: datosMovimiento.iva,
    total: datosMovimiento.total,
    manoObra: datosMovimiento.manoObra,
    recambios: datosMovimiento.recambios,
    // Avisos combinados (de ambos lectores, sin duplicar)
    avisos: Array.from(new Set([...datosFactura.avisos, ...datosMovimiento.avisos])),
  });
};
