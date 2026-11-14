import { useCallback, useEffect, useMemo, useState } from 'react';
import Acceso from './components/Acceso.jsx';
import Ajustes from './components/Ajustes.jsx';
import Bloqueo from './components/Bloqueo.jsx';
import Badge from './components/Badge.jsx';
import Categorias from './components/Categorias.jsx';
import Dona from './components/Dona.jsx';
import Grupo from './components/Grupo.jsx';
import HojaCategoria from './components/HojaCategoria.jsx';
import NuevoGasto from './components/NuevoGasto.jsx';
import PagosGuias from './components/PagosGuias.jsx';
import { ChevronLeft, ChevronRight, CircleDashed, Compass, Plus, RefreshCw, ScanFace, Settings, Sprout, UserRound } from 'lucide-react';
import { POR_CLASIFICAR, cat, categorias, idDe, normalizarCategoria, setCategorias } from './lib/categorias.js';
import { iconoPorNombre } from './lib/iconos.js';
import {
  SesionVencida, borrarCategoria, borrarSesion, cambiarCategoria, cerrarSesion, crearCategoria, crearGasto, crearGrupo,
  editarCategoria, editarGasto, editarGrupo, eliminarGasto, guardarCache, leerCache, leerSesion, moverGasto, obtenerDatos, restaurarGasto, sincronizar,
} from './lib/api.js';
import { K_PREGUNTADO, activarFaceId, faceIdActivo, faceIdDisponible } from './lib/faceid.js';
import { claveMes, colones, nombreComercio, diaDelMes, etiquetaDia, hora, mesDeFecha, moverMes, nombreMes } from './lib/formato.js';

const MES_INICIO = '2026-11';
const RE_BLOQUEO_MS = 2 * 60 * 1000; // vuelve a pedir Face ID si la app estuvo cerrada 2 min
const K_AMBITO = 'misgastos.ambito';
const PERSONAL = 'personal';

const VACIO = { usuario: null, usuarios: [], personal: { categorias: [], movimientos: [] }, grupos: [] };

function leerAmbito() {
  try { return localStorage.getItem(K_AMBITO) || PERSONAL; } catch { return PERSONAL; }
}

export default function App() {
  const [sesion, setSesion] = useState(leerSesion);
  const [bloqueado, setBloqueado] = useState(() => Boolean(leerSesion()) && faceIdActivo());
  const [datos, setDatos] = useState(() => leerCache() || VACIO);
  const [ambito, setAmbitoEstado] = useState(leerAmbito);
  const [mes, setMes] = useState(() => {
    const actual = claveMes(new Date());
    return actual < MES_INICIO ? MES_INICIO : actual;
  });
  const [filtro, setFiltro] = useState(null);
  const [persona, setPersona] = useState(null); // en grupos: ver solo los gastos de una persona
  const [editando, setEditando] = useState(null);
  const [panel, setPanel] = useState(null); // ajustes | categorias | nuevo | grupo-nuevo | grupo-editar | faceid | guias
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const conectado = Boolean(sesion);
  const yo = datos.usuario?.id || sesion?.usuario?.id;

  // ── Ámbito actual: personal o un grupo ──
  // Cuentas "solo grupos" (ej. Mario Andrés): sin Personal y sin crear grupos
  const soloGrupos = Boolean(datos.usuario?.soloGrupos);
  const ambitoReal = soloGrupos && !datos.grupos.some((g) => g.id === ambito) ? datos.grupos[0]?.id || PERSONAL : ambito;
  const grupo = ambitoReal === PERSONAL ? null : datos.grupos.find((g) => g.id === ambitoReal) || null;
  const scope = grupo || datos.personal;
  const nombreAmbito = grupo ? grupo.nombre : 'Personal';
  // Las categorías activas son las del ámbito (las usan Badge, Dona, las hojas…)
  setCategorias(scope.categorias?.length ? scope.categorias : null);
  const gastos = useMemo(
    () => (scope.movimientos || []).map((g) => ({ ...g, categoria: normalizarCategoria(g.categoria) })),
    [scope]  
  );

  function setAmbito(a) {
    setAmbitoEstado(a);
    setFiltro(null);
    setPersona(null);
    try { localStorage.setItem(K_AMBITO, a); } catch { /* nada */ }
  }

  // Si el grupo guardado ya no existe, vuelve a personal (o al primer grupo si la cuenta es solo de grupos)
  useEffect(() => {
    if (ambitoReal !== ambito) setAmbito(ambitoReal);
    else if (ambito !== PERSONAL && datos.usuario && !datos.grupos.some((g) => g.id === ambito)) setAmbito(PERSONAL);
  }, [datos, ambito, ambitoReal]);

  const aplicar = useCallback((d) => {
    if (!d?.personal) return;
    const limpio = { usuario: d.usuario, usuarios: d.usuarios, personal: d.personal, grupos: d.grupos };
    setDatos(limpio);
    guardarCache(limpio);
  }, []);

  const mostrarAviso = useCallback((texto, tipo = 'ok', accion = null) => {
    setAviso({ texto, tipo, accion, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.accion ? 6000 : 3800);
    return () => clearTimeout(t);
  }, [aviso]);

  function salir() {
    borrarSesion();
    setSesion(null);
    setBloqueado(false);
    setDatos(VACIO);
    setPanel(null);
    if (location.hash === '#demo') history.replaceState(null, '', location.pathname);
  }

  /** Ejecuta una llamada al servidor y aplica la respuesta; maneja errores comunes. */
  async function hacer(fn, { error = 'No se pudo guardar', lanzar = false } = {}) {
    try {
      const d = await fn();
      aplicar(d);
      return d;
    } catch (e) {
      if (e instanceof SesionVencida) { salir(); return null; }
      if (lanzar) throw e;
      mostrarAviso(`${error}: ${e.message}`, 'error');
      return null;
    }
  }

  // Al abrir: trae lo último del servidor
  useEffect(() => {
    if (!conectado) return;
    let vivo = true;
    setCargando(true);
    obtenerDatos()
      .then((d) => vivo && aplicar(d))
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
    const d = await hacer(sincronizar, { error: 'No se pudo actualizar' });
    setCargando(false);
    if (d) mostrarAviso(d.nuevos ? `${d.nuevos} gasto${d.nuevos === 1 ? '' : 's'} nuevo${d.nuevos === 1 ? '' : 's'}` : 'Todo al día');
  }

  async function entrar(d) {
    setSesion(leerSesion());
    aplicar(d);
    let preguntado = false;
    try { preguntado = Boolean(localStorage.getItem(K_PREGUNTADO)); } catch { /* nada */ }
    if (!preguntado && !faceIdActivo() && await faceIdDisponible()) setPanel('faceid');
  }

  async function responderFaceId(si) {
    setPanel(null);
    try { localStorage.setItem(K_PREGUNTADO, '1'); } catch { /* nada */ }
    if (!si) return;
    try {
      await activarFaceId();
      mostrarAviso('Face ID activado');
    } catch {
      mostrarAviso('No se pudo activar Face ID. Puedes intentarlo en Ajustes.', 'error');
    }
  }

  // Enlace directo a un gasto (desde una notificación): #gasto=<id>
  useEffect(() => {
    if (bloqueado || !datos.usuario) return;
    const abrir = () => {
      const m = location.hash.match(/^#gasto=(.+)$/);
      if (!m) return;
      const id = decodeURIComponent(m[1]);
      history.replaceState(null, '', location.pathname + location.search);
      const ambitos = [{ id: PERSONAL, movs: datos.personal.movimientos }, ...datos.grupos.map((g) => ({ id: g.id, movs: g.movimientos }))];
      for (const a of ambitos) {
        const g = a.movs.find((x) => x.id === id);
        if (g) {
          setAmbito(a.id);
          setMes(g.fecha.slice(0, 7));
          setEditando(g.id);
          return;
        }
      }
    };
    abrir();
    window.addEventListener('hashchange', abrir);
    // La notificación con la app ya abierta llega como mensaje del service worker
    const mensaje = (e) => {
      if (e.data?.tipo !== 'abrir') return;
      const hash = new URL(e.data.url).hash;
      if (hash) { location.hash = hash; abrir(); }
    };
    navigator.serviceWorker?.addEventListener('message', mensaje);
    return () => {
      window.removeEventListener('hashchange', abrir);
      navigator.serviceWorker?.removeEventListener('message', mensaje);
    };
  }, [bloqueado, datos]);  

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

  // ── Acciones sobre gastos ──

  async function elegirCategoria(nombre) {
    const g = gastos.find((x) => x.id === editando);
    setEditando(null);
    if (!g || g.categoria === nombre) return;
    const d = await hacer(() => cambiarCategoria(g.id, idDe(nombre)));
    if (!d) return;
    const otros = (d.actualizados || 1) - 1;
    mostrarAviso(otros > 0 ? `Listo. También moví ${otros} gasto${otros === 1 ? '' : 's'} más de ${nombreComercio(g.comercio)}` : `Movido a ${nombre}`);
  }

  async function editarDetalle(g, cambios) {
    if (cambios.pagadoPor) { // cambiar quién pagó: muestra el error como aviso
      const d = await hacer(() => editarGasto(g.id, cambios), { error: 'No se pudo cambiar' });
      const quien = datos.usuarios.find((u) => u.id === cambios.pagadoPor);
      if (d) mostrarAviso(cambios.pagadoPor === yo ? 'Ahora lo pagaste tú' : `Ahora lo pagó ${quien?.nombre || 'otra persona'}`);
      return;
    }
    await hacer(() => editarGasto(g.id, cambios), { lanzar: true });
    mostrarAviso('Gasto actualizado');
  }

  async function mover(g, grupoId) {
    setEditando(null);
    const destino = grupoId ? datos.grupos.find((x) => x.id === grupoId)?.nombre : 'tus gastos personales';
    const d = await hacer(() => moverGasto(g.id, grupoId), { error: 'No se pudo mover' });
    if (d) mostrarAviso(`Movido a ${destino}`, 'ok', { texto: 'Deshacer', fn: async () => { setAviso(null); await hacer(() => moverGasto(g.id, g.grupoId || null)); } });
  }

  async function eliminar(g) {
    setEditando(null);
    const d = await hacer(() => eliminarGasto(g.id), { error: 'No se pudo eliminar' });
    if (d) {
      mostrarAviso('Gasto eliminado', 'ok', {
        texto: 'Deshacer',
        fn: async () => {
          setAviso(null);
          if (await hacer(() => restaurarGasto(g.id))) mostrarAviso('Gasto recuperado');
        },
      });
    }
  }

  async function agregar(datosGasto) {
    await hacer(() => crearGasto({ ...datosGasto, grupoId: grupo?.id || null }), { lanzar: true });
    setPanel(null);
    const m = claveMes(new Date(datosGasto.fecha));
    setMes(m < MES_INICIO ? MES_INICIO : m);
    mostrarAviso('Gasto agregado');
  }

  // ── Categorías del ámbito ──
  async function guardarCat(original, d) {
    await hacer(() => (original.id ? editarCategoria(original.id, d) : crearCategoria(grupo?.id || null, d)), { lanzar: true });
    if (filtro && filtro === original.nombre) setFiltro(d.nombre);
    mostrarAviso(original.id ? 'Categoría actualizada' : `Categoría “${d.nombre}” creada`);
  }

  async function borrarCat(original) {
    const d = await hacer(() => borrarCategoria(original.id), { lanzar: true });
    if (filtro === original.nombre) setFiltro(null);
    if (d) mostrarAviso(d.movidos ? `Borrada · ${d.movidos} gasto${d.movidos === 1 ? '' : 's'} quedaron por clasificar` : 'Categoría borrada');
  }

  // ── Grupos ──
  async function guardarGrupo(d) {
    if (panel === 'grupo-nuevo') {
      const antes = new Set(datos.grupos.map((g) => g.id));
      const r = await hacer(() => crearGrupo(d), { lanzar: true });
      const nuevo = r?.grupos.find((g) => !antes.has(g.id));
      if (nuevo) setAmbito(nuevo.id);
      mostrarAviso(`Grupo “${d.nombre}” creado`);
    } else {
      await hacer(() => editarGrupo(grupo.id, d), { lanzar: true });
      mostrarAviso('Grupo actualizado');
    }
    setPanel(null);
  }

  // ── Cálculos del reporte ──
  const reporte = useMemo(() => {
    const hoy = new Date();
    const esMesActual = mes === claveMes(hoy);
    const prev = moverMes(mes, -1);
    // Persona elegida (solo en grupos): todo el reporte muestra solo sus gastos
    const personaSel = grupo && persona && grupo.miembros.some((m) => m.id === persona) ? persona : null;
    // Lo que todavía no pasó (ej. guías de mañana) no se suma: se muestra aparte como "Próximos"
    const ahora = Date.now();
    const yaPaso = (g) => new Date(g.fecha).getTime() <= ahora;
    const base = (personaSel ? gastos.filter((g) => g.usuarioId === personaSel) : gastos);
    const proximos = base.filter((g) => mesDeFecha(g.fecha) === mes && !yaPaso(g)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const delMes = base.filter((g) => mesDeFecha(g.fecha) === mes && yaPaso(g));
    // Si es el mes en curso, compara contra los mismos días del mes anterior
    const delPrev = base.filter((g) => mesDeFecha(g.fecha) === prev && (!esMesActual || diaDelMes(g.fecha) <= hoy.getDate()));
    const suma = (l) => l.reduce((s, g) => s + g.monto, 0);
    const total = suma(delMes);
    const totalPrev = suma(delPrev);
    const hayPrev = prev >= MES_INICIO;

    const porCat = [...categorias(), { nombre: POR_CLASIFICAR }].map((c) => {
      const t = suma(delMes.filter((g) => g.categoria === c.nombre));
      const tp = suma(delPrev.filter((g) => g.categoria === c.nombre));
      return { nombre: c.nombre, total: t, prev: tp, cantidad: delMes.filter((g) => g.categoria === c.nombre).length };
    }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

    // En grupos: cuánto puso cada quien (siempre todas las personas, para poder cambiar)
    const delMesTodos = gastos.filter((g) => mesDeFecha(g.fecha) === mes && yaPaso(g));
    const totalGrupo = suma(delMesTodos);
    const porPersona = grupo
      ? grupo.miembros.map((m) => ({ ...m, total: suma(delMesTodos.filter((g) => g.usuarioId === m.id)) })).sort((a, b) => b.total - a.total)
      : [];

    const movimientos = delMes
      .filter((g) => !filtro || g.categoria === filtro)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const dias = [];
    movimientos.forEach((g) => {
      const d = g.fecha.slice(0, 10);
      if (!dias.length || dias[dias.length - 1].dia !== d) dias.push({ dia: d, items: [] });
      dias[dias.length - 1].items.push(g);
    });

    const pendientes = delMes.filter((g) => g.categoria === POR_CLASIFICAR);
    const proximosVisibles = proximos.filter((g) => !filtro || g.categoria === filtro);
    return { total, totalPrev, hayPrev, esMesActual, prev, porCat, porPersona, totalGrupo, personaSel, dias, pendientes, proximos: proximosVisibles, cantidad: delMes.length };
  }, [gastos, mes, filtro, grupo, persona]);  

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
  const gastoEditando = editando ? gastos.find((g) => g.id === editando) : null;
  const personaInfo = reporte.personaSel ? grupo?.miembros.find((m) => m.id === reporte.personaSel) : null;
  const nombrePersona = personaInfo ? (personaInfo.id === yo ? 'Tú' : personaInfo.nombre) : null;
  function elegirPersona(id) {
    setPersona((p) => (p === id ? null : id));
    setFiltro(null);
  }

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          <img src="./icon.svg" alt="" />
          <span>Mis Gastos</span>
        </div>
        <div className="barra-acc">
          <button className={'icono' + (cargando ? ' girando' : '')} onClick={refrescar} aria-label="Buscar gastos nuevos" title="Buscar gastos nuevos">
            <RefreshCw size={19} strokeWidth={2} />
          </button>
          <button className="icono" onClick={() => setPanel('ajustes')} aria-label="Ajustes" title="Ajustes">
            <Settings size={19} strokeWidth={2} />
          </button>
        </div>
      </header>

      <nav className="ambitos" aria-label="Personal o grupos">
        {!soloGrupos && (
          <button className={'ambito' + (!grupo ? ' activo' : '')} onClick={() => setAmbito(PERSONAL)}>
            <UserRound size={16} strokeWidth={2} /> Personal
          </button>
        )}
        {datos.grupos.map((g) => {
          const I = iconoPorNombre(g.icono);
          return (
            <button key={g.id} className={'ambito' + (grupo?.id === g.id ? ' activo' : '')} style={{ '--c': g.color }} onClick={() => setAmbito(g.id)}>
              <I size={16} strokeWidth={2} color={g.color} /> {g.nombre}
            </button>
          );
        })}
        {!soloGrupos && (
          <button className="ambito nuevo" onClick={() => setPanel('grupo-nuevo')} aria-label="Crear grupo">
            <Plus size={16} strokeWidth={2.2} /> Grupo
          </button>
        )}
      </nav>

      <nav className="mes">
        <button className="icono" disabled={!puedeAtras} onClick={() => { setMes(moverMes(mes, -1)); setFiltro(null); }} aria-label="Mes anterior"><ChevronLeft size={22} /></button>
        <h1>{nombreMes(mes)}</h1>
        <button className="icono" disabled={!puedeAdelante} onClick={() => { setMes(moverMes(mes, 1)); setFiltro(null); }} aria-label="Mes siguiente"><ChevronRight size={22} /></button>
      </nav>

      <section className="total tarjeta">
        <p className="muted">{personaInfo ? `${personaInfo.id === yo ? 'Pagado por ti' : `Pagado por ${personaInfo.nombre}`} en ${grupo.nombre}` : grupo ? `Gastado en ${grupo.nombre}` : 'Total gastado'}</p>
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
        {grupo && reporte.totalGrupo > 0 && (
          <ul className="personas" aria-label="Filtrar por persona">
            {reporte.porPersona.map((p) => {
              const activo = reporte.personaSel === p.id;
              return (
                <li key={p.id}>
                  <button
                    className={'persona' + (activo ? ' activo' : '') + (reporte.personaSel && !activo ? ' apagado' : '')}
                    onClick={() => elegirPersona(p.id)}
                    aria-pressed={activo}
                  >
                    <span className="avatar">{p.nombre.slice(0, 1)}</span>
                    <span className="persona-nombre">{p.id === yo ? 'Tú' : p.nombre}</span>
                    <span className="num">{colones(p.total)}</span>
                  </button>
                </li>
              );
            })}
            <li className="personas-ayuda pequeno muted">
              {reporte.personaSel
                ? <>Viendo solo lo de {nombrePersona === 'Tú' ? 'ti' : nombrePersona} · <button className="btn-link" onClick={() => setPersona(null)}>Ver todos</button></>
                : 'Toca una persona para ver solo sus gastos'}
            </li>
          </ul>
        )}
      </section>

      {grupo?.pagosGuias && grupo.guiasPendientes > 0 && (
        <button className="pendientes tarjeta" onClick={() => setPanel('guias')}>
          <Compass size={22} strokeWidth={2} color="#D9B24C" />
          <span>
            <strong>{grupo.guiasPendientes} guía{grupo.guiasPendientes === 1 ? '' : 's'} sin pagar</strong>
            <span className="muted pequeno">{colones(grupo.guiasPendientes * 10000)} · toca para marcar quién pagó</span>
          </span>
          <ChevronRight size={18} color="var(--muted)" />
        </button>
      )}

      {reporte.pendientes.length > 0 && filtro !== POR_CLASIFICAR && (
        <button className="pendientes tarjeta" onClick={() => { setFiltro(POR_CLASIFICAR); setTimeout(() => document.querySelector('.movs')?.scrollIntoView({ behavior: 'smooth' }), 50); }}>
          <CircleDashed size={22} strokeWidth={2} color="#D9B24C" />
          <span>
            <strong>{reporte.pendientes.length} gasto{reporte.pendientes.length === 1 ? '' : 's'} por clasificar</strong>
            <span className="muted pequeno">{colones(reporte.pendientes.reduce((t, g) => t + g.monto, 0))} · tócalos para elegir su categoría</span>
          </span>
          <ChevronRight size={18} color="var(--muted)" />
        </button>
      )}

      {reporte.cantidad === 0 && reporte.proximos.length === 0 ? (
        <section className="vacio tarjeta">
          <Sprout size={34} strokeWidth={1.6} color="var(--musgo)" />
          <p>{cargando ? 'Buscando gastos…' : nombrePersona ? `${nombrePersona === 'Tú' ? 'No pagaste' : `${nombrePersona} no pagó`} gastos de este grupo este mes.` : grupo ? 'Todavía no hay gastos en este grupo este mes.' : 'Todavía no hay gastos este mes.'}</p>
          {!cargando && (grupo
            ? <button className="btn-sec" onClick={() => setPanel('nuevo')}>Agregar un gasto</button>
            : <button className="btn-sec" onClick={refrescar}>Buscar en el correo</button>)}
        </section>
      ) : (
        <>
          {reporte.cantidad > 0 && (
            <section className="tarjeta categorias">
              <h2>Por categoría</h2>
              <Dona
                partes={reporte.porCat}
                total={reporte.total}
                seleccion={filtro}
                onSeleccion={setFiltro}
                centro={filtro ? { valor: colones(totalFiltro), etiqueta: filtro === POR_CLASIFICAR ? 'por clasificar' : filtro.split(' ')[0].toLowerCase() } : { valor: reporte.cantidad, etiqueta: reporte.cantidad === 1 ? 'movimiento' : 'movimientos' }}
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
                        <Badge categoria={c.nombre} />
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
          )}

          <section className="movs">
            <div className="movs-cab">
              <h2 className="tit-icono">
                {filtro ? <><Badge categoria={filtro} size={15} className="mini-badge" />{filtro}</> : 'Movimientos'}
                {nombrePersona && <span className="chip-persona">{nombrePersona}</span>}
              </h2>
              {filtro && <button className="btn-link" onClick={() => setFiltro(null)}>Ver todos</button>}
            </div>
            {reporte.proximos.length > 0 && (
              <div className="dia">
                <p className="dia-tit">Próximos · todavía no se suman</p>
                <ul className="tarjeta lista-mov proximos">
                  {reporte.proximos.map((g) => (
                    <li key={g.id}>
                      <button className="mov" onClick={() => setEditando(g.id)}>
                        <Badge categoria={g.categoria} />
                        <span className="mov-txt">
                          <span className="mov-nombre">{nombreComercio(g.comercio)}</span>
                          <span className="pequeno muted">
                            {grupo ? (g.usuarioId === yo ? 'Tú' : g.quien) + ' · ' : ''}
                            {etiquetaDia(g.fecha.slice(0, 10))} · {hora(g.fecha)}
                          </span>
                        </span>
                        <span className="num mov-monto">{colones(g.monto)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {reporte.dias.map((d) => (
              <div key={d.dia} className="dia">
                <p className="dia-tit">{etiquetaDia(d.dia)}</p>
                <ul className="tarjeta lista-mov">
                  {d.items.map((g) => (
                    <li key={g.id}>
                      <button className="mov" onClick={() => setEditando(g.id)}>
                        <Badge categoria={g.categoria} />
                        <span className="mov-txt">
                          <span className="mov-nombre">{nombreComercio(g.comercio)}</span>
                          <span className="pequeno muted">
                            {grupo ? (g.usuarioId === yo ? 'Tú' : g.quien) + ' · ' : ''}
                            {g.banco ? `${g.banco}${g.tipo === 'SINPE' ? ' · SINPE' : ''} · ` : ''}
                            {hora(g.fecha)}
                            {g.categoria === POR_CLASIFICAR ? ' · toca para clasificar' : ''}
                          </span>
                        </span>
                        <span className="num mov-monto">{colones(g.monto)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}

      <button className="fab" onClick={() => setPanel('nuevo')} aria-label="Agregar gasto">
        <Plus size={26} strokeWidth={2.4} />
      </button>

      {gastoEditando && (
        <HojaCategoria
          gasto={gastoEditando}
          yo={yo}
          grupos={datos.grupos}
          enGrupo={Boolean(grupo)}
          puedePersonal={!soloGrupos}
          onElegir={elegirCategoria}
          onMover={mover}
          onEditar={editarDetalle}
          miembros={grupo?.miembros || []}
          onEliminar={eliminar}
          onCerrar={() => setEditando(null)}
        />
      )}
      {panel === 'nuevo' && <NuevoGasto ambitoNombre={grupo ? `el grupo ${grupo.nombre}` : 'tus gastos personales'} onGuardar={agregar} onCerrar={() => setPanel(null)} />}
      {panel === 'guias' && grupo?.pagosGuias && (
        <PagosGuias grupo={grupo} yo={yo} onDatos={aplicar} onCerrar={() => setPanel(null)} />
      )}
      {panel === 'categorias' && (
        <Categorias titulo={grupo ? `Categorías · ${grupo.nombre}` : 'Categorías'} onGuardar={guardarCat} onBorrar={borrarCat} onCerrar={() => setPanel(null)} />
      )}
      {(panel === 'grupo-nuevo' || panel === 'grupo-editar') && (
        <Grupo
          grupo={panel === 'grupo-editar' ? grupo : null}
          usuarios={datos.usuarios}
          yo={yo}
          onGuardar={guardarGrupo}
          onCerrar={() => setPanel(null)}
        />
      )}
      {panel === 'ajustes' && (
        <Ajustes
          sesion={sesion}
          ambitoNombre={nombreAmbito}
          grupo={grupo}
          avisar={mostrarAviso}
          onCerrar={() => setPanel(null)}
          onCategorias={() => setPanel('categorias')}
          onGrupo={() => setPanel('grupo-editar')}
          onCerrarSesion={() => { cerrarSesion(); salir(); }}
        />
      )}
      {panel === 'faceid' && (
        <div className="velo">
          <section className="hoja hoja-faceid" role="dialog" aria-label="Activar Face ID">
            <div className="hoja-asa" />
            <ScanFace className="faceid-emoji" size={40} strokeWidth={1.5} color="var(--musgo)" />
            <h2>¿Usar Face ID para abrir Mis Gastos?</h2>
            <p className="muted">Así nadie más puede ver tus gastos aunque tenga tu celular desbloqueado. Tu sesión queda activa por un mes.</p>
            <div className="confirmar-btns">
              <button className="btn-sec" onClick={() => responderFaceId(false)}>Ahora no</button>
              <button className="btn-primario" onClick={() => responderFaceId(true)}>Activar Face ID</button>
            </div>
          </section>
        </div>
      )}
      {aviso && (
        <div key={aviso.id} className={'aviso ' + aviso.tipo} role="status">
          <span>{aviso.texto}</span>
          {aviso.accion && <button className="aviso-accion" onClick={aviso.accion.fn}>{aviso.accion.texto}</button>}
        </div>
      )}
    </div>
  );
}
