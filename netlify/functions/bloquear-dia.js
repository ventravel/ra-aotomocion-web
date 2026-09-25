const { citasStore, requireAdmin, json } = require('./_shared/lib');
const { getBloqueos, setBloqueos } = require('./_shared/citas');

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

  const { fecha, bloqueado } = payload;
  if (!fecha || typeof bloqueado !== 'boolean') {
    return json(400, { error: 'Faltan datos (fecha, bloqueado)' });
  }

  const store = citasStore();
  let bloqueos = await getBloqueos(store);

  if (bloqueado && !bloqueos.includes(fecha)) {
    bloqueos = bloqueos.concat([fecha]);
  } else if (!bloqueado) {
    bloqueos = bloqueos.filter((f) => f !== fecha);
  }

  await setBloqueos(store, bloqueos);
  return json(200, { ok: true, bloqueos });
};
