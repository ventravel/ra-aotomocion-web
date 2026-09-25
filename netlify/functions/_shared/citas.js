// Reglas de reserva de citas: llegada única a las 9:00, capacidad por día.
const CAPACIDAD_BASE = 4;
const CAPACIDAD_MAXIMA = 5;
const PALABRAS_TRABAJO_RAPIDO = ['REVISION', 'REVISIÓN', 'FILTRO', 'FILTROS'];

const BLOQUEOS_KEY = '_bloqueos';

// La web publica que los domingos el taller está cerrado (horario en index.html).
function esDomingo(fecha) {
  return new Date(fecha + 'T00:00:00Z').getUTCDay() === 0;
}

function esTrabajoRapido(motivo) {
  const up = (motivo || '').toUpperCase();
  return PALABRAS_TRABAJO_RAPIDO.some((p) => up.includes(p));
}

function citasActivas(citasDelDia) {
  return citasDelDia.filter((c) => c.estado !== 'cancelada');
}

// Devuelve { ok: true } o { ok: false, motivo: 'completo' | 'cerrado' }.
function puedeReservar(citasDelDia, motivo, bloqueado) {
  if (bloqueado) return { ok: false, motivo: 'cerrado' };
  const activas = citasActivas(citasDelDia).length;
  if (activas < CAPACIDAD_BASE) return { ok: true };
  if (activas < CAPACIDAD_MAXIMA && esTrabajoRapido(motivo)) return { ok: true };
  return { ok: false, motivo: 'completo' };
}

// Estado de un día para mostrarlo al cliente antes de reservar.
function estadoDelDia(citasDelDia, bloqueado) {
  if (bloqueado) return 'cerrado';
  const activas = citasActivas(citasDelDia).length;
  if (activas < CAPACIDAD_BASE) return 'libre';
  if (activas < CAPACIDAD_MAXIMA) return 'solo-rapidos';
  return 'completo';
}

async function getBloqueos(store) {
  const guardado = await store.get(BLOQUEOS_KEY, { type: 'json' });
  return guardado || [];
}

async function setBloqueos(store, bloqueos) {
  await store.setJSON(BLOQUEOS_KEY, bloqueos);
}

module.exports = {
  CAPACIDAD_BASE,
  CAPACIDAD_MAXIMA,
  BLOQUEOS_KEY,
  esDomingo,
  esTrabajoRapido,
  citasActivas,
  puedeReservar,
  estadoDelDia,
  getBloqueos,
  setBloqueos,
};
