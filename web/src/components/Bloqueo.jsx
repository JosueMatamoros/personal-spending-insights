import { useEffect, useRef, useState } from 'react';
import { verificarFaceId } from '../lib/faceid.js';

/** Pantalla de bloqueo: pide Face ID para abrir la app. */
export default function Bloqueo({ onDesbloquear, onUsarContrasena }) {
  const [error, setError] = useState('');
  const intentado = useRef(false);

  async function desbloquear() {
    setError('');
    try {
      await verificarFaceId();
      onDesbloquear();
    } catch {
      setError('No se pudo verificar. Intenta de nuevo.');
    }
  }

  useEffect(() => {
    if (intentado.current) return;
    intentado.current = true;
    desbloquear();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="config bloqueo">
      <img src="./icon.svg" alt="" className="config-logo" />
      <h1>Mis Gastos</h1>
      <p className="muted">Desbloquea para ver tus gastos.</p>
      <button className="btn-primario btn-faceid" onClick={desbloquear}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9 15.5c1.7 1.3 4.3 1.3 6 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Desbloquear con Face ID
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn-link demo" onClick={onUsarContrasena}>Entrar con contraseña</button>
    </main>
  );
}
