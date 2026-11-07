import { useState } from 'react';
import { obtenerGastos } from '../lib/api.js';

export default function Configurar({ inicial, onListo }) {
  const [url, setUrl] = useState(inicial.url);
  const [token, setToken] = useState(inicial.token);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const urlFija = Boolean(import.meta.env.VITE_API_URL);

  async function entrar(e) {
    e.preventDefault();
    setError('');
    const cfg = { url: url.trim(), token: token.trim().toUpperCase() };
    if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(cfg.url)) {
      setError('La dirección debe ser la del Apps Script (empieza con https://script.google.com/…).');
      return;
    }
    setCargando(true);
    try {
      const data = await obtenerGastos(cfg);
      onListo(cfg, data.gastos);
    } catch (err) {
      setError(err.message === 'Clave incorrecta' ? 'Esa clave no es correcta. Revísala e intenta de nuevo.' : err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="config">
      <img src="./icon.svg" alt="" className="config-logo" />
      <h1>Mis Gastos</h1>
      <p className="muted">Tus gastos de BAC, BCR y Banco Popular, organizados cada mes.</p>
      <form onSubmit={entrar} className="config-form">
        {!urlFija && (
          <label>
            <span>Dirección del Apps Script</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" inputMode="url" autoComplete="off" />
          </label>
        )}
        <label>
          <span>Clave de acceso</span>
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="8 letras y números" autoCapitalize="characters" autoComplete="off" className="clave" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primario" disabled={cargando || !token || !url}>
          {cargando ? 'Conectando…' : 'Entrar'}
        </button>
      </form>
      <button className="btn-link demo" onClick={() => onListo({ url: 'demo', token: 'DEMO' }, [])}>Ver un ejemplo sin conectar</button>
    </main>
  );
}
