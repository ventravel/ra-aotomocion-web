(function () {
  'use strict';

  const AVISO_DIAS = 15;

  const loginBox = document.getElementById('login-box');
  const panel = document.getElementById('panel');
  const loginError = document.getElementById('login-error');
  const form = document.getElementById('form-recordatorio');
  const avisosLista = document.getElementById('avisos-lista');
  const tiposDatalist = document.getElementById('tipos-catalogo');

  let catalogoActual = [];

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

  // Compatibilidad con recordatorios guardados antes de tener una lista de avisos.
  function normalizarAvisos(r) {
    if (Array.isArray(r.avisos)) return r.avisos;
    const avisos = [];
    if (r.fechaITV) avisos.push({ tipo: 'ITV', fecha: r.fechaITV });
    if (r.fechaRevision) avisos.push({ tipo: r.trabajo || 'Revisión', fecha: r.fechaRevision });
    return avisos;
  }

  // Dictado por voz para rellenar campos (matrícula, cliente, vehículo, trabajo).
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognitionCtor) {
    document.getElementById('voz-no-disponible').hidden = false;
    document.querySelectorAll('.btn-voz').forEach((btn) => (btn.disabled = true));
  } else {
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
          setTimeout(() => {
            btn.textContent = '🎤';
          }, 1500);
        });

        recognition.addEventListener('end', () => {
          escuchando = false;
          btn.classList.remove('escuchando');
          btn.textContent = '🎤';
        });

        recognition.start();
      });
    });
  }

  // --- Avisos dinámicos del vehículo (en vez de ITV/Revisión fijos) ---

  function crearAvisoRow(tipo, fecha) {
    const row = document.createElement('div');
    row.className = 'aviso-row';

    const inputTipo = document.createElement('input');
    inputTipo.type = 'text';
    inputTipo.placeholder = 'Tipo de aviso (ej: Frenos)';
    inputTipo.setAttribute('list', 'tipos-catalogo');
    inputTipo.value = tipo || '';

    const inputFecha = document.createElement('input');
    inputFecha.type = 'date';
    inputFecha.value = fecha || '';

    const btnQuitar = document.createElement('button');
    btnQuitar.type = 'button';
    btnQuitar.className = 'btn-quitar-aviso';
    btnQuitar.textContent = '✕';
    btnQuitar.title = 'Quitar este aviso';
    btnQuitar.addEventListener('click', () => row.remove());

    row.appendChild(inputTipo);
    row.appendChild(inputFecha);
    row.appendChild(btnQuitar);
    avisosLista.appendChild(row);
    return row;
  }

  function limpiarAvisos() {
    avisosLista.innerHTML = '';
  }

  function leerAvisosDelForm() {
    const filas = avisosLista.querySelectorAll('.aviso-row');
    const avisos = [];
    filas.forEach((fila) => {
      const inputs = fila.querySelectorAll('input');
      const tipo = inputs[0].value.trim();
      const fecha = inputs[1].value;
      if (tipo && fecha) avisos.push({ tipo, fecha });
    });
    return avisos;
  }

  document.getElementById('btn-add-aviso').addEventListener('click', () => crearAvisoRow('', ''));

  // --- Catálogo de tipos de trabajo ---

  function renderCatalogo() {
    const tbody = document.getElementById('tabla-catalogo-body');
    tbody.innerHTML = '';

    tiposDatalist.innerHTML = '';
    catalogoActual.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.nombre;
      tiposDatalist.appendChild(opt);
    });
    ['ITV'].forEach((nombre) => {
      const opt = document.createElement('option');
      opt.value = nombre;
      tiposDatalist.appendChild(opt);
    });

    if (catalogoActual.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'Sin tipos de trabajo guardados.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    catalogoActual.forEach((item) => {
      const tr = document.createElement('tr');

      const tdNombre = document.createElement('td');
      tdNombre.textContent = item.nombre;
      tr.appendChild(tdNombre);

      const tdPalabras = document.createElement('td');
      tdPalabras.textContent = (item.palabrasClave || []).join(', ');
      tr.appendChild(tdPalabras);

      const tdMeses = document.createElement('td');
      const inputMeses = document.createElement('input');
      inputMeses.type = 'number';
      inputMeses.min = '1';
      inputMeses.style.width = '80px';
      inputMeses.value = item.intervaloMeses || '';
      inputMeses.placeholder = 'Sin aviso';
      inputMeses.addEventListener('change', () => {
        const intervaloMeses = inputMeses.value ? Number(inputMeses.value) : null;
        authFetch('/.netlify/functions/save-catalogo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', id: item.id, item: { intervaloMeses } }),
        }).then(() => cargarCatalogo());
      });
      tdMeses.appendChild(inputMeses);
      tr.appendChild(tdMeses);

      const tdAcciones = document.createElement('td');
      const btnBorrar = document.createElement('button');
      btnBorrar.type = 'button';
      btnBorrar.textContent = 'Eliminar';
      btnBorrar.className = 'link-borrar';
      btnBorrar.addEventListener('click', () => {
        if (!confirm(`¿Eliminar el tipo de trabajo "${item.nombre}"? Dejará de detectarse en facturas nuevas.`)) return;
        authFetch('/.netlify/functions/save-catalogo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'remove', id: item.id }),
        }).then(() => cargarCatalogo());
      });
      tdAcciones.appendChild(btnBorrar);
      tr.appendChild(tdAcciones);

      tbody.appendChild(tr);
    });
  }

  function cargarCatalogo() {
    return authFetch('/.netlify/functions/list-catalogo')
      .then((res) => res.json())
      .then(({ catalogo }) => {
        catalogoActual = catalogo;
        renderCatalogo();
      });
  }

  document.getElementById('form-catalogo').addEventListener('submit', (evt) => {
    evt.preventDefault();
    const errorEl = document.getElementById('catalogo-error');
    errorEl.hidden = true;

    const nombre = document.getElementById('c-nombre').value.trim();
    const palabrasClave = document.getElementById('c-palabras').value
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const mesesVal = document.getElementById('c-meses').value;
    const intervaloMeses = mesesVal ? Number(mesesVal) : null;

    if (!nombre || palabrasClave.length === 0) {
      errorEl.textContent = 'Rellena el nombre y al menos una palabra clave.';
      errorEl.hidden = false;
      return;
    }

    authFetch('/.netlify/functions/save-catalogo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', item: { nombre, palabrasClave, intervaloMeses } }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error)));
        return res.json();
      })
      .then(() => {
        document.getElementById('form-catalogo').reset();
        cargarCatalogo();
      })
      .catch((err) => {
        errorEl.textContent = err.message || 'No se ha podido guardar.';
        errorEl.hidden = false;
      });
  });

  // --- Lectura de factura ---

  document.getElementById('f-factura').addEventListener('change', (evt) => {
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
        if (datos.cliente) document.getElementById('f-cliente').value = datos.cliente;
        if (datos.telefono) document.getElementById('f-telefono').value = datos.telefono;
        if (datos.matricula) document.getElementById('f-matricula').value = datos.matricula;
        if (datos.vehiculo) document.getElementById('f-vehiculo').value = datos.vehiculo;
        if (datos.trabajo) document.getElementById('f-trabajo').value = datos.trabajo;

        if (datos.avisosDetectados && datos.avisosDetectados.length) {
          limpiarAvisos();
          datos.avisosDetectados.forEach((a) => crearAvisoRow(a.tipo, a.fecha));
        }

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

  // --- Login ---

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
        cargarCatalogo();
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

  // --- Lista de vehículos ---

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

  function crearBotonWhatsapp(aviso, r) {
    const phone = formatPhoneForWhatsapp(r.telefono);
    if (!phone) return null;
    const mensaje = `Hola ${r.cliente}, te recordamos que a tu ${r.vehiculo || 'vehículo'} (${r.matricula}) le toca "${aviso.tipo}" el ${aviso.fecha}. ¿Quieres que te demos cita?`;
    const a = document.createElement('a');
    a.href = `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'btn btn-whatsapp btn-sm';
    a.textContent = `WhatsApp ${aviso.tipo}`;
    a.style.marginRight = '6px';
    a.style.marginBottom = '6px';
    return a;
  }

  function celdaAvisos(hoy, avisos) {
    const td = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'tabla-avisos-celda';

    if (avisos.length === 0) {
      wrap.textContent = '—';
      td.appendChild(wrap);
      return td;
    }

    avisos
      .slice()
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
      .forEach((aviso) => {
        const span = document.createElement('span');
        if (!aviso.fecha) {
          span.textContent = `${aviso.tipo}: sin fecha`;
        } else {
          const dias = diasHasta(hoy, aviso.fecha);
          span.textContent = `${aviso.tipo}: ${aviso.fecha} (${dias < 0 ? `vencida hace ${-dias}d` : `en ${dias}d`})`;
          if (dias <= AVISO_DIAS) span.className = 'aviso-vencido';
        }
        wrap.appendChild(span);
      });

    td.appendChild(wrap);
    return td;
  }

  function renderRecordatorios(hoy, recordatorios) {
    const tbody = document.getElementById('tabla-recordatorios-body');
    tbody.innerHTML = '';

    if (recordatorios.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = 'No hay vehículos guardados todavía.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    recordatorios.forEach((r) => {
      const avisos = normalizarAvisos(r);
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

      tr.appendChild(celdaAvisos(hoy, avisos));

      const tdAcciones = document.createElement('td');
      tdAcciones.className = 'acciones-orden';

      avisos.forEach((aviso) => {
        if (aviso.fecha && diasHasta(hoy, aviso.fecha) <= AVISO_DIAS) {
          const btn = crearBotonWhatsapp(aviso, r);
          if (btn) tdAcciones.appendChild(btn);
        }
      });

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
    document.getElementById('f-trabajo').value = r.trabajo || '';

    limpiarAvisos();
    normalizarAvisos(r).forEach((a) => crearAvisoRow(a.tipo, a.fecha));

    document.getElementById('form-titulo').textContent = 'Editar vehículo';
    document.getElementById('btn-cancelar-edicion').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetFormulario() {
    form.reset();
    document.getElementById('f-id').value = '';
    limpiarAvisos();
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
      avisos: leerAvisosDelForm(),
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
