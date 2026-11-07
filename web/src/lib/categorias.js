export const CATEGORIAS = [
  { nombre: 'Supermercado', emoji: '🛒', color: '#8FB573' },
  { nombre: 'Comida y restaurantes', emoji: '🍔', color: '#E0A458' },
  { nombre: 'Transporte', emoji: '🚗', color: '#6FA8C9' },
  { nombre: 'Servicios', emoji: '💡', color: '#CDBB5E' },
  { nombre: 'Vivienda', emoji: '🏠', color: '#B98668' },
  { nombre: 'Salud', emoji: '💊', color: '#DE7F72' },
  { nombre: 'Compras', emoji: '👗', color: '#B892CC' },
  { nombre: 'Entretenimiento', emoji: '🎬', color: '#5FB8A5' },
  { nombre: 'Suscripciones', emoji: '📺', color: '#8E9DDB' },
  { nombre: 'Otros', emoji: '❓', color: '#868E83' }
];

export const POR_NOMBRE = Object.fromEntries(CATEGORIAS.map((c) => [c.nombre, c]));
export const cat = (nombre) => POR_NOMBRE[nombre] || POR_NOMBRE.Otros;
