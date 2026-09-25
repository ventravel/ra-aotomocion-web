const { randomUUID } = require('crypto');
const { cuentasStore, cuentasFileStore, requireAdmin, json } = require('./_shared/lib');

const EXTENSIONES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

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

  const { tipo, fecha, contraparte, base, iva, total, manoObra, recambios, categoria, archivoBase64, archivoTipo } = payload;

  if (tipo !== 'ingreso' && tipo !== 'gasto') {
    return json(400, { error: 'Tipo inválido' });
  }
  if (!fecha || base == null || iva == null || total == null) {
    return json(400, { error: 'Faltan datos obligatorios (fecha, base, iva, total)' });
  }

  const id = randomUUID();
  let archivoExt = null;

  if (archivoBase64 && archivoTipo && EXTENSIONES[archivoTipo]) {
    archivoExt = EXTENSIONES[archivoTipo];
    const bytes = Buffer.from(archivoBase64, 'base64');
    await cuentasFileStore().set(`${id}/original.${archivoExt}`, bytes, {
      metadata: { contentType: archivoTipo },
    });
  }

  const movimiento = {
    id,
    tipo,
    fecha,
    contraparte: contraparte || '',
    base: Number(base),
    iva: Number(iva),
    total: Number(total),
    manoObra: tipo === 'ingreso' ? Number(manoObra || 0) : 0,
    recambios: Number(recambios || 0),
    categoria: tipo === 'gasto' ? (categoria || 'Recambios') : '',
    archivoExt,
    creado: new Date().toISOString(),
  };

  await cuentasStore().setJSON(id, movimiento);

  return json(200, { ok: true, movimiento });
};
