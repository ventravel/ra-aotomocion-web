const { rrhhStore, checkAdmin, json } = require('./_shared/lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método no permitido' });
  }
  if (!checkAdmin(event)) {
    return json(401, { error: 'No autorizado' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: 'Cuerpo inválido' });
  }

  const { month, id } = payload;
  if (!month || !id) {
    return json(400, { error: 'Faltan datos' });
  }

  const store = rrhhStore();
  const blobKey = `fichajes/${month}`;
  const registros = (await store.get(blobKey, { type: 'json' })) || [];
  const filtrados = registros.filter((r) => r.id !== id);
  await store.setJSON(blobKey, filtrados);

  return json(200, { ok: true, registros: filtrados });
};
