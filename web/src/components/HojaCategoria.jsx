import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { categorias } from '../lib/categorias.js';
import { colones, etiquetaDia, hora, nombreComercio } from '../lib/formato.js';

/** Panel inferior para cambiar la categoría de un gasto (o eliminarlo). */
export default function HojaCategoria({ gasto, onElegir, onEliminar, onCerrar }) {
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  return (
    <div className="velo" onClick={onCerrar}>
      <section className="hoja" role="dialog" aria-label="Cambiar categoría" onClick={(e) => e.stopPropagation()}>
        <div className="hoja-asa" />
        <header className="hoja-cab">
          <div>
            <h2>{nombreComercio(gasto.comercio)}</h2>
            <p className="muted">{etiquetaDia(gasto.fecha)} · {hora(gasto.fecha)} · {gasto.banco}{gasto.tipo === 'SINPE' ? ' SINPE' : ''}</p>
          </div>
          <strong className="num">{colones(gasto.monto)}</strong>
        </header>
        {gasto.moneda === 'USD' && (
          <p className="nota">Compra en dólares (${gasto.montoOriginal}), convertida a colones.</p>
        )}
        <p className="hoja-tit">Categoría</p>
        <div className="hoja-grid">
          {categorias().map((c) => (
            <button
              key={c.nombre}
              className={'chip' + (c.nombre === gasto.categoria ? ' activo' : '')}
              style={{ '--c': c.color }}
              onClick={() => onElegir(c.nombre)}
            >
              <c.Icono size={18} strokeWidth={1.9} color={c.color} />
              <span className="chip-txt">{c.nombre}</span>
            </button>
          ))}
        </div>
        <p className="muted pequeno">Los próximos gastos de este comercio se van a guardar en la categoría que elijas.</p>

        {confirmar ? (
          <div className="confirmar">
            <p>¿Eliminar este gasto? Ya no va a contar en tus reportes.</p>
            <div className="confirmar-btns">
              <button className="btn-sec" onClick={() => setConfirmar(false)}>Cancelar</button>
              <button className="btn-peligro" onClick={() => onEliminar(gasto)}>Eliminar</button>
            </div>
          </div>
        ) : (
          <button className="btn-eliminar" onClick={() => setConfirmar(true)}>
            <Trash2 size={17} strokeWidth={2} /> Eliminar gasto
          </button>
        )}
      </section>
    </div>
  );
}
