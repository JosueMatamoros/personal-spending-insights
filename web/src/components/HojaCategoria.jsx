import { useEffect, useState } from 'react';
import { ArrowLeftRight, Pencil, Trash2 } from 'lucide-react';
import { iconoPorNombre } from '../lib/iconos.js';
import { categorias } from '../lib/categorias.js';
import { colones, etiquetaDia, hora, nombreComercio } from '../lib/formato.js';

/**
 * Panel inferior de un gasto: cambiar categoría, mandarlo a un grupo (o
 * devolverlo a personal) y eliminarlo.
 */
export default function HojaCategoria({ gasto, yo, grupos = [], enGrupo, puedePersonal = true, onElegir, onMover, onEditar, onEliminar, onCerrar }) {
  const mio = gasto.usuarioId === yo;
  const [confirmar, setConfirmar] = useState(false);
  const editable = gasto.origen === 'manual' && Boolean(onEditar);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  return (
    <div className="velo" onClick={onCerrar}>
      <section className="hoja" role="dialog" aria-label="Cambiar categoría" onClick={(e) => e.stopPropagation()}>
        <div className="hoja-asa" />
        {editando ? (
          <EditarGasto gasto={gasto} onGuardar={async (c) => { await onEditar(gasto, c); setEditando(false); }} onCancelar={() => setEditando(false)} />
        ) : (
        <header className="hoja-cab">
          <div>
            <h2 className="tit-editar">
              {nombreComercio(gasto.comercio)}
              {editable && (
                <button className="icono lapiz" onClick={() => setEditando(true)} aria-label="Editar descripción y monto" title="Editar">
                  <Pencil size={16} strokeWidth={2.2} />
                </button>
              )}
            </h2>
            <p className="muted">
              {etiquetaDia(gasto.fecha)} · {hora(gasto.fecha)}
              {gasto.banco ? ` · ${gasto.banco}${gasto.tipo === 'SINPE' ? ' SINPE' : ''}` : ' · agregado a mano'}
              {enGrupo && gasto.quien ? ` · ${mio ? 'lo pagaste tú' : 'lo pagó ' + gasto.quien}` : ''}
            </p>
          </div>
          <strong className="num">{colones(gasto.monto)}</strong>
        </header>
        )}
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
        {mio && enGrupo && puedePersonal && (
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

/** Editar la descripción y el monto de un gasto agregado a mano (o un pago de guía). */
function EditarGasto({ gasto, onGuardar, onCancelar }) {
  const formato = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const [comercio, setComercio] = useState(gasto.comercio);
  const [monto, setMonto] = useState(formato(gasto.monto));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(e) {
    e.preventDefault();
    const n = Number(monto.replace(/[^\d]/g, ''));
    if (!n) return setError('Escribe el monto');
    if (!comercio.trim()) return setError('Escribe una descripción');
    setGuardando(true);
    setError('');
    try {
      await onGuardar({ comercio: comercio.trim(), monto: n });
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <form className="editar-gasto" onSubmit={guardar}>
      <p className="hoja-tit" style={{ marginTop: 0 }}>Editar gasto</p>
      <div className="monto-campo">
        <span>₡</span>
        <input value={monto} onChange={(e) => setMonto(formato(Number(e.target.value.replace(/[^\d]/g, '')) || 0).replace(/^0$/, ''))} inputMode="numeric" aria-label="Monto" />
      </div>
      <div className="campos campos-uno">
        <input value={comercio} onChange={(e) => setComercio(e.target.value)} placeholder="Descripción" aria-label="Descripción" maxLength={120} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="confirmar-btns">
        <button type="button" className="btn-sec" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}
