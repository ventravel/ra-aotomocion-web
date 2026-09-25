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

function checkAdmin(event) {
  const provided = event.headers['x-admin-password'] || '';
  const expected = process.env.ADMIN_PASSWORD || '';
  return expected.length > 0 && provided === expected;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

module.exports = { metaStore, fileStore, rrhhStore, recordatoriosStore, checkAdmin, json, madridDateParts };
