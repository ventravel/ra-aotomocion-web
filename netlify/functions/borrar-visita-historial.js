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

  const { vehiculoId, visitaId } = payload;
  if (!vehiculoId || !visitaId) return json(400, { error: 'Faltan datos' });

  const store = historialStore();
  const registro = await store.get(vehiculoId, { type: 'json' });
  if (!registro) return json(404, { error: 'No se ha encontrado el vehículo' });

  const visita = (registro.visitas || []).find((v) => v.id === visitaId);
  registro.visitas = (registro.visitas || []).filter((v) => v.id !== visitaId);

  if (visita && visita.fotoExt) {
    await historialFileStore().delete(`${vehiculoId}/${visitaId}.${visita.fotoExt}`);
  }

  await store.setJSON(vehiculoId, registro);
  return json(200, { ok: true, registro });
};
