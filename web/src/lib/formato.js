const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const colones = (n) => '₡' + nf.format(Math.round(n || 0));

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const claveMes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const mesDeFecha = (iso) => iso.slice(0, 7);

export function nombreMes(clave, conAnio = true) {
  const [a, m] = clave.split('-').map(Number);
  const n = MESES[m - 1];
  return (n.charAt(0).toUpperCase() + n.slice(1)) + (conAnio ? ' ' + a : '');
}

export function moverMes(clave, delta) {
  const [a, m] = clave.split('-').map(Number);
  return claveMes(new Date(a, m - 1 + delta, 1));
}

export function etiquetaDia(iso) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const f = new Date(a, m - 1, d);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const mismo = (x, y) => x.toDateString() === y.toDateString();
  if (mismo(f, hoy)) return 'Hoy';
  if (mismo(f, ayer)) return 'Ayer';
  const dia = DIAS[f.getDay()];
  return `${dia.charAt(0).toUpperCase() + dia.slice(1)} ${d} de ${MESES[m - 1]}`;
}

export const hora = (iso) => iso.slice(11, 16);
export const diaDelMes = (iso) => Number(iso.slice(8, 10));

const SIGLAS = new Set(['SINPE', 'BAC', 'BCR', 'KFC', 'ICE', 'AYA', 'CCSS', 'AM', 'PM', 'USA', 'CR']);
const MENORES = new Set(['y', 'de', 'del', 'la', 'el', 'los', 'las', 'en']);
/** "TACO BELL TERRAMALL" → "Taco Bell Terramall" */
export function nombreComercio(s) {
  return String(s || '').toLowerCase().split(/(\s+)/).map((p, i) => {
    if (SIGLAS.has(p.toUpperCase())) return p.toUpperCase();
    if (i > 0 && MENORES.has(p)) return p;
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join('');
}
