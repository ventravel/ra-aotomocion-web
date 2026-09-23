(function () {
  'use strict';

  const selectEmpleado = document.getElementById('select-empleado');
  const errorEl = document.getElementById('ficha-error');
  const btnEntrada = document.getElementById('btn-entrada');
  const btnSalida = document.getElementById('btn-salida');
  const formEl = document.getElementById('ficha-form');
  const confirmacionEl = document.getElementById('ficha-confirmacion');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  fetch('/.netlify/functions/employees')
    .then((res) => res.json())
    .then(({ empleados }) => {
      selectEmpleado.innerHTML = '';
      if (!empleados || empleados.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = 'No hay empleados configurados';
        selectEmpleado.appendChild(opt);
        return;
      }
      const optBlank = document.createElement('option');
      optBlank.value = '';
      optBlank.textContent = 'Elige tu nombre…';
      selectEmpleado.appendChild(optBlank);
      empleados.forEach((nombre) => {
        const opt = document.createElement('option');
        opt.value = nombre;
        opt.textContent = nombre;
        selectEmpleado.appendChild(opt);
      });
    })
    .catch(() => showError('No se ha podido cargar la lista de empleados.'));

  function fichar(tipo) {
    errorEl.hidden = true;
    const empleado = selectEmpleado.value;
    if (!empleado) {
      showError('Selecciona tu nombre antes de fichar.');
      return;
    }

    btnEntrada.disabled = true;
    btnSalida.disabled = true;

    fetch('/.netlify/functions/fichar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empleado, tipo }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || 'Error al fichar')));
        return res.json();
      })
      .then(({ registro }) => {
        document.getElementById('confirmacion-titulo').textContent =
          tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada';
        document.getElementById('confirmacion-detalle').textContent =
          `${registro.empleado} — ${registro.fecha} a las ${registro.hora}`;
        formEl.hidden = true;
        confirmacionEl.hidden = false;
      })
      .catch((err) => {
        showError(err.message || 'No se ha podido registrar el fichaje.');
      })
      .finally(() => {
        btnEntrada.disabled = false;
        btnSalida.disabled = false;
      });
  }

  btnEntrada.addEventListener('click', () => fichar('entrada'));
  btnSalida.addEventListener('click', () => fichar('salida'));

  document.getElementById('btn-fichar-otra-vez').addEventListener('click', () => {
    confirmacionEl.hidden = true;
    formEl.hidden = false;
    selectEmpleado.value = '';
  });
})();
