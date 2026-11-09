import { useEffect, useState } from 'react';
import { ArrowLeftRight, Trash2 } from 'lucide-react';
import { iconoPorNombre } from '../lib/iconos.js';
import { categorias } from '../lib/categorias.js';
import { colones, etiquetaDia, hora, nombreComercio } from '../lib/formato.js';

/**
 * Panel inferior de un gasto: cambiar categoría, mandarlo a un grupo (o
 * devolverlo a personal) y eliminarlo.
 */
export default function HojaCategoria({ gasto, yo, grupos = [], enGrupo, onElegir, onMover, onEliminar, onCerrar }) {
  const mio = gasto.usuarioId === yo;
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
            <p className="muted">
              {etiquetaDia(gasto.fecha)} · {hora(gasto.fecha)}
              {gasto.banco ? ` · ${gasto.banco}${gasto.tipo === 'SINPE' ? ' SINPE' : ''}` : ' · agregado a mano'}
              {enGrupo && gasto.quien ? ` · ${mio ? 'lo pagaste tú' : 'lo pagó ' + gasto.quien}` : ''}
            </p>
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
              key={c.id || c.nombre}
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

        {mio && !enGrupo && grupos.length > 0 && (
          <>
            <p className="hoja-tit">Mandar a un grupo</p>
            <div className="hoja-grid">
              {grupos.map((g) => {
                const I = iconoPorNombre(g.icono);
                return (
                  <button key={g.id} className="chip" style={{ '--c': g.color }} onClick={() => onMover(gasto, g.id)}>
                    <I size={18} strokeWidth={1.9} color={g.color} />
                    <span className="chip-txt">{g.nombre}</span>
                  </button>
                );
              })}
            </div>
            <p className="muted pequeno">Sale de tus gastos personales y cuenta en el grupo.</p>
          </>
        )}
        {mio && enGrupo && (
          <button className="btn-sec btn-ancho" style={{ marginTop: 16 }} onClick={() => onMover(gasto, null)}>
            <ArrowLeftRight size={17} strokeWidth={2} /> Devolver a mis gastos personales
          </button>
        )}

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
