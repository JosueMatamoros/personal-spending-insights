import { useCallback, useEffect, useMemo, useState } from 'react';
import Acceso from './components/Acceso.jsx';
import Ajustes from './components/Ajustes.jsx';
import Bloqueo from './components/Bloqueo.jsx';
import Dona from './components/Dona.jsx';
import HojaCategoria from './components/HojaCategoria.jsx';
import { CATEGORIAS, cat } from './lib/categorias.js';
import { SesionVencida, borrarSesion, cambiarCategoria, cerrarSesion, guardarCache, leerCache, leerSesion, obtenerGastos, sincronizar } from './lib/api.js';
import { K_PREGUNTADO, activarFaceId, faceIdActivo, faceIdDisponible } from './lib/faceid.js';
import { claveMes, colones, nombreComercio, diaDelMes, etiquetaDia, hora, mesDeFecha, moverMes, nombreMes } from './lib/formato.js';

const MES_INICIO = '2026-11';
const RE_BLOQUEO_MS = 2 * 60 * 1000; // vuelve a pedir Face ID si la app estuvo cerrada 2 min

export default function App() {
  const [sesion, setSesion] = useState(leerSesion);
  const [bloqueado, setBloqueado] = useState(() => Boolean(leerSesion()) && faceIdActivo());
  const [ajustes, setAjustes] = useState(false);
  const [ofrecerFaceId, setOfrecerFaceId] = useState(false);
  const [gastos, setGastos] = useState(() => leerCache()?.gastos || []);
  const [mes, setMes] = useState(() => {
    const actual = claveMes(new Date());
    return actual < MES_INICIO ? MES_INICIO : actual;
  });
  const [filtro, setFiltro] = useState(null);
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const conectado = Boolean(sesion);

  const actualizar = useCallback((lista) => {
    setGastos(lista);
    guardarCache(lista);
  }, []);

  const mostrarAviso = useCallback((texto, tipo = 'ok') => {
    setAviso({ texto, tipo, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3800);
    return () => clearTimeout(t);
  }, [aviso]);

  // Al abrir: trae lo último de la hoja
  useEffect(() => {
    if (!conectado) return;
    let vivo = true;
    setCargando(true);
    obtenerGastos()
      .then((d) => vivo && actualizar(d.gastos))
      .catch((e) => {
        if (!vivo) return;
        if (e instanceof SesionVencida) salir();
        else mostrarAviso(e.message, 'error');
      })
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [conectado]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refrescar() {
    if (cargando) return;
    setCargando(true);
    try {
      const d = await sincronizar();
      actualizar(d.gastos);
      mostrarAviso(d.nuevos ? `${d.nuevos} gasto${d.nuevos === 1 ? '' : 's'} nuevo${d.nuevos === 1 ? '' : 's'} 🌿` : 'Todo al día ✓');
    } catch (e) {
      if (e instanceof SesionVencida) salir();
      else mostrarAviso(e.message, 'error');
    } finally {
      setCargando(false);
    }
  }

  function salir() {
    borrarSesion();
    setSesion(null);
    setBloqueado(false);
    setGastos([]);
    setAjustes(false);
    if (location.hash === '#demo') history.replaceState(null, '', location.pathname);
  }

  async function entrar(lista) {
    setSesion(leerSesion());
    actualizar(lista);
    // Ofrece Face ID una sola vez después del primer ingreso
    let preguntado = false;
    try { preguntado = Boolean(localStorage.getItem(K_PREGUNTADO)); } catch { /* nada */ }
    if (!preguntado && !faceIdActivo() && await faceIdDisponible()) setOfrecerFaceId(true);
  }

  async function responderFaceId(si) {
    setOfrecerFaceId(false);
    try { localStorage.setItem(K_PREGUNTADO, '1'); } catch { /* nada */ }
    if (!si) return;
    try {
      await activarFaceId();
      mostrarAviso('Face ID activado 🔒');
    } catch {
      mostrarAviso('No se pudo activar Face ID. Puedes intentarlo en Ajustes.', 'error');
    }
  }

  // Vuelve a bloquear con Face ID si la app estuvo en segundo plano un rato
  useEffect(() => {
    let oculto = 0;
    const cambio = () => {
      if (document.hidden) oculto = Date.now();
      else if (oculto && Date.now() - oculto > RE_BLOQUEO_MS && faceIdActivo() && leerSesion()) setBloqueado(true);
    };
    document.addEventListener('visibilitychange', cambio);
    return () => document.removeEventListener('visibilitychange', cambio);
  }, []);

  async function elegirCategoria(categoria) {
    const g = editando;
    setEditando(null);
    if (!g || g.categoria === categoria) return;
    const anterior = gastos;
    actualizar(gastos.map((x) => (x.id === g.id ? { ...x, categoria } : x)));
    try {
      const d = await cambiarCategoria(g.id, categoria);
      actualizar(d.gastos);
      const otros = d.actualizados - 1;
      mostrarAviso(otros > 0 ? `Listo. También moví ${otros} gasto${otros === 1 ? '' : 's'} más de ${nombreComercio(g.comercio)}` : `Movido a ${cat(categoria).emoji} ${categoria}`);
    } catch (e) {
      actualizar(anterior);
      if (e instanceof SesionVencida) return salir();
      mostrarAviso('No se pudo guardar: ' + e.message, 'error');
    }
  }

  // ── Cálculos del reporte ──
  const reporte = useMemo(() => {
    const hoy = new Date();
    const esMesActual = mes === claveMes(hoy);
    const prev = moverMes(mes, -1);
    const delMes = gastos.filter((g) => mesDeFecha(g.fecha) === mes);
    // Si es el mes en curso, compara contra los mismos días del mes anterior
    const delPrev = gastos.filter((g) => mesDeFecha(g.fecha) === prev && (!esMesActual || diaDelMes(g.fecha) <= hoy.getDate()));
    const suma = (l) => l.reduce((s, g) => s + g.monto, 0);
    const total = suma(delMes);
    const totalPrev = suma(delPrev);
    const hayPrev = prev >= MES_INICIO;

    const porCat = CATEGORIAS.map((c) => {
      const t = suma(delMes.filter((g) => g.categoria === c.nombre));
      const tp = suma(delPrev.filter((g) => g.categoria === c.nombre));
      return { nombre: c.nombre, total: t, prev: tp, cantidad: delMes.filter((g) => g.categoria === c.nombre).length };
    }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

    const movimientos = delMes
      .filter((g) => !filtro || g.categoria === filtro)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const dias = [];
    movimientos.forEach((g) => {
      const d = g.fecha.slice(0, 10);
      if (!dias.length || dias[dias.length - 1].dia !== d) dias.push({ dia: d, items: [] });
      dias[dias.length - 1].items.push(g);
    });

    return { total, totalPrev, hayPrev, esMesActual, prev, porCat, dias, cantidad: delMes.length, cantidadFiltro: movimientos.length };
  }, [gastos, mes, filtro]);

  if (!conectado) {
    return <Acceso onEntrar={entrar} />;
  }
  if (bloqueado) {
    return <Bloqueo onDesbloquear={() => setBloqueado(false)} onUsarContrasena={salir} />;
  }

  const mesMax = claveMes(new Date());
  const puedeAtras = mes > MES_INICIO;
  const puedeAdelante = mes < mesMax;
  const cambio = reporte.totalPrev > 0 ? (reporte.total - reporte.totalPrev) / reporte.totalPrev : null;
  const totalFiltro = filtro ? reporte.porCat.find((c) => c.nombre === filtro)?.total || 0 : null;

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          <img src="./icon.svg" alt="" />
          <span>Mis Gastos</span>
        </div>
        <div className="barra-acc">
          <button className={'icono' + (cargando ? ' girando' : '')} onClick={refrescar} aria-label="Buscar gastos nuevos" title="Buscar gastos nuevos">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="icono" onClick={() => setAjustes(true)} aria-label="Ajustes" title="Ajustes">
            <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </header>

      <nav className="mes">
        <button className="icono" disabled={!puedeAtras} onClick={() => { setMes(moverMes(mes, -1)); setFiltro(null); }} aria-label="Mes anterior">‹</button>
        <h1>{nombreMes(mes)}</h1>
        <button className="icono" disabled={!puedeAdelante} onClick={() => { setMes(moverMes(mes, 1)); setFiltro(null); }} aria-label="Mes siguiente">›</button>
      </nav>

      <section className="total tarjeta">
        <p className="muted">Total gastado</p>
        <p className="total-num num">{colones(reporte.total)}</p>
        {cambio !== null ? (
          <p className={'cambio ' + (cambio > 0 ? 'sube' : 'baja')}>
            <span className="cambio-pill">{cambio > 0 ? '▲' : '▼'} {Math.abs(Math.round(cambio * 100))}%</span>
            <span className="muted">
              {cambio > 0 ? 'más' : 'menos'} que {reporte.esMesActual ? `los mismos días de ${nombreMes(reporte.prev, false).toLowerCase()}` : nombreMes(reporte.prev, false).toLowerCase()}
              {' '}({colones(reporte.totalPrev)})
            </span>
          </p>
        ) : (
          <p className="muted pequeno">{reporte.hayPrev ? `Sin gastos en ${nombreMes(reporte.prev, false).toLowerCase()} para comparar` : 'Primer mes registrado · el próximo mes verás la comparación'}</p>
        )}
      </section>

      {reporte.cantidad === 0 ? (
        <section className="vacio tarjeta">
          <p className="vacio-emoji">🌱</p>
          <p>{cargando ? 'Buscando tus gastos…' : 'Todavía no hay gastos este mes.'}</p>
          {!cargando && <button className="btn-sec" onClick={refrescar}>Buscar en el correo</button>}
        </section>
      ) : (
        <>
          <section className="tarjeta categorias">
            <h2>Por categoría</h2>
            <Dona
              partes={reporte.porCat}
              total={reporte.total}
              seleccion={filtro}
              onSeleccion={setFiltro}
              centro={filtro ? { valor: colones(totalFiltro), etiqueta: cat(filtro).emoji + ' ' + filtro.split(' ')[0] } : { valor: reporte.cantidad, etiqueta: reporte.cantidad === 1 ? 'movimiento' : 'movimientos' }}
            />
            <ul className="lista-cat">
              {reporte.porCat.map((c) => {
                const info = cat(c.nombre);
                const pct = Math.round((c.total / reporte.total) * 100);
                const dif = c.total - c.prev;
                const activo = filtro === c.nombre;
                return (
                  <li key={c.nombre}>
                    <button className={'fila-cat' + (activo ? ' activo' : '') + (filtro && !activo ? ' apagado' : '')} onClick={() => setFiltro(activo ? null : c.nombre)} style={{ '--c': info.color }}>
                      <span className="badge">{info.emoji}</span>
                      <span className="fila-txt">
                        <span className="fila-nombre">{c.nombre}</span>
                        <span className="barra-pct"><span style={{ width: pct + '%' }} /></span>
                      </span>
                      <span className="fila-der">
                        <span className="num">{colones(c.total)}</span>
                        <span className="pequeno muted">
                          {pct}%
                          {reporte.totalPrev > 0 && dif !== 0 && (
                            <span className={dif > 0 ? 'sube' : 'baja'}> · {dif > 0 ? '▲' : '▼'}{colones(Math.abs(dif))}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="movs">
            <div className="movs-cab">
              <h2>{filtro ? `${cat(filtro).emoji} ${filtro}` : 'Movimientos'}</h2>
              {filtro && <button className="btn-link" onClick={() => setFiltro(null)}>Ver todos</button>}
            </div>
            {reporte.dias.map((d) => (
              <div key={d.dia} className="dia">
                <p className="dia-tit">{etiquetaDia(d.dia)}</p>
                <ul className="tarjeta lista-mov">
                  {d.items.map((g) => {
                    const info = cat(g.categoria);
                    return (
                      <li key={g.id}>
                        <button className="mov" onClick={() => setEditando(g)}>
                          <span className="badge" style={{ '--c': info.color }}>{info.emoji}</span>
                          <span className="mov-txt">
                            <span className="mov-nombre">{nombreComercio(g.comercio)}</span>
                            <span className="pequeno muted">{g.banco}{g.tipo === 'SINPE' ? ' · SINPE' : ''} · {hora(g.fecha)}{g.categoria === 'Otros' ? ' · toca para clasificar' : ''}</span>
                          </span>
                          <span className="num mov-monto">{colones(g.monto)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}

      {editando && <HojaCategoria gasto={editando} onElegir={elegirCategoria} onCerrar={() => setEditando(null)} />}
      {ajustes && (
        <Ajustes
          sesion={sesion}
          avisar={mostrarAviso}
          onCerrar={() => setAjustes(false)}
          onCerrarSesion={async () => { await cerrarSesion(); salir(); }}
        />
      )}
      {ofrecerFaceId && (
        <div className="velo">
          <section className="hoja hoja-faceid" role="dialog" aria-label="Activar Face ID">
            <div className="hoja-asa" />
            <p className="faceid-emoji">🔒</p>
            <h2>¿Usar Face ID para abrir Mis Gastos?</h2>
            <p className="muted">Así nadie más puede ver tus gastos aunque tenga tu celular desbloqueado. Tu sesión queda activa por un mes.</p>
            <div className="confirmar-btns">
              <button className="btn-sec" onClick={() => responderFaceId(false)}>Ahora no</button>
              <button className="btn-primario" onClick={() => responderFaceId(true)}>Activar Face ID</button>
            </div>
          </section>
        </div>
      )}
      {aviso && <div key={aviso.id} className={'aviso ' + aviso.tipo} role="status">{aviso.texto}</div>}
    </div>
  );
}
