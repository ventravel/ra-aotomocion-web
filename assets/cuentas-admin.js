(function () {
  'use strict';

  const loginBox = document.getElementById('login-box');
  const panel = document.getElementById('panel');
  const loginError = document.getElementById('login-error');
  const formMovWrap = document.getElementById('form-mov-wrap');
  const form = document.getElementById('form-movimiento');

  let periodoActual = 'mes';
  let tipoActual = null;
  let archivoActual = null; // { base64, tipo (mime) } o null
  let todosLosMovimientos = [];
  let compGranularidad = 'trimestre';

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

  function fmt(n) {
    return (Math.round((n || 0) * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function hoyISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function rangoPeriodo(periodo) {
    const hoy = new Date();
    if (periodo === 'todo') return {};
    if (periodo === 'mes') {
      const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: desde.toISOString().slice(0, 10), hasta: hoyISO() };
    }
    // trimestre
    const trimInicio = Math.floor(hoy.getMonth() / 3) * 3;
    const desde = new Date(hoy.getFullYear(), trimInicio, 1);
    return { desde: desde.toISOString().slice(0, 10), hasta: hoyISO() };
  }

  // --- Comparativa (círculos por mes/trimestre/año) ---

  const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  function claveYEtiqueta(fechaISO, granularidad) {
    const [anio, mes] = fechaISO.split('-');
    const mesNum = Number(mes);
    if (granularidad === 'anio') return { clave: anio, etiqueta: anio };
    if (granularidad === 'trimestre') {
      const t = Math.floor((mesNum - 1) / 3) + 1;
      return { clave: `${anio}-T${t}`, etiqueta: `T${t} ${anio}` };
    }
    return { clave: `${anio}-${mes}`, etiqueta: `${NOMBRES_MES[mesNum - 1]} ${anio}` };
  }

  function agruparParaComparativa(movimientos, granularidad) {
    const grupos = {};
    movimientos.forEach((m) => {
      const { clave, etiqueta } = claveYEtiqueta(m.fecha, granularidad);
      if (!grupos[clave]) grupos[clave] = { clave, etiqueta, manoObra: 0, recambios: 0, iva: 0, recambiosGastados: 0 };
      if (m.tipo === 'ingreso') {
        grupos[clave].manoObra += m.manoObra || 0;
        grupos[clave].recambios += m.recambios || 0;
        grupos[clave].iva += m.iva || 0;
      } else {
        grupos[clave].recambiosGastados += m.recambios || 0;
      }
    });
    return Object.values(grupos)
      .map((g) => {
        // Del total cobrado por recambios, una parte es lo que costaron al proveedor
        // (coste real) y el resto es el margen que se gana en la pieza.
        const costeRecambios = Math.min(g.recambios, g.recambiosGastados);
        const margenRecambios = Math.max(0, g.recambios - costeRecambios);
        return { ...g, costeRecambios, margenRecambios, total: g.manoObra + g.recambios + g.iva };
      })
      .filter((g) => g.total > 0)
      .sort((a, b) => a.clave.localeCompare(b.clave));
  }

  function renderComparativa() {
    const cont = document.getElementById('comparativa-row');
    const grupos = agruparParaComparativa(todosLosMovimientos, compGranularidad);

    if (grupos.length === 0) {
      cont.innerHTML = '<p class="comparativa-vacio">Todavía no hay ingresos suficientes para comparar.</p>';
      return;
    }

    const MIN_PX = 64, MAX_PX = 150;
    const maxTotal = Math.max(...grupos.map((g) => g.total), 0.01);

    cont.innerHTML = '';
    grupos.forEach((g) => {
      const diametro = g.total <= 0 ? MIN_PX : Math.round(MIN_PX + (MAX_PX - MIN_PX) * (g.total / maxTotal));
      const pManoObra = g.total > 0 ? (g.manoObra / g.total) * 100 : 0;
      const pMargen = g.total > 0 ? (g.margenRecambios / g.total) * 100 : 0;
      const pCoste = g.total > 0 ? (g.costeRecambios / g.total) * 100 : 0;
      const c1 = pManoObra;
      const c2 = c1 + pMargen;
      const c3 = c2 + pCoste;
      const margenPct = g.recambios > 0 ? Math.round((g.margenRecambios / g.recambios) * 100) : 0;

      const card = document.createElement('div');
      card.className = 'comp-card';

      const circulo = document.createElement('div');
      circulo.className = 'comp-circulo';
      circulo.style.width = diametro + 'px';
      circulo.style.height = diametro + 'px';
      circulo.title = `Mano de obra ${fmt(g.manoObra)} · Margen en recambios ${fmt(g.margenRecambios)} (${margenPct}%) · Coste de recambios ${fmt(g.costeRecambios)} · IVA ${fmt(g.iva)}`;
      circulo.style.background = g.total > 0
        ? `conic-gradient(#1a7a4c 0% ${c1}%, #4caf7d ${c1}% ${c2}%, #b3261e ${c2}% ${c3}%, #b7bdc9 ${c3}% 100%)`
        : '';

      card.appendChild(circulo);
      const label = document.createElement('div');
      label.className = 'comp-label';
      label.textContent = g.etiqueta;
      card.appendChild(label);
      const total = document.createElement('div');
      total.className = 'comp-total';
      total.textContent = fmt(g.total);
      card.appendChild(total);

      cont.appendChild(card);
    });
  }

  document.querySelectorAll('.comp-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.comp-btn').forEach((b) => b.classList.remove('activo'));
      btn.classList.add('activo');
      compGranularidad = btn.dataset.comp;
      renderComparativa();
    });
  });

  document.querySelectorAll('.periodo-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.periodo-btn').forEach((b) => b.classList.remove('activo'));
      btn.classList.add('activo');
      periodoActual = btn.dataset.periodo;
      cargar();
    });
  });

  // --- Login ---

  function entrar(password) {
    sessionStorage.setItem('adminPassword', password);
    authFetch('/.netlify/functions/list-movimientos')
      .then((res) => {
        if (!res.ok) throw new Error('bad-auth');
        return res.json();
      })
      .then((datos) => {
        loginBox.hidden = true;
        panel.hidden = false;
        render(datos);
        todosLosMovimientos = datos.movimientos;
        renderComparativa();
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
    const { desde, hasta } = rangoPeriodo(periodoActual);
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    authFetch('/.netlify/functions/list-movimientos?' + params.toString())
      .then((res) => res.json())
      .then(render);

    // La comparativa siempre mira todos los movimientos, no el filtro de arriba.
    authFetch('/.netlify/functions/list-movimientos')
      .then((res) => res.json())
      .then(({ movimientos }) => {
        todosLosMovimientos = movimientos;
        renderComparativa();
      });
  }

  // --- Resumen ---

  function renderResumen(r) {
    const cards = [
      ['IVA repercutido (cobrado)', r.ivaRepercutido, 'positivo'],
      ['IVA soportado (pagado)', r.ivaSoportado, 'negativo'],
      ['IVA neto a pagar', r.ivaNeto, 'destacado'],
      ['Mano de obra cobrada', r.manoObraCobrada, ''],
      ['Recambios cobrados', r.recambiosCobrados, ''],
      ['Recambios gastados', r.recambiosGastados, ''],
      ['Margen en recambios', r.margenRecambios, 'positivo', ` (${r.margenRecambiosPct}%)`],
      ['Total cobrado', r.totalCobrado, 'positivo'],
      ['Total gastado', r.totalGastado, 'negativo'],
    ];
    const grid = document.getElementById('resumen-grid');
    grid.innerHTML = '';
    cards.forEach(([label, valor, clase, extra]) => {
      const card = document.createElement('div');
      card.className = 'resumen-card ' + clase;
      card.innerHTML = `<div class="label">${label}</div><div class="valor">${fmt(valor)}${extra || ''}</div>`;
      grid.appendChild(card);
    });
  }

  // --- Nuevo movimiento ---

  function abrirForm(tipo) {
    tipoActual = tipo;
    archivoActual = null;
    form.reset();
    document.getElementById('mv-fecha').value = hoyISO();
    document.getElementById('mv-estado').hidden = true;
    document.getElementById('mv-avisos').hidden = true;
    document.getElementById('form-mov-titulo').textContent = tipo === 'ingreso' ? 'Nuevo ingreso (factura a cliente)' : 'Nuevo gasto (factura de proveedor)';
    document.getElementById('mv-contraparte-label').textContent = tipo === 'ingreso' ? 'Cliente' : 'Proveedor';
    document.getElementById('mv-ingreso-campos').hidden = tipo !== 'ingreso';
    document.getElementById('mv-gasto-campos').hidden = tipo !== 'gasto';
    formMovWrap.hidden = false;
    window.scrollTo({ top: formMovWrap.offsetTop - 20, behavior: 'smooth' });
  }

  document.getElementById('btn-nuevo-ingreso').addEventListener('click', () => abrirForm('ingreso'));
  document.getElementById('btn-nuevo-gasto').addEventListener('click', () => abrirForm('gasto'));
  document.getElementById('btn-cancelar-mov').addEventListener('click', () => { formMovWrap.hidden = true; });

  document.getElementById('mv-archivo').addEventListener('change', (evt) => {
    const file = evt.target.files[0];
    if (!file) return;

    const estadoEl = document.getElementById('mv-estado');
    const avisosEl = document.getElementById('mv-avisos');
    avisosEl.hidden = true;
    estadoEl.hidden = false;

    fileToBase64(file).then((base64) => {
      archivoActual = { base64, tipo: file.type };

      if (file.type !== 'application/pdf') {
        estadoEl.textContent = 'Foto adjuntada. Rellena los datos a mano.';
        return;
      }

      estadoEl.textContent = 'Leyendo factura…';
      authFetch('/.netlify/functions/parse-movimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoActual, pdfBase64: base64 }),
      })
        .then((res) => res.json())
        .then((datos) => {
          if (datos.fecha) document.getElementById('mv-fecha').value = datos.fecha;
          if (datos.base != null) document.getElementById('mv-base').value = datos.base;
          if (datos.iva != null) document.getElementById('mv-iva').value = datos.iva;
          if (datos.total != null) document.getElementById('mv-total').value = datos.total;
          if (tipoActual === 'ingreso') {
            if (datos.manoObra != null) document.getElementById('mv-manoobra').value = datos.manoObra;
            if (datos.recambios != null) document.getElementById('mv-recambios-ingreso').value = datos.recambios;
          }
          estadoEl.textContent = 'Factura leída. Revisa los datos antes de guardar.';
          if (datos.avisos && datos.avisos.length) {
            avisosEl.textContent = datos.avisos.join(' · ');
            avisosEl.hidden = false;
          }
        })
        .catch(() => {
          estadoEl.textContent = 'No se ha podido leer la factura. Rellena los datos a mano.';
        });
    });
  });

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    const errorEl = document.getElementById('mov-error');
    errorEl.hidden = true;

    const payload = {
      tipo: tipoActual,
      fecha: document.getElementById('mv-fecha').value,
      contraparte: document.getElementById('mv-contraparte').value.trim(),
      base: document.getElementById('mv-base').value,
      iva: document.getElementById('mv-iva').value,
      total: document.getElementById('mv-total').value,
    };
    if (tipoActual === 'ingreso') {
      payload.manoObra = document.getElementById('mv-manoobra').value || 0;
      payload.recambios = document.getElementById('mv-recambios-ingreso').value || 0;
    } else {
      payload.categoria = document.getElementById('mv-categoria').value;
      payload.recambios = payload.categoria === 'Recambios' ? payload.base : 0;
    }
    if (archivoActual) {
      payload.archivoBase64 = archivoActual.base64;
      payload.archivoTipo = archivoActual.tipo;
    }

    if (!payload.fecha || payload.base === '' || payload.iva === '' || payload.total === '') {
      errorEl.textContent = 'Rellena fecha, base, IVA y total.';
      errorEl.hidden = false;
      return;
    }

    authFetch('/.netlify/functions/save-movimiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error)));
        return res.json();
      })
      .then(() => {
        formMovWrap.hidden = true;
        cargar();
      })
      .catch((err) => {
        errorEl.textContent = err.message || 'No se ha podido guardar.';
        errorEl.hidden = false;
      });
  });

  // --- Lista de movimientos ---

  function verArchivo(id) {
    authFetch('/.netlify/functions/get-movimiento-archivo?id=' + id)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      });
  }

  function renderLista(movimientos) {
    const cont = document.getElementById('lista-movimientos');
    cont.innerHTML = '';

    if (movimientos.length === 0) {
      cont.innerHTML = '<p class="section-sub">No hay movimientos en este periodo.</p>';
      return;
    }

    movimientos.forEach((m) => {
      const item = document.createElement('div');
      item.className = 'mov-item';

      const datos = document.createElement('div');
      datos.className = 'datos';
      const badge = `<span class="tipo-badge ${m.tipo}">${m.tipo}</span>`;
      datos.innerHTML = `${badge}<b>${m.fecha}</b> — ${m.contraparte || 'sin nombre'}<br>Base ${fmt(m.base)} · IVA ${fmt(m.iva)} · Total ${fmt(m.total)}`;
      const desglose = document.createElement('div');
      desglose.className = 'desglose';
      desglose.textContent = m.tipo === 'ingreso'
        ? `Mano de obra ${fmt(m.manoObra)} · Recambios ${fmt(m.recambios)}`
        : `Categoría: ${m.categoria || 'Recambios'}`;
      datos.appendChild(desglose);

      const acciones = document.createElement('div');
      acciones.className = 'acciones';
      if (m.archivoExt) {
        const btnVer = document.createElement('button');
        btnVer.type = 'button';
        btnVer.className = 'btn btn-secondary btn-sm';
        btnVer.textContent = 'Ver archivo';
        btnVer.addEventListener('click', () => verArchivo(m.id));
        acciones.appendChild(btnVer);
      }
      const btnBorrar = document.createElement('button');
      btnBorrar.type = 'button';
      btnBorrar.className = 'link-borrar';
      btnBorrar.textContent = 'Eliminar';
      btnBorrar.addEventListener('click', () => {
        if (!confirm('¿Eliminar este movimiento?')) return;
        authFetch('/.netlify/functions/delete-movimiento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: m.id }),
        }).then(() => cargar());
      });
      acciones.appendChild(btnBorrar);

      item.appendChild(datos);
      item.appendChild(acciones);
      cont.appendChild(item);
    });
  }

  function render({ movimientos, resumen }) {
    renderResumen(resumen);
    renderLista(movimientos);
  }
})();
