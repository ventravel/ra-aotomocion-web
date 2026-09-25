const { cuentasStore, cuentasFileStore, requireAdmin, json } = require('./_shared/lib');

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

  const { id } = payload;
  if (!id) return json(400, { error: 'Falta el id' });

  const store = cuentasStore();
  const movimiento = await store.get(id, { type: 'json' });
  if (movimiento && movimiento.archivoExt) {
    await cuentasFileStore().delete(`${id}/original.${movimiento.archivoExt}`);
  }
  await store.delete(id);

  return json(200, { ok: true });
};
