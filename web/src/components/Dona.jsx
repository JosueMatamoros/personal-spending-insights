import { cat } from '../lib/categorias.js';

/** Gráfico de dona por categoría. `partes` = [{ nombre, total }] ordenado. */
export default function Dona({ partes, total, seleccion, onSeleccion, centro }) {
  const r = 70;
  const grosor = 22;
  const circ = 2 * Math.PI * r;
  const hueco = partes.length > 1 ? 3 : 0; // separación entre segmentos
  let acumulado = 0;

  return (
    <svg viewBox="0 0 200 200" className="dona" role="img" aria-label="Gastos por categoría">
      <circle cx="100" cy="100" r={r} fill="none" stroke="var(--pista)" strokeWidth={grosor} />
      {total > 0 && partes.map((p) => {
        const largo = (p.total / total) * circ;
        const visible = Math.max(largo - hueco, 0.5);
        const offset = -acumulado;
        acumulado += largo;
        const apagado = seleccion && seleccion !== p.nombre;
        return (
          <circle
            key={p.nombre}
            cx="100" cy="100" r={r}
            fill="none"
            stroke={cat(p.nombre).color}
            strokeWidth={grosor}
            strokeDasharray={`${visible} ${circ - visible}`}
            strokeDashoffset={offset}
            transform="rotate(-90 100 100)"
            opacity={apagado ? 0.22 : 1}
            className="dona-seg"
            onClick={() => onSeleccion(seleccion === p.nombre ? null : p.nombre)}
          />
        );
      })}
      <text x="100" y="96" textAnchor="middle" className="dona-num">{centro.valor}</text>
      <text x="100" y="118" textAnchor="middle" className="dona-lbl">{centro.etiqueta}</text>
    </svg>
  );
}
