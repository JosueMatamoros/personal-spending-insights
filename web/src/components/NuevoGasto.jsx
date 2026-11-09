import { useState } from 'react';
import { categorias } from '../lib/categorias.js';

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Agregar un gasto a mano (efectivo, algo de otra tarjeta, gasto del grupo…). */
export default function NuevoGasto({ ambitoNombre, onGuardar, onCerrar }) {
  const [monto, setMonto] = useState('');
  const [comercio, setComercio] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [categoria, setCategoria] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    const n = Number(String(monto).replace(/[^\d.]/g, ''));
    if (!n) return setError('Escribe el monto');
    if (!comercio.trim()) return setError('Escribe en qué fue el gasto');
    setGuardando(true);
    setError('');
    try {
      // Si es hoy, guarda la hora actual; si es otro día, al mediodía
      const ahora = new Date();
      const f = fecha === hoy() ? ahora : new Date(`${fecha}T12:00:00`);
      await onGuardar({ monto: n, comercio: comercio.trim(), fecha: f.toISOString(), categoriaId: categoria?.id || null });
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <div className="velo" onClick={onCerrar}>
      <form className="hoja" role="dialog" aria-label="Agregar gasto" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <div className="hoja-asa" />
        <h2 className="ajustes-tit">Agregar gasto</h2>
        <p className="muted pequeno">En {ambitoNombre}</p>

        <div className="monto-campo">
          <span>₡</span>
          <input value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))} inputMode="numeric" placeholder="0" aria-label="Monto" autoFocus />
        </div>
        <div className="campos">
          <input value={comercio} onChange={(e) => setComercio(e.target.value)} placeholder="¿En qué fue? (ej. Heno, Gasolina)" aria-label="Descripción" maxLength={120} />
          <input type="date" value={fecha} min="2026-11-01" max={hoy()} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha" />
        </div>

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
