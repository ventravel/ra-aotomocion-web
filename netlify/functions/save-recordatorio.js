const { randomUUID } = require('crypto');
const { recordatoriosStore, requireAdmin, json } = require('./_shared/lib');

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

  const { id, cliente, telefono, matricula, vehiculo, trabajo, avisos } = payload;
  if (!cliente || !matricula) {
    return json(400, { error: 'Faltan campos obligatorios (cliente, matrícula)' });
  }

  const avisosLimpios = (Array.isArray(avisos) ? avisos : [])
    .filter((a) => a && a.tipo && a.fecha)
    .map((a) => ({ tipo: a.tipo, fecha: a.fecha }));

  const store = recordatoriosStore();
  const recordatorio = {
    id: id || randomUUID(),
    cliente,
    telefono: telefono || '',
    matricula,
    vehiculo: vehiculo || '',
    trabajo: trabajo || '',
    avisos: avisosLimpios,
  };

  await store.setJSON(recordatorio.id, recordatorio);

  return json(200, { ok: true, recordatorio });
};
