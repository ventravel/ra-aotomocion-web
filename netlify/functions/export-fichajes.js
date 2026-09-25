const { rrhhStore, requireAdmin, madridDateParts } = require('./_shared/lib');

function csvEscape(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Método no permitido' };
  }
  const authError = await requireAdmin(event);
  if (authError) return { statusCode: authError.statusCode, body: JSON.parse(authError.body).error };

  const params = event.queryStringParameters || {};
  const month = params.month || madridDateParts(new Date()).fecha.slice(0, 7);

  const store = rrhhStore();
  const registros = (await store.get(`fichajes/${month}`, { type: 'json' })) || [];
  registros.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const rows = [['Empleado', 'Fecha', 'Hora', 'Tipo'].map(csvEscape).join(';')];
  for (const r of registros) {
    rows.push([r.empleado, r.fecha, r.hora, r.tipo === 'entrada' ? 'Entrada' : 'Salida'].map(csvEscape).join(';'));
  }
  const csv = '﻿' + rows.join('\r\n');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="fichajes-${month}.csv"`,
    },
    body: csv,
  };
};
