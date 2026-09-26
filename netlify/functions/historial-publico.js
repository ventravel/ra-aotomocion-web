const { historialStore, json } = require('./_shared/lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método no permitido' });
  }

  const { id } = event.queryStringParameters || {};
  if (!id) return json(400, { error: 'Falta el id' });

  const registro = await historialStore().get(id, { type: 'json' });
  if (!registro) return json(404, { error: 'No se ha encontrado este vehículo' });

  const visitas = (registro.visitas || []).map((v) => ({
    fecha: v.fecha,
    trabajo: v.trabajo,
    km: v.km,
    fotoUrl: v.fotoExt ? `/.netlify/functions/historial-foto?id=${registro.id}&visita=${v.id}` : null,
  }));

  return json(200, {
    matricula: registro.matricula,
    vehiculo: registro.vehiculo,
    cliente: registro.cliente,
    avisoProximo: registro.avisoProximo,
    visitas,
  });
};
