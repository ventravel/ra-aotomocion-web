(function () {
  'use strict';

  function formatearFecha(fechaISO) {
    const d = new Date(fechaISO + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatearKm(km) {
    return km ? Number(km).toLocaleString('es-ES') + ' km' : '';
  }

  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  const cargando = document.getElementById('cargando');
  const noEncontrado = document.getElementById('no-encontrado');
  const contenido = document.getElementById('contenido-historial');

  if (!id) {
    cargando.hidden = true;
    noEncontrado.hidden = false;
  } else {
    fetch('/.netlify/functions/historial-publico?id=' + encodeURIComponent(id))
      .then((res) => {
        if (!res.ok) throw new Error('not-found');
        return res.json();
      })
      .then((datos) => {
        cargando.hidden = true;
        contenido.hidden = false;

        document.getElementById('veh-matricula').textContent = datos.matricula;
        document.getElementById('veh-vehiculo').textContent = datos.vehiculo || 'Vehículo';
        document.getElementById('veh-cliente').textContent = datos.cliente ? `Vehículo de: ${datos.cliente}` : '';

        if (datos.avisoProximo && (datos.avisoProximo.kmLimite || datos.avisoProximo.fechaLimite)) {
          const av = datos.avisoProximo;
          document.getElementById('aviso-proximo-texto').innerHTML =
            `<b>Próximo servicio:</b> a los ${formatearKm(av.kmLimite)} o el ${formatearFecha(av.fechaLimite)} — lo que ocurra antes`;
          document.getElementById('aviso-proximo').hidden = false;
        }

        const timeline = document.getElementById('timeline');
        if (datos.visitas.length === 0) {
          timeline.innerHTML = '<li><div class="visita">Todavía no hay visitas registradas.</div></li>';
        }
        datos.visitas.forEach((v) => {
          const li = document.createElement('li');
          const div = document.createElement('div');
          div.className = 'visita';
          div.innerHTML = `
            <div class="fecha">${formatearFecha(v.fecha)}</div>
            <h3>${v.trabajo}</h3>
            ${v.km ? `<p class="km">${formatearKm(v.km)}</p>` : ''}
            ${v.fotoUrl ? `<img class="foto" src="${v.fotoUrl}" alt="Foto del vehículo en esta visita">` : ''}
          `;
          li.appendChild(div);
          timeline.appendChild(li);
        });
      })
      .catch(() => {
        cargando.hidden = true;
        noEncontrado.hidden = false;
      });
  }
})();
