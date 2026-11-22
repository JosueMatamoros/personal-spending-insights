import { CircleDashed, iconoPorNombre } from './iconos.js';

export const POR_CLASIFICAR = 'Por clasificar';

// Las mismas del servidor; se usan hasta que llega la lista real (y en el ejemplo).
export const CATEGORIAS_INICIALES = [
  { nombre: 'Supermercado', icono: 'ShoppingCart', color: '#8FB573' },
  { nombre: 'Comida y restaurantes', icono: 'UtensilsCrossed', color: '#E0A458' },
  { nombre: 'Transporte', icono: 'Car', color: '#6FA8C9' },
  { nombre: 'Servicios', icono: 'Lightbulb', color: '#CDBB5E' },
  { nombre: 'Vivienda', icono: 'House', color: '#B98668' },
  { nombre: 'Salud', icono: 'Pill', color: '#DE7F72' },
  { nombre: 'Suscripciones', icono: 'Tv', color: '#8E9DDB' },
  { nombre: 'Salidas', icono: 'HeartHandshake', color: '#C98BB9', clave: 'Salidas' },
  { nombre: 'Otros', icono: 'Shapes', color: '#9AA396' },
];

const PENDIENTE = { nombre: POR_CLASIFICAR, icono: 'CircleDashed', Icono: CircleDashed, color: '#D9B24C' };

let lista = [];
let porNombre = {};

/** Cambia la lista de categorías activa (la manda el servidor). */
export function setCategorias(nuevas) {
  const validas = Array.isArray(nuevas) && nuevas.length ? nuevas : CATEGORIAS_INICIALES;
  lista = validas.map((c) => ({ ...c, Icono: iconoPorNombre(c.icono) }));
  porNombre = Object.fromEntries([...lista, PENDIENTE].map((c) => [c.nombre, c]));
  return lista;
}
setCategorias(CATEGORIAS_INICIALES);

export const categorias = () => lista;
export const cat = (nombre) => porNombre[nombre] || PENDIENTE;

/** El servidor manda '' para los gastos sin clasificar. */
export const normalizarCategoria = (c) => (porNombre[c] && c !== POR_CLASIFICAR ? c : POR_CLASIFICAR);

/** id de una categoría del ámbito actual a partir de su nombre. */
export const idDe = (nombre) => porNombre[nombre]?.id || null;

// ── Zonas (solo supermercado, comida y salidas) ──
export const CLAVES_CON_ZONA = ['Supermercado', 'Comida y restaurantes', 'Salidas'];
export const ZONAS = [
  { id: 'pueblo', nombre: 'Pueblo', color: '#8FB573' },
  { id: 'ciudad', nombre: 'Ciudad', color: '#6FA8C9' },
  { id: 'viaje', nombre: 'Viaje', color: '#E0A458', noCuenta: true },
  { id: 'ninguna', nombre: 'Ninguna', color: '#9AA396', noCuenta: true },
];
/** ¿Esta categoría (por nombre del ámbito actual) lleva zona? Usa la clave para que renombrarla no la rompa. */
export const llevaZona = (nombre) => {
  const c = porNombre[nombre];
  return Boolean(c && CLAVES_CON_ZONA.includes(c.clave || c.nombre));
};
/** Lo que de verdad gasté yo: el total menos lo que otros me deben. */
export const miParte = (g) => Math.max(0, g.monto - (g.cobros || []).reduce((s, k) => s + k.monto, 0));

/** Dónde está el teléfono ahora (para la zona de un gasto anotado a mano). Si no hay permiso o tarda, nada. */
export function ubicacionActual(ms = 5000) {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok({});
    const t = setTimeout(() => ok({}), ms);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); ok({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { clearTimeout(t); ok({}); },
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: ms },
    );
  });
}
