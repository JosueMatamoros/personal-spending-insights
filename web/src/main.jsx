import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/manrope';
import './index.css';
import App from './App.jsx';

// Busca versiones nuevas al abrir la app y cada vez que vuelve a primer plano
// (en iPhone la app instalada no se actualiza sola si queda abierta en segundo plano).
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const revisar = () => { if (!document.hidden) reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', revisar);
    setInterval(revisar, 30 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
