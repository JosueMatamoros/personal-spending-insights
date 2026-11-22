import { useEffect, useState } from 'react';
import { ArrowLeftRight, CalendarDays, Check, CreditCard, HandCoins, Landmark, MapPin, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import Badge from './Badge.jsx';
import { iconoPorNombre } from '../lib/iconos.js';
import { ZONAS, categorias, llevaZona, miParte } from '../lib/categorias.js';
import { colones, escribirMonto, etiquetaDia, hora, leerMonto, nombreComercio } from '../lib/formato.js';
import { BotonMoneda } from './NuevoGasto.jsx';

/**
 * Panel inferior de un gasto: cambiar categoría, mandarlo a un grupo (o
 * devolverlo a personal) y eliminarlo.
 */
export default function HojaCategoria({ gasto, yo, grupos = [], enGrupo, miembros = [], puedePersonal = true, personasDeben = [], onElegir, onMover, onEditar, onEliminar, onZona, onCobro, onCerrar }) {
  const mio = gasto.usuarioId === yo;
  const [confirmar, setConfirmar] = useState(false);
  const editable = gasto.origen === 'manual' && Boolean(onEditar);
  const [editando, setEditando] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  // "Guía Dykember · Horseback Riding 12:00" → título + subtítulo
  const nombre = nombreComercio(gasto.comercio);
  const corte = gasto.tipo === 'Guía' ? nombre.indexOf(' · ') : -1;
  const titulo = corte > 0 ? nombre.slice(0, corte) : nombre;
  const subtitulo = corte > 0 ? nombre.slice(corte + 3) : '';

  const pagoActual = gasto.caja ? 'caja' : gasto.usuarioId;
  async function cambiarPagador(id) {
    if (id === pagoActual) return;
    setCambiando(true);
    try { await onEditar(gasto, { pagadoPor: id }); } catch { /* el aviso ya lo muestra la app */ } finally { setCambiando(false); }
  }

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
          <header className="det">
            <div className="det-top">
              <Badge categoria={gasto.categoria} size={24} className="badge grande" />
              <div className="det-txt">
                <h2>{titulo}</h2>
                {subtitulo && <p className="muted">{subtitulo}</p>}
              </div>
              {editable && (
                <button className="icono lapiz" onClick={() => setEditando(true)} aria-label="Editar descripción y monto" title="Editar">
                  <Pencil size={18} strokeWidth={2.1} />
                </button>
              )}
            </div>
            <p className="det-monto num">{colones(miParte(gasto))}</p>
            {(gasto.cobros || []).length > 0 && (
              <p className="muted pequeno det-parte">Tu parte · pagaste {colones(gasto.monto)} en total</p>
            )}
            <div className="det-meta">
              <span className="meta-pill"><CalendarDays size={14} strokeWidth={2.1} />{etiquetaDia(gasto.fecha)} · {hora(gasto.fecha)}</span>
              <span className="meta-pill">
                {gasto.banco ? <CreditCard size={14} strokeWidth={2.1} /> : <HandCoins size={14} strokeWidth={2.1} />}
                {gasto.banco ? `${gasto.banco}${gasto.tipo === 'SINPE' ? ' · SINPE' : ''}` : gasto.tipo === 'Guía' ? 'Pago de guía' : 'Agregado a mano'}
              </span>
            </div>
          </header>
        )}

        {enGrupo && miembros.length > 0 && !editando && (
          <>
            <p className="hoja-tit">Quién pagó</p>
            <div className="pagadores">
              {(editable ? miembros : miembros.filter((m) => m.id === pagoActual)).map((m) => (
                <button
                  key={m.id}
                  className={'pagador' + (m.id === pagoActual ? ' activo' : '') + (m.id === 'caja' ? ' pagador-caja' : '')}
                  disabled={!editable || cambiando}
                  onClick={() => cambiarPagador(m.id)}
                >
                  <span className="avatar">{m.id === 'caja' ? <Landmark size={15} strokeWidth={2.2} /> : m.nombre.slice(0, 1)}</span>
                  <span className="pagador-nombre">{m.id === yo ? 'Yo' : m.nombre}</span>
                </button>
              ))}
            </div>
            {!editable && <p className="muted pequeno nota-pagador">Viene de {mio ? 'tu' : 'su'} tarjeta, por eso no se puede cambiar.</p>}
          </>
        )}

        {gasto.moneda === 'USD' && (
          <p className="nota">Compra en dólares (${gasto.montoOriginal}), convertida a colones.</p>
        )}
        {!enGrupo && !editando && onZona && llevaZona(gasto.categoria) && (
          <>
            <p className="hoja-tit tit-icono"><MapPin size={13} strokeWidth={2.2} /> ¿Dónde fue?</p>
            <div className="zonas-chips">
              {ZONAS.map((z) => (
                <button
                  key={z.id}
                  className={'chip chip-zona' + (gasto.zona === z.id ? ' activo' : '')}
                  style={{ '--c': z.color }}
                  onClick={() => onZona(gasto, gasto.zona === z.id ? null : z.id)}
                >
                  <span className="chip-txt">{z.nombre}{z.sub && <span className="muted"> · {z.sub}</span>}</span>
                </button>
              ))}
            </div>
            <p className="muted pequeno">Viaje y Ninguna no cuentan en la comparación por zona.</p>
          </>
        )}

        {!enGrupo && !editando && onCobro && (
          <MeDeben gasto={gasto} personas={personasDeben} onCobro={onCobro} />
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
        {gasto.origen !== 'manual' && <p className="muted pequeno">Los próximos gastos de este comercio se van a guardar en la categoría que elijas.</p>}

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
  const [comercio, setComercio] = useState(gasto.comercio);
  const [moneda, setMoneda] = useState(gasto.moneda === 'USD' ? 'USD' : 'CRC');
  const [monto, setMonto] = useState(() => (gasto.moneda === 'USD'
    ? escribirMonto(String(gasto.montoOriginal ?? ''), 'USD')
    : escribirMonto(String(Math.round(gasto.monto)), 'CRC')));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function guardar(e) {
    e.preventDefault();
    const n = leerMonto(monto);
    if (!n) return setError('Escribe el monto');
    if (!comercio.trim()) return setError('Escribe una descripción');
    setGuardando(true);
    setError('');
    try {
      await onGuardar({ comercio: comercio.trim(), monto: n, moneda });
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <form className="editar-gasto" onSubmit={guardar}>
      <p className="hoja-tit" style={{ marginTop: 0 }}>Editar gasto</p>
      <div className="monto-campo">
        <BotonMoneda moneda={moneda} onCambiar={(m) => { setMoneda(m); setMonto(escribirMonto(monto, m)); }} />
        <input value={monto} onChange={(e) => setMonto(escribirMonto(e.target.value, moneda))} inputMode={moneda === 'USD' ? 'decimal' : 'numeric'} aria-label="Monto" />
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

/** Lo que otros me deben de este gasto (no cuenta como gasto mío). */
function MeDeben({ gasto, personas, onCobro }) {
  const cobros = gasto.cobros || [];
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState('iguales'); // 'iguales' | 'cadaquien'
  const [total, setTotal] = useState(2); // cuántos eran, contándome
  const [filas, setFilas] = useState([{ persona: '', monto: '' }]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const libre = miParte(gasto);

  const otros = modo === 'iguales' ? total - 1 : filas.length;
  const cadaUno = Math.round(libre / total);
  const pedido = modo === 'iguales' ? cadaUno * otros : filas.reduce((s, f) => s + (leerMonto(f.monto) || 0), 0);
  const miResto = Math.max(0, libre - pedido);

  function cuantos(n) {
    const t = Math.min(20, Math.max(2, n));
    setTotal(t);
    setFilas((fs) => Array.from({ length: t - 1 }, (_, i) => fs[i] || { persona: '', monto: '' }));
  }
  const cambiar = (i, campo, v) => setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));

  async function correr(fn) {
    setOcupado(true);
    setError('');
    try { await fn(); return true; } catch (e) { setError(e.message); return false; } finally { setOcupado(false); }
  }
  function abrir() {
    setAbierto(true);
    setModo('iguales');
    setTotal(2);
    setFilas([{ persona: '', monto: '' }]);
    setError('');
  }
  async function agregar(e) {
    e.preventDefault();
    const usadas = filas.slice(0, otros);
    if (usadas.some((f) => !f.persona.trim())) return setError('Escribe el nombre de cada persona');
    const lista = usadas.map((f) => ({ persona: f.persona.trim(), monto: modo === 'iguales' ? cadaUno : leerMonto(f.monto) }));
    if (lista.some((k) => !k.monto)) return setError('Falta cuánto paga alguien');
    if (pedido > libre + 1) return setError(`Entre todos no puede pasar de ${colones(libre)}`);
    if (await correr(() => onCobro('agregar', { cobros: lista }))) setAbierto(false);
  }

  return (
    <>
      <p className="hoja-tit tit-icono"><HandCoins size={13} strokeWidth={2.2} /> Me deben</p>
      {cobros.length > 0 && (
        <ul className="cobros">
          {cobros.map((k) => (
            <li key={k.id} className={'cobro' + (k.pagado ? ' pagado' : '')}>
              <span className="avatar">{k.persona.slice(0, 1).toUpperCase()}</span>
              <span className="cobro-txt">
                <strong>{k.persona}</strong>
                <span className="pequeno muted">{k.pagado ? 'Ya te pagó' : 'Pendiente'}</span>
              </span>
              <span className="num">{colones(k.monto)}</span>
              <button
                className={'cobro-btn' + (k.pagado ? ' ok' : '')}
                disabled={ocupado}
                onClick={() => correr(() => onCobro('pagar', { ids: [k.id], pagado: !k.pagado }))}
                aria-label={k.pagado ? 'Marcar como pendiente' : 'Marcar que ya pagó'}
                title={k.pagado ? 'Marcar como pendiente' : 'Ya me pagó'}
              >
                <Check size={16} strokeWidth={2.6} />
              </button>
              <button className="cobro-btn" disabled={ocupado} onClick={() => correr(() => onCobro('borrar', { id: k.id }))} aria-label="Quitar" title="Quitar">
                <X size={16} strokeWidth={2.4} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {abierto ? (
        <form className="cobro-form" onSubmit={agregar}>
          <div className="segmento" role="tablist">
            <button type="button" role="tab" aria-selected={modo === 'iguales'} className={modo === 'iguales' ? 'activo' : ''} onClick={() => { setModo('iguales'); cuantos(total); }}>Partes iguales</button>
            <button type="button" role="tab" aria-selected={modo === 'cadaquien'} className={modo === 'cadaquien' ? 'activo' : ''} onClick={() => setModo('cadaquien')}>Cuánto paga cada quien</button>
          </div>

          {modo === 'iguales' && (
            <>
              <div className="dividir">
                <span className="dividir-txt">
                  <strong>¿Entre cuántos?</strong>
                  <span className="pequeno muted">Contándote a vos</span>
                </span>
                <div className="stepper">
                  <button type="button" onClick={() => cuantos(total - 1)} disabled={total <= 2} aria-label="Uno menos"><Minus size={16} strokeWidth={2.4} /></button>
                  <span className="num">{total}</span>
                  <button type="button" onClick={() => cuantos(total + 1)} disabled={total >= 20} aria-label="Uno más"><Plus size={16} strokeWidth={2.4} /></button>
                </div>
              </div>
              <p className="pequeno dividir-res"><span className="num">{colones(cadaUno)}</span> cada uno</p>
            </>
          )}

          <div className="cobro-filas">
            {filas.slice(0, otros).map((f, i) => (
              <div key={i} className={'cobro-fila' + (modo === 'iguales' ? ' solo-nombre' : '')}>
                <input value={f.persona} onChange={(e) => cambiar(i, 'persona', e.target.value)} placeholder={i === 0 ? 'Quién (ej. Héctor)' : `Persona ${i + 1}`} aria-label={`Nombre de la persona ${i + 1}`} list="personas-deben" maxLength={40} autoFocus={i === 0} />
                {modo === 'iguales'
                  ? <span className="num cobro-fijo">{colones(cadaUno)}</span>
                  : <input value={f.monto} onChange={(e) => cambiar(i, 'monto', escribirMonto(e.target.value, 'CRC'))} placeholder="₡ cuánto" aria-label={`Cuánto paga la persona ${i + 1}`} inputMode="numeric" />}
                {modo === 'cadaquien' && filas.length > 1 && (
                  <button type="button" className="cobro-btn" onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))} aria-label="Quitar persona"><X size={15} strokeWidth={2.4} /></button>
                )}
              </div>
            ))}
          </div>
          <datalist id="personas-deben">{personas.map((p) => <option key={p} value={p} />)}</datalist>
          {modo === 'cadaquien' && filas.length < 20 && (
            <button type="button" className="chip-mini cobro-mas" onClick={() => setFilas((fs) => [...fs, { persona: '', monto: '' }])}>
              <Plus size={14} strokeWidth={2.4} /> Otra persona
            </button>
          )}

          <p className={'pequeno cobro-resumen' + (pedido > libre + 1 ? ' error' : '')}>
            Te deben <span className="num">{colones(pedido)}</span> · tu parte <span className="num">{colones(miResto)}</span>
          </p>
          {error && <p className="error">{error}</p>}
          <div className="confirmar-btns">
            <button type="button" className="btn-sec" onClick={() => { setAbierto(false); setError(''); }}>Cancelar</button>
            <button className="btn-primario" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      ) : (
        <>
          {error && <p className="error">{error}</p>}
          <button className="btn-sec btn-ancho" onClick={abrir}>
            <HandCoins size={17} strokeWidth={2} /> {cobros.length ? 'Alguien más me debe' : 'Dividir con otros'}
          </button>
          {cobros.length === 0 && <p className="muted pequeno">Lo que te deben no cuenta como gasto tuyo.</p>}
        </>
      )}
    </>
  );
}
