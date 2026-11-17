// Texto de las publicaciones en redes (Instagram y Facebook). Funciones puras: se prueban sin navegador.

/** Hashtag por categoría; si no hay uno propio, el nombre de la categoría sin acentos ni espacios. */
const HASHTAGS = { HP: 'perfumes', MP: 'perfumes', PHP: 'perfumes', PMP: 'perfumes', JYA: 'joyeria', RLA: 'relojes', CTA: 'carteras', RPM: 'ropa', RPH: 'ropa', CMM: 'tenis', CHM: 'tenis', PAG: 'regalos', PAGH: 'regalos' };
export function hashtag(categoriaId, nombreCategoria = '') {
  if (HASHTAGS[categoriaId]) return HASHTAGS[categoriaId];
  const limpio = String(nombreCategoria).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return limpio || 'alexashop';
}

/** «4400Lps» (sin separador de miles, como se publica en las redes). */
export function precioEnRedes(precio) {
  const n = Number(precio);
  if (precio === '' || precio === null || precio === undefined || !Number.isFinite(n)) return '';
  return `${Math.round(n * 100) / 100}Lps`;
}

/**
 * Descripción corta lista para publicar:
 *   Valentino Born in Roma
 *   Precio: 4400Lps
 *   Alexashop.cc
 *   #perfumes
 */
export function armarDescripcion({ nombre, precio, cotizar, categoriaId, categoriaNombre }) {
  const lineas = [String(nombre || '').trim()];
  if (cotizar) lineas.push('Precio: por consultar');
  else if (precioEnRedes(precio)) lineas.push(`Precio: ${precioEnRedes(precio)}`);
  lineas.push('Alexashop.cc', `#${hashtag(categoriaId, categoriaNombre)}`);
  return lineas.filter(Boolean).join('\n');
}

/** Hora local del navegador (campo datetime-local) → instante ISO (UTC) para el servidor. */
export const aISO = (valorLocal) => { const t = new Date(valorLocal); return Number.isNaN(t.getTime()) ? '' : t.toISOString(); };
