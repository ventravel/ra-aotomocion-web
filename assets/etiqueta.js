(function () {
  'use strict';

  function formatearFecha(fechaISO) {
    const d = new Date(fechaISO + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatearKm(km) {
    return Number(km).toLocaleString('es-ES') + ' km';
  }

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const ayudaTexto = document.getElementById('ayuda-texto');

  if (!id) {
    ayudaTexto.textContent = 'Falta el identificador del vehículo en el enlace.';
    return;
  }

  fetch('/.netlify/functions/historial-publico?id=' + encodeURIComponent(id))
    .then((res) => {
      if (!res.ok) throw new Error('not-found');
      return res.json();
    })
    .then((datos) => {
      document.getElementById('et-matricula').textContent = datos.matricula;
      document.getElementById('et-qr').src = '/.netlify/functions/historial-qr?id=' + encodeURIComponent(id);

      const proximoEl = document.getElementById('et-proximo');
      const av = datos.avisoProximo;
      if (av && (av.kmLimite || av.fechaLimite)) {
        proximoEl.innerHTML = `
          <div class="proximo">Próximo servicio</div>
          ${av.kmLimite ? `<div class="condicion">${formatearKm(av.kmLimite)}</div>` : ''}
          ${av.kmLimite && av.fechaLimite ? '<div class="o">o</div>' : ''}
          ${av.fechaLimite ? `<div class="condicion">${formatearFecha(av.fechaLimite)}</div>` : ''}
        `;
      } else {
        proximoEl.innerHTML = '<div class="proximo">Escanea para ver el historial completo</div>';
      }

      document.getElementById('etiqueta').hidden = false;
      ayudaTexto.textContent = 'Esta es la etiqueta a tamaño real (50×70mm). Imprímela con tu impresora de etiquetas, o haz una captura de pantalla para importarla en la app de la impresora.';
      document.getElementById('btn-imprimir').hidden = false;
    })
    .catch(() => {
      ayudaTexto.textContent = 'No se ha encontrado este vehículo.';
    });

  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());
})();
