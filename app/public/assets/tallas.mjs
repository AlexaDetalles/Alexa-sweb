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

// Lee las tallas escritas en la descripción de un producto y las deja en el formato corto del campo «Talla» (el que sale en las imágenes para redes).
//   «Talla 11 y 12»                   → «11 · 12»
//   «Tres tallas disponibles, 9.5, 9 y 7» → «7 · 9 · 9.5»
//   «Talla S y XXL»                   → «S · XXL»
//   «Talla 28-30 y 36-38»             → «28-30 · 36-38»
//   «Unitalla»                        → «ÚNICA»
// Si no hay talla, o algo no tiene sentido (p. ej. «28-330»), devuelve '' y se deja para llenar a mano.
const LETRAS = new Set(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']);
const MAX = 20; // largo del campo Talla
const numL = /^(\d{1,3}(?:\.\d)?)([A-Z]?)$/;
const rangoL = /^(\d{1,3}(?:\.\d)?)-(\d{1,3}(?:\.\d)?)$/;
const sensato = (n) => n > 0 && n <= 60; // tallas de ropa y calzado

export function leerTallas(texto) {
  const t = String(texto ?? '');
  if (/\bunitalla\b|\btalla\s+[uú]nica\b/i.test(t)) return 'ÚNICA';
  const m = /\btallas?\b[^\n]*/i.exec(t); // desde la palabra «talla» hasta el final de esa línea
  if (!m) return '';
  const resto = m[0].replace(/^tallas?/i, '').toUpperCase().replace(/(\d),(\d)(?!\d)/g, '$1.$2'); // «7,5» es 7.5, pero «3, 13» son dos tallas
  const piezas = resto.split(/[^0-9A-ZÑ.\-]+/).map((p) => p.replace(/^[.\-]+|[.\-]+$/g, '')).filter(Boolean);
  const salida = [];
  for (const p of piezas) {
    let r;
    if ((r = rangoL.exec(p))) { const a = Number(r[1]), b = Number(r[2]); if (!sensato(a) || !sensato(b) || a >= b) return ''; salida.push(p); }
    else if ((r = numL.exec(p))) { if (!sensato(Number(r[1]))) return ''; salida.push(p); }
    else if (LETRAS.has(p)) salida.push(p);
    else if (/^[0-9][0-9.\-]*$/.test(p)) return ''; // un número raro (28-330, 1.2.3): mejor no adivinar
    // cualquier otra palabra («disponibles», «y», «us», «niño»…) se ignora
  }
  const únicas = [...new Set(salida)];
  if (!únicas.length) return '';
  if (únicas.every((x) => /^\d+(\.\d)?$/.test(x))) únicas.sort((a, b) => Number(a) - Number(b));
  let r = '';
  for (const x of únicas) { const nuevo = r ? `${r} · ${x}` : x; if (nuevo.length > MAX) break; r = nuevo; }
  return r;
}
