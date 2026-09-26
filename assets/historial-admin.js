(function () {
  'use strict';

  const loginBox = document.getElementById('login-box');
  const panel = document.getElementById('panel');
  const loginError = document.getElementById('login-error');

  let todosVehiculos = [];
  let vehiculoActual = null; // registro actual (existente) o null si es nuevo
  let matriculaBuscada = '';
  let fotoActual = null; // { base64, tipo } o null

  function getPassword() {
    return sessionStorage.getItem('adminPassword') || '';
  }

  function authFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, { 'x-admin-password': getPassword() });
    return fetch(url, options);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function normalizarMatricula(m) {
    return (m || '').toUpperCase().replace(/[\s-]/g, '');
  }

  function formatearFecha(fechaISO) {
    const d = new Date(fechaISO + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // --- Dictado por voz ---
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognitionCtor) {
    document.querySelectorAll('.btn-voz').forEach((btn) => {
      const input = document.getElementById(btn.dataset.target);
      let escuchando = false;
      btn.addEventListener('click', () => {
        if (escuchando) return;
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = 'es-ES';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        escuchando = true;
        btn.classList.add('escuchando');
        btn.textContent = '…';
        recognition.addEventListener('result', (evt) => {
          const texto = evt.results[0][0].transcript;
          input.value = texto.charAt(0).toUpperCase() + texto.slice(1);
        });
        recognition.addEventListener('error', () => {
          btn.textContent = '⚠️';
          setTimeout(() => { btn.textContent = '🎤'; }, 1500);
        });
        recognition.addEventListener('end', () => {
          escuchando = false;
          btn.classList.remove('escuchando');
          btn.textContent = '🎤';
        });
        recognition.start();
      });
    });
  } else {
    document.querySelectorAll('.btn-voz').forEach((btn) => (btn.disabled = true));
  }

  // --- Login ---

  function entrar(password) {
    sessionStorage.setItem('adminPassword', password);
    authFetch('/.netlify/functions/list-historial')
      .then((res) => {
        if (!res.ok) throw new Error('bad-auth');
        return res.json();
      })
      .then(({ vehiculos }) => {
        loginBox.hidden = true;
        panel.hidden = false;
        todosVehiculos = vehiculos;
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

  function recargarVehiculos() {
    return authFetch('/.netlify/functions/list-historial')
      .then((res) => res.json())
      .then(({ vehiculos }) => { todosVehiculos = vehiculos; });
  }

  // --- Buscar ---

  document.getElementById('btn-buscar').addEventListener('click', () => {
    const matricula = document.getElementById('buscar-matricula').value.trim();
    const errorEl = document.getElementById('buscar-error');
    errorEl.hidden = true;
    if (!matricula) {
      errorEl.textContent = 'Escribe una matrícula.';
      errorEl.hidden = false;
      return;
    }
    matriculaBuscada = matricula;
    const norm = normalizarMatricula(matricula);
    const encontrado = todosVehiculos.find((v) => normalizarMatricula(v.matricula) === norm) || null;
    seleccionarVehiculo(encontrado);
  });

  function seleccionarVehiculo(registro) {
    vehiculoActual = registro;
    fotoActual = null;
    document.getElementById('v-foto-preview').innerHTML = 'Vista previa de la foto aquí';
    document.getElementById('v-foto').value = '';

    const nuevoCampos = document.getElementById('vehiculo-nuevo-campos');
    const resumenWrap = document.getElementById('veh-resumen-wrap');
    const formWrap = document.getElementById('form-visita-wrap');

    document.getElementById('form-visita').reset();
    document.getElementById('v-fecha').valueAsDate = new Date();

    if (!registro) {
      nuevoCampos.hidden = false;
      document.getElementById('nuevo-vehiculo').value = '';
      document.getElementById('nuevo-cliente').value = '';
      resumenWrap.hidden = true;
      formWrap.hidden = false;
      renderVisitas([]);
      return;
    }

    nuevoCampos.hidden = true;
    resumenWrap.hidden = false;
    formWrap.hidden = false;

    document.getElementById('veh-matricula').textContent = registro.matricula;
    document.getElementById('veh-modelo').textContent = [registro.vehiculo, registro.cliente].filter(Boolean).join(' · ');
    document.getElementById('veh-num-visitas').textContent = `${(registro.visitas || []).length} visita(s) registrada(s)`;

    const link = `${location.origin}/historial.html?id=${registro.id}`;
    document.getElementById('veh-link').textContent = link;
    document.getElementById('veh-qr').src = `/.netlify/functions/historial-qr?id=${registro.id}&t=${Date.now()}`;

    renderVisitas(registro.visitas || []);
  }

  document.getElementById('btn-copiar-enlace').addEventListener('click', () => {
    const link = document.getElementById('veh-link').textContent;
    navigator.clipboard.writeText(link).catch(() => {});
  });

  // --- Lectura de factura ---

  document.getElementById('v-factura').addEventListener('change', (evt) => {
    const file = evt.target.files[0];
    if (!file) return;
    const estadoEl = document.getElementById('factura-estado');
    const avisosEl = document.getElementById('factura-avisos');
    avisosEl.hidden = true;
    estadoEl.hidden = false;
    estadoEl.textContent = 'Leyendo factura…';

    fileToBase64(file)
      .then((pdfBase64) =>
        authFetch('/.netlify/functions/parse-factura', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64 }),
        })
      )
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || 'Error al leer la factura')));
        return res.json();
      })
      .then((datos) => {
        if (datos.fechaFactura) document.getElementById('v-fecha').value = datos.fechaFactura;
        if (datos.trabajo) document.getElementById('v-trabajo').value = datos.trabajo;
        if (datos.km) document.getElementById('v-km').value = datos.km;
        if (!vehiculoActual && datos.vehiculo) document.getElementById('nuevo-vehiculo').value = datos.vehiculo;
        if (!vehiculoActual && datos.cliente) document.getElementById('nuevo-cliente').value = datos.cliente;

        estadoEl.textContent = 'Factura leída. Revisa los datos antes de guardar.';
        if (datos.avisos && datos.avisos.length) {
          avisosEl.textContent = datos.avisos.join(' · ');
          avisosEl.hidden = false;
        }
      })
      .catch((err) => {
        estadoEl.textContent = err.message || 'No se ha podido leer la factura.';
      });
  });

  // --- Foto ---

  document.getElementById('v-foto').addEventListener('change', (evt) => {
    const file = evt.target.files[0];
    if (!file) return;
    fileToBase64(file).then((base64) => {
      fotoActual = { base64, tipo: file.type };
      document.getElementById('v-foto-preview').innerHTML = `<img src="data:${file.type};base64,${base64}" alt="Vista previa">`;
    });
  });

  // --- Guardar visita (crea vehículo si hace falta) ---

  document.getElementById('form-visita').addEventListener('submit', (evt) => {
    evt.preventDefault();
    const errorEl = document.getElementById('visita-error');
    errorEl.hidden = true;

    const payload = {
      fecha: document.getElementById('v-fecha').value,
      trabajo: document.getElementById('v-trabajo').value.trim(),
      km: document.getElementById('v-km').value || null,
    };

    if (vehiculoActual) {
      payload.vehiculoId = vehiculoActual.id;
    } else {
      payload.matricula = matriculaBuscada;
      payload.vehiculo = document.getElementById('nuevo-vehiculo').value.trim();
      payload.cliente = document.getElementById('nuevo-cliente').value.trim();
    }
    if (fotoActual) {
      payload.fotoBase64 = fotoActual.base64;
      payload.fotoTipo = fotoActual.tipo;
    }

    if (!payload.fecha || !payload.trabajo) {
      errorEl.textContent = 'Rellena al menos la fecha y qué se hizo.';
      errorEl.hidden = false;
      return;
    }

    authFetch('/.netlify/functions/guardar-visita-historial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error)));
        return res.json();
      })
      .then(({ registro }) => {
        return recargarVehiculos().then(() => seleccionarVehiculo(registro));
      })
      .catch((err) => {
        errorEl.textContent = err.message || 'No se ha podido guardar.';
        errorEl.hidden = false;
      });
  });

  function renderVisitas(visitas) {
    const cont = document.getElementById('lista-visitas');
    cont.innerHTML = '';
    if (visitas.length === 0) {
      cont.innerHTML = '<p class="section-sub">Todavía no hay visitas.</p>';
      return;
    }
    visitas.forEach((v) => {
      const item = document.createElement('div');
      item.className = 'entrada-item';
      item.innerHTML = `
        <div>
          <div class="fecha">${formatearFecha(v.fecha)}</div>
          <h4>${v.trabajo}</h4>
          <div class="km">${v.km ? Number(v.km).toLocaleString('es-ES') + ' km' : ''}${v.fotoExt ? ' · <span class="badge-foto">📷 con foto</span>' : ''}</div>
        </div>
      `;
      const btnBorrar = document.createElement('button');
      btnBorrar.type = 'button';
      btnBorrar.className = 'link-borrar';
      btnBorrar.textContent = 'Borrar';
      btnBorrar.addEventListener('click', () => {
        if (!confirm('¿Borrar esta visita?')) return;
        authFetch('/.netlify/functions/borrar-visita-historial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehiculoId: vehiculoActual.id, visitaId: v.id }),
        })
          .then((res) => res.json())
          .then(({ registro }) => recargarVehiculos().then(() => seleccionarVehiculo(registro)));
      });
      item.appendChild(btnBorrar);
      cont.appendChild(item);
    });
  }

  document.getElementById('btn-borrar-vehiculo').addEventListener('click', () => {
    if (!vehiculoActual) return;
    if (!confirm(`¿Eliminar todo el historial de ${vehiculoActual.matricula}? Esto no se puede deshacer.`)) return;
    authFetch('/.netlify/functions/borrar-vehiculo-historial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehiculoId: vehiculoActual.id }),
    }).then(() =>
      recargarVehiculos().then(() => {
        vehiculoActual = null;
        document.getElementById('veh-resumen-wrap').hidden = true;
        document.getElementById('form-visita-wrap').hidden = true;
        document.getElementById('vehiculo-nuevo-campos').hidden = true;
        document.getElementById('buscar-matricula').value = '';
      })
    );
  });
})();
