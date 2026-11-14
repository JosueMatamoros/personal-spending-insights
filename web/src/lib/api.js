import { demo } from './demo.js';

// Base del backend: https://<backend>.onrender.com/api/gastos
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const K_SESION = 'misgastos.sesion.v2';
const K_CACHE = 'misgastos.datos.v2';

function leer(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
}
function escribir(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
}

// ── Sesión ──
export const esDemo = () => typeof location !== 'undefined' && location.hash === '#demo';

export function leerSesion() {
  if (esDemo()) return { token: 'demo', expira: Infinity, demo: true, usuario: { id: 'u-josue', nombre: 'Josué' } };
  const s = leer(K_SESION);
  return s && s.expira > Date.now() ? s : null;
}
export function borrarSesion() {
  escribir(K_SESION, null);
  escribir(K_CACHE, null);
  try { localStorage.removeItem('misgastos.sesion'); localStorage.removeItem('misgastos.cache'); } catch { /* nada */ }
}

export const leerCache = () => (esDemo() ? null : leer(K_CACHE));
export const guardarCache = (datos) => { if (!esDemo()) escribir(K_CACHE, datos); };

export class SesionVencida extends Error {}

async function llamar(metodo, ruta, cuerpo) {
  const s = leerSesion();
  if (s?.demo || esDemo()) return demo(metodo, ruta, cuerpo);
  if (!API_URL) throw new Error('Falta configurar la dirección del servidor.');
  let res;
  try {
    res = await fetch(API_URL + ruta, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(s?.token ? { Authorization: 'Bearer ' + s.token } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new Error('Sin conexión. Mostrando los últimos datos guardados.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (res.status === 401 && s?.token && ruta !== '/login' && ruta !== '/activar') {
    borrarSesion();
    throw new SesionVencida('Sesión vencida');
  }
  if (!res.ok || !data?.ok) throw new Error(data?.error || `El servidor no respondió (${res.status}).`);
  return data;
}

function conSesion(d) {
  escribir(K_SESION, { token: d.token, expira: d.expira, usuario: d.usuario });
  guardarCache(d);
  return d;
}

// ── Acceso ──
export const login = async (cedula, password) => conSesion(await llamar('POST', '/login', { cedula, password }));
export const activar = async (codigo, cedula, password) => conSesion(await llamar('POST', '/activar', { codigo, cedula, password }));
export function cerrarSesion() { borrarSesion(); }

// ── Datos (todas devuelven el paquete completo: personal + grupos) ──
export const obtenerDatos = () => llamar('GET', '/datos');
export const sincronizar = () => llamar('POST', '/sync', {});
export const cambiarCategoria = (id, categoriaId) => llamar('PATCH', `/movimientos/${id}/categoria`, { categoriaId });
export const moverGasto = (id, grupoId) => llamar('POST', `/movimientos/${id}/mover`, { grupoId });
export const eliminarGasto = (id) => llamar('DELETE', `/movimientos/${id}`);
export const restaurarGasto = (id) => llamar('POST', `/movimientos/${id}/restaurar`, {});
export const crearGasto = (datos) => llamar('POST', '/movimientos', datos);
export const crearCategoria = (grupoId, datos) => llamar('POST', '/categorias', { grupoId, ...datos });
export const editarCategoria = (id, datos) => llamar('PATCH', `/categorias/${id}`, datos);
export const borrarCategoria = (id) => llamar('DELETE', `/categorias/${id}`);
export const crearGrupo = (datos) => llamar('POST', '/grupos', datos);
export const editarGrupo = (id, datos) => llamar('PATCH', `/grupos/${id}`, datos);
export const guiasDelGrupo = (grupoId, mes) => llamar('GET', `/grupos/${grupoId}/guias?mes=${encodeURIComponent(mes)}`);
export const pagarGuia = (grupoId, slotId, datos) => llamar('PUT', `/grupos/${grupoId}/guias/${slotId}`, datos);

// ── Notificaciones ──
export const clavePush = () => llamar('GET', '/push/clave');
export const suscribirPush = (subscription) => llamar('POST', '/push/suscribir', { subscription });
export const desuscribirPush = (endpoint) => llamar('POST', '/push/desuscribir', { endpoint });
