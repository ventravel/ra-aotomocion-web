const { randomUUID } = require('crypto');
const {
  recordatoriosStore, cuentasStore, cuentasFileStore, historialStore, historialFileStore,
  requireAdmin, json,
} = require('./_shared/lib');

const EXT_IMAGEN = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function normalizarMatricula(m) {
  return (m || '').toUpperCase().replace(/[\s-]/g, '');
}

function sumarDias(fechaISO, dias) {
  const d = new Date(fechaISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Guarda de una vez el recordatorio, el ingreso en cuentas y la visita en el
// historial del vehículo, a partir de una única factura leída. Así no hace
// falta subir la misma factura tres veces en tres paneles distintos.
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

  const {
    cliente, telefono, matricula, vehiculo, fecha, trabajo, km, avisos,
    base, iva, total, manoObra, recambios,
    facturaBase64, fotoVehiculoBase64, fotoVehiculoTipo,
  } = payload;

  if (!matricula || !fecha) {
    return json(400, { error: 'Faltan datos obligatorios (matrícula, fecha)' });
  }

  const resultado = {};

  // --- 1. Recordatorio (ITV / revisión / catálogo) ---
  const avisosLimpios = (Array.isArray(avisos) ? avisos : [])
    .filter((a) => a && a.tipo && a.fecha)
    .map((a) => ({ tipo: a.tipo, fecha: a.fecha }));

  if (avisosLimpios.length > 0) {
    const recordatorio = {
      id: randomUUID(),
      cliente: cliente || '',
      telefono: telefono || '',
      matricula,
      vehiculo: vehiculo || '',
      trabajo: trabajo || '',
      avisos: avisosLimpios,
    };
    await recordatoriosStore().setJSON(recordatorio.id, recordatorio);
    resultado.recordatorio = recordatorio;
  }

  // --- 2. Ingreso en cuentas ---
  if (base != null && iva != null && total != null) {
    const movId = randomUUID();
    let archivoExt = null;
    if (facturaBase64) {
      archivoExt = 'pdf';
      await cuentasFileStore().set(`${movId}/original.pdf`, Buffer.from(facturaBase64, 'base64'), {
        metadata: { contentType: 'application/pdf' },
      });
    }
    const movimiento = {
      id: movId,
      tipo: 'ingreso',
      fecha,
      contraparte: cliente || '',
      base: Number(base),
      iva: Number(iva),
      total: Number(total),
      manoObra: Number(manoObra || 0),
      recambios: Number(recambios || 0),
      categoria: '',
      archivoExt,
      creado: new Date().toISOString(),
    };
    await cuentasStore().setJSON(movId, movimiento);
    resultado.movimiento = movimiento;
  }

  // --- 3. Visita en el historial del vehículo (crea el vehículo si hace falta) ---
  const storeHist = historialStore();
  const matriculaNorm = normalizarMatricula(matricula);
  const { blobs } = await storeHist.list();
  const existentes = await Promise.all(blobs.map((b) => storeHist.get(b.key, { type: 'json' })));
  let vehiculoReg = existentes.find((r) => normalizarMatricula(r.matricula) === matriculaNorm) || null;

  if (!vehiculoReg) {
    vehiculoReg = {
      id: randomUUID(),
      matricula: matricula.toUpperCase(),
      vehiculo: vehiculo || '',
      cliente: cliente || '',
      avisoProximo: null,
      visitas: [],
      creado: new Date().toISOString(),
    };
  }

  const visitaId = randomUUID();
  let fotoExt = null;
  if (fotoVehiculoBase64 && fotoVehiculoTipo && EXT_IMAGEN[fotoVehiculoTipo]) {
    fotoExt = EXT_IMAGEN[fotoVehiculoTipo];
    await historialFileStore().set(`${vehiculoReg.id}/${visitaId}.${fotoExt}`, Buffer.from(fotoVehiculoBase64, 'base64'), {
      metadata: { contentType: fotoVehiculoTipo },
    });
  }

  vehiculoReg.visitas = [{ id: visitaId, fecha, trabajo: trabajo || 'Visita', km: km || null, fotoExt, creado: new Date().toISOString() }, ...(vehiculoReg.visitas || [])];
  if (km) {
    vehiculoReg.avisoProximo = { kmLimite: Number(km) + 15000, fechaLimite: sumarDias(fecha, 365) };
  }
  vehiculoReg.actualizado = new Date().toISOString();
  await storeHist.setJSON(vehiculoReg.id, vehiculoReg);
  resultado.vehiculo = vehiculoReg;

  return json(200, { ok: true, ...resultado });
};
