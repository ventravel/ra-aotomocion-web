const { recordatoriosStore, madridDateParts, normalizarAvisos } = require('./_shared/lib');
const { CATALOGO_KEY } = require('./_shared/catalogo');

const DIAS_AVISO = 15;
const DESTINATARIO = 'raautomocion@hotmail.com';
const REMITENTE = 'RA Automoción <onboarding@resend.dev>';

function sumarDias(fechaISO, dias) {
  const d = new Date(fechaISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasRestantes(hoy, fecha) {
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.round((new Date(fecha + 'T00:00:00Z') - new Date(hoy + 'T00:00:00Z')) / msPorDia);
}

function filaHtml(item) {
  const etiqueta = item.dias < 0
    ? `Vencido hace ${Math.abs(item.dias)} día(s)`
    : item.dias === 0
      ? 'Vence hoy'
      : `Vence en ${item.dias} día(s)`;
  return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.cliente}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.telefono || '-'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.matricula}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.vehiculo || '-'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.tipo}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.fecha} (${etiqueta})</td>
    </tr>`;
}

exports.handler = async () => {
  const store = recordatoriosStore();
  const { blobs } = await store.list();
  const recordatorios = await Promise.all(
    blobs.filter((b) => b.key !== CATALOGO_KEY).map((b) => store.get(b.key, { type: 'json' }))
  );

  const hoy = madridDateParts(new Date()).fecha;
  const limite = sumarDias(hoy, DIAS_AVISO);

  const pendientes = [];
  for (const r of recordatorios) {
    for (const aviso of normalizarAvisos(r)) {
      if (aviso.fecha && aviso.fecha <= limite) {
        pendientes.push({ ...r, tipo: aviso.tipo, fecha: aviso.fecha, dias: diasRestantes(hoy, aviso.fecha) });
      }
    }
  }

  if (pendientes.length === 0) {
    return { statusCode: 200, body: 'Sin pendientes, no se envía correo.' };
  }

  pendientes.sort((a, b) => a.dias - b.dias);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('Falta RESEND_API_KEY: no se puede enviar el correo de recordatorios.');
    return { statusCode: 500, body: 'Falta configurar RESEND_API_KEY' };
  }

  const html = `
    <h2>Recordatorios de taller — próximos ${DIAS_AVISO} días</h2>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px">
      <thead>
        <tr style="text-align:left;background:#f5f5f5">
          <th style="padding:8px">Cliente</th>
          <th style="padding:8px">Teléfono</th>
          <th style="padding:8px">Matrícula</th>
          <th style="padding:8px">Vehículo</th>
          <th style="padding:8px">Tipo</th>
          <th style="padding:8px">Fecha</th>
        </tr>
      </thead>
      <tbody>${pendientes.map(filaHtml).join('')}</tbody>
    </table>
    <p style="font-family:sans-serif;font-size:13px;color:#666">
      Entra en la web para gestionarlos: tallerraautomocion.es/recordatorios-admin.html
    </p>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: REMITENTE,
      to: [DESTINATARIO],
      subject: `${pendientes.length} recordatorio(s) de taller próximos a vencer`,
      html,
    }),
  });

  if (!res.ok) {
    const texto = await res.text();
    console.error('Error enviando correo con Resend:', res.status, texto);
    return { statusCode: 502, body: 'Error al enviar el correo' };
  }

  return { statusCode: 200, body: `Correo enviado con ${pendientes.length} recordatorio(s).` };
};
