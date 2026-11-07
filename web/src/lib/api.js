import { demo } from './demo.js';

const CLAVE_CONFIG = 'misgastos.config';
const CLAVE_CACHE = 'misgastos.cache';

function leer(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
}
function escribir(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
}

export function leerConfig() {
  if (typeof location !== 'undefined' && location.hash === '#demo') return { url: 'demo', token: 'DEMO' };
  const c = leer(CLAVE_CONFIG) || {};
  return { url: c.url || import.meta.env.VITE_API_URL || '', token: c.token || '' };
}
export const guardarConfig = (c) => escribir(CLAVE_CONFIG, c);
export const borrarConfig = () => { escribir(CLAVE_CONFIG, null); escribir(CLAVE_CACHE, null); };

export const leerCache = () => leer(CLAVE_CACHE);
export const guardarCache = (gastos) => escribir(CLAVE_CACHE, { gastos, en: Date.now() });

async function llamar({ url, token }, params = {}) {
  if (url === 'demo') return demo(params);
  const q = new URLSearchParams({ token, ...params });
  let res;
  try {
    res = await fetch(`${url}?${q}`, { redirect: 'follow' });
  } catch {
    throw new Error('Sin conexión. Mostrando los últimos datos guardados.');
  }
  if (!res.ok) throw new Error('El servidor no respondió (' + res.status + ').');
  let data;
  try { data = await res.json(); } catch { throw new Error('La URL no parece ser la del Apps Script.'); }
  if (!data.ok) throw new Error(data.error || 'Error desconocido');
  return data;
}

export const obtenerGastos = (cfg) => llamar(cfg);
export const sincronizar = (cfg) => llamar(cfg, { action: 'sync' });
export const cambiarCategoria = (cfg, id, categoria) => llamar(cfg, { action: 'setCategory', id, categoria });
