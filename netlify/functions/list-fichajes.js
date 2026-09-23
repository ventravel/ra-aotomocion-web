const { rrhhStore, checkAdmin, json, madridDateParts } = require('./_shared/lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método no permitido' });
  }
  if (!checkAdmin(event)) {
    return json(401, { error: 'No autorizado' });
  }

  const params = event.queryStringParameters || {};
  const month = params.month || madridDateParts(new Date()).fecha.slice(0, 7);

  const store = rrhhStore();
  const registros = (await store.get(`fichajes/${month}`, { type: 'json' })) || [];
  registros.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return json(200, { month, registros });
};
