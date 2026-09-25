// Catálogo de tipos de trabajo que el lector de facturas puede detectar.
// El intervalo de "Aceite" viene ya fijado (era el comportamiento previo, 365 días).
// El resto se deja sin intervalo: el taller lo rellena él mismo desde el panel,
// para no inventar un dato que no conocemos.
const CATALOGO_SEED = [
  { id: 'aceite', nombre: 'Aceite y filtro de aceite', palabrasClave: ['ACEITE'], intervaloMeses: 12 },
  { id: 'frenos', nombre: 'Frenos (pastillas/discos)', palabrasClave: ['FRENO', 'PASTILLA', 'DISCO DE FRENO'], intervaloMeses: null },
  { id: 'correa-distribucion', nombre: 'Correa de distribución', palabrasClave: ['CORREA DISTRIB', 'DISTRIBUCION'], intervaloMeses: null },
  { id: 'filtro-combustible', nombre: 'Filtro de combustible', palabrasClave: ['FILTRO COMBUSTIBLE', 'FILTRO GASOIL', 'FILTRO GASOLINA'], intervaloMeses: null },
  { id: 'filtro-polen', nombre: 'Filtro de polen / habitáculo', palabrasClave: ['FILTRO POLEN', 'FILTRO HABITACULO', 'FILTRO ANTIPOLEN'], intervaloMeses: null },
  { id: 'filtro-aire', nombre: 'Filtro de aire', palabrasClave: ['FILTRO DE AIRE', 'FILTRO AIRE'], intervaloMeses: null },
  { id: 'neumaticos', nombre: 'Neumáticos', palabrasClave: ['NEUMATIC'], intervaloMeses: null },
];

const CATALOGO_KEY = '_catalogo';

async function getCatalogo(store) {
  const guardado = await store.get(CATALOGO_KEY, { type: 'json' });
  return guardado || CATALOGO_SEED;
}

async function setCatalogo(store, catalogo) {
  await store.setJSON(CATALOGO_KEY, catalogo);
}

module.exports = { getCatalogo, setCatalogo, CATALOGO_KEY, CATALOGO_SEED };
