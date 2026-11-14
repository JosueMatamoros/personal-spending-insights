import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Compass } from 'lucide-react';
import { guiasDelGrupo, pagarGuia } from '../lib/api.js';
import { claveMes, colones, etiquetaDia, moverMes, nombreMes } from '../lib/formato.js';

const MES_INICIO = '2026-11';

/**
 * Guías asignados a cada tour (vienen del sistema de tours) y quién le pagó a cada uno.
 * Al elegir quién pagó se crea el gasto en la categoría Guías del grupo.
 */
export default function PagosGuias({ grupo, yo, mesInicial, onDatos, onCerrar }) {
  const [mes, setMes] = useState(mesInicial < MES_INICIO ? MES_INICIO : mesInicial);
  const [lista, setLista] = useState(null);
  const [precio, setPrecio] = useState(10000);
  const [guardando, setGuardando] = useState(null); // id de la fila que se guarda
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    setLista(null);
    setError('');
    guiasDelGrupo(grupo.id, mes)
      .then((r) => { if (vivo) { setLista(r.guias); setPrecio(r.precio); } })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [grupo.id, mes]);

  async function elegir(fila, pagadoPor, noAplica = false) {
    const igual = noAplica ? fila.noAplica && !fila.pagadoPor : fila.pagadoPor === pagadoPor;
    setGuardando(fila.id);
    setError('');
    try {
      // Tocar la opción ya elegida la desmarca (vuelve a pendiente)
      const r = igual
        ? await pagarGuia(grupo.id, fila.id, { pagadoPor: null, noAplica: false, mes })
        : await pagarGuia(grupo.id, fila.id, { pagadoPor, noAplica, mes });
      setLista(r.guias);
      onDatos(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(null);
    }
  }

  const ahora = new Date();
  const hoy = `${claveMes(ahora)}-${String(ahora.getDate()).padStart(2, '0')}`;
  const pagados = (lista || []).filter((f) => f.pagadoPor);
  const pendientes = (lista || []).filter((f) => !f.pagadoPor && !f.noAplica && f.fecha <= hoy);
  const actual = claveMes(ahora);
  const dias = [];
  for (const f of lista || []) {
    const d = dias[dias.length - 1];
    if (d?.dia === f.fecha) d.items.push(f); else dias.push({ dia: f.fecha, items: [f] });
  }

  return (
    <div className="velo" onClick={onCerrar}>
      <section className="hoja hoja-alta" role="dialog" aria-label="Guías por tour" onClick={(e) => e.stopPropagation()}>
        <div className="hoja-asa" />
        <h2 className="ajustes-tit tit-icono"><Compass size={20} strokeWidth={2} color="var(--musgo)" /> Guías por tour</h2>
        <p className="muted pequeno">Cada guía asignado en el sistema de tours cuesta {colones(precio)}. Elige quién le pagó y se anota como gasto en Guías.</p>

        <nav className="mes mes-hoja">
          <button className="icono" disabled={mes <= MES_INICIO} onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
          <h3>{nombreMes(mes)}</h3>
          <button className="icono" disabled={mes >= actual} onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
        </nav>

        {lista && lista.length > 0 && (
          <p className="guias-resumen">
            <span><strong className="num">{colones(pagados.reduce((t, f) => t + f.monto, 0))}</strong> pagado</span>
            {pendientes.length > 0 && <span className="pendiente">{pendientes.length} sin pagar · {colones(pendientes.length * precio)}</span>}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        {!lista && !error && <p className="muted">Cargando…</p>}
        {lista && lista.length === 0 && <p className="muted">No hay guías asignados en {nombreMes(mes, false).toLowerCase()}.</p>}

        {dias.map((d) => (
          <div key={d.dia} className="dia">
            <p className="dia-tit">{etiquetaDia(d.dia)}</p>
            <ul className="tarjeta lista-guias">
              {d.items.map((f) => {
                const falta = !f.pagadoPor && !f.noAplica && f.fecha <= hoy;
                return (
                  <li key={f.id} className={falta ? 'falta' : ''}>
                    <div className="guia-cab">
                      <span>
                        <strong>{f.guia}</strong>
                        <span className="muted pequeno"> · {f.tour} {f.hora}</span>
                      </span>
                      <span className="num">{colones(f.monto)}</span>
                    </div>
                    <div className="guia-ops" aria-busy={guardando === f.id}>
                      {grupo.miembros.map((m) => (
                        <button key={m.id} className={'opcion' + (f.pagadoPor === m.id ? ' activo' : '')} disabled={guardando === f.id} onClick={() => elegir(f, m.id)}>
                          {m.id === yo ? 'Yo' : m.nombre}
                        </button>
                      ))}
                      <button className={'opcion tenue' + (f.noAplica && !f.pagadoPor ? ' activo' : '')} disabled={guardando === f.id} onClick={() => elegir(f, null, true)}>
                        No se paga
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
