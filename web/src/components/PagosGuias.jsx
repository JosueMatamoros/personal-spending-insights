import { useEffect, useState } from 'react';
import { Check, ChevronDown, PartyPopper, X } from 'lucide-react';
import { guiasDelGrupo, pagarGuia } from '../lib/api.js';
import { colones, etiquetaDia } from '../lib/formato.js';

const NO_SE_PAGA = 'no';

/**
 * Guías que todavía no se han pagado (tours de hoy para atrás). Se elige quién
 * pagó (Andrés por defecto) y al confirmar se anota el gasto en Guías.
 */
export default function PagosGuias({ grupo, yo, onDatos, onCerrar }) {
  const andres = grupo.miembros.find((m) => /andr[eé]s/i.test(m.nombre)) || grupo.miembros[0];
  const [lista, setLista] = useState(null);
  const [eleccion, setEleccion] = useState({}); // slotId → usuarioId | 'no'
  const [guardando, setGuardando] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    guiasDelGrupo(grupo.id)
      .then((r) => vivo && setLista(r.guias))
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [grupo.id]);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  async function confirmar(f) {
    const quien = eleccion[f.id] || andres?.id;
    setGuardando(f.id);
    setError('');
    try {
      const r = await pagarGuia(grupo.id, f.id, quien === NO_SE_PAGA ? { pagadoPor: null, noAplica: true } : { pagadoPor: quien });
      setLista(r.guias);
      onDatos(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(null);
    }
  }

  const dias = [];
  for (const f of lista || []) {
    const d = dias[dias.length - 1];
    if (d?.dia === f.fecha) d.items.push(f); else dias.push({ dia: f.fecha, items: [f] });
  }
  const total = (lista || []).reduce((t, f) => t + f.monto, 0);

  return (
    <div className="velo" onClick={onCerrar}>
      <section className="hoja hoja-alta" role="dialog" aria-label="Guías sin pagar" onClick={(e) => e.stopPropagation()}>
        <header className="guias-cab">
          <div>
            <h2>Guías sin pagar</h2>
            {lista && lista.length > 0 && (
              <p className="muted pequeno">{lista.length} guía{lista.length === 1 ? '' : 's'} · <strong className="num">{colones(total)}</strong></p>
            )}
          </div>
          <button className="icono cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={22} strokeWidth={2.2} /></button>
        </header>

        {error && <p className="error">{error}</p>}
        {!lista && !error && <p className="muted">Cargando…</p>}
        {lista && lista.length === 0 && (
          <div className="guias-listo">
            <PartyPopper size={34} strokeWidth={1.6} color="var(--musgo)" />
            <p>Todos los guías están pagados.</p>
          </div>
        )}

        {dias.map((d) => (
          <div key={d.dia} className="guias-dia">
            <p className="dia-tit">{etiquetaDia(d.dia)}</p>
            <ul className="guias-lista">
              {d.items.map((f) => {
                const quien = eleccion[f.id] || andres?.id;
                return (
                  <li key={f.id} className="guia tarjeta">
                    <div className="guia-info">
                      <span className="guia-hora num">{f.hora}</span>
                      <span className="guia-txt">
                        <strong>{f.guia}</strong>
                        <span className="muted pequeno">{f.tour}</span>
                      </span>
                      <span className="num guia-monto">{colones(f.monto)}</span>
                    </div>
                    <div className="guia-pago">
                      <label className="selector">
                        <span className="muted pequeno">Pagó</span>
                        <select value={quien} onChange={(e) => setEleccion({ ...eleccion, [f.id]: e.target.value })} disabled={guardando === f.id}>
                          {grupo.miembros.map((m) => (
                            <option key={m.id} value={m.id}>{m.nombre}{m.id === yo ? ' (yo)' : ''}</option>
                          ))}
                          <option value={NO_SE_PAGA}>No se paga</option>
                        </select>
                        <ChevronDown size={16} className="selector-flecha" />
                      </label>
                      <button className="btn-primario guia-ok" disabled={guardando === f.id} onClick={() => confirmar(f)}>
                        <Check size={17} strokeWidth={2.6} /> {guardando === f.id ? 'Guardando…' : quien === NO_SE_PAGA ? 'Listo' : 'Pagado'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
