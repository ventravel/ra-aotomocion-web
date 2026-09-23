(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  const estadoCargando = document.getElementById('estado-cargando');
  const estadoError = document.getElementById('estado-error');
  const errorMensaje = document.getElementById('error-mensaje');
  const estadoFirmadoYa = document.getElementById('estado-firmado-ya');
  const estadoConfirmado = document.getElementById('estado-confirmado');
  const formFirma = document.getElementById('form-firma');

  function mostrar(el) {
    [estadoCargando, estadoError, estadoFirmadoYa, estadoConfirmado, formFirma].forEach((e) => {
      e.hidden = e !== el;
    });
  }

  function mostrarError(msg) {
    errorMensaje.textContent = msg;
    mostrar(estadoError);
  }

  if (!id) {
    mostrarError('Falta el identificador de la orden en el enlace.');
    return;
  }

  const pdfUrlOriginal = `/.netlify/functions/get-order-pdf?id=${encodeURIComponent(id)}&kind=original`;
  const pdfUrlFirmado = `/.netlify/functions/get-order-pdf?id=${encodeURIComponent(id)}&kind=signed`;

  fetch(`/.netlify/functions/get-order-meta?id=${encodeURIComponent(id)}`)
    .then((res) => {
      if (!res.ok) throw new Error(res.status === 404 ? 'Orden no encontrada.' : 'Error al cargar la orden.');
      return res.json();
    })
    .then(({ meta }) => {
      if (meta.estado === 'firmado') {
        document.getElementById('link-descarga-firmado').href = pdfUrlFirmado;
        mostrar(estadoFirmadoYa);
        return;
      }

      document.getElementById('dato-cliente').textContent = meta.cliente;
      document.getElementById('dato-vehiculo').textContent =
        meta.vehiculo + (meta.matricula ? ' — ' + meta.matricula : '');
      document.getElementById('pdf-viewer').src = pdfUrlOriginal;
      document.getElementById('link-pdf-nueva-pestana').href = pdfUrlOriginal;
      document.getElementById('input-nombre-firmante').value = meta.cliente || '';

      mostrar(formFirma);
      initSignaturePad();
    })
    .catch((err) => {
      mostrarError(err.message || 'No se ha podido cargar la orden.');
    });

  function initSignaturePad() {
    const canvas = document.getElementById('firma-pad');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasStroke = false;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1b1f27';

    function pos(evt) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY,
      };
    }

    canvas.addEventListener('pointerdown', (evt) => {
      drawing = true;
      hasStroke = true;
      const p = pos(evt);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      canvas.setPointerCapture(evt.pointerId);
    });

    canvas.addEventListener('pointermove', (evt) => {
      if (!drawing) return;
      const p = pos(evt);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => {
      canvas.addEventListener(ev, () => {
        drawing = false;
      });
    });

    document.getElementById('btn-borrar-firma').addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasStroke = false;
    });

    formFirma.addEventListener('submit', (evt) => {
      evt.preventDefault();
      const firmaError = document.getElementById('firma-error');
      firmaError.hidden = true;

      if (!hasStroke) {
        firmaError.textContent = 'Por favor, dibuja tu firma en el recuadro antes de enviar.';
        firmaError.hidden = false;
        return;
      }

      const nombreFirmante = document.getElementById('input-nombre-firmante').value.trim();
      if (!nombreFirmante) {
        firmaError.textContent = 'Introduce el nombre de quien firma.';
        firmaError.hidden = false;
        return;
      }

      if (!document.getElementById('input-conformidad').checked) {
        firmaError.textContent = 'Debes marcar la casilla de conformidad para continuar.';
        firmaError.hidden = false;
        return;
      }

      const btnEnviar = document.getElementById('btn-enviar-firma');
      btnEnviar.disabled = true;
      btnEnviar.textContent = 'Enviando…';

      const signatureDataUrl = canvas.toDataURL('image/png');

      fetch('/.netlify/functions/sign-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, signatureDataUrl, nombreFirmante }),
      })
        .then((res) => {
          if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || 'Error al firmar')));
          return res.json();
        })
        .then(() => {
          document.getElementById('link-descarga-confirmado').href = pdfUrlFirmado;
          mostrar(estadoConfirmado);
        })
        .catch((err) => {
          firmaError.textContent = err.message || 'No se ha podido enviar la firma. Inténtalo de nuevo.';
          firmaError.hidden = false;
          btnEnviar.disabled = false;
          btnEnviar.textContent = 'Firmar y enviar';
        });
    });
  }
})();
