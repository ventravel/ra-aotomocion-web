const { randomUUID } = require('crypto');
const { historialStore, historialFileStore, requireAdmin, json } = require('./_shared/lib');

const EXTENSIONES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function normalizarMatricula(m) {
  return (m || '').toUpperCase().replace(/[\s-]/g, '');
}

function sumarDias(fechaISO, dias) {
  const d = new Date(fechaISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

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

  const { vehiculoId, matricula, vehiculo, cliente, fecha, trabajo, km, fotoBase64, fotoTipo } = payload;
  if (!fecha || !trabajo) {
    return json(400, { error: 'Faltan datos obligatorios (fecha, trabajo)' });
  }

  const store = historialStore();
  let registro = null;

  if (vehiculoId) {
    registro = await store.get(vehiculoId, { type: 'json' });
    if (!registro) return json(404, { error: 'No se ha encontrado el vehículo' });
  } else {
    if (!matricula) return json(400, { error: 'Falta la matrícula para crear el vehículo' });
    const matriculaNorm = normalizarMatricula(matricula);

    // Evita duplicar: si ya existe un vehículo con esa matrícula, se añade ahí.
    const { blobs } = await store.list();
    const existentes = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
    registro = existentes.find((r) => normalizarMatricula(r.matricula) === matriculaNorm) || null;

    if (!registro) {
      registro = {
        id: randomUUID(),
        matricula: matricula.toUpperCase(),
        vehiculo: vehiculo || '',
        cliente: cliente || '',
        avisoProximo: null,
        visitas: [],
        creado: new Date().toISOString(),
      };
    }
  }

  const visitaId = randomUUID();
  let fotoExt = null;
  if (fotoBase64 && fotoTipo && EXTENSIONES[fotoTipo]) {
    fotoExt = EXTENSIONES[fotoTipo];
    const bytes = Buffer.from(fotoBase64, 'base64');
    await historialFileStore().set(`${registro.id}/${visitaId}.${fotoExt}`, bytes, {
      metadata: { contentType: fotoTipo },
    });
  }

  const visita = {
    id: visitaId,
    fecha,
    trabajo,
    km: km || null,
    fotoExt,
    creado: new Date().toISOString(),
  };

  registro.visitas = [visita, ...(registro.visitas || [])];

  // El "próximo servicio" (para la etiqueta) se recalcula con la visita más reciente que tenga km.
  if (km) {
    registro.avisoProximo = {
      kmLimite: Number(km) + 15000,
      fechaLimite: sumarDias(fecha, 365),
    };
  }
  registro.actualizado = new Date().toISOString();

  await store.setJSON(registro.id, registro);

  return json(200, { ok: true, registro });
};
