const { historialStore, requireAdmin, json } = require('./_shared/lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método no permitido' });
  }
  const authError = await requireAdmin(event);
  if (authError) return authError;

  const store = historialStore();
  const { blobs } = await store.list();
  const vehiculos = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
  vehiculos.sort((a, b) => (b.actualizado || b.creado).localeCompare(a.actualizado || a.creado));

  return json(200, { vehiculos });
};
