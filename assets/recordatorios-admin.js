(function () {
  'use strict';

  const AVISO_DIAS = 15;

  const loginBox = document.getElementById('login-box');
  const panel = document.getElementById('panel');
  const loginError = document.getElementById('login-error');
  const form = document.getElementById('form-recordatorio');

  function getPassword() {
    return sessionStorage.getItem('adminPassword') || '';
  }

  function authFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { 'x-admin-password': getPassword() });
    return fetch(url, options);
  }

  function entrar(password) {
    sessionStorage.setItem('adminPassword', password);
    authFetch('/.netlify/functions/list-recordatorios')
      .then((res) => {
        if (!res.ok) throw new Error('bad-auth');
        return res.json();
      })
      .then(({ hoy, recordatorios }) => {
        loginBox.hidden = true;
        panel.hidden = false;
        renderRecordatorios(hoy, recordatorios);
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

  function diasHasta(hoy, fecha) {
    const a = new Date(hoy + 'T00:00:00');
    const b = new Date(fecha + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  function formatPhoneForWhatsapp(telefono) {
    const digits = (telefono || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('34') ? digits : '34' + digits;
  }

  function cargarLista() {
    authFetch('/.netlify/functions/list-recordatorios')
      .then((res) => res.json())
      .then(({ hoy, recordatorios }) => renderRecordatorios(hoy, recordatorios));
  }

  document.getElementById('btn-refrescar').addEventListener('click', cargarLista);

  function crearBotonWhatsapp(tipo, r) {
    const phone = formatPhoneForWhatsapp(r.telefono);
    if (!phone) return null;
    const fecha = tipo === 'itv' ? r.fechaITV : r.fechaRevision;
    const etiqueta = tipo === 'itv' ? 'ITV' : 'revisión';
    const mensaje =
      tipo === 'itv'
        ? `Hola ${r.cliente}, te recordamos que la ITV de tu ${r.vehiculo || 'vehículo'} (${r.matricula}) vence el ${fecha}. Contáctanos si quieres que te ayudemos con la revisión previa.`
        : `Hola ${r.cliente}, según nuestros registros a tu ${r.vehiculo || 'vehículo'} (${r.matricula}) le toca revisión. ¿Quieres que te demos cita?`;
    const a = document.createElement('a');
    a.href = `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'btn btn-whatsapp btn-sm';
    a.textContent = `WhatsApp ${etiqueta}`;
    return a;
  }

  function celdaFecha(hoy, fecha) {
    const td = document.createElement('td');
    if (!fecha) {
      td.textContent = '—';
      return td;
    }
    const dias = diasHasta(hoy, fecha);
    td.textContent = fecha + (dias < 0 ? ` (vencida hace ${-dias}d)` : ` (en ${dias}d)`);
    if (dias <= AVISO_DIAS) {
      td.style.color = '#b3261e';
      td.style.fontWeight = '700';
    }
    return td;
  }

  function renderRecordatorios(hoy, recordatorios) {
    const tbody = document.getElementById('tabla-recordatorios-body');
    tbody.innerHTML = '';

    if (recordatorios.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.textContent = 'No hay vehículos guardados todavía.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    recordatorios.forEach((r) => {
      const tr = document.createElement('tr');

      const tdCliente = document.createElement('td');
      tdCliente.textContent = r.cliente + (r.telefono ? ' — ' + r.telefono : '');
      tr.appendChild(tdCliente);

      const tdMatricula = document.createElement('td');
      tdMatricula.textContent = r.matricula + (r.vehiculo ? ' — ' + r.vehiculo : '');
      tr.appendChild(tdMatricula);

      const tdTrabajo = document.createElement('td');
      tdTrabajo.textContent = r.trabajo || '—';
      tr.appendChild(tdTrabajo);

      tr.appendChild(celdaFecha(hoy, r.fechaITV));
      tr.appendChild(celdaFecha(hoy, r.fechaRevision));

      const tdAcciones = document.createElement('td');
      tdAcciones.className = 'acciones-orden';

      if (r.fechaITV && diasHasta(hoy, r.fechaITV) <= AVISO_DIAS) {
        const btn = crearBotonWhatsapp('itv', r);
        if (btn) tdAcciones.appendChild(btn);
      }
      if (r.fechaRevision && diasHasta(hoy, r.fechaRevision) <= AVISO_DIAS) {
        const btn = crearBotonWhatsapp('revision', r);
        if (btn) tdAcciones.appendChild(btn);
      }

      const btnEditar = document.createElement('button');
      btnEditar.type = 'button';
      btnEditar.textContent = 'Editar';
      btnEditar.className = 'link-borrar';
      btnEditar.addEventListener('click', () => cargarEnFormulario(r));
      tdAcciones.appendChild(btnEditar);

      const btnBorrar = document.createElement('button');
      btnBorrar.type = 'button';
      btnBorrar.textContent = 'Eliminar';
      btnBorrar.className = 'link-borrar';
      btnBorrar.addEventListener('click', () => {
        if (!confirm(`¿Eliminar el vehículo ${r.matricula} de ${r.cliente}?`)) return;
        authFetch('/.netlify/functions/delete-recordatorio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: r.id }),
        }).then(() => cargarLista());
      });
      tdAcciones.appendChild(btnBorrar);

      tr.appendChild(tdAcciones);
      tbody.appendChild(tr);
    });
  }

  function cargarEnFormulario(r) {
    document.getElementById('f-id').value = r.id;
    document.getElementById('f-cliente').value = r.cliente;
    document.getElementById('f-telefono').value = r.telefono;
    document.getElementById('f-matricula').value = r.matricula;
    document.getElementById('f-vehiculo').value = r.vehiculo;
    document.getElementById('f-trabajo').value = r.trabajo;
    document.getElementById('f-itv').value = r.fechaITV;
    document.getElementById('f-revision').value = r.fechaRevision;
    document.getElementById('form-titulo').textContent = 'Editar vehículo';
    document.getElementById('btn-cancelar-edicion').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetFormulario() {
    form.reset();
    document.getElementById('f-id').value = '';
    document.getElementById('form-titulo').textContent = 'Añadir vehículo';
    document.getElementById('btn-cancelar-edicion').hidden = true;
  }

  document.getElementById('btn-cancelar-edicion').addEventListener('click', resetFormulario);

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    const errorEl = document.getElementById('recordatorio-error');
    errorEl.hidden = true;

    const payload = {
      id: document.getElementById('f-id').value || undefined,
      cliente: document.getElementById('f-cliente').value.trim(),
      telefono: document.getElementById('f-telefono').value.trim(),
      matricula: document.getElementById('f-matricula').value.trim(),
      vehiculo: document.getElementById('f-vehiculo').value.trim(),
      trabajo: document.getElementById('f-trabajo').value.trim(),
      fechaITV: document.getElementById('f-itv').value,
      fechaRevision: document.getElementById('f-revision').value,
    };

    if (!payload.cliente || !payload.matricula) {
      errorEl.textContent = 'Rellena al menos el cliente y la matrícula.';
      errorEl.hidden = false;
      return;
    }

    authFetch('/.netlify/functions/save-recordatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error)));
        return res.json();
      })
      .then(() => {
        resetFormulario();
        cargarLista();
      })
      .catch((err) => {
        errorEl.textContent = err.message || 'No se ha podido guardar.';
        errorEl.hidden = false;
      });
  });
})();
