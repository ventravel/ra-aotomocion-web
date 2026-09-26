const { getStore } = require('@netlify/blobs');

function blobConfig(name) {
  return {
    name,
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  };
}

function metaStore() {
  return getStore(blobConfig('orders-meta'));
}

function fileStore() {
  return getStore(blobConfig('orders-files'));
}

function rrhhStore() {
  return getStore(blobConfig('rrhh'));
}

function recordatoriosStore() {
  return getStore(blobConfig('recordatorios'));
}

function citasStore() {
  return getStore(blobConfig('citas'));
}

function cuentasStore() {
  return getStore(blobConfig('cuentas-meta'));
}

function cuentasFileStore() {
  return getStore(blobConfig('cuentas-files'));
}

function historialStore() {
  return getStore(blobConfig('historial-meta'));
}

function historialFileStore() {
  return getStore(blobConfig('historial-files'));
}

function madridDateParts(date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    fecha: `${get('year')}-${get('month')}-${get('day')}`,
    hora: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
}

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

function authStore() {
  return getStore(blobConfig('admin-auth'));
}

function clientIp(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['client-ip'] ||
    (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown'
  );
}

// Devuelve { ok: true } si la contraseña es correcta, o
// { ok: false, reason: 'blocked' | 'wrong-password', minutosRestantes? }.
// Bloquea una IP durante BLOQUEO_MINUTOS tras MAX_INTENTOS fallos seguidos.
async function checkAdmin(event) {
  const provided = event.headers['x-admin-password'] || '';
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return { ok: false, reason: 'wrong-password' };

  const store = authStore();
  const key = `intentos-${clientIp(event)}`;
  const estado = (await store.get(key, { type: 'json' })) || { fallos: 0, bloqueadoHasta: 0 };
  const ahora = Date.now();

  if (estado.bloqueadoHasta && ahora < estado.bloqueadoHasta) {
    return { ok: false, reason: 'blocked', minutosRestantes: Math.ceil((estado.bloqueadoHasta - ahora) / 60000) };
  }

  if (provided === expected) {
    if (estado.fallos > 0) await store.delete(key);
    return { ok: true };
  }

  estado.fallos = (estado.fallos || 0) + 1;
  if (estado.fallos >= MAX_INTENTOS) {
    estado.bloqueadoHasta = ahora + BLOQUEO_MINUTOS * 60 * 1000;
    estado.fallos = 0;
  }
  await store.setJSON(key, estado);
  return { ok: false, reason: 'wrong-password' };
}

// Compatibilidad con recordatorios guardados antes de tener una lista de avisos
// (cuando solo había fechaITV/fechaRevision fijas). Si ya tiene "avisos", se deja igual.
function normalizarAvisos(r) {
  if (Array.isArray(r.avisos)) return r.avisos;
  const avisos = [];
  if (r.fechaITV) avisos.push({ tipo: 'ITV', fecha: r.fechaITV });
  if (r.fechaRevision) avisos.push({ tipo: r.trabajo || 'Revisión', fecha: r.fechaRevision });
  return avisos;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

// Comprueba la contraseña de admin y, si falla, devuelve directamente la
// respuesta HTTP que hay que retornar (401 o 429). Si es null, está autorizado.
async function requireAdmin(event) {
  const auth = await checkAdmin(event);
  if (auth.ok) return null;
  if (auth.reason === 'blocked') {
    return json(429, { error: `Demasiados intentos. Inténtalo de nuevo en ${auth.minutosRestantes} minuto(s).` });
  }
  return json(401, { error: 'No autorizado' });
}

module.exports = {
  metaStore,
  fileStore,
  rrhhStore,
  recordatoriosStore,
  citasStore,
  cuentasStore,
  cuentasFileStore,
  historialStore,
  historialFileStore,
  checkAdmin,
  requireAdmin,
  json,
  madridDateParts,
  normalizarAvisos,
};
