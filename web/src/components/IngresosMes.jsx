import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { ingresosDelGrupo } from '../lib/api.js';
import { colones } from '../lib/formato.js';

const dolares = (n) => '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const ORIGEN = { direct: 'Directo', viator: 'Viator', gyg: 'GetYourGuide', localbird: 'Localbird' };

/**
 * Ingresos del negocio en el mes (según las reservas, como en Finanzas) contra
 * los gastos del grupo: cuánto queda. Solo lectura.
 */
export default function IngresosMes({ grupo, mes, gastado }) {
  const [ing, setIng] = useState(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vivo = true;
    setIng(null);
    const traer = () => {
      if (document.hidden) return;
      ingresosDelGrupo(grupo.id, mes).then((r) => vivo && setIng(r)).catch(() => {});
    };
    traer();
    const t = setInterval(traer, 120000);
    document.addEventListener('visibilitychange', traer);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', traer); };
  }, [grupo.id, mes]);

  if (!ing) return <section className="ingresos tarjeta cargando-ing"><p className="muted pequeno">Cargando ingresos…</p></section>;

  const queda = ing.crc - gastado;
  const origenes = Object.entries(ing.porOrigen || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  return (
    <section className="ingresos tarjeta">
      <button className="ing-filas" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <span className="ing-fila">
          <span className="muted">Ingresos del mes</span>
          <span className="num ing-pos">{colones(ing.crc)} <small className="muted">{dolares(ing.usd)}</small></span>
        </span>
        <span className="ing-fila">
          <span className="muted">Gastos</span>
          <span className="num">− {colones(gastado)}</span>
        </span>
        <span className="ing-fila ing-queda">
          <span className="tit-icono">
            {queda >= 0 ? <TrendingUp size={18} color="var(--musgo)" /> : <TrendingDown size={18} color="var(--sube)" />}
            {queda >= 0 ? 'Queda' : 'Faltan'}
          </span>
          <span className={'num ' + (queda >= 0 ? 'ing-pos' : 'ing-neg')}>{colones(Math.abs(queda))}</span>
        </span>
      </button>
      {abierto && (
        <div className="ing-detalle pequeno muted">
          {origenes.map(([k, v]) => (
            <p key={k}><span>{ORIGEN[k] || k}</span><span className="num">{dolares(v)}</span></p>
          ))}
          <p><span>Reservas hasta hoy</span><span className="num">{ing.reservas}</span></p>
          {ing.porVenir > 0 && <p><span>Por venir este mes</span><span className="num">{colones(ing.porVenir)} · {dolares(ing.porVenirUsd)}</span></p>}
          {ing.sinPrecio > 0 && <p><span>Reservas sin precio (no suman)</span><span className="num">{ing.sinPrecio}</span></p>}
          <p className="ing-nota">Tours hasta hoy, igual que en Finanzas. Dólares a ₡{ing.tipoCambio}.</p>
        </div>
      )}
    </section>
  );
}
