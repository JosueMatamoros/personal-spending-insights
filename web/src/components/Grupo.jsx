import { useState } from 'react';
import { Check } from 'lucide-react';
import { COLORES, ICONOS } from '../lib/iconos.js';

const ICONOS_GRUPO = ['Users', 'Tent', 'TreePalm', 'Plane', 'House', 'Briefcase', 'Sprout', 'Wheat', 'Heart', 'Gift', 'Car', 'PiggyBank'];

/** Crear o editar un grupo (nombre, ícono, color y quiénes están). */
export default function Grupo({ grupo, usuarios, yo, onGuardar, onCerrar }) {
  const nuevo = !grupo;
  const [nombre, setNombre] = useState(grupo?.nombre || '');
  const [icono, setIcono] = useState(grupo?.icono || 'Users');
  const [color, setColor] = useState(grupo?.color || COLORES[7]);
  const [miembros, setMiembros] = useState(() => new Set((grupo?.miembros || []).map((m) => m.id).filter((id) => id !== yo)));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const Icono = ICONOS[icono] || ICONOS.Tag;

  function alternar(id) {
    const s = new Set(miembros);
    s.has(id) ? s.delete(id) : s.add(id);
    setMiembros(s);
  }

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      await onGuardar({ nombre: nombre.trim(), icono, color, miembros: [...miembros] });
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  }

  const otros = usuarios.filter((u) => u.id !== yo);

  return (
    <div className="velo" onClick={onCerrar}>
      <section className="hoja" role="dialog" aria-label={nuevo ? 'Nuevo grupo' : 'Editar grupo'} onClick={(e) => e.stopPropagation()}>
        <div className="hoja-asa" />
        <h2 className="ajustes-tit">{nuevo ? 'Nuevo grupo' : 'Editar grupo'}</h2>
        <p className="muted pequeno">Los gastos de un grupo se llevan aparte de tus gastos personales y todos los miembros los ven.</p>

        <div className="editor-nombre" style={{ marginTop: 16 }}>
          <span className="badge grande" style={{ '--c': color }}><Icono size={24} strokeWidth={1.9} color={color} /></span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Tour a caballo)" maxLength={40} autoFocus={nuevo} />
        </div>

        <p className="hoja-tit">Quiénes están</p>
        <ul className="lista-editar">
          <li><div className="fila-editar"><span className="avatar">Yo</span><span className="fila-nombre">Tú</span><Check size={18} color="var(--musgo)" /></div></li>
          {otros.map((u) => (
            <li key={u.id}>
              <button className="fila-editar" onClick={() => alternar(u.id)} aria-pressed={miembros.has(u.id)}>
                <span className="avatar">{u.nombre.slice(0, 1)}</span>
                <span className="fila-nombre">{u.nombre}</span>
                <span className={'check' + (miembros.has(u.id) ? ' on' : '')}>{miembros.has(u.id) && <Check size={15} strokeWidth={3} />}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="hoja-tit">Color</p>
        <div className="colores">
          {COLORES.map((c) => <button key={c} className={'color' + (c === color ? ' activo' : '')} style={{ '--c': c }} onClick={() => setColor(c)} aria-label={'Color ' + c} />)}
        </div>
        <p className="hoja-tit">Ícono</p>
        <div className="iconos">
          {ICONOS_GRUPO.map((n) => {
            const I = ICONOS[n];
            return <button key={n} className={'icono-op' + (n === icono ? ' activo' : '')} style={{ '--c': color }} onClick={() => setIcono(n)} aria-label={n}><I size={20} strokeWidth={1.9} /></button>;
          })}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn-primario btn-ancho" disabled={guardando || !nombre.trim()} onClick={guardar}>{guardando ? 'Guardando…' : nuevo ? 'Crear grupo' : 'Guardar'}</button>
      </section>
    </div>
  );
}
