const pdfParse = require('pdf-parse');
const { checkAdmin, json } = require('./_shared/lib');

// Correspondencia aproximada matrícula (formato 0000-XXX desde sept. 2000) -> año.
// Fuente: tablas públicas de fechamatriculacion.es (asignación correlativa de la DGT).
// Es una ESTIMACIÓN, no un dato exacto: por eso el resultado siempre se muestra
// para revisión antes de guardar, nunca se guarda solo.
const ANIO_POR_LETRA = {
  B: 2000, C: 2003, D: 2005, F: 2006, G: 2008,
  H: 2012, J: 2016, K: 2018, L: 2020, M: 2024, N: 2026,
};

function sumarDias(fechaISO, dias) {
  const d = new Date(fechaISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function fechaDDMMYYYYaISO(str) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(str);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function estimarIntervaloITV(matricula) {
  const letra = (matricula.match(/[A-Z]/) || [])[0];
  const anioEstimado = ANIO_POR_LETRA[letra];
  if (!anioEstimado) return { anios: 2, nota: 'No se ha podido estimar la antigüedad; se usa el intervalo habitual de 2 años.' };
  const antiguedad = new Date().getFullYear() - anioEstimado;
  // Margen de seguridad: a partir de 9 años (no 10) se asume el intervalo corto,
  // por si la estimación se queda corta.
  const anios = antiguedad >= 9 ? 1 : 2;
  return {
    anios,
    nota: `Matrícula ~${anioEstimado} (unos ${antiguedad} años) → intervalo estimado de ${anios} año(s). Revísalo si lo sabes con certeza.`,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método no permitido' });
  }
  if (!checkAdmin(event)) {
    return json(401, { error: 'No autorizado' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: 'Cuerpo inválido' });
  }

  const { pdfBase64 } = payload;
  if (!pdfBase64) {
    return json(400, { error: 'Falta el PDF' });
  }

  let texto;
  try {
    const parsed = await pdfParse(Buffer.from(pdfBase64, 'base64'));
    texto = parsed.text;
  } catch {
    return json(400, { error: 'No se ha podido leer el PDF (¿es un PDF con texto, no una foto escaneada?)' });
  }

  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const avisos = [];

  // Matrícula (formato 0000-XXX). Sin \b final: el extractor a veces pega la
  // matrícula directamente con los km que la siguen (p.ej. "8735HWK150000").
  const matriculaMatch = texto.match(/\b\d{4}[A-Z]{3}/);
  const matricula = matriculaMatch ? matriculaMatch[0] : '';
  if (!matricula) avisos.push('No se ha encontrado la matrícula automáticamente.');

  // Marca y modelo: misma línea que la matrícula, tras los km
  let vehiculo = '';
  if (matricula) {
    const lineaMatricula = lineas.find((l) => l.includes(matricula));
    if (lineaMatricula) {
      const resto = lineaMatricula
        .replace(matricula, '')
        .replace(/^\s*\d+\s*/, '')
        .trim();
      vehiculo = resto;
    }
  }

  // Fecha de la factura
  const fechaMatch = texto.match(/\bFecha\s+(\d{2}\/\d{2}\/\d{4})/);
  const fechaFactura = fechaMatch ? fechaDDMMYYYYaISO(fechaMatch[1]) : null;
  if (!fechaFactura) avisos.push('No se ha encontrado la fecha de la factura.');

  // Cliente: primera línea alfabética (no el número de orden) tras "Núm. de Orden"
  let cliente = '';
  const idxOrden = lineas.findIndex((l) => /N[uú]m\.?\s*de\s*Orden/i.test(l));
  if (idxOrden !== -1) {
    for (let i = idxOrden + 1; i < Math.min(idxOrden + 6, lineas.length); i++) {
      if (/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.'-]+$/.test(lineas[i])) {
        cliente = lineas[i];
        break;
      }
    }
  }
  if (!cliente) avisos.push('No se ha encontrado el nombre del cliente automáticamente.');

  // Teléfono: línea de 9 dígitos cerca del bloque de cliente
  let telefono = '';
  if (idxOrden !== -1) {
    for (let i = idxOrden + 1; i < Math.min(idxOrden + 9, lineas.length); i++) {
      if (/^\d{9}$/.test(lineas[i])) {
        telefono = lineas[i];
        break;
      }
    }
  }
  if (!telefono) avisos.push('No se ha encontrado un teléfono automáticamente.');

  // Detección de conceptos y cálculo de fechas
  const textoUpper = texto.toUpperCase();
  let fechaRevision = '';
  let fechaITV = '';
  const trabajos = [];

  if (textoUpper.includes('ACEITE')) {
    trabajos.push('Cambio de aceite');
    if (fechaFactura) {
      fechaRevision = sumarDias(fechaFactura, 365);
      avisos.push('Detectado "aceite" → próxima revisión = fecha factura + 365 días.');
    }
  }

  if (textoUpper.includes('ITV')) {
    trabajos.push('ITV');
    if (fechaFactura && matricula) {
      const { anios, nota } = estimarIntervaloITV(matricula);
      fechaITV = sumarDias(fechaFactura, anios * 365);
      avisos.push(`Detectado "ITV" → ${nota}`);
    }
  }

  return json(200, {
    cliente,
    telefono,
    matricula,
    vehiculo,
    trabajo: trabajos.join(' + '),
    fechaITV,
    fechaRevision,
    avisos,
  });
};
