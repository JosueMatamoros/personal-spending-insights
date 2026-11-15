import { useEffect, useState } from 'react';

// Instalar la app en el celular.
// - Android (Chrome, Edge, Samsung Internet): el navegador manda el evento
//   `beforeinstallprompt`; lo guardamos y un botón muestra el diálogo nativo
//   "Instalar app" con un solo toque.
// - iPhone: no existe ese evento; solo se puede con Compartir → Agregar a inicio.
// El evento puede llegar antes de que React monte, por eso se escucha aquí,
// al importar el módulo (main.jsx lo importa primero).

let aviso = null; // evento beforeinstallprompt guardado
const oyentes = new Set();
const notificar = () => oyentes.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // que no salga la mini barra de Chrome; usamos nuestro botón
    aviso = e;
    notificar();
  });
  window.addEventListener('appinstalled', () => {
    aviso = null;
    notificar();
  });
}

export const esStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

export const esIphone = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
export const esAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

/** Abre el diálogo nativo de instalación. Devuelve true si la instaló. */
export async function instalar() {
  if (!aviso) return false;
  const e = aviso;
  aviso = null;
  notificar();
  e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === 'accepted';
}

/**
 * Estado de instalación para la UI:
 * - 'instalada'  → ya se abre como app; no mostrar nada
 * - 'boton'      → Android con diálogo nativo disponible (un toque)
 * - 'android'    → Android sin diálogo (otro navegador o ya lo rechazó): instrucciones del menú ⋮
 * - 'iphone'     → instrucciones de Compartir → Agregar a inicio
 * - null         → computadora u otro: no mostrar
 */
export function useInstalar() {
  const [, refrescar] = useState(0);
  useEffect(() => {
    const fn = () => refrescar((n) => n + 1);
    oyentes.add(fn);
    return () => oyentes.delete(fn);
  }, []);

  if (esStandalone()) return 'instalada';
  if (aviso) return 'boton';
  if (esAndroid()) return 'android';
  if (esIphone()) return 'iphone';
  return null;
}
