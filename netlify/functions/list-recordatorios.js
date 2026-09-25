const { recordatoriosStore, requireAdmin, json, madridDateParts, normalizarAvisos } = require('./_shared/lib');
const { CATALOGO_KEY } = require('./_shared/catalogo');

function proximaFecha(r) {
  const fechas = normalizarAvisos(r).map((a) => a.fecha).filter(Boolean);
  if (fechas.length === 0) return null;
  return fechas.sort()[0];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método no permitido' });
  }
  const authError = await requireAdmin(event);
  if (authError) return authError;

  const store = recordatoriosStore();
  const { blobs } = await store.list();
  const recordatorios = await Promise.all(
    blobs.filter((b) => b.key !== CATALOGO_KEY).map((b) => store.get(b.key, { type: 'json' }))
  );

  const hoy = madridDateParts(new Date()).fecha;
  recordatorios.sort((a, b) => {
    const pa = proximaFecha(a) || '9999-99-99';
    const pb = proximaFecha(b) || '9999-99-99';
    return pa.localeCompare(pb);
  });

  return json(200, { hoy, recordatorios });
};
