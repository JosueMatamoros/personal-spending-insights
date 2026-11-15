import { useState } from 'react';
import { login } from '../lib/api.js';
import InstalarApp from './InstalarApp.jsx';

/** Formatea la cédula mientras se escribe: 1-2345-6789 */
function formatearCedula(v) {
  const d = v.replace(/\D/g, '').slice(0, 12);
  if (d.length === 9) return `${d[0]}-${d.slice(1, 5)}-${d.slice(5)}`;
  return d;
}

export default function Acceso({ onEntrar }) {
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [lento, setLento] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    // El servidor gratuito se duerme: si tarda, avisamos
    const t = setTimeout(() => setLento(true), 4000);
    try {
      onEntrar(await login(cedula, password));
    } catch (err) {
      setError(err.message);
    } finally {
      clearTimeout(t);
      setLento(false);
      setEnviando(false);
    }
  }

  // Las cuentas las crea el administrador; aquí solo se entra.
  return (
    <main className="config">
      <img src="./icon.svg" alt="" className="config-logo" />
      <h1>Mis Gastos</h1>
      <p className="muted">Tus gastos personales y de grupo, organizados cada mes.</p>

      <form onSubmit={enviar} className="config-form">
        <input value={cedula} onChange={(e) => setCedula(formatearCedula(e.target.value))} placeholder="Cédula" aria-label="Cédula" inputMode="numeric" autoComplete="username" required />
        <div className="campo-pass">
          <input type={ver ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" aria-label="Contraseña" autoComplete="current-password" required />
          <button type="button" className="ver-pass" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? 'Ocultar' : 'Ver'}</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primario" disabled={enviando}>
          {enviando ? (lento ? 'Despertando el servidor…' : 'Un momento…') : 'Entrar'}
        </button>
      </form>

      <InstalarApp />
    </main>
  );
}
