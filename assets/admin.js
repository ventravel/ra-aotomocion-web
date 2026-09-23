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

  function entrar(password) {
    sessionStorage.setItem('adminPassword', password);
    authFetch('/.netlify/functions/list-orders')
      .then((res) => {
        if (!res.ok) throw new Error('bad-auth');
        return res.json();
      })
      .then(({ orders }) => {
        loginBox.hidden = true;
        panel.hidden = false;
        renderOrders(orders);
      })
      .catch(() => {
        sessionStorage.removeItem('adminPassword');
        loginError.hidden = false;
      });
  }

  document.getElementById('btn-entrar').addEventListener('click', () => {
    const password = document.getElementById('input-password').value;
    entrar(password);
  });

  document.getElementById('input-password').addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') {
      document.getElementById('btn-entrar').click();
    }
  });

  if (getPassword()) {
    entrar(getPassword());
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function formatPhoneForWhatsapp(telefono) {
    const digits = telefono.replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('34') ? digits : '34' + digits;
  }

  document.getElementById('form-nueva-orden').addEventListener('submit', (evt) => {
    evt.preventDefault();
    const ordenError = document.getElementById('orden-error');
    ordenError.hidden = true;

    const cliente = document.getElementById('f-cliente').value.trim();
    const telefono = document.getElementById('f-telefono').value.trim();
    const vehiculo = document.getElementById('f-vehiculo').value.trim();
    const matricula = document.getElementById('f-matricula').value.trim();
    const fileInput = document.getElementById('f-pdf');
    const file = fileInput.files[0];

    if (!cliente || !vehiculo || !file) {
      ordenError.textContent = 'Rellena cliente, vehículo y selecciona el PDF.';
      ordenError.hidden = false;
      return;
    }

    const btn = document.getElementById('btn-crear-orden');
    btn.disabled = true;
    btn.textContent = 'Creando…';

    fileToBase64(file)
      .then((pdfBase64) =>
        authFetch('/.netlify/functions/upload-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente, telefono, vehiculo, matricula, pdfBase64 }),
        })
      )
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || 'Error al crear la orden')));
        return res.json();
      })
      .then(({ id }) => {
        const link = window.location.origin + '/firmar.html?id=' + encodeURIComponent(id);
        const linkEl = document.getElementById('link-orden-nueva');
        linkEl.href = link;
        linkEl.textContent = link;

        const waLink = document.getElementById('link-whatsapp-orden');
        const phone = formatPhoneForWhatsapp(telefono);
        const mensaje = encodeURIComponent(
          `Hola ${cliente}, te enviamos la orden de reparación de tu ${vehiculo} para que la firmes desde el móvil: ${link}`
        );
        waLink.href = phone ? `https://wa.me/${phone}?text=${mensaje}` : `https://wa.me/?text=${mensaje}`;

        document.getElementById('resultado-orden').hidden = false;
        document.getElementById('form-nueva-orden').reset();
        cargarOrdenes();
      })
      .catch((err) => {
        ordenError.textContent = err.message || 'No se ha podido crear la orden.';
        ordenError.hidden = false;
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Crear orden y generar enlace';
      });
  });

  document.getElementById('btn-refrescar').addEventListener('click', cargarOrdenes);

  function cargarOrdenes() {
    authFetch('/.netlify/functions/list-orders')
      .then((res) => res.json())
      .then(({ orders }) => renderOrders(orders));
  }

  function renderOrders(orders) {
    const tbody = document.getElementById('tabla-ordenes-body');
    tbody.innerHTML = '';

    orders.forEach((o) => {
      const tr = document.createElement('tr');

      const fecha = new Date(o.creado).toLocaleDateString('es-ES');
      const link = window.location.origin + '/firmar.html?id=' + encodeURIComponent(o.id);

      const tdFecha = document.createElement('td');
      tdFecha.textContent = fecha;

      const tdCliente = document.createElement('td');
      tdCliente.textContent = o.cliente;

      const tdVehiculo = document.createElement('td');
      tdVehiculo.textContent = o.vehiculo + (o.matricula ? ' — ' + o.matricula : '');

      const tdEstado = document.createElement('td');
      tdEstado.textContent = o.estado === 'firmado' ? 'Firmado' : 'Pendiente';

      const tdAcciones = document.createElement('td');
      tdAcciones.className = 'acciones-orden';

      const linkFirma = document.createElement('a');
      linkFirma.href = link;
      linkFirma.target = '_blank';
      linkFirma.rel = 'noopener';
      linkFirma.textContent = 'Enlace de firma';
      tdAcciones.appendChild(linkFirma);

      const linkOriginal = document.createElement('a');
      linkOriginal.href = `/.netlify/functions/get-order-pdf?id=${encodeURIComponent(o.id)}&kind=original`;
      linkOriginal.target = '_blank';
      linkOriginal.rel = 'noopener';
      linkOriginal.textContent = 'PDF original';
      tdAcciones.appendChild(document.createTextNode(' · '));
      tdAcciones.appendChild(linkOriginal);

      if (o.estado === 'firmado') {
        const linkFirmado = document.createElement('a');
        linkFirmado.href = `/.netlify/functions/get-order-pdf?id=${encodeURIComponent(o.id)}&kind=signed`;
        linkFirmado.target = '_blank';
        linkFirmado.rel = 'noopener';
        linkFirmado.textContent = 'PDF firmado';
        tdAcciones.appendChild(document.createTextNode(' · '));
        tdAcciones.appendChild(linkFirmado);
      }

      tr.appendChild(tdFecha);
      tr.appendChild(tdCliente);
      tr.appendChild(tdVehiculo);
      tr.appendChild(tdEstado);
      tr.appendChild(tdAcciones);
      tbody.appendChild(tr);
    });
  }
})();
