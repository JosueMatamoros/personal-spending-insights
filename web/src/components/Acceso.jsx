import { useState } from 'react';
import { activar, login } from '../lib/api.js';

/** Formatea la cédula mientras se escribe: 1-2345-6789 */
function formatearCedula(v) {
  const d = v.replace(/\D/g, '').slice(0, 12);
  if (d.length === 9) return `${d[0]}-${d.slice(1, 5)}-${d.slice(5)}`;
  return d;
}

export default function Acceso({ onEntrar }) {
  const [modo, setModo] = useState('login'); // login | activar
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [lento, setLento] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (modo === 'activar') {
      if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
      if (password !== confirmar) return setError('Las contraseñas no coinciden.');
    }
    setEnviando(true);
    // El servidor gratuito se duerme: si tarda, avisamos
    const t = setTimeout(() => setLento(true), 4000);
    try {
      const d = modo === 'activar'
        ? await activar(codigo.trim().toUpperCase(), cedula, password)
        : await login(cedula, password);
      onEntrar(d);
    } catch (err) {
      setError(err.message);
    } finally {
      clearTimeout(t);
      setLento(false);
      setEnviando(false);
    }
  }

  const act = modo === 'activar';

  return (
    <main className="config">
      <img src="./icon.svg" alt="" className="config-logo" />
      <h1>Mis Gastos</h1>
      <p className="muted">
        {act ? 'Usa el código que te dieron para crear tu contraseña.' : 'Tus gastos personales y de grupo, organizados cada mes.'}
      </p>

      <form onSubmit={enviar} className="config-form">
        {act && (
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código de activación" aria-label="Código de activación" autoCapitalize="characters" autoComplete="one-time-code" className="clave" required />
        )}
        <input value={cedula} onChange={(e) => setCedula(formatearCedula(e.target.value))} placeholder="Cédula" aria-label="Cédula" inputMode="numeric" autoComplete="username" required />
        <div className="campo-pass">
          <input type={ver ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={act ? 'Contraseña nueva' : 'Contraseña'} aria-label="Contraseña" autoComplete={act ? 'new-password' : 'current-password'} required />
          <button type="button" className="ver-pass" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? 'Ocultar' : 'Ver'}</button>
        </div>
        {act && (
          <input type={ver ? 'text' : 'password'} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repite la contraseña" aria-label="Repite la contraseña" autoComplete="new-password" required />
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primario" disabled={enviando}>
          {enviando ? (lento ? 'Despertando el servidor…' : 'Un momento…') : act ? 'Crear contraseña y entrar' : 'Entrar'}
        </button>
      </form>

      <button className="btn-link demo" onClick={() => { setModo(act ? 'login' : 'activar'); setError(''); }}>
        {act ? 'Ya tengo contraseña' : 'Primera vez u olvidé la contraseña'}
      </button>
      <button className="btn-link demo-sec" onClick={() => { location.hash = 'demo'; location.reload(); }}>Ver un ejemplo</button>
    </main>
  );
}
