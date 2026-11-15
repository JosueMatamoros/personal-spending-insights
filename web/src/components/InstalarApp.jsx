import { useState } from 'react';
import { Download, EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import { instalar, useInstalar } from '../lib/instalar.js';

/**
 * Tarjeta "Instala la app". En Android con Chrome es un solo botón que abre el
 * diálogo nativo; si el navegador no lo ofrece, explica el menú ⋮. En iPhone
 * explica Compartir → Agregar a inicio. Ya instalada (o en computadora) no aparece.
 */
export default function InstalarApp({ compacta = false }) {
  const estado = useInstalar();
  const [ocupado, setOcupado] = useState(false);

  if (!estado || estado === 'instalada') return null;

  async function tocar() {
    setOcupado(true);
    try { await instalar(); } finally { setOcupado(false); }
  }

  return (
    <div className={'instalar' + (compacta ? ' instalar-compacta' : '')}>
      <div className="instalar-cab">
        <span className="instalar-ico"><Download size={18} /></span>
        <div>
          <p className="ajuste-nombre">Instala la app</p>
          <p className="muted pequeno">Queda en tu pantalla de inicio, abre al toque y recibe avisos.</p>
        </div>
      </div>

      {estado === 'boton' && (
        <button className="btn-primario instalar-btn" onClick={tocar} disabled={ocupado}>
          {ocupado ? 'Un momento…' : 'Instalar en este celular'}
        </button>
      )}

      {estado === 'android' && (
        <ol className="instalar-pasos">
          <li>Abre esta página en <b>Chrome</b>.</li>
          <li>Toca el menú <EllipsisVertical size={15} aria-label="tres puntos" /> arriba a la derecha.</li>
          <li>Elige <b>Instalar app</b> (o <b>Agregar a pantalla principal</b>).</li>
        </ol>
      )}

      {estado === 'iphone' && (
        <ol className="instalar-pasos">
          <li>Abre esta página en <b>Safari</b>.</li>
          <li>Toca <Share size={15} aria-label="Compartir" /> <b>Compartir</b> abajo.</li>
          <li>Elige <SquarePlus size={15} aria-hidden /> <b>Agregar a inicio</b>.</li>
        </ol>
      )}
    </div>
  );
}
