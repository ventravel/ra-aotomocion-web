const { randomUUID } = require('crypto');
const { citasStore, json, madridDateParts } = require('./_shared/lib');
const { getBloqueos, puedeReservar, esDomingo } = require('./_shared/citas');

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

  const { fecha, cliente, telefono, matricula, motivo } = payload;
  if (!fecha || !cliente || !telefono || !matricula) {
    return json(400, { error: 'Faltan datos obligatorios (fecha, nombre, teléfono, matrícula)' });
  }

  const hoy = madridDateParts(new Date()).fecha;
  if (fecha < hoy) {
    return json(400, { error: 'No se puede reservar un día que ya ha pasado' });
  }

  const store = citasStore();
  const bloqueos = await getBloqueos(store);

  const { blobs } = await store.list();
  const citasDelDia = [];
  for (const b of blobs) {
    if (b.key === '_bloqueos') continue;
    const cita = await store.get(b.key, { type: 'json' });
    if (cita && cita.fecha === fecha) citasDelDia.push(cita);
  }

  const resultado = puedeReservar(citasDelDia, motivo, bloqueos.includes(fecha) || esDomingo(fecha));
  if (!resultado.ok) {
    const mensaje = resultado.motivo === 'cerrado'
      ? 'Ese día el taller está cerrado. Elige otra fecha.'
      : 'Ese día ya está completo. Elige otra fecha.';
    return json(409, { error: mensaje, motivo: resultado.motivo });
  }

  const cita = {
    id: randomUUID(),
    fecha,
    cliente,
    telefono,
    matricula,
    motivo: motivo || '',
    estado: 'pendiente',
    creado: new Date().toISOString(),
  };
  await store.setJSON(cita.id, cita);

  return json(200, { ok: true, cita });
};
