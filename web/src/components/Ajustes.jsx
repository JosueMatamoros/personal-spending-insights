import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { activarPush, desactivarPush, iphoneSinInstalar, pushActivo, pushSoportado } from '../lib/push.js';
import { activarFaceId, desactivarFaceId, faceIdActivo, faceIdDisponible } from '../lib/faceid.js';

const fecha = (ms) => new Date(ms).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function Ajustes({ sesion, ambitoNombre, grupo, onCerrarSesion, onCerrar, onCategorias, onGrupo, avisar }) {
  const [disponible, setDisponible] = useState(false);
  const [activo, setActivo] = useState(faceIdActivo);
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  const [notif, setNotif] = useState(false);
  const [notifOcupado, setNotifOcupado] = useState(false);

  useEffect(() => { faceIdDisponible().then(setDisponible); pushActivo().then(setNotif).catch(() => {}); }, []);

  async function alternarNotif() {
    setNotifOcupado(true);
    try {
      if (notif) { await desactivarPush(); setNotif(false); avisar('Notificaciones desactivadas'); }
      else { await activarPush(); setNotif(true); avisar('Listo: te aviso cada gasto nuevo'); }
    } catch (e) {
      avisar(e.message, 'error');
    } finally {
      setNotifOcupado(false);
    }
  }

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

        <button className="ajuste ajuste-btn" onClick={onCategorias}>
          <div>
            <p className="ajuste-nombre">Categorías{grupo ? ` de ${ambitoNombre}` : ''}</p>
            <p className="muted pequeno">Editar, agregar o borrar categorías</p>
          </div>
          <ChevronRight size={20} color="var(--muted)" />
        </button>

        {grupo && (
          <button className="ajuste ajuste-btn" onClick={onGrupo}>
            <div>
              <p className="ajuste-nombre">Grupo {grupo.nombre}</p>
              <p className="muted pequeno">{grupo.miembros.map((m) => m.nombre).join(', ')} · editar nombre y miembros</p>
            </div>
            <ChevronRight size={20} color="var(--muted)" />
          </button>
        )}

        <div className="ajuste">
          <div>
            <p className="ajuste-nombre">Notificaciones</p>
            <p className="muted pequeno">
              {pushSoportado() ? 'Aviso de cada gasto nuevo; tócalo para clasificarlo.'
                : iphoneSinInstalar() ? 'Primero agrega la app a la pantalla de inicio (Compartir → Agregar a inicio).'
                : 'Este navegador no permite notificaciones.'}
            </p>
          </div>
          <button role="switch" aria-checked={notif} className={'switch' + (notif ? ' on' : '')} disabled={notifOcupado || (!pushSoportado() && !notif)} onClick={alternarNotif}>
            <span />
          </button>
        </div>

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
