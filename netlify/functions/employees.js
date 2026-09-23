const { rrhhStore, checkAdmin, json } = require('./_shared/lib');

async function getList(store) {
  const list = await store.get('empleados', { type: 'json' });
  return list || [];
}

exports.handler = async (event) => {
  const store = rrhhStore();

  if (event.httpMethod === 'GET') {
    const empleados = await getList(store);
    return json(200, { empleados });
  }

  if (event.httpMethod === 'POST') {
    if (!checkAdmin(event)) {
      return json(401, { error: 'No autorizado' });
    }

    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch {
      return json(400, { error: 'Cuerpo inválido' });
    }

    const { action, nombre } = payload;
    if (!nombre || typeof nombre !== 'string') {
      return json(400, { error: 'Falta el nombre' });
    }

    let empleados = await getList(store);

    if (action === 'add') {
      if (!empleados.includes(nombre)) empleados.push(nombre);
    } else if (action === 'remove') {
      empleados = empleados.filter((e) => e !== nombre);
    } else {
      return json(400, { error: 'Acción inválida' });
    }

    await store.setJSON('empleados', empleados);
    return json(200, { empleados });
  }

  return json(405, { error: 'Método no permitido' });
};
