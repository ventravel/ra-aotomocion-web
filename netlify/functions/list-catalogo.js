const { recordatoriosStore, requireAdmin, json } = require('./_shared/lib');
const { getCatalogo } = require('./_shared/catalogo');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método no permitido' });
  }
  const authError = await requireAdmin(event);
  if (authError) return authError;

  const catalogo = await getCatalogo(recordatoriosStore());
  return json(200, { catalogo });
};
