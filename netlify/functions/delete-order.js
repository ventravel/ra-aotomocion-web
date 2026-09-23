const { metaStore, fileStore, checkAdmin, json } = require('./_shared/lib');

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

  const { id } = payload;
  if (!id) {
    return json(400, { error: 'Falta el id' });
  }

  const files = fileStore();
  await files.delete(`${id}/original.pdf`);
  await files.delete(`${id}/signed.pdf`);
  await metaStore().delete(id);

  return json(200, { ok: true });
};
