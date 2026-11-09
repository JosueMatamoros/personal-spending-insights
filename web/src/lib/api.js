import { demo } from './demo.js';

const API_URL = import.meta.env.VITE_API_URL || '';
const K_SESION = 'misgastos.sesion';
const K_CACHE = 'misgastos.cache';

function leer(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
}
function escribir(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
}

// ── Sesión ──
export function leerSesion() {
  if (typeof location !== 'undefined' && location.hash === '#demo') return { sesion: 'demo', expira: Infinity, demo: true };
  const s = leer(K_SESION);
  return s && s.expira > Date.now() ? s : null;
}
const guardarSesion = (s) => escribir(K_SESION, s);
export function borrarSesion() {
  escribir(K_SESION, null);
  escribir(K_CACHE, null);
}

export const leerCache = () => leer(K_CACHE);
export const guardarCache = (gastos, categorias) => escribir(K_CACHE, { gastos, categorias, en: Date.now() });

export class SesionVencida extends Error {}

async function llamar(action, datos = {}) {
  const s = leerSesion();
  if (s?.demo || datos.demo) return demo({ action, ...datos });
  if (!API_URL) throw new Error('Falta configurar la dirección del servidor.');
  let res;
  try {
    // text/plain evita la verificación CORS previa que Apps Script no soporta
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, sesion: s?.sesion, ...datos }),
      redirect: 'follow',
    });
  } catch {
    throw new Error('Sin conexión. Mostrando los últimos datos guardados.');
  }
  if (!res.ok) throw new Error('El servidor no respondió (' + res.status + ').');
  let data;
  try { data = await res.json(); } catch { throw new Error('Respuesta inesperada del servidor.'); }
  if (!data.ok) {
    if (data.error === 'Sesión vencida') { borrarSesion(); throw new SesionVencida(data.error); }
    throw new Error(data.error || 'Error desconocido');
  }
  return data;
}

function conSesion(data) {
  guardarSesion({ sesion: data.sesion, expira: data.expira });
  if (data.gastos) guardarCache(data.gastos, data.categorias);
  return data;
}

export const estado = () => llamar('estado');
export const login = async (cedula, password) => conSesion(await llamar('login', { cedula, password }));
export const registrar = async (clave, cedula, password) => conSesion(await llamar('registrar', { clave, cedula, password }));
export const obtenerGastos = () => llamar('gastos');
export const sincronizar = () => llamar('sync');
export const cambiarCategoria = (id, categoria) => llamar('setCategory', { id, categoria });
export const eliminarGasto = (id) => llamar('deleteExpense', { id });
export const restaurarGasto = (id) => llamar('restoreExpense', { id });
/** Crea (sin `anterior`) o edita una categoría. */
export const guardarCategoria = (anterior, categoria) => llamar('saveCategory', { anterior, categoria });
export const borrarCategoria = (nombre) => llamar('deleteCategory', { nombre });
export async function cerrarSesion() {
  try { await llamar('logout'); } catch { /* igual se borra localmente */ }
  borrarSesion();
}
