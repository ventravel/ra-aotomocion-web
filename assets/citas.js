(function () {
  'use strict';

  const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const ETIQUETAS_ESTADO = {
    libre: 'Hay hueco',
    'solo-rapidos': 'Solo revisión/filtros',
    completo: 'Completo',
    cerrado: 'Cerrado',
  };

  const pasoCalendario = document.getElementById('paso-calendario');
  const pasoForm = document.getElementById('paso-form');
  const pasoConfirmacion = document.getElementById('paso-confirmacion');
  const diasLista = document.getElementById('dias-lista');

  let fechaSeleccionada = null;

  function formatearFecha(fecha) {
    const d = new Date(fecha + 'T00:00:00');
    const diaSemana = DIAS_SEMANA[d.getDay()];
    const dia = d.getDate();
    const mes = d.toLocaleDateString('es-ES', { month: 'long' });
    return { diaSemana, texto: `${dia} de ${mes}` };
  }

  function cargarDisponibilidad() {
    fetch('/.netlify/functions/disponibilidad-citas')
      .then((res) => res.json())
      .then(({ disponibilidad }) => renderDias(disponibilidad))
      .catch(() => {
        diasLista.innerHTML = '<p>No se ha podido cargar la disponibilidad. Inténtalo de nuevo más tarde.</p>';
      });
  }

  function renderDias(disponibilidad) {
    diasLista.innerHTML = '';
    Object.keys(disponibilidad)
      .sort()
      .forEach((fecha) => {
        const estado = disponibilidad[fecha];
        const { diaSemana, texto } = formatearFecha(fecha);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `dia-card estado-${estado}`;
        btn.disabled = estado === 'completo' || estado === 'cerrado';

        const izq = document.createElement('span');
        izq.innerHTML = `<span class="dia-fecha">${texto}</span><span class="dia-semana">${diaSemana}</span>`;

        const badge = document.createElement('span');
        badge.className = 'dia-estado';
        badge.textContent = ETIQUETAS_ESTADO[estado] || estado;

        btn.appendChild(izq);
        btn.appendChild(badge);
        btn.addEventListener('click', () => seleccionarDia(fecha, texto, diaSemana));

        diasLista.appendChild(btn);
      });
  }

  function seleccionarDia(fecha, texto, diaSemana) {
    fechaSeleccionada = fecha;
    document.getElementById('fecha-elegida-texto').textContent = `${diaSemana}, ${texto} — a las 9:00`;
    pasoCalendario.hidden = true;
    pasoForm.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('btn-volver-calendario').addEventListener('click', () => {
    pasoForm.hidden = true;
    pasoCalendario.hidden = false;
  });

  document.getElementById('form-cita').addEventListener('submit', (evt) => {
    evt.preventDefault();
    const errorEl = document.getElementById('cita-error');
    errorEl.hidden = true;

    const payload = {
      fecha: fechaSeleccionada,
      cliente: document.getElementById('c-cliente').value.trim(),
      telefono: document.getElementById('c-telefono').value.trim(),
      matricula: document.getElementById('c-matricula').value.trim(),
      motivo: document.getElementById('c-motivo').value.trim(),
    };

    if (!payload.cliente || !payload.telefono || !payload.matricula) {
      errorEl.textContent = 'Rellena tu nombre, teléfono y matrícula.';
      errorEl.hidden = false;
      return;
    }

    const btn = document.getElementById('btn-reservar');
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    fetch('/.netlify/functions/reservar-cita', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json().then((datos) => ({ ok: res.ok, datos })))
      .then(({ ok, datos }) => {
        if (!ok) throw new Error(datos.error || 'No se ha podido reservar la cita.');

        const { texto } = formatearFecha(fechaSeleccionada);
        document.getElementById('confirmacion-texto').textContent = `Cita solicitada para el ${texto}.`;
        pasoForm.hidden = true;
        pasoConfirmacion.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch((err) => {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        // El día pudo llenarse mientras rellenaba el formulario: refrescamos la disponibilidad.
        cargarDisponibilidad();
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = 'Pedir esta cita';
      });
  });

  cargarDisponibilidad();
})();
