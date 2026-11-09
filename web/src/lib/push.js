import { clavePush, desuscribirPush, suscribirPush } from './api.js';

export const pushSoportado = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** En iPhone las notificaciones solo funcionan con la app agregada a la pantalla de inicio. */
export const iphoneSinInstalar = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.navigator.standalone && !matchMedia('(display-mode: standalone)').matches;

async function registro() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg || navigator.serviceWorker.ready;
}

export async function pushActivo() {
  if (!pushSoportado() || Notification.permission !== 'granted') return false;
  const reg = await registro();
  return Boolean(await reg?.pushManager.getSubscription());
}

function claveABytes(b64) {
  const relleno = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function activarPush() {
  if (!pushSoportado()) throw new Error(iphoneSinInstalar() ? 'Primero agrega la app a la pantalla de inicio' : 'Este navegador no permite notificaciones');
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('No diste permiso para las notificaciones. Puedes activarlo en Ajustes del iPhone → Notificaciones → Mis Gastos.');
  const reg = await registro();
  const { publicKey } = await clavePush();
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(publicKey) }));
  await suscribirPush(sub.toJSON());
}

export async function desactivarPush() {
  const reg = await registro();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  try { await desuscribirPush(sub.endpoint); } catch { /* igual se quita en el celular */ }
  await sub.unsubscribe();
}
