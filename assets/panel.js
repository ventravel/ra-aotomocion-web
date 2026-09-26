(function () {
  'use strict';

  const loginBox = document.getElementById('login-box');
  const panel = document.getElementById('panel');
  const loginError = document.getElementById('login-error');
  const AVISO_DIAS = 15;

  function getPassword() {
    return sessionStorage.getItem('adminPassword') || '';
  }

  function authFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { 'x-admin-password': getPassword() });
    return fetch(url, options);
  }

  function normalizarAvisos(r) {
    if (Array.isArray(r.avisos)) return r.avisos;
    const avisos = [];
    if (r.fechaITV) avisos.push({ tipo: 'ITV', fecha: r.fechaITV });
    if (r.fechaRevision) avisos.push({ tipo: r.trabajo || 'Revisión', fecha: r.fechaRevision });
    return avisos;
  }

  function diasHasta(hoy, fecha) {
    return Math.round((new Date(fecha + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 86400000);
  }

  function fmt(n) {
    return (Math.round((n || 0) * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function entrar(password) {
    sessionStorage.setItem('adminPassword', password);
    authFetch('/.netlify/functions/list-recordatorios')
      .then((res) => {
        if (!res.ok) throw new Error('bad-auth');
        return res.json();
      })
      .then(() => {
        loginBox.hidden = true;
        panel.hidden = false;
        cargarResumenes();
      })
      .catch(() => {
        sessionStorage.removeItem('adminPassword');
        loginError.hidden = false;
      });
  }

  document.getElementById('btn-entrar').addEventListener('click', () => {
    entrar(document.getElementById('input-password').value);
  });
  document.getElementById('input-password').addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') document.getElementById('btn-entrar').click();
  });
  if (getPassword()) entrar(getPassword());

  function cargarResumenes() {
    authFetch('/.netlify/functions/list-recordatorios')
      .then((res) => res.json())
      .then(({ hoy, recordatorios }) => {
        let urgentes = 0;
        recordatorios.forEach((r) => {
          normalizarAvisos(r).forEach((a) => {
            if (a.fecha && diasHasta(hoy, a.fecha) <= AVISO_DIAS) urgentes++;
          });
        });
        document.getElementById('resumen-recordatorios').textContent =
          urgentes > 0 ? `⚠️ ${urgentes} próximos a vencer` : 'Todo al día';
      })
      .catch(() => {});

    authFetch('/.netlify/functions/list-citas')
      .then((res) => res.json())
      .then(({ citas, hoy }) => {
        const pendientes = citas.filter((c) => c.fecha >= hoy && c.estado === 'pendiente').length;
        document.getElementById('resumen-citas').textContent =
          pendientes > 0 ? `${pendientes} pendiente(s) de confirmar` : 'Sin pendientes';
      })
      .catch(() => {});

    const desdeEsteMes = new Date();
    desdeEsteMes.setDate(1);
    const desde = desdeEsteMes.toISOString().slice(0, 10);
    authFetch('/.netlify/functions/list-movimientos?desde=' + desde)
      .then((res) => res.json())
      .then(({ resumen }) => {
        document.getElementById('resumen-cuentas').textContent = `Este mes: ${fmt(resumen.totalCobrado)} cobrado`;
      })
      .catch(() => {});
  }
})();
