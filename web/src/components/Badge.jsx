import { cat } from '../lib/categorias.js';

export default function Badge({ categoria, size = 20, className = 'badge' }) {
  const { Icono, color } = cat(categoria);
  return (
    <span className={className} style={{ '--c': color }} aria-hidden="true">
      <Icono size={size} strokeWidth={1.9} color={color} />
    </span>
  );
}
