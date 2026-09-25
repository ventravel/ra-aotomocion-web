const { recordatoriosStore, checkAdmin, json, madridDateParts } = require('./_shared/lib');

function proximaFecha(r) {
  const fechas = [r.fechaITV, r.fechaRevision].filter(Boolean);
  if (fechas.length === 0) return null;
  return fechas.sort()[0];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método no permitido' });
  }
  if (!checkAdmin(event)) {
    return json(401, { error: 'No autorizado' });
  }

  const store = recordatoriosStore();
  const { blobs } = await store.list();
  const recordatorios = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));

  const hoy = madridDateParts(new Date()).fecha;
  recordatorios.sort((a, b) => {
    const pa = proximaFecha(a) || '9999-99-99';
    const pb = proximaFecha(b) || '9999-99-99';
    return pa.localeCompare(pb);
  });

  return json(200, { hoy, recordatorios });
};
