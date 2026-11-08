import { useEffect, useRef, useState } from 'react';
import { ScanFace } from 'lucide-react';
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
        <ScanFace size={22} strokeWidth={1.9} />
        Desbloquear con Face ID
      </button>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn-link demo" onClick={onUsarContrasena}>Entrar con contraseña</button>
    </main>
  );
}
