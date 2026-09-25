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
  const m = texto.match(/\bFecha:?\s*\n?\s*(\d{2}[/.]\d{2}[/.]\d{4})/i) || texto.match(/(\d{2}[/.]\d{2}[/.]\d{4})/);
  return m ? fechaDDMMYYYYaISO(m[1]) : null;
}

// Intenta varios patrones conocidos (aprendidos de facturas reales de proveedores
// habituales del taller); si ninguno encaja, no se inventa nada.
function extraerBaseIvaTotal(texto) {
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
// seguida de los 7 importes. Es mucho mas fiable que sumar partida por partida.
function extraerResumenCSS(texto) {
  const cab = /Mano de Obra\s*Piezas\s*Pintura\s*Otros\s*Base\s*Imponible\s*Impuestos\s*TOTAL\s*IMPORTE/i;
  const m = texto.match(new RegExp(cab.source + `\\s*\\n(${NUM})(${NUM})(${NUM})(${NUM})(${NUM})\\s*(${NUM})\\s*(${NUM})\\s*€`, 'i'));
  if (!m) return null;
  return {
    manoObra: toNum(m[1]),
    recambios: toNum(m[2]),
    pintura: toNum(m[3]),
    otros: toNum(m[4]),
    base: toNum(m[5]),
    iva: toNum(m[6]),
    total: toNum(m[7]),
  };
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
