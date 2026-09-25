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

  function formatearFecha(fecha) {
    const d = new Date(fecha + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function formatPhoneForWhatsapp(telefono) {
    const digits = (telefono || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('34') ? digits : '34' + digits;
  }

  function entrar(password) {
    sessionStorage.setItem('adminPassword', password);
    authFetch('/.netlify/functions/list-citas')
      .then((res) => {
        if (!res.ok) throw new Error('bad-auth');
        return res.json();
      })
      .then((datos) => {
        loginBox.hidden = true;
        panel.hidden = false;
        render(datos);
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

  function cargar() {
    authFetch('/.netlify/functions/list-citas')
      .then((res) => res.json())
      .then(render);
  }

  document.getElementById('btn-refrescar').addEventListener('click', cargar);

  // --- Bloqueo de días ---

  document.getElementById('form-bloqueo').addEventListener('submit', (evt) => {
    evt.preventDefault();
    const fecha = document.getElementById('b-fecha').value;
    if (!fecha) return;
    authFetch('/.netlify/functions/bloquear-dia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, bloqueado: true }),
    }).then(() => {
      document.getElementById('form-bloqueo').reset();
      cargar();
    });
  });

  function renderBloqueos(bloqueos, hoy) {
    const cont = document.getElementById('lista-bloqueos');
    cont.innerHTML = '';
    const futuros = bloqueos.filter((f) => f >= hoy).sort();

    if (futuros.length === 0) {
      cont.innerHTML = '<p class="section-sub" style="font-size:13px;">No hay días bloqueados.</p>';
      return;
    }

    futuros.forEach((fecha) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:14px;';
      row.innerHTML = `<span>${formatearFecha(fecha)}</span>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link-borrar';
      btn.textContent = 'Desbloquear';
      btn.addEventListener('click', () => {
        authFetch('/.netlify/functions/bloquear-dia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha, bloqueado: false }),
        }).then(() => cargar());
      });
      row.appendChild(btn);
      cont.appendChild(row);
    });
  }

  // --- Citas por día ---

  function crearBotonWhatsapp(cita) {
    const phone = formatPhoneForWhatsapp(cita.telefono);
    if (!phone) return null;
    const mensaje = `Hola ${cita.cliente}, confirmamos tu cita en RA Automoción el ${formatearFecha(cita.fecha)} a las 9:00 para tu vehículo (${cita.matricula}).`;
    const a = document.createElement('a');
    a.href = `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'btn btn-whatsapp btn-sm';
    a.textContent = 'WhatsApp';
    a.style.marginRight = '6px';
    return a;
  }

  function crearCitaItem(cita) {
    const item = document.createElement('div');
    item.className = 'admin-cita-item';

    const datos = document.createElement('div');
    datos.className = 'datos';
    datos.innerHTML = `<b>${cita.cliente}</b> — ${cita.telefono || 'sin teléfono'}<br>${cita.matricula}`;
    if (cita.motivo) {
      const motivo = document.createElement('div');
      motivo.className = 'motivo';
      motivo.textContent = cita.motivo;
      datos.appendChild(motivo);
    }

    const acciones = document.createElement('div');
    acciones.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:6px;';

    const pill = document.createElement('span');
    pill.className = `estado-pill ${cita.estado}`;
    pill.textContent = cita.estado;
    acciones.appendChild(pill);

    const botones = document.createElement('div');
    const wa = crearBotonWhatsapp(cita);
    if (wa) botones.appendChild(wa);

    if (cita.estado !== 'confirmada') {
      const btnConfirmar = document.createElement('button');
      btnConfirmar.type = 'button';
      btnConfirmar.className = 'btn btn-secondary btn-sm';
      btnConfirmar.textContent = 'Confirmar';
      btnConfirmar.style.marginRight = '6px';
      btnConfirmar.addEventListener('click', () => cambiarEstado(cita.id, 'confirmada'));
      botones.appendChild(btnConfirmar);
    }
    if (cita.estado !== 'cancelada') {
      const btnCancelar = document.createElement('button');
      btnCancelar.type = 'button';
      btnCancelar.className = 'link-borrar';
      btnCancelar.textContent = 'Cancelar';
      btnCancelar.style.marginRight = '10px';
      btnCancelar.addEventListener('click', () => cambiarEstado(cita.id, 'cancelada'));
      botones.appendChild(btnCancelar);
    }
    const btnBorrar = document.createElement('button');
    btnBorrar.type = 'button';
    btnBorrar.className = 'link-borrar';
    btnBorrar.textContent = 'Eliminar';
    btnBorrar.addEventListener('click', () => {
      if (!confirm(`¿Eliminar la cita de ${cita.cliente}?`)) return;
      authFetch('/.netlify/functions/delete-cita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cita.id }),
      }).then(() => cargar());
    });
    botones.appendChild(btnBorrar);

    acciones.appendChild(botones);
    item.appendChild(datos);
    item.appendChild(acciones);
    return item;
  }

  function cambiarEstado(id, estado) {
    authFetch('/.netlify/functions/actualizar-cita', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado }),
    }).then(() => cargar());
  }

  function renderCitas(citas, hoy) {
    const cont = document.getElementById('citas-por-dia');
    cont.innerHTML = '';

    const futuras = citas.filter((c) => c.fecha >= hoy);
    if (futuras.length === 0) {
      cont.innerHTML = '<p class="section-sub">No hay citas próximas.</p>';
      return;
    }

    const porDia = {};
    futuras.forEach((c) => {
      (porDia[c.fecha] = porDia[c.fecha] || []).push(c);
    });

    Object.keys(porDia).sort().forEach((fecha) => {
      const citasDelDia = porDia[fecha];
      const activas = citasDelDia.filter((c) => c.estado !== 'cancelada').length;

      const bloque = document.createElement('div');
      bloque.className = 'admin-citas-dia';

      const cabecera = document.createElement('div');
      cabecera.className = 'dia-cabecera';
      cabecera.innerHTML = `<h3>${formatearFecha(fecha)}</h3><span class="section-sub" style="font-size:13px;">${activas}/5 (base 4)</span>`;
      bloque.appendChild(cabecera);

      citasDelDia
        .sort((a, b) => a.creado.localeCompare(b.creado))
        .forEach((c) => bloque.appendChild(crearCitaItem(c)));

      cont.appendChild(bloque);
    });
  }

  function render({ citas, bloqueos, hoy }) {
    renderBloqueos(bloqueos, hoy);
    renderCitas(citas, hoy);
  }
})();
