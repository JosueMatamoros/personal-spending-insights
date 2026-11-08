import { CircleDashed, Clapperboard, House, Lightbulb, Pill, Shapes, ShoppingCart, Car, Tv, UtensilsCrossed } from 'lucide-react';

export const POR_CLASIFICAR = 'Por clasificar';

export const CATEGORIAS = [
  { nombre: 'Supermercado', Icono: ShoppingCart, color: '#8FB573' },
  { nombre: 'Comida y restaurantes', Icono: UtensilsCrossed, color: '#E0A458' },
  { nombre: 'Transporte', Icono: Car, color: '#6FA8C9' },
  { nombre: 'Servicios', Icono: Lightbulb, color: '#CDBB5E' },
  { nombre: 'Vivienda', Icono: House, color: '#B98668' },
  { nombre: 'Salud', Icono: Pill, color: '#DE7F72' },
  { nombre: 'Entretenimiento', Icono: Clapperboard, color: '#5FB8A5' },
  { nombre: 'Suscripciones', Icono: Tv, color: '#8E9DDB' },
  { nombre: 'Otros', Icono: Shapes, color: '#9AA396' },
];

const PENDIENTE = { nombre: POR_CLASIFICAR, Icono: CircleDashed, color: '#D9B24C' };

export const POR_NOMBRE = Object.fromEntries([...CATEGORIAS, PENDIENTE].map((c) => [c.nombre, c]));
export const cat = (nombre) => POR_NOMBRE[nombre] || PENDIENTE;

/** El servidor manda '' para los gastos sin clasificar. */
export const normalizarCategoria = (c) => (POR_NOMBRE[c] && c !== POR_CLASIFICAR ? c : POR_CLASIFICAR);
