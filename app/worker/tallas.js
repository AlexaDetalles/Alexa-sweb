// Lee las tallas escritas en la descripción de un producto y las deja en el formato corto del campo «Talla» (el que sale en las imágenes para redes).
//   «Talla 11 y 12»                   → «11 · 12»
//   «Tres tallas disponibles, 9.5, 9 y 7» → «7 · 9 · 9.5»
//   «Talla S y XXL»                   → «S · XXL»
//   «Talla 28-30 y 36-38»             → «28-30 · 36-38»
//   «Unitalla»                        → «ÚNICA»
// Si no hay talla, o algo no tiene sentido (p. ej. «28-330»), devuelve '' y se deja para llenar a mano.
const LETRAS = new Set(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']);
const MAX = 20; // largo del campo Talla
const num = /^(\d{1,3}(?:\.\d)?)([A-Z]?)$/;
const rango = /^(\d{1,3}(?:\.\d)?)-(\d{1,3}(?:\.\d)?)$/;
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
    if ((r = rango.exec(p))) { const a = Number(r[1]), b = Number(r[2]); if (!sensato(a) || !sensato(b) || a >= b) return ''; salida.push(p); }
    else if ((r = num.exec(p))) { if (!sensato(Number(r[1]))) return ''; salida.push(p); }
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
