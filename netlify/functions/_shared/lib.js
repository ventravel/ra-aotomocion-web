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

module.exports = { metaStore, fileStore, checkAdmin, json };
