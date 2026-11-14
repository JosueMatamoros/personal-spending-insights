// Datos de ejemplo para ver la app sin conectarla (#demo). Imita al backend.
import { CATEGORIAS_INICIALES } from './categorias.js';

const JOSUE = { id: 'u-josue', nombre: 'Josué' };
const MARIO = { id: 'u-mario', nombre: 'Mario Andrés' };
let sec = 0;
const nid = (p) => `${p}-${++sec}`;

let categorias = CATEGORIAS_INICIALES.map((c) => ({ id: nid('c'), ...c, dueño: 'personal' }));
const GRUPO = { id: 'g-tour', nombre: 'Tour a caballo', icono: 'Users', color: '#E0A458', tourId: 2, creadoPor: JOSUE.id, pagosGuias: true };
let grupos = [{ ...GRUPO, miembros: [JOSUE.id, MARIO.id] }];
[['Alimento caballos', 'Sprout', '#8FB573'], ['Veterinario', 'Stethoscope', '#DE7F72'], ['Equipo', 'Wrench', '#B98668'], ['Otros', 'Shapes', '#9AA396']]
  .forEach(([nombre, icono, color]) => categorias.push({ id: nid('c'), nombre, icono, color, dueño: GRUPO.id }));

const catId = (nombre, dueño = 'personal') => categorias.find((c) => c.nombre === nombre && c.dueño === dueño)?.id || null;

const base = [
  ['2026-10-03T12:10', 'BAC', 'Tarjeta', 'Automercado Escazu', 32450, 'Supermercado'],
  ['2026-10-04T20:30', 'BCR', 'Tarjeta', 'Taco Bell Terramall Cartago', 7500, 'Comida y restaurantes'],
  ['2026-10-05T08:00', 'Popular', 'SINPE', 'SINPE · Alquiler', 95000, 'Vivienda'],
  ['2026-10-06T18:45', 'BAC', 'Tarjeta', 'Uber Trip', 4200, 'Transporte'],
  ['2026-10-07T09:00', 'BAC', 'Tarjeta', 'Netflix.com', 7800, 'Suscripciones'],
  ['2026-10-12T13:20', 'Popular', 'Tarjeta', 'Walmart Curridabat', 41800, 'Supermercado'],
  ['2026-10-18T21:00', 'BAC', 'Tarjeta', 'Cinepolis Lincoln Plaza', 9800, 'Entretenimiento'],
  ['2026-11-01T11:15', 'BAC', 'Tarjeta', 'Automercado Escazu', 28900, 'Supermercado'],
  ['2026-11-02T10:00', 'BAC', 'Tarjeta', 'Spotify', 3200, 'Suscripciones'],
  ['2026-11-03T17:29', 'BCR', 'Tarjeta', 'Taco Bell Terramall Cartago', 7500, 'Comida y restaurantes'],
  ['2026-11-03T19:40', 'BAC', 'Tarjeta', 'Uber Trip', 3650, 'Transporte'],
  ['2026-11-04T08:00', 'Popular', 'SINPE', 'SINPE · Alquiler', 95000, 'Vivienda'],
  ['2026-11-05T15:10', 'BCR', 'Tarjeta', 'Farmacia Fischel', 12350, 'Salud'],
  ['2026-11-06T13:05', 'BAC', 'Tarjeta', 'Shein', 18400, ''],
  ['2026-11-06T20:30', 'BAC', 'Tarjeta', 'Bar La Terraza', 11000, ''],
  ['2026-11-07T09:15', 'Popular', 'SINPE', 'SINPE (sin descripción)', 6000, ''],
];
let movs = base.map(([fecha, banco, tipo, comercio, monto, cat]) => ({
  id: nid('m'), fecha: fecha + ':00', banco, tipo, comercio, monto, moneda: 'CRC', montoOriginal: monto,
  categoriaId: catId(cat), usuarioId: JOSUE.id, grupoId: null, origen: 'correo', eliminado: false,
}));
movs.push(
  { id: nid('m'), fecha: '2026-11-02T07:30:00', banco: 'Popular', tipo: 'SINPE', comercio: 'SINPE · Heno', monto: 42000, moneda: 'CRC', montoOriginal: 42000, categoriaId: catId('Alimento caballos', GRUPO.id), usuarioId: JOSUE.id, grupoId: GRUPO.id, origen: 'correo', eliminado: false },
  { id: nid('m'), fecha: '2026-11-04T16:00:00', banco: null, tipo: 'Manual', comercio: 'Herraduras', monto: 15000, moneda: 'CRC', montoOriginal: 15000, categoriaId: catId('Equipo', GRUPO.id), usuarioId: MARIO.id, grupoId: GRUPO.id, origen: 'manual', eliminado: false },
  { id: nid('m'), fecha: '2026-11-06T10:20:00', banco: null, tipo: 'Manual', comercio: 'Visita veterinario', monto: 25000, moneda: 'CRC', montoOriginal: 25000, categoriaId: catId('Veterinario', GRUPO.id), usuarioId: MARIO.id, grupoId: GRUPO.id, origen: 'manual', eliminado: false },
);

const usuarios = [JOSUE, MARIO];
// Guías asignados (imita public.slot_guides)
let guias = [
  ['2026-11-07', '15:00', 'Dykember'], ['2026-11-09', '15:00', 'Andy'], ['2026-11-10', '08:00', 'Andy'],
  ['2026-11-10', '12:00', 'Dykember'], ['2026-11-11', '12:00', 'Dykember'],
].map(([fecha, hora, guia]) => ({ id: nid('s'), fecha, hora, guia, tour: 'Horseback Riding', monto: 10000, pagadoPor: null, noAplica: false }));
const guiasPendientes = () => guias.filter((x) => !x.pagadoPor && !x.noAplica);
const nombreDe = (id) => usuarios.find((u) => u.id === id)?.nombre;
const vista = (m) => ({ ...m, categoria: categorias.find((c) => c.id === m.categoriaId)?.nombre || '', quien: nombreDe(m.usuarioId) });
const catsDe = (dueño) => categorias.filter((c) => c.dueño === dueño).map(({ dueño: _d, ...c }) => c); // eslint-disable-line no-unused-vars

function datos(extra = {}) {
  const vivos = movs.filter((m) => !m.eliminado).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    ok: true, ...extra,
    usuario: JOSUE, usuarios,
    personal: { categorias: catsDe('personal'), movimientos: vivos.filter((m) => !m.grupoId && m.usuarioId === JOSUE.id).map(vista) },
    grupos: grupos.map((g) => ({
      ...g, miembros: g.miembros.map((id) => ({ id, nombre: nombreDe(id) })),
      categorias: catsDe(g.id), movimientos: vivos.filter((m) => m.grupoId === g.id).map(vista),
      ...(g.pagosGuias ? { guiasPendientes: guiasPendientes().length } : {}),
    })),
  };
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const falla = (msg) => { throw new Error(msg); };

function validarNombre(nombre, dueño, excepto) {
  const n = String(nombre || '').trim();
  if (!n) falla('Escribe un nombre');
  if (categorias.some((c) => c.dueño === dueño && c.id !== excepto && c.nombre.toLowerCase() === n.toLowerCase())) falla('Ya existe una categoría con ese nombre');
  return n;
}

export async function demo(metodo, ruta, b = {}) {
  await espera(350);
  const [, recurso, id, accion] = ruta.split('/');
  const m = movs.find((x) => x.id === id);

  if (recurso === 'datos' || recurso === 'sync') return datos({ nuevos: 0 });
  if (recurso === 'push') falla('Las notificaciones no funcionan en el ejemplo');

  if (recurso === 'grupos' && accion?.startsWith('guias')) {
    if (metodo === 'PUT') {
      const s = guias.find((x) => x.id === ruta.split('/')[4]) || falla('Guía no encontrado');
      Object.assign(s, { pagadoPor: b.pagadoPor, noAplica: !b.pagadoPor && Boolean(b.noAplica) });
      if (b.pagadoPor) movs.push({ id: nid('m'), fecha: `${s.fecha}T${s.hora}:00`, banco: null, tipo: 'Guía', comercio: `Guía ${s.guia} · ${s.tour} ${s.hora}`, monto: 10000, moneda: 'CRC', montoOriginal: 10000, categoriaId: null, usuarioId: b.pagadoPor, grupoId: id, origen: 'manual', eliminado: false });
    }
    return datos({ precio: 10000, guias: guiasPendientes() });
  }

  if (recurso === 'movimientos') {
    if (metodo === 'POST' && !id) {
      movs.push({ id: nid('m'), fecha: b.fecha || new Date().toISOString().slice(0, 19), banco: null, tipo: 'Manual', comercio: b.comercio, monto: b.monto, moneda: 'CRC', montoOriginal: b.monto, categoriaId: b.categoriaId || null, usuarioId: JOSUE.id, grupoId: b.grupoId || null, origen: 'manual', eliminado: false, nota: b.nota });
      return datos();
    }
    if (!m) falla('Gasto no encontrado');
    if (accion === 'categoria') {
      let actualizados = 0;
      movs = movs.map((x) => (x.id === id || (x.comercio === m.comercio && x.grupoId === m.grupoId && !/sin descripci/i.test(m.comercio)) ? (actualizados++, { ...x, categoriaId: b.categoriaId }) : x));
      return datos({ actualizados });
    }
    if (metodo === 'PATCH' && !accion) { if (b.comercio) m.comercio = b.comercio; if (b.monto) m.monto = m.montoOriginal = b.monto; if (b.pagadoPor) m.usuarioId = b.pagadoPor; return datos(); }
    if (accion === 'mover') { m.grupoId = b.grupoId; m.categoriaId = null; return datos(); }
    if (accion === 'restaurar') { m.eliminado = false; return datos(); }
    if (metodo === 'DELETE') { m.eliminado = true; return datos(); }
  }

  if (recurso === 'categorias') {
    if (metodo === 'POST') {
      const dueño = b.grupoId || 'personal';
      categorias.push({ id: nid('c'), nombre: validarNombre(b.nombre, dueño), icono: b.icono, color: b.color, dueño });
      return datos();
    }
    const c = categorias.find((x) => x.id === id) || falla('Categoría no encontrada');
    if (metodo === 'PATCH') { Object.assign(c, { nombre: validarNombre(b.nombre, c.dueño, c.id), icono: b.icono, color: b.color }); return datos(); }
    if (metodo === 'DELETE') {
      if (categorias.filter((x) => x.dueño === c.dueño).length <= 1) falla('Debe quedar al menos una categoría');
      let movidos = 0;
      movs = movs.map((x) => (x.categoriaId === id ? (movidos++, { ...x, categoriaId: null }) : x));
      categorias = categorias.filter((x) => x.id !== id);
      return datos({ movidos });
    }
  }

  if (recurso === 'grupos') {
    if (metodo === 'POST') {
      if (!String(b.nombre || '').trim()) falla('Escribe un nombre');
      const g = { id: nid('g'), nombre: b.nombre.trim(), icono: b.icono || 'Users', color: b.color || '#8FB573', creadoPor: JOSUE.id, miembros: [...new Set([JOSUE.id, ...(b.miembros || [])])] };
      grupos.push(g);
      [['Comida y restaurantes', 'UtensilsCrossed', '#E0A458'], ['Transporte', 'Car', '#6FA8C9'], ['Otros', 'Shapes', '#9AA396']]
        .forEach(([nombre, icono, color]) => categorias.push({ id: nid('c'), nombre, icono, color, dueño: g.id }));
      return datos();
    }
    const g = grupos.find((x) => x.id === id) || falla('Grupo no encontrado');
    Object.assign(g, { nombre: b.nombre, icono: b.icono, color: b.color });
    if (b.miembros) g.miembros = [...new Set([JOSUE.id, ...b.miembros])];
    return datos();
  }
  return falla('Acción desconocida');
}
