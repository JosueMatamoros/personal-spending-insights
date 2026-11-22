import { useCallback, useEffect, useMemo, useState } from 'react';
import Acceso from './components/Acceso.jsx';
import Ajustes from './components/Ajustes.jsx';
import Bloqueo from './components/Bloqueo.jsx';
import Badge from './components/Badge.jsx';
import Categorias from './components/Categorias.jsx';
import Dona from './components/Dona.jsx';
import Grupo from './components/Grupo.jsx';
import HojaCategoria from './components/HojaCategoria.jsx';
import IngresosMes from './components/IngresosMes.jsx';
import NuevoGasto from './components/NuevoGasto.jsx';
import PagosGuias from './components/PagosGuias.jsx';
import { Check, ChevronLeft, ChevronRight, CircleDashed, Compass, HandCoins, Landmark, MapPin, Plus, RefreshCw, ScanFace, Settings, Sprout, UserRound } from 'lucide-react';
import { POR_CLASIFICAR, ZONAS, cat, categorias, idDe, llevaZona, miParte, normalizarCategoria, setCategorias, ubicacionActual } from './lib/categorias.js';
import { iconoPorNombre } from './lib/iconos.js';
import {
  SesionVencida, agregarCobro, borrarCobro, cambiarZona, marcarCobros, borrarCategoria, borrarSesion, cambiarCategoria, cerrarSesion, crearCategoria, crearGasto, crearGrupo,
  editarCategoria, editarGasto, editarGrupo, eliminarGasto, guardarCache, leerCache, leerSesion, moverGasto, obtenerDatos, restaurarGasto, sincronizar,
} from './lib/api.js';
import { K_PREGUNTADO, activarFaceId, faceIdActivo, faceIdDisponible } from './lib/faceid.js';
import { claveMes, colones, nombreComercio, diaDelMes, etiquetaDia, hora, mesDeFecha, moverMes, nombreMes } from './lib/formato.js';

const MES_INICIO = '2026-11';
const RE_BLOQUEO_MS = 2 * 60 * 1000; // vuelve a pedir Face ID si la app estuvo cerrada 2 min
const K_AMBITO = 'misgastos.ambito';
const PERSONAL = 'personal';
// En grupos, "quién pagó" puede ser una persona o la empresa (caja chica)
const CAJA = 'caja';
const pagadorDe = (g) => (g.caja ? CAJA : g.usuarioId);
const pagadoresDe = (grupo) => [...grupo.miembros, { id: CAJA, nombre: 'Caja chica' }];

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
  const [zona, setZona] = useState(null); // personal: ver solo los gastos de una zona ('sin' = sin zona)
  const [zonaCat, setZonaCat] = useState(null); // categoría elegida dentro de la tarjeta de zonas
  const [abiertoDeben, setAbiertoDeben] = useState(null);
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
    // `parte`: lo que de verdad gasté (el total menos lo que otros me deben)
    () => (scope.movimientos || []).map((g) => ({ ...g, categoria: normalizarCategoria(g.categoria), parte: miParte(g) })),
    [scope]  
  );

  function setAmbito(a) {
    setAmbitoEstado(a);
    setFiltro(null);
    setPersona(null);
    setZona(null);
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

  // Sin hacer ruido: al volver a la app y cada minuto trae lo último (guías, gastos del otro, etc.)
  useEffect(() => {
    if (!conectado || bloqueado) return;
    const traer = () => {
      if (document.hidden) return;
      obtenerDatos().then(aplicar).catch((e) => { if (e instanceof SesionVencida) salir(); });
    };
    const t = setInterval(traer, 60000);
    document.addEventListener('visibilitychange', traer);
    window.addEventListener('focus', traer);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', traer);
      window.removeEventListener('focus', traer);
    };
  }, [conectado, bloqueado]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (d) mostrarAviso(cambios.pagadoPor === CAJA ? 'Ahora lo pagó la caja chica' : cambios.pagadoPor === yo ? 'Ahora lo pagaste tú' : `Ahora lo pagó ${quien?.nombre || 'otra persona'}`);
      return;
    }
    await hacer(() => editarGasto(g.id, cambios), { lanzar: true });
    mostrarAviso('Gasto actualizado');
  }

  async function ponerZona(g, z) {
    const d = await hacer(() => cambiarZona(g.id, z), { error: 'No se pudo guardar la zona' });
    if (d) mostrarAviso(z ? `Zona: ${ZONAS.find((x) => x.id === z)?.nombre}` : 'Sin zona');
  }

  async function cobro(accion, x) {
    const g = gastos.find((m) => m.id === editando);
    const fn = accion === 'agregar' ? () => agregarCobro(g.id, x.cobros)
      : accion === 'pagar' ? () => marcarCobros(x.ids, x.pagado)
        : () => borrarCobro(x.id);
    await hacer(fn, { lanzar: true });
    if (accion === 'agregar') {
      const t = x.cobros.reduce((s, k) => s + k.monto, 0);
      mostrarAviso(x.cobros.length === 1 ? `${x.cobros[0].persona} te debe ${colones(t)}` : `Te deben ${colones(t)} entre ${x.cobros.length}`);
    }
  }

  async function pagaron(ids, quien) {
    const d = await hacer(() => marcarCobros(ids, true), { error: 'No se pudo marcar' });
    if (d) mostrarAviso(`${quien} ya te pagó`, 'ok', { texto: 'Deshacer', fn: async () => { setAviso(null); await hacer(() => marcarCobros(ids, false)); } });
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
    // Gasto personal de hoy: la zona sale de dónde está el teléfono (no de lo que diga el nombre)
    const reciente = !grupo && Math.abs(Date.now() - new Date(datosGasto.fecha || Date.now())) < 6 * 3600 * 1000;
    const donde = reciente ? await ubicacionActual() : {};
    await hacer(() => crearGasto({ ...datosGasto, ...donde, grupoId: grupo?.id || null }), { lanzar: true });
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
    const personaSel = grupo && persona && pagadoresDe(grupo).some((m) => m.id === persona) ? persona : null;
    // Lo que todavía no pasó (ej. guías de mañana) no se suma: se muestra aparte como "Próximos"
    const ahora = Date.now();
    const yaPaso = (g) => new Date(g.fecha).getTime() <= ahora;
    const base = (personaSel ? gastos.filter((g) => pagadorDe(g) === personaSel) : gastos);
    const proximos = base.filter((g) => mesDeFecha(g.fecha) === mes && !yaPaso(g)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const delMes = base.filter((g) => mesDeFecha(g.fecha) === mes && yaPaso(g));
    // Si es el mes en curso, compara contra los mismos días del mes anterior
    const delPrev = base.filter((g) => mesDeFecha(g.fecha) === prev && (!esMesActual || diaDelMes(g.fecha) <= hoy.getDate()));
    const suma = (l) => l.reduce((s, g) => s + g.parte, 0);
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
      ? pagadoresDe(grupo).map((m) => ({ ...m, total: suma(delMesTodos.filter((g) => pagadorDe(g) === m.id)) }))
        .filter((m) => m.id !== CAJA || m.total > 0).sort((a, b) => b.total - a.total)
      : [];

    // Por zona (solo personal): supermercado, comida y salidas
    const conZona = grupo ? [] : delMes.filter((g) => llevaZona(g.categoria) && (!zonaCat || g.categoria === zonaCat));
    const catsZona = grupo ? [] : categorias().filter((c) => llevaZona(c.nombre) && delMes.some((g) => g.categoria === c.nombre));
    const porZona = ZONAS.map((z) => ({ ...z, total: suma(conZona.filter((g) => g.zona === z.id)), cantidad: conZona.filter((g) => g.zona === z.id).length }));
    const sinZona = conZona.filter((g) => !g.zona);
    const zonaOk = (g) => !zona || (llevaZona(g.categoria) && (!zonaCat || g.categoria === zonaCat) && (zona === 'sin' ? !g.zona : g.zona === zona));

    const movimientos = delMes
      .filter((g) => (!filtro || g.categoria === filtro) && zonaOk(g))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const dias = [];
    movimientos.forEach((g) => {
      const d = g.fecha.slice(0, 10);
      if (!dias.length || dias[dias.length - 1].dia !== d) dias.push({ dia: d, items: [] });
      dias[dias.length - 1].items.push(g);
    });

    const pendientes = delMes.filter((g) => g.categoria === POR_CLASIFICAR);
    const proximosVisibles = proximos.filter((g) => !filtro || g.categoria === filtro);
    return {
      total, totalPrev, hayPrev, esMesActual, prev, porCat, porPersona, totalGrupo, personaSel, dias, pendientes, proximos: proximosVisibles, cantidad: delMes.length,
      porZona, sinZona, catsZona, hayZona: conZona.length > 0 || Boolean(zonaCat),
    };
  }, [gastos, mes, filtro, grupo, persona, zona, zonaCat]);

  // Te deben (personal, de todos los meses): pendientes agrupados por persona
  const deben = useMemo(() => {
    if (grupo) return [];
    const m = {};
    for (const g of datos.personal.movimientos || []) {
      for (const k of g.cobros || []) {
        if (k.pagado) continue;
        const clave = k.persona.trim().toLowerCase();
        (m[clave] ||= { persona: k.persona.trim(), total: 0, items: [] });
        m[clave].total += k.monto;
        m[clave].items.push({ ...k, comercio: g.comercio, fecha: g.fecha });
      }
    }
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [datos, grupo]);
  const personasDeben = useMemo(() => {
    const s = new Set();
    for (const g of datos.personal.movimientos || []) for (const k of g.cobros || []) s.add(k.persona.trim());
    return [...s].sort();
  }, [datos]);  

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
  const personaInfo = reporte.personaSel && grupo ? pagadoresDe(grupo).find((m) => m.id === reporte.personaSel) : null;
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

      {grupo?.verIngresos && <IngresosMes grupo={grupo} mes={mes} gastado={reporte.totalGrupo} />}

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
                    <span className={'avatar' + (p.id === CAJA ? ' avatar-caja' : '')}>{p.id === CAJA ? <Landmark size={15} strokeWidth={2.2} /> : p.nombre.slice(0, 1)}</span>
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

      {!grupo && deben.length > 0 && (
        <section className="tarjeta categorias deben">
          <h2 className="tit-icono"><HandCoins size={18} strokeWidth={2} color="var(--musgo)" /> Te deben {colones(deben.reduce((s, p) => s + p.total, 0))}</h2>
          <ul className="deben-lista">
            {deben.map((p) => {
              const abierto = abiertoDeben === p.persona;
              return (
                <li key={p.persona}>
                  <button className="deben-persona" onClick={() => setAbiertoDeben(abierto ? null : p.persona)} aria-expanded={abierto}>
                    <span className="avatar">{p.persona.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <strong>{p.persona}</strong>
                      <span className="pequeno muted">{p.items.length} gasto{p.items.length === 1 ? '' : 's'} · toca para ver</span>
                    </span>
                    <span className="num">{colones(p.total)}</span>
                  </button>
                  {abierto && (
                    <>
                      <ul className="deben-items">
                        {p.items.map((k) => (
                          <li key={k.id} className="deben-item">
                            <span>{nombreComercio(k.comercio)} · <span className="muted">{etiquetaDia(k.fecha.slice(0, 10))}</span></span>
                            <span className="num">{colones(k.monto)}</span>
                            <button className="cobro-btn" onClick={() => pagaron([k.id], p.persona)} aria-label="Ya me pagó esto" title="Ya me pagó esto"><Check size={15} strokeWidth={2.6} /></button>
                          </li>
                        ))}
                      </ul>
                      <button className="btn-sec btn-ancho" onClick={() => { setAbiertoDeben(null); pagaron(p.items.map((k) => k.id), p.persona); }}>
                        <Check size={17} strokeWidth={2.4} /> {p.persona} ya me pagó todo
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
            <span className="muted pequeno">{colones(reporte.pendientes.reduce((t, g) => t + g.parte, 0))} · tócalos para elegir su categoría</span>
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

          {!grupo && reporte.hayZona && (() => {
            const cuentan = reporte.porZona.filter((z) => !z.noCuenta);
            const tot = cuentan.reduce((s, z) => s + z.total, 0);
            const fuera = reporte.porZona.filter((z) => z.noCuenta && z.total > 0);
            const verZona = (id) => { setZona(zona === id ? null : id); setFiltro(null); setTimeout(() => document.querySelector('.movs')?.scrollIntoView({ behavior: 'smooth' }), 50); };
            return (
              <section className="tarjeta categorias">
                <h2 className="tit-icono"><MapPin size={17} strokeWidth={2} color="var(--musgo)" /> ¿Dónde gasto más?</h2>
                <div className="zona-filtros">
                  <button className={'chip-mini' + (!zonaCat ? ' activo' : '')} onClick={() => setZonaCat(null)}>Todo</button>
                  {reporte.catsZona.map((c) => (
                    <button key={c.nombre} className={'chip-mini' + (zonaCat === c.nombre ? ' activo' : '')} onClick={() => setZonaCat(zonaCat === c.nombre ? null : c.nombre)}>
                      {c.nombre === 'Comida y restaurantes' ? 'Comida' : c.nombre}
                    </button>
                  ))}
                </div>
                {cuentan.map((z) => {
                  const pct = tot ? Math.round((z.total / tot) * 100) : 0;
                  return (
                    <button key={z.id} className={'zona-fila' + (zona === z.id ? ' activo' : '') + (zona && zona !== z.id ? ' apagado' : '')} style={{ '--c': z.color }} onClick={() => verZona(z.id)}>
                      <span className="zona-punto" />
                      <span className="fila-txt">
                        <span className="fila-nombre">{z.nombre}{z.sub && <span className="muted pequeno"> · {z.sub}</span>}</span>
                        <span className="barra-pct"><span style={{ width: pct + '%' }} /></span>
                      </span>
                      <span className="fila-der">
                        <span className="num">{colones(z.total)}</span>
                        <span className="pequeno muted">{pct}% · {z.cantidad} gasto{z.cantidad === 1 ? '' : 's'}</span>
                      </span>
                    </button>
                  );
                })}
                {fuera.length > 0 && (
                  <p className="muted pequeno zona-extra">
                    No cuentan: {fuera.map((z, i) => <span key={z.id}>{i ? ' · ' : ''}<button className="btn-link" onClick={() => verZona(z.id)}>{z.nombre} {colones(z.total)}</button></span>)}
                  </p>
                )}
                {reporte.sinZona.length > 0 && (
                  <button className="pendientes zona-extra" onClick={() => verZona('sin')}>
                    <MapPin size={20} strokeWidth={2} color="#D9B24C" />
                    <span>
                      <strong>{reporte.sinZona.length} gasto{reporte.sinZona.length === 1 ? '' : 's'} sin zona</strong>
                      <span className="muted pequeno">{colones(reporte.sinZona.reduce((s, g) => s + g.parte, 0))} · tócalos para decir dónde fue</span>
                    </span>
                    <ChevronRight size={18} color="var(--muted)" />
                  </button>
                )}
              </section>
            );
          })()}

          <section className="movs">
            <div className="movs-cab">
              <h2 className="tit-icono">
                {filtro ? <><Badge categoria={filtro} size={15} className="mini-badge" />{filtro}</> : 'Movimientos'}
                {nombrePersona && <span className="chip-persona">{nombrePersona}</span>}
              </h2>
              {zona && !filtro && <span className="chip-persona">{zona === 'sin' ? 'Sin zona' : ZONAS.find((z) => z.id === zona)?.nombre}</span>}
              {(filtro || zona) && <button className="btn-link" onClick={() => { setFiltro(null); setZona(null); }}>Ver todos</button>}
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
                            {grupo ? (g.usuarioId === yo && !g.caja ? 'Tú' : g.quien) + ' · ' : ''}
                            {etiquetaDia(g.fecha.slice(0, 10))} · {hora(g.fecha)}
                          </span>
                        </span>
                        <span className="num mov-monto">{colones(g.parte)}</span>
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
                            {grupo ? (g.usuarioId === yo && !g.caja ? 'Tú' : g.quien) + ' · ' : ''}
                            {g.banco ? `${g.banco}${g.tipo === 'SINPE' ? ' · SINPE' : ''} · ` : ''}
                            {hora(g.fecha)}
                            {!grupo && g.zona && llevaZona(g.categoria) ? ` · ${ZONAS.find((z) => z.id === g.zona)?.nombre}` : ''}
                            {g.categoria === POR_CLASIFICAR ? ' · toca para clasificar' : ''}
                            {g.cobros?.length > 0 && <span className="mov-deben"> · de {colones(g.monto)}</span>}
                          </span>
                        </span>
                        <span className="num mov-monto">{colones(g.parte)}</span>
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
          miembros={grupo ? pagadoresDe(grupo) : []}
          onEliminar={eliminar}
          onZona={ponerZona}
          onCobro={cobro}
          personasDeben={personasDeben}
          onCerrar={() => setEditando(null)}
        />
      )}
      {panel === 'nuevo' && <NuevoGasto ambitoNombre={grupo ? `el grupo ${grupo.nombre}` : 'tus gastos personales'} pagadores={grupo ? pagadoresDe(grupo) : null} yo={yo} onGuardar={agregar} onCerrar={() => setPanel(null)} />}
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
