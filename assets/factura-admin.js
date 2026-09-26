(function () {
  'use strict';

  const loginBox = document.getElementById('login-box');
  const panel = document.getElementById('panel');
  const loginError = document.getElementById('login-error');
  const avisosLista = document.getElementById('avisos-lista');
  const tiposDatalist = document.getElementById('tipos-catalogo');

  let facturaBase64Actual = null;
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
    authFetch('/.netlify/functions/list-catalogo')
      .then((res) => {
        if (!res.ok) throw new Error('bad-auth');
        return res.json();
      })
      .then(({ catalogo }) => {
        loginBox.hidden = true;
        panel.hidden = false;
        document.getElementById('f-fecha').valueAsDate = new Date();
        tiposDatalist.innerHTML = '';
        catalogo.concat([{ nombre: 'ITV' }]).forEach((item) => {
          const opt = document.createElement('option');
          opt.value = item.nombre;
          tiposDatalist.appendChild(opt);
        });
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

  // --- Avisos dinámicos ---

  function crearAvisoRow(tipo, fecha) {
    const row = document.createElement('div');
    row.className = 'aviso-row';
    const inputTipo = document.createElement('input');
    inputTipo.type = 'text';
    inputTipo.placeholder = 'Tipo de aviso';
    inputTipo.setAttribute('list', 'tipos-catalogo');
    inputTipo.value = tipo || '';
    const inputFecha = document.createElement('input');
    inputFecha.type = 'date';
    inputFecha.value = fecha || '';
    const btnQuitar = document.createElement('button');
    btnQuitar.type = 'button';
    btnQuitar.className = 'btn-quitar-aviso';
    btnQuitar.textContent = '✕';
    btnQuitar.addEventListener('click', () => row.remove());
    row.appendChild(inputTipo);
    row.appendChild(inputFecha);
    row.appendChild(btnQuitar);
    avisosLista.appendChild(row);
  }

  function limpiarAvisos() {
    avisosLista.innerHTML = '';
  }

  function leerAvisos() {
    const avisos = [];
    avisosLista.querySelectorAll('.aviso-row').forEach((fila) => {
      const inputs = fila.querySelectorAll('input');
      const tipo = inputs[0].value.trim();
      const fecha = inputs[1].value;
      if (tipo && fecha) avisos.push({ tipo, fecha });
    });
    return avisos;
  }

  document.getElementById('btn-add-aviso').addEventListener('click', () => crearAvisoRow('', ''));

  // --- Leer factura (rellena TODO de golpe) ---

  document.getElementById('f-factura').addEventListener('change', (evt) => {
    const file = evt.target.files[0];
    if (!file) return;
    const estadoEl = document.getElementById('factura-estado');
    const avisosEl = document.getElementById('factura-avisos');
    avisosEl.hidden = true;
    estadoEl.hidden = false;
    estadoEl.textContent = 'Leyendo factura…';

    fileToBase64(file)
      .then((base64) => {
        facturaBase64Actual = base64;
        return authFetch('/.netlify/functions/parse-factura-completa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 }),
        });
      })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || 'Error al leer la factura')));
        return res.json();
      })
      .then((datos) => {
        if (datos.cliente) document.getElementById('f-cliente').value = datos.cliente;
        if (datos.telefono) document.getElementById('f-telefono').value = datos.telefono;
        if (datos.matricula) document.getElementById('f-matricula').value = datos.matricula;
        if (datos.vehiculo) document.getElementById('f-vehiculo').value = datos.vehiculo;
        if (datos.fechaFactura) document.getElementById('f-fecha').value = datos.fechaFactura;
        if (datos.trabajo) document.getElementById('f-trabajo').value = datos.trabajo;
        if (datos.km) document.getElementById('f-km').value = datos.km;
        if (datos.base != null) document.getElementById('f-base').value = datos.base;
        if (datos.iva != null) document.getElementById('f-iva').value = datos.iva;
        if (datos.total != null) document.getElementById('f-total').value = datos.total;
        if (datos.manoObra != null) document.getElementById('f-manoobra').value = datos.manoObra;
        if (datos.recambios != null) document.getElementById('f-recambios').value = datos.recambios;

        if (datos.avisosDetectados && datos.avisosDetectados.length) {
          limpiarAvisos();
          datos.avisosDetectados.forEach((a) => crearAvisoRow(a.tipo, a.fecha));
        }

        estadoEl.textContent = 'Factura leída. Revisa todos los datos antes de guardar.';
        if (datos.avisos && datos.avisos.length) {
          avisosEl.textContent = datos.avisos.join(' · ');
          avisosEl.hidden = false;
        }
      })
      .catch((err) => {
        estadoEl.textContent = err.message || 'No se ha podido leer la factura.';
      });
  });

  // --- Foto del vehículo ---

  document.getElementById('f-foto').addEventListener('change', (evt) => {
    const file = evt.target.files[0];
    if (!file) return;
    fileToBase64(file).then((base64) => {
      fotoActual = { base64, tipo: file.type };
      document.getElementById('f-foto-preview').innerHTML = `<img src="data:${file.type};base64,${base64}" alt="Vista previa">`;
    });
  });

  // --- Guardar todo ---

  document.getElementById('form-factura').addEventListener('submit', (evt) => {
    evt.preventDefault();
    const errorEl = document.getElementById('guardar-error');
    errorEl.hidden = true;

    const payload = {
      cliente: document.getElementById('f-cliente').value.trim(),
      telefono: document.getElementById('f-telefono').value.trim(),
      matricula: document.getElementById('f-matricula').value.trim(),
      vehiculo: document.getElementById('f-vehiculo').value.trim(),
      fecha: document.getElementById('f-fecha').value,
      trabajo: document.getElementById('f-trabajo').value.trim(),
      km: document.getElementById('f-km').value || null,
      avisos: leerAvisos(),
      base: document.getElementById('f-base').value || null,
      iva: document.getElementById('f-iva').value || null,
      total: document.getElementById('f-total').value || null,
      manoObra: document.getElementById('f-manoobra').value || 0,
      recambios: document.getElementById('f-recambios').value || 0,
    };
    if (facturaBase64Actual) payload.facturaBase64 = facturaBase64Actual;
    if (fotoActual) {
      payload.fotoVehiculoBase64 = fotoActual.base64;
      payload.fotoVehiculoTipo = fotoActual.tipo;
    }

    if (!payload.matricula || !payload.fecha) {
      errorEl.textContent = 'Rellena al menos la matrícula y la fecha.';
      errorEl.hidden = false;
      return;
    }

    authFetch('/.netlify/functions/guardar-factura-unificada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error)));
        return res.json();
      })
      .then((datos) => {
        const partes = [];
        if (datos.recordatorio) partes.push(`✓ Recordatorio guardado (${datos.recordatorio.avisos.length} aviso(s))`);
        if (datos.movimiento) partes.push(`✓ Ingreso guardado en Cuentas (${datos.movimiento.total.toFixed(2)} €)`);
        if (datos.vehiculo) partes.push(`✓ Visita añadida al historial de ${datos.vehiculo.matricula}`);

        const resultado = document.getElementById('resultado-guardado');
        resultado.innerHTML = `<div class="factura-rellenado">${partes.join('<br>')}</div>`;
        resultado.hidden = false;
        document.getElementById('form-factura').reset();
        document.getElementById('f-factura').value = '';
        document.getElementById('f-foto').value = '';
        document.getElementById('f-fecha').valueAsDate = new Date();
        document.getElementById('factura-estado').hidden = true;
        document.getElementById('factura-avisos').hidden = true;
        document.getElementById('f-foto-preview').innerHTML = 'Vista previa de la foto aquí';
        limpiarAvisos();
        facturaBase64Actual = null;
        fotoActual = null;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch((err) => {
        errorEl.textContent = err.message || 'No se ha podido guardar.';
        errorEl.hidden = false;
      });
  });
})();
