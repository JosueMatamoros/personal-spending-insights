import { useEffect, useState } from 'react';
import { ChevronDown, TrendingDown, TrendingUp } from 'lucide-react';
import { ingresosDelGrupo } from '../lib/api.js';
import { colones, nombreMes } from '../lib/formato.js';

const dolares = (n) => '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const tc = (n) => '₡' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const fechaCorta = (ymd) => (ymd ? ymd.slice(8, 10) + '/' + ymd.slice(5, 7) : '');

/**
 * Ingresos del negocio en el mes (según las reservas, como en Finanzas). Al
 * tocarlo muestra la resta contra los gastos y a cuánto se tomó el dólar.
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

  const queda = ing ? ing.crc - gastado : 0;

  return (
    <section className={'ingresos tarjeta' + (abierto ? ' abierto' : '')}>
      <button className="ing-cab" onClick={() => ing && setAbierto(!abierto)} aria-expanded={abierto}>
        <span className="ing-tit">
          <span className="muted">Ingresos de {nombreMes(mes, false).toLowerCase()}</span>
          {ing ? (
            <span className="ing-num num">{colones(ing.crc)} <small>{dolares(ing.usd)}</small></span>
          ) : (
            <span className="ing-num num cargando-txt">₡ …</span>
          )}
        </span>
        <ChevronDown size={20} className="ing-flecha" />
      </button>

      {abierto && ing && (
        <div className="ing-detalle">
          <p className="ing-fila"><span className="muted">Ingresos</span><span className="num">{colones(ing.crc)}</span></p>
          <p className="ing-fila"><span className="muted">Gastos</span><span className="num">− {colones(gastado)}</span></p>
          <p className={'ing-fila ing-queda ' + (queda >= 0 ? 'ing-pos' : 'ing-neg')}>
            <span className="tit-icono">
              {queda >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              {queda >= 0 ? 'Queda' : 'Faltan'}
            </span>
            <span className="num">{colones(Math.abs(queda))}</span>
          </p>
          <p className="ing-dolar pequeno muted">
            Dólar a <strong className="num">{tc(ing.tipoCambio)}</strong>
            {ing.cerrado
              ? ' · guardado al cierre del mes'
              : ing.fechaTipoCambio ? ` · BCCR, compra del ${fechaCorta(ing.fechaTipoCambio)}` : ' · aproximado'}
          </p>
        </div>
      )}
    </section>
  );
}
