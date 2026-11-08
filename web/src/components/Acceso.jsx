import { useEffect, useState } from 'react';
import { estado, login, registrar } from '../lib/api.js';

/** Formatea la cédula mientras se escribe: 1-2345-6789 */
function formatearCedula(v) {
  const d = v.replace(/\D/g, '').slice(0, 12);
  if (d.length === 9) return `${d[0]}-${d.slice(1, 5)}-${d.slice(5)}`;
  return d;
}

export default function Acceso({ onEntrar }) {
  const [modo, setModo] = useState('cargando'); // cargando | login | registro
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function revisar() {
    setModo('cargando');
    setError('');
    estado()
      .then((d) => setModo(d.registrado ? 'login' : 'registro'))
      .catch((e) => { setModo('error'); setError(e.message === 'Clave incorrecta' ? 'El servidor tiene una versión vieja del script. Actualízalo y crea una "Nueva versión" en Implementar.' : e.message); });
  }

  useEffect(revisar, []);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (modo === 'registro') {
      if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
      if (password !== confirmar) return setError('Las contraseñas no coinciden.');
    }
    setEnviando(true);
    try {
      const d = modo === 'registro'
        ? await registrar(clave.trim().toUpperCase(), cedula, password)
        : await login(cedula, password);
      onEntrar(d.gastos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const registro = modo === 'registro';

  return (
    <main className="config">
      <img src="./icon.svg" alt="" className="config-logo" />
      <h1>Mis Gastos</h1>
      <p className="muted">
        {registro ? 'Crea tu acceso. Solo se hace una vez.' : 'Tus gastos de BAC, BCR y Banco Popular, organizados cada mes.'}
      </p>

      {modo === 'cargando' ? (
        <p className="muted cargando-acceso">Conectando…</p>
      ) : modo === 'error' ? (
        <div className="config-form">
          <p className="error" role="alert">{error}</p>
          <button className="btn-primario" onClick={revisar}>Reintentar</button>
        </div>
      ) : (
        <form onSubmit={enviar} className="config-form">
          {registro && (
            <input value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave de acceso del script" aria-label="Clave de acceso del script" autoCapitalize="characters" autoComplete="off" className="clave" required />
          )}
          <input value={cedula} onChange={(e) => setCedula(formatearCedula(e.target.value))} placeholder="Cédula" aria-label="Cédula" inputMode="numeric" autoComplete="username" required />
          <div className="campo-pass">
            <input type={ver ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" aria-label="Contraseña" autoComplete={registro ? 'new-password' : 'current-password'} required />
            <button type="button" className="ver-pass" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? 'Ocultar' : 'Ver'}</button>
          </div>
          {registro && (
            <input type={ver ? 'text' : 'password'} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repite la contraseña" aria-label="Repite la contraseña" autoComplete="new-password" required />
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primario" disabled={enviando}>
            {enviando ? 'Un momento…' : registro ? 'Crear acceso' : 'Entrar'}
          </button>
        </form>
      )}

      {modo === 'login' && (
        <button className="btn-link demo" onClick={() => { setModo('registro'); setError(''); }}>¿Olvidaste la contraseña? Crear una nueva</button>
      )}
      {registro && modo !== 'cargando' && (
        <button className="btn-link demo" onClick={() => { setModo('login'); setError(''); }}>Ya tengo acceso</button>
      )}
      <button className="btn-link demo-sec" onClick={() => { location.hash = 'demo'; location.reload(); }}>Ver un ejemplo</button>
    </main>
  );
}
