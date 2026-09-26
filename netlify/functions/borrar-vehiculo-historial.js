const { historialStore, historialFileStore, requireAdmin, json } = require('./_shared/lib');

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

  const { vehiculoId } = payload;
  if (!vehiculoId) return json(400, { error: 'Falta el id' });

  const store = historialStore();
  const registro = await store.get(vehiculoId, { type: 'json' });
  if (registro) {
    const files = historialFileStore();
    for (const v of registro.visitas || []) {
      if (v.fotoExt) await files.delete(`${vehiculoId}/${v.id}.${v.fotoExt}`);
    }
  }
  await store.delete(vehiculoId);

  return json(200, { ok: true });
};
