import { CATEGORIAS_INICIALES } from './categorias.js';

// Datos de ejemplo para ver la app sin conectarla a Gmail.
const base = [
  ['2026-10-03T12:10', 'BAC', 'Tarjeta', 'Automercado Escazu', 32450, 'Supermercado'],
  ['2026-10-04T20:30', 'BCR', 'Tarjeta', 'Taco Bell Terramall Cartago', 7500, 'Comida y restaurantes'],
  ['2026-10-05T08:00', 'Popular', 'SINPE', 'SINPE · Alquiler', 95000, 'Vivienda'],
  ['2026-10-06T18:45', 'BAC', 'Tarjeta', 'Uber Trip', 4200, 'Transporte'],
  ['2026-10-07T09:00', 'BAC', 'Tarjeta', 'Netflix.com', 7800, 'Suscripciones'],
  ['2026-10-12T13:20', 'Popular', 'Tarjeta', 'Walmart Curridabat', 41800, 'Supermercado'],
  ['2026-10-18T21:00', 'BAC', 'Tarjeta', 'Cinepolis Lincoln Plaza', 9800, 'Entretenimiento'],
  ['2026-10-29T23:03', 'BAC', 'Tarjeta', 'Roof', 4000, 'Comida y restaurantes'],
  ['2026-11-01T11:15', 'BAC', 'Tarjeta', 'Automercado Escazu', 28900, 'Supermercado'],
  ['2026-11-02T10:00', 'BAC', 'Tarjeta', 'Spotify', 3200, 'Suscripciones'],
  ['2026-11-03T17:29', 'BCR', 'Tarjeta', 'Taco Bell Terramall Cartago', 7500, 'Comida y restaurantes'],
  ['2026-11-03T19:40', 'BAC', 'Tarjeta', 'Uber Trip', 3650, 'Transporte'],
  ['2026-11-04T08:00', 'Popular', 'SINPE', 'SINPE · Alquiler', 95000, 'Vivienda'],
  ['2026-11-05T12:22', 'Popular', 'Tarjeta', 'Mini Super y Licorera Don Alajuela', 5700, 'Supermercado'],
  ['2026-11-05T15:10', 'BCR', 'Tarjeta', 'Farmacia Fischel', 12350, 'Salud'],
  ['2026-11-06T13:05', 'BAC', 'Tarjeta', 'Shein', 18400, ''],
  ['2026-11-06T20:30', 'BAC', 'Tarjeta', 'Bar La Terraza', 11000, ''],
  ['2026-11-07T09:15', 'Popular', 'SINPE', 'SINPE (sin descripción)', 6000, ''],
];

let gastos = base.map(([fecha, banco, tipo, comercio, monto, categoria], i) => ({
  id: 'demo-' + i, fecha: fecha + ':00', banco, tipo, comercio, monto, moneda: 'CRC', montoOriginal: monto, categoria,
}));

let categorias = CATEGORIAS_INICIALES.map((c) => ({ ...c }));
const eliminados = new Set();

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const respuesta = (extra = {}) => ({ ok: true, ...extra, gastos: gastos.filter((g) => !eliminados.has(g.id)), categorias });

function guardarCategoria({ anterior, categoria }) {
  const nombre = String(categoria.nombre || '').trim();
  if (!nombre) throw new Error('Escribe un nombre');
  if (categorias.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase() && c.nombre !== anterior)) throw new Error('Ya existe una categoría con ese nombre');
  const nueva = { nombre, icono: categoria.icono, color: categoria.color };
  if (anterior) {
    categorias = categorias.map((c) => (c.nombre === anterior ? nueva : c));
    gastos = gastos.map((g) => (g.categoria === anterior ? { ...g, categoria: nombre } : g));
  } else {
    categorias = [...categorias, nueva];
  }
}

export async function demo(params) {
  await espera(400);
  if (params.action === 'deleteExpense') { eliminados.add(params.id); return respuesta(); }
  if (params.action === 'restoreExpense') { eliminados.delete(params.id); return respuesta(); }
  if (params.action === 'saveCategory') { guardarCategoria(params); return respuesta(); }
  if (params.action === 'deleteCategory') {
    let movidos = 0;
    categorias = categorias.filter((c) => c.nombre !== params.nombre);
    gastos = gastos.map((g) => (g.categoria === params.nombre ? (movidos++, { ...g, categoria: '' }) : g));
    return respuesta({ movidos });
  }
  if (params.action === 'setCategory') {
    const g = gastos.find((x) => x.id === params.id);
    let actualizados = 0;
    gastos = gastos.map((x) => {
      if (x.id === params.id || (x.comercio === g.comercio && !/sin descripci/i.test(g.comercio))) { actualizados++; return { ...x, categoria: params.categoria }; }
      return x;
    });
    return respuesta({ actualizados });
  }
  return respuesta({ nuevos: 0 });
}
