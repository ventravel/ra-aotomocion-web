const { randomUUID } = require('crypto');
const { recordatoriosStore, checkAdmin, json } = require('./_shared/lib');

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

  const { id, cliente, telefono, matricula, vehiculo, trabajo, fechaITV, fechaRevision } = payload;
  if (!cliente || !matricula) {
    return json(400, { error: 'Faltan campos obligatorios (cliente, matrícula)' });
  }

  const store = recordatoriosStore();
  const recordatorio = {
    id: id || randomUUID(),
    cliente,
    telefono: telefono || '',
    matricula,
    vehiculo: vehiculo || '',
    trabajo: trabajo || '',
    fechaITV: fechaITV || '',
    fechaRevision: fechaRevision || '',
  };

  await store.setJSON(recordatorio.id, recordatorio);

  return json(200, { ok: true, recordatorio });
};
