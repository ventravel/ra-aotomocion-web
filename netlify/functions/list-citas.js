const { citasStore, requireAdmin, json, madridDateParts } = require('./_shared/lib');
const { getBloqueos, BLOQUEOS_KEY } = require('./_shared/citas');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método no permitido' });
  }
  const authError = await requireAdmin(event);
  if (authError) return authError;

  const store = citasStore();
  const { blobs } = await store.list();
  const citas = await Promise.all(
    blobs.filter((b) => b.key !== BLOQUEOS_KEY).map((b) => store.get(b.key, { type: 'json' }))
  );
  citas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado.localeCompare(b.creado));

  const bloqueos = await getBloqueos(store);
  const hoy = madridDateParts(new Date()).fecha;

  return json(200, { citas, bloqueos, hoy });
};
