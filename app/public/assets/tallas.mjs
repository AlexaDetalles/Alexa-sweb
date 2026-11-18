// Tallas de un producto: las comparten la tienda, el panel y el Worker (todo es función pura, sin pantalla ni base de datos).
// El campo «Talla» guarda las tallas disponibles separadas por « · » (p. ej. «8 · 9» o «S · XXL»).
const ORDEN_LETRAS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const num = /^\d{1,3}(?:\.\d)?$/;
const rango = /^(\d{1,3}(?:\.\d)?)-(\d{1,3}(?:\.\d)?)$/;

/** «8 · 9» → ['8', '9']. También entiende lo que se escriba a mano («9.5, 9 y 7», «11/12»). */
export function partirTallas(texto) {
  const t = Array.isArray(texto) ? texto.join(' · ') : String(texto ?? '');
  const v = t.toUpperCase().split(/\s*[·,;/]\s*|\s+Y\s+/).map((x) => x.trim()).filter(Boolean);
  return [...new Set(v)];
}

/** ¿Este producto tiene la talla pedida? «9» encuentra «9», «8 · 9» y también un rango «8-10». */
export function coincideTalla(tallas, quiero) {
  const q = String(quiero ?? '').trim().toUpperCase();
  if (!q) return true;
  return partirTallas(tallas).some((t) => {
    if (t === q) return true;
    const r = rango.exec(t);
    if (r && num.test(q)) return Number(q) >= Number(r[1]) && Number(q) <= Number(r[2]);
    return false;
  });
}

const clave = (t) => {
  if (num.test(t)) return [0, Number(t)];
  const l = ORDEN_LETRAS.indexOf(t);
  if (l >= 0) return [1, l];
  const r = rango.exec(t);
  if (r) return [0, Number(r[1]) + 0.01];
  return [2, 0];
};

/** Todas las tallas distintas de una lista de productos, ordenadas: números, luego letras (XS…XXL) y al final lo demás. Rangos como «28-30» no se ofrecen (se encuentran por cualquier número dentro). */
export function listaTallas(tallasDeProductos) {
  const todas = new Set();
  for (const x of tallasDeProductos) for (const t of partirTallas(x)) if (!rango.test(t)) todas.add(t);
  return [...todas].sort((a, b) => { const A = clave(a), B = clave(b); return A[0] - B[0] || A[1] - B[1] || a.localeCompare(b, 'es'); });
}

/** Quita una talla de «8 · 9 · 10» (la que se vendió) y devuelve lo que queda, o null si esa talla no estaba. */
export function quitarTalla(texto, vendida) {
  const lista = partirTallas(texto), q = String(vendida ?? '').trim().toUpperCase();
  if (!lista.includes(q)) return null;
  return lista.filter((t) => t !== q).join(' · ');
}
