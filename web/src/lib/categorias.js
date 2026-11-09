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
  { nombre: 'Entretenimiento', icono: 'Clapperboard', color: '#5FB8A5' },
  { nombre: 'Suscripciones', icono: 'Tv', color: '#8E9DDB' },
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
