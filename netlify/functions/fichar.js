const { randomUUID } = require('crypto');
const { rrhhStore, json, madridDateParts } = require('./_shared/lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método no permitido' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: 'Cuerpo inválido' });
  }

  const { empleado, tipo } = payload;
  if (!empleado || (tipo !== 'entrada' && tipo !== 'salida')) {
    return json(400, { error: 'Faltan datos o tipo inválido' });
  }

  const store = rrhhStore();
  const empleados = (await store.get('empleados', { type: 'json' })) || [];
  if (!empleados.includes(empleado)) {
    return json(400, { error: 'Empleado no reconocido' });
  }

  const now = new Date();
  const { fecha, hora } = madridDateParts(now);
  const monthKey = fecha.slice(0, 7);
  const blobKey = `fichajes/${monthKey}`;

  const registro = {
    id: randomUUID(),
    empleado,
    tipo,
    fecha,
    hora,
    timestamp: now.toISOString(),
  };

  const registros = (await store.get(blobKey, { type: 'json' })) || [];
  registros.push(registro);
  await store.setJSON(blobKey, registros);

  return json(200, { ok: true, registro });
};
