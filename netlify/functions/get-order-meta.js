const { metaStore, json } = require('./_shared/lib');

exports.handler = async (event) => {
  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) {
    return json(400, { error: 'Falta el id' });
  }

  const meta = await metaStore().get(id, { type: 'json' });
  if (!meta) {
    return json(404, { error: 'Orden no encontrada' });
  }

  return json(200, { meta });
};
