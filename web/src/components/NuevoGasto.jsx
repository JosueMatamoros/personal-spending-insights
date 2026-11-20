import { useState } from 'react';
import { Landmark, X } from 'lucide-react';
import { categorias } from '../lib/categorias.js';
import { escribirMonto, leerMonto } from '../lib/formato.js';

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Agregar un gasto a mano (efectivo, algo de otra tarjeta, gasto del grupo…). */
export default function NuevoGasto({ ambitoNombre, pagadores = null, yo, onGuardar, onCerrar }) {
  const [pagadoPor, setPagadoPor] = useState(yo);
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState('CRC');
  const [comercio, setComercio] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [categoria, setCategoria] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    const n = leerMonto(monto);
    if (!n) return setError('Escribe el monto');
    if (!comercio.trim()) return setError('Escribe una descripción');
    setGuardando(true);
    setError('');
    try {
      // Si es hoy, guarda la hora actual; si es otro día, al mediodía
      const ahora = new Date();
      const f = fecha === hoy() ? ahora : new Date(`${fecha}T12:00:00`);
      await onGuardar({ monto: n, comercio: comercio.trim(), fecha: f.toISOString(), categoriaId: categoria?.id || null, moneda, ...(pagadores ? { pagadoPor } : {}) });
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <div className="velo" onClick={onCerrar}>
      <form className="hoja" role="dialog" aria-label="Agregar gasto" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <div className="hoja-asa" />
        <header className="hoja-cab">
          <div>
            <h2 className="ajustes-tit">Agregar gasto</h2>
            <p className="muted pequeno">En {ambitoNombre}</p>
          </div>
          <button type="button" className="icono cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={22} strokeWidth={2.2} /></button>
        </header>

        <div className="monto-campo">
          <BotonMoneda moneda={moneda} onCambiar={(m) => { setMoneda(m); setMonto(escribirMonto(monto, m)); }} />
          <input value={monto} onChange={(e) => setMonto(escribirMonto(e.target.value, moneda))} inputMode={moneda === 'USD' ? 'decimal' : 'numeric'} placeholder="0" aria-label="Monto" autoFocus />
        </div>
        <div className="campos">
          <input value={comercio} onChange={(e) => setComercio(e.target.value)} placeholder="Descripción" aria-label="Descripción" maxLength={120} />
          <input type="date" value={fecha} min="2026-11-01" max={hoy()} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" />
        </div>

        {pagadores && (
          <>
            <p className="hoja-tit">Quién pagó</p>
            <div className="pagadores">
              {pagadores.map((m) => (
                <button type="button" key={m.id} className={'pagador' + (m.id === pagadoPor ? ' activo' : '') + (m.id === 'caja' ? ' pagador-caja' : '')} onClick={() => setPagadoPor(m.id)}>
                  <span className="avatar">{m.id === 'caja' ? <Landmark size={15} strokeWidth={2.2} /> : m.nombre.slice(0, 1)}</span>
                  <span className="pagador-nombre">{m.id === yo ? 'Yo' : m.nombre}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <p className="hoja-tit">Categoría</p>
        <div className="hoja-grid">
          {categorias().map((c) => (
            <button type="button" key={c.id || c.nombre} className={'chip' + (categoria?.nombre === c.nombre ? ' activo' : '')} style={{ '--c': c.color }} onClick={() => setCategoria(categoria?.nombre === c.nombre ? null : c)}>
              <c.Icono size={18} strokeWidth={1.9} color={c.color} />
              <span className="chip-txt">{c.nombre}</span>
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn-primario btn-ancho" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar gasto'}</button>
      </form>
    </div>
  );
}

/** El símbolo del monto: al tocarlo cambia entre colones y dólares. */
export function BotonMoneda({ moneda, onCambiar }) {
  const usd = moneda === 'USD';
  return (
    <button type="button" className="moneda-btn" onClick={() => onCambiar(usd ? 'CRC' : 'USD')} aria-label={usd ? 'En dólares, tocar para colones' : 'En colones, tocar para dólares'} title="Cambiar moneda">
      {usd ? '$' : '₡'}
    </button>
  );
}
