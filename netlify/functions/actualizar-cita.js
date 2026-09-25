const { citasStore, requireAdmin, json } = require('./_shared/lib');

const ESTADOS_VALIDOS = ['pendiente', 'confirmada', 'cancelada'];

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

  const { id, estado } = payload;
  if (!id || !ESTADOS_VALIDOS.includes(estado)) {
    return json(400, { error: 'Faltan datos o estado inválido' });
  }

  const store = citasStore();
  const cita = await store.get(id, { type: 'json' });
  if (!cita) return json(404, { error: 'No se ha encontrado la cita' });

  cita.estado = estado;
  await store.setJSON(id, cita);

  return json(200, { ok: true, cita });
};
