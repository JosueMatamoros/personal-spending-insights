import { useEffect, useState } from 'react';
import { activarFaceId, desactivarFaceId, faceIdActivo, faceIdDisponible } from '../lib/faceid.js';

const fecha = (ms) => new Date(ms).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function Ajustes({ sesion, onCerrarSesion, onCerrar, avisar }) {
  const [disponible, setDisponible] = useState(false);
  const [activo, setActivo] = useState(faceIdActivo);
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  useEffect(() => { faceIdDisponible().then(setDisponible); }, []);

  async function alternarFaceId() {
    if (activo) {
      desactivarFaceId();
      setActivo(false);
      avisar('Face ID desactivado');
      return;
    }
    try {
      await activarFaceId();
      setActivo(true);
      avisar('Face ID activado');
    } catch {
      avisar('No se pudo activar Face ID', 'error');
    }
  }

  return (
    <div className="velo" onClick={onCerrar}>
      <section className="hoja" role="dialog" aria-label="Ajustes" onClick={(e) => e.stopPropagation()}>
        <div className="hoja-asa" />
        <h2 className="ajustes-tit">Ajustes</h2>

        <div className="ajuste">
          <div>
            <p className="ajuste-nombre">Desbloquear con Face ID</p>
            <p className="muted pequeno">{disponible ? 'Pide Face ID cada vez que abres la app.' : 'Este dispositivo no tiene Face ID disponible para la app.'}</p>
          </div>
          <button role="switch" aria-checked={activo} className={'switch' + (activo ? ' on' : '')} disabled={!disponible && !activo} onClick={alternarFaceId}>
            <span />
          </button>
        </div>

        {!sesion.demo && (
          <div className="ajuste">
            <div>
              <p className="ajuste-nombre">Sesión activa</p>
              <p className="muted pequeno">Hasta el {fecha(sesion.expira)}</p>
            </div>
          </div>
        )}

        {confirmarSalida ? (
          <div className="confirmar">
            <p>¿Cerrar sesión en este celular?</p>
            <div className="confirmar-btns">
              <button className="btn-sec" onClick={() => setConfirmarSalida(false)}>Cancelar</button>
              <button className="btn-peligro" onClick={onCerrarSesion}>Cerrar sesión</button>
            </div>
          </div>
        ) : (
          <button className="btn-salir" onClick={() => setConfirmarSalida(true)}>{sesion.demo ? 'Salir del ejemplo' : 'Cerrar sesión'}</button>
        )}
      </section>
    </div>
  );
}
