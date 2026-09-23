const { metaStore, checkAdmin, json } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método no permitido' });
  }
  if (!checkAdmin(event)) {
    return json(401, { error: 'No autorizado' });
  }

  const store = metaStore();
  const { blobs } = await store.list();
  const orders = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
  orders.sort((a, b) => new Date(b.creado) - new Date(a.creado));

  return json(200, { orders });
};
