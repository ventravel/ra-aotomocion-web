// Lectura best-effort de facturas de ingreso/gasto para el libro de cuentas.
// A diferencia de parse-factura.js (formato fijo de CSS), aquí llegan facturas
// de proveedores muy variados: cada patrón es una apuesta, nunca una certeza.
// Por eso el resultado SIEMPRE se enseña para revisar antes de guardar.
const NUM = '-?\\d{1,3}(?:[.,]\\d{3})*[.,]\\d{2}';

function toNum(s) {
  const m = String(s).match(/^(-)?(.*)([.,])(\d{2})$/);
  if (!m) return null;
  const sign = m[1] || '';
  const intPart = m[2].replace(/[.,]/g, '');
  return Number(sign + (intPart || '0') + '.' + m[4]);
}

function fechaDDMMYYYYaISO(str) {
  const m = /(\d{2})[/.](\d{2})[/.](\d{4})/.exec(str);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function extraerFecha(texto) {
  let m = texto.match(/\bFecha:?\s*\n?\s*(\d{2}[/.]\d{2}[/.]\d{4})/i);
  if (m) return fechaDDMMYYYYaISO(m[1]);
  // Facturas de ITV (Applus): la etiqueta "Fecha:" sale muy lejos del valor
  // real en el texto extraído (el orden de lectura del PDF va desordenado) y
  // antes aparece la fecha de primera matriculación del vehículo, que no es
  // la que queremos. El número de factura (una racha larga de dígitos) sí
  // va siempre pegado justo delante de la fecha real.
  m = texto.match(/\d{12,}\s*\n\s*(\d{2}[/.]\d{2}[/.]\d{4})/);
  if (m) return fechaDDMMYYYYaISO(m[1]);
  m = texto.match(/(\d{2}[/.]\d{2}[/.]\d{4})/);
  return m ? fechaDDMMYYYYaISO(m[1]) : null;
}

// Intenta varios patrones conocidos (aprendidos de facturas reales de proveedores
// habituales del taller); si ninguno encaja, no se inventa nada.
function extraerBaseIvaTotal(texto) {
  // Facturas de ITV (Applus): el resumen final trae los importes en el orden
  // "Total, Tasas, IVA, Base Imponible" (al revés de lo habitual) y con algún
  // "0" suelto pegado a los importes por cómo se extrae el texto del PDF.
  // Se activa solo si el texto es claramente de Applus, para no interferir
  // con ningún otro proveedor.
  if (/Applus/i.test(texto)) {
    const mApplus = texto.match(new RegExp(
      `(${NUM})\\s*\\n\\s*(${NUM})\\s+(${NUM})0?\\s+(${NUM})0?\\s*\\n\\s*Forma de pago`, 'i'
    ));
    if (mApplus) {
      return { total: toNum(mApplus[1]), iva: toNum(mApplus[3]), base: toNum(mApplus[4]), metodo: 'applus-itv' };
    }
  }

  let m = texto.match(new RegExp(`BASE IMPONIBLE\\s*\\n(${NUM})[^\\n]*\\nI\\.?V\\.?A\\.?\\s*\\n(${NUM})[^\\n]*\\nTOTAL\\s*\\n(${NUM})`, 'i'));
  if (m) return { base: toNum(m[1]), iva: toNum(m[2]), total: toNum(m[3]), metodo: 'patron-1' };

  m = texto.match(new RegExp(`Base Imponible ?Impuestos\\s*\\nTOTAL\\s*\\n(${NUM})(${NUM})\\s*\\n(${NUM})\\s*€`, 'i'));
  if (m) return { base: toNum(m[1]), iva: toNum(m[2]), total: toNum(m[3]), metodo: 'patron-2' };

  const mTotal = texto.match(new RegExp(`\\n\\s*(${NUM})\\s*\\n\\s*(${NUM})\\s*\\nDto\\.\\s?PP\\.Base IVA`, 'i'));
  const mCab = texto.match(new RegExp(`T ?O ?T ?A ?L[^\\n]*\\n\\s*(${NUM})\\s*(${NUM})\\s+(-?\\d{1,2},\\d{2})\\s*(${NUM})`));
  if (mTotal && mCab) return { base: toNum(mCab[2]), iva: toNum(mCab[4]), total: toNum(mTotal[1]), metodo: 'patron-3' };

  // Generico: base + iva conocidos y total = base + iva (si no se encuentra un total explicito)
  const mBase = texto.match(new RegExp(`Base ?[Ii]mponible[^\\n]*\\n\\s*(${NUM})`, 'i'));
  const mIva = texto.match(new RegExp(`I\\.?V\\.?A\\.?[^\\n]{0,15}\\n\\s*(${NUM})`, 'i'));
  const mTot = texto.match(new RegExp(`TOTAL[^\\n]{0,10}\\n\\s*(${NUM})`, 'i'));
  if (mBase && mIva) {
    const base = toNum(mBase[1]);
    const iva = toNum(mIva[1]);
    const total = mTot ? toNum(mTot[1]) : Math.round((base + iva) * 100) / 100;
    return { base, iva, total, metodo: 'generico' };
  }

  return null;
}

// Las facturas que emite el propio taller (formato CSS) traen una linea-resumen
// final: "Mano de ObraPiezasPinturaOtrosBase ImponibleImpuestosTOTAL IMPORTE"
// seguida de los 7 importes PEGADOS SIN NINGUN ESPACIO entre ellos. Como el
// formato de cada importe (miles con "." y decimales con ",") es el mismo que
// el separador entre importes, la frontera entre uno y el siguiente es
// ambigua a simple vista (ej: "156,80" + "1.040,00" se lee igual que
// "156.801.040,00" si no se sabe dónde cortar). Probamos TODAS las formas de
// trocear el bloque en exactamente 7 importes válidos y, si hay más de una,
// nos quedamos con la que cuadra aritméticamente (manoObra+recambios+pintura+
// otros = base, base+iva = total). Es mucho mas fiable que sumar partida por partida.
const NUM_ANCLADO = new RegExp(`^${NUM}$`);

function trocearSieteImportes(bloque) {
  const n = bloque.length;
  const candidatosDesde = (start) => {
    const res = [];
    for (let len = 4; start + len <= n && len <= 16; len++) {
      const trozo = bloque.slice(start, start + len);
      if (NUM_ANCLADO.test(trozo)) res.push(len);
    }
    return res;
  };
  const soluciones = [];
  const partes = [];
  (function buscar(pos) {
    if (partes.length === 7) {
      if (pos === n) soluciones.push(partes.slice());
      return;
    }
    for (const len of candidatosDesde(pos)) {
      partes.push(bloque.slice(pos, pos + len));
      buscar(pos + len);
      partes.pop();
    }
  })(0);
  if (soluciones.length === 0) return null;
  if (soluciones.length === 1) return soluciones[0];
  // Desempate: la combinación cuyas sumas cuadren mejor con base y total.
  let mejor = null;
  let mejorError = Infinity;
  for (const sol of soluciones) {
    const [manoObra, recambios, pintura, otros, base, iva, total] = sol.map(toNum);
    const errorBase = Math.abs((manoObra + recambios + pintura + otros) - base);
    const errorTotal = Math.abs((base + iva) - total);
    const error = errorBase + errorTotal;
    if (error < mejorError) { mejorError = error; mejor = sol; }
  }
  return mejor;
}

function extraerResumenCSS(texto) {
  const cab = /Mano de Obra\s*Piezas\s*Pintura\s*Otros\s*Base\s*Imponible\s*Impuestos\s*TOTAL\s*IMPORTE/i;
  // Los importes pueden venir totalmente pegados o con algún espacio suelto
  // entre unos y otros (varía según la factura); admitimos espacios/tabs
  // sueltos dentro del bloque y los quitamos antes de trocearlo.
  const m = texto.match(new RegExp(cab.source + `\\s*\\n([-\\d.,\\t ]+)\\s*€`, 'i'));
  if (!m) return null;
  const partes = trocearSieteImportes(m[1].replace(/\s+/g, ''));
  if (!partes) return null;
  const [manoObra, recambios, pintura, otros, base, iva, total] = partes.map(toNum);
  return { manoObra, recambios, pintura, otros, base, iva, total };
}

function parseMovimiento(texto, tipo) {
  const avisos = [];
  const fecha = extraerFecha(texto);
  if (!fecha) avisos.push('No se ha encontrado la fecha automáticamente.');

  let base = null, iva = null, total = null, manoObra = null, recambios = null;

  if (tipo === 'ingreso') {
    const resumen = extraerResumenCSS(texto);
    if (resumen) {
      base = resumen.base; iva = resumen.iva; total = resumen.total;
      manoObra = resumen.manoObra; recambios = resumen.recambios + resumen.pintura + resumen.otros;
      avisos.push('Importes y reparto mano de obra/recambios detectados automáticamente (formato CSS). Revísalos.');
    } else {
      avisos.push('No se ha podido leer el resumen de la factura automáticamente. Rellena los datos a mano.');
    }
  } else {
    const importes = extraerBaseIvaTotal(texto);
    if (importes) {
      base = importes.base; iva = importes.iva; total = importes.total;
      avisos.push(`Importes detectados (${importes.metodo}). Revísalos antes de guardar.`);
    } else {
      avisos.push('No se han podido leer base/IVA/total automáticamente. Rellénalos a mano.');
    }
  }

  return { fecha, base, iva, total, manoObra, recambios, avisos };
}

module.exports = { parseMovimiento };
