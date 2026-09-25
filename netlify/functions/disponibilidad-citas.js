const { citasStore, json, madridDateParts } = require('./_shared/lib');
const { getBloqueos, estadoDelDia, esDomingo } = require('./_shared/citas');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método no permitido' });
  }

  const params = event.queryStringParameters || {};
  const hoy = madridDateParts(new Date()).fecha;
  const desde = params.desde || hoy;
  const dias = Math.min(Number(params.dias) || 45, 90);

  const store = citasStore();
  const { blobs } = await store.list();
  const bloqueos = await getBloqueos(store);

  const citasPorFecha = {};
  for (const b of blobs) {
    if (b.key === '_bloqueos') continue;
    const cita = await store.get(b.key, { type: 'json' });
    if (!cita || !cita.fecha) continue;
    (citasPorFecha[cita.fecha] = citasPorFecha[cita.fecha] || []).push(cita);
  }

  const disponibilidad = {};
  const inicio = new Date(desde + 'T00:00:00Z');
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio);
    d.setUTCDate(d.getUTCDate() + i);
    const fecha = d.toISOString().slice(0, 10);
    const citasDelDia = citasPorFecha[fecha] || [];
    disponibilidad[fecha] = estadoDelDia(citasDelDia, bloqueos.includes(fecha) || esDomingo(fecha));
  }

  return json(200, { hoy, disponibilidad });
};
