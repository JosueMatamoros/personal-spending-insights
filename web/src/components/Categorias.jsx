import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { categorias } from '../lib/categorias.js';
import { COLORES, ICONOS } from '../lib/iconos.js';

/**
 * Lista de categorías para editarlas, agregar nuevas o borrarlas.
 * onGuardar(original, {nombre, icono, color}) y onBorrar(original) devuelven promesas.
 */
export default function Categorias({ titulo = 'Categorías', onGuardar, onBorrar, onCerrar }) {
  const [editando, setEditando] = useState(null); // null = lista · {} = nueva · {nombre…} = editar
  const [borrando, setBorrando] = useState(null);  // categoría que se está por borrar
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function borrar(c) {
    setOcupado(true);
    setError('');
    try { await onBorrar(c); setBorrando(null); } catch (e) { setError(e.message); } finally { setOcupado(false); }
  }

  return (
    <div className="velo" onClick={onCerrar}>
      <section className="hoja hoja-alta" role="dialog" aria-label="Categorías" onClick={(e) => e.stopPropagation()}>
        <div className="hoja-asa" />
        {editando ? (
          <Editor
            original={editando}
            onVolver={() => setEditando(null)}
            onGuardar={async (datos) => { await onGuardar(editando, datos); setEditando(null); }}
            onBorrar={async () => { await onBorrar(editando); setEditando(null); }}
          />
        ) : (
          <>
            <h2 className="ajustes-tit">{titulo}</h2>
            <ul className="lista-editar">
              {categorias().map((c) => (
                <li key={c.id || c.nombre}>
                  {borrando?.nombre === c.nombre ? (
                    <div className="fila-borrar">
                      <span>¿Borrar <strong>{c.nombre}</strong>? Sus gastos quedan por clasificar.</span>
                      <div className="confirmar-btns">
                        <button className="btn-sec" onClick={() => setBorrando(null)}>Cancelar</button>
                        <button className="btn-peligro" disabled={ocupado} onClick={() => borrar(c)}>{ocupado ? 'Borrando…' : 'Borrar'}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="fila-cat-edit">
                      <button className="fila-editar" onClick={() => setEditando(c)}>
                        <span className="badge" style={{ '--c': c.color }}><c.Icono size={20} strokeWidth={1.9} color={c.color} /></span>
                        <span className="fila-nombre">{c.nombre}</span>
                        <ChevronRight size={18} color="var(--muted)" />
                      </button>
                      <button className="icono borrar-cat" onClick={() => { setBorrando(c); setError(''); }} aria-label={'Borrar ' + c.nombre}>
                        <Trash2 size={18} strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
            <button className="btn-sec btn-ancho" onClick={() => setEditando({})}>
              <Plus size={18} strokeWidth={2.2} /> Nueva categoría
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function Editor({ original, onVolver, onGuardar, onBorrar }) {
  const nueva = !original.nombre;
  const [nombre, setNombre] = useState(original.nombre || '');
  const [icono, setIcono] = useState(original.icono || 'Tag');
  const [color, setColor] = useState(original.color || COLORES[0]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const Icono = ICONOS[icono] || ICONOS.Tag;

  async function hacer(fn) {
    setGuardando(true);
    setError('');
    try { await fn(); } catch (e) { setError(e.message); setGuardando(false); }
  }

  return (
    <div className="editor-cat">
      <div className="editor-cab">
        <button className="icono" onClick={onVolver} aria-label="Volver"><ChevronLeft size={22} /></button>
        <h2>{nueva ? 'Nueva categoría' : 'Editar categoría'}</h2>
      </div>

      <div className="editor-nombre">
        <span className="badge grande" style={{ '--c': color }}><Icono size={24} strokeWidth={1.9} color={color} /></span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Mascotas)" maxLength={30} autoFocus={nueva} />
      </div>

      <p className="hoja-tit">Color</p>
      <div className="colores">
        {COLORES.map((c) => (
          <button key={c} className={'color' + (c === color ? ' activo' : '')} style={{ '--c': c }} onClick={() => setColor(c)} aria-label={'Color ' + c} />
        ))}
      </div>

      <p className="hoja-tit">Ícono</p>
      <div className="iconos">
        {Object.entries(ICONOS).map(([n, I]) => (
          <button key={n} className={'icono-op' + (n === icono ? ' activo' : '')} style={{ '--c': color }} onClick={() => setIcono(n)} aria-label={n}>
            <I size={20} strokeWidth={1.9} />
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      <button className="btn-primario btn-ancho" disabled={guardando || !nombre.trim()} onClick={() => hacer(() => onGuardar({ nombre: nombre.trim(), icono, color }))}>
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>

      {!nueva && (confirmar ? (
        <div className="confirmar">
          <p>¿Borrar “{original.nombre}”? Sus gastos van a quedar <strong>por clasificar</strong>.</p>
          <div className="confirmar-btns">
            <button className="btn-sec" onClick={() => setConfirmar(false)}>Cancelar</button>
            <button className="btn-peligro" disabled={guardando} onClick={() => hacer(onBorrar)}>Borrar</button>
          </div>
        </div>
      ) : (
        <button className="btn-eliminar" onClick={() => setConfirmar(true)}>Borrar categoría</button>
      ))}
    </div>
  );
}
