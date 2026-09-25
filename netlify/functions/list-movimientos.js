const { cuentasStore, requireAdmin, json } = require('./_shared/lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método no permitido' });
  }
  const authError = await requireAdmin(event);
  if (authError) return authError;

  const { desde, hasta } = event.queryStringParameters || {};

  const store = cuentasStore();
  const { blobs } = await store.list();
  let movimientos = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));

  if (desde) movimientos = movimientos.filter((m) => m.fecha >= desde);
  if (hasta) movimientos = movimientos.filter((m) => m.fecha <= hasta);

  movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado.localeCompare(a.creado));

  const resumen = {
    ivaRepercutido: 0, ivaSoportado: 0,
    manoObraCobrada: 0,
    recambiosCobrados: 0, recambiosGastados: 0,
    totalCobrado: 0, totalGastado: 0,
  };
  for (const m of movimientos) {
    if (m.tipo === 'ingreso') {
      resumen.ivaRepercutido += m.iva;
      resumen.manoObraCobrada += m.manoObra;
      resumen.recambiosCobrados += m.recambios;
      resumen.totalCobrado += m.total;
    } else {
      resumen.ivaSoportado += m.iva;
      resumen.recambiosGastados += m.recambios;
      resumen.totalGastado += m.total;
    }
  }
  for (const k of Object.keys(resumen)) resumen[k] = Math.round(resumen[k] * 100) / 100;
  resumen.ivaNeto = Math.round((resumen.ivaRepercutido - resumen.ivaSoportado) * 100) / 100;

  return json(200, { movimientos, resumen });
};
