const { randomUUID } = require('crypto');
const { recordatoriosStore, requireAdmin, json } = require('./_shared/lib');
const { getCatalogo, setCatalogo } = require('./_shared/catalogo');

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

  const { action, item, id } = payload;
  const store = recordatoriosStore();
  let catalogo = await getCatalogo(store);

  if (action === 'add') {
    if (!item || !item.nombre || !Array.isArray(item.palabrasClave) || item.palabrasClave.length === 0) {
      return json(400, { error: 'Falta el nombre o las palabras clave' });
    }
    catalogo = catalogo.concat([{
      id: randomUUID(),
      nombre: item.nombre,
      palabrasClave: item.palabrasClave,
      intervaloMeses: item.intervaloMeses || null,
    }]);
  } else if (action === 'edit') {
    if (!id) return json(400, { error: 'Falta el id' });
    catalogo = catalogo.map((c) => (c.id === id ? { ...c, ...item } : c));
  } else if (action === 'remove') {
    if (!id) return json(400, { error: 'Falta el id' });
    catalogo = catalogo.filter((c) => c.id !== id);
  } else {
    return json(400, { error: 'Acción inválida' });
  }

  await setCatalogo(store, catalogo);
  return json(200, { catalogo });
};
