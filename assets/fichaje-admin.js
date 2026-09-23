(function () {
  'use strict';

  const loginBox = document.getElementById('login-box');
  const panel = document.getElementById('panel');
  const loginError = document.getElementById('login-error');

  function getPassword() {
    return sessionStorage.getItem('adminPassword') || '';
  }

  function authFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { 'x-admin-password': getPassword() });
    return fetch(url, options);
  }

  function currentMonth() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  function entrar(password) {
    sessionStorage.setItem('adminPassword', password);
    authFetch('/.netlify/functions/list-fichajes?month=' + currentMonth())
      .then((res) => {
        if (!res.ok) throw new Error('bad-auth');
        return res.json();
      })
      .then(({ registros }) => {
        loginBox.hidden = true;
        panel.hidden = false;
        document.getElementById('f-mes').value = currentMonth();
        renderFichajes(registros);
        cargarEmpleados();
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

  function cargarEmpleados() {
    fetch('/.netlify/functions/employees')
      .then((res) => res.json())
      .then(({ empleados }) => renderEmpleados(empleados));
  }

  function renderEmpleados(empleados) {
    const ul = document.getElementById('lista-empleados');
    ul.innerHTML = '';
    empleados.forEach((nombre) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = nombre;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link-borrar';
      btn.textContent = 'Eliminar';
      btn.addEventListener('click', () => {
        if (!confirm(`¿Eliminar a ${nombre} de la lista de trabajadores?`)) return;
        authFetch('/.netlify/functions/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'remove', nombre }),
        }).then(() => cargarEmpleados());
      });
      li.appendChild(span);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  document.getElementById('btn-anadir-empleado').addEventListener('click', () => {
    const input = document.getElementById('f-nuevo-empleado');
    const empleadoError = document.getElementById('empleado-error');
    empleadoError.hidden = true;
    const nombre = input.value.trim();
    if (!nombre) {
      empleadoError.textContent = 'Escribe un nombre.';
      empleadoError.hidden = false;
      return;
    }
    authFetch('/.netlify/functions/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', nombre }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error)));
        return res.json();
      })
      .then(({ empleados }) => {
        input.value = '';
        renderEmpleados(empleados);
      })
      .catch((err) => {
        empleadoError.textContent = err.message || 'No se ha podido añadir.';
        empleadoError.hidden = false;
      });
  });

  function renderFichajes(registros) {
    const tbody = document.getElementById('tabla-fichajes-body');
    tbody.innerHTML = '';
    if (registros.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'Sin fichajes este mes.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    registros.forEach((r) => {
      const tr = document.createElement('tr');
      [r.empleado, r.fecha, r.hora, r.tipo === 'entrada' ? 'Entrada' : 'Salida'].forEach((val) => {
        const td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  document.getElementById('btn-ver-mes').addEventListener('click', () => {
    const month = document.getElementById('f-mes').value;
    if (!month) return;
    authFetch('/.netlify/functions/list-fichajes?month=' + encodeURIComponent(month))
      .then((res) => res.json())
      .then(({ registros }) => renderFichajes(registros));
  });

  document.getElementById('btn-exportar').addEventListener('click', () => {
    const month = document.getElementById('f-mes').value || currentMonth();
    authFetch('/.netlify/functions/export-fichajes?month=' + encodeURIComponent(month))
      .then((res) => {
        if (!res.ok) throw new Error('No se ha podido generar el archivo.');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fichajes-${month}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((err) => alert(err.message));
  });
})();
