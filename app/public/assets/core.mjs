export const GROUPS = {
  HP: 'Perfumes para él', MP: 'Perfumes para ella', PHP: 'Premium para él', PMP: 'Premium para ella',
  JYA: 'Joyería', RLA: 'Relojes', CTA: 'Carteras',
  PAG: 'Regalos para ella', PAGH: 'Regalos para él'
};
export const money = cents => new Intl.NumberFormat('es-HN', {style:'currency', currency:'HNL'}).format(cents / 100);
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Quoted commas, escaped quotes and embedded newlines belong to the same CSV field.
export function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i+1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i+1] === '\n') i++;
      row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += ch;
  }
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function price(raw) {
  const n = Number(String(raw).replace(/,/g, ''));
  const cents = Math.round(n * 100);
  return raw !== '' && Number.isSafeInteger(cents) && n >= 0 && cents <= 100000000 ? cents : null;
}
const validID = id => /^[A-Za-z0-9._-]{1,80}$/.test(id) && !['__proto__','constructor','prototype'].includes(id);

export function imageURL(raw) {
  const value = String(raw || '').split(/,\s*(?=https?:\/\/)/)[0].trim();
  const local = value.match(/^https:\/\/alexashop\.cc\/img\/(\d+)\.png$/);
  // These are the real photographs present in the repository.
  if (local && (+local[1] <= 54 || (+local[1] >= 79 && +local[1] <= 115))) return `/assets/images/${local[1]}.webp`;
  const external = value.match(/^https:\/\/alexadetalles\.github\.io\/imagenes-nuevas\/img\/([a-z0-9]+)\.png$/);
  const saved = ['adidasamarilla','adidasrojo','arianagrande','armafcandy','bluebanderas','bluenigth','cancan','charliegold','clubdenuit','clubdenuitwoman','cold','dubainichebubbles','geniusblush','glacier','kamra','nauticaperronaosiosi','rush','vainillaazucar','victoriasecret','yara'];
  if (external && saved.includes(external[1])) return `/assets/images/${external[1]}.webp`;
  // Only known, locally archived images may load; sheet edits cannot add tracking hosts.
  return '/assets/images/no-photo.svg';
}

export function parseProducts(text) {
  const seen = new Set();
  return parseCSV(text).slice(1).flatMap(c => {
    const cents = price(c[2] ?? '');
    if (!validID(c[0]) || !c[1] || !Object.hasOwn(GROUPS,c[5]) || cents === null || seen.has(c[0]) || !/^true$/i.test(c[4])) return [];
    seen.add(c[0]);
    return [{id:c[0],name:c[1],cents,img:imageURL(c[3]),available:/^true$/i.test(c[4]),group:c[5],description:c[6] || ''}];
  });
}

// Una línea de la bolsa se identifica por «REFERENCIA» o, cuando el producto tiene varias tallas, por «REFERENCIA@TALLA» (cada talla es una línea).
const validSize = size => /^[A-Za-z0-9.\-]{1,10}$/.test(size);
const validKey = key => { const parts = String(key).split('@'); return parts.length <= 2 && validID(parts[0]) && (parts.length === 1 || validSize(parts[1])); };
export const cartId = key => String(key).split('@')[0];
export const cartSize = key => String(key).split('@')[1] || '';
export function sanitizeCart(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key,q]) => validKey(key) && Number.isInteger(q) && q > 0 && q <= 99));
}
/** Tallas con las que se puede comprar un producto (la API las manda en `sizes`). */
export const sizesOf = p => (Array.isArray(p?.sizes) ? p.sizes : []);
/** Un producto con varias tallas exige elegir una; con una sola, esa es su talla. */
export function lineSize(p, key) {
  const chosen = cartSize(key).toUpperCase(), sizes = sizesOf(p);
  return chosen || (sizes.length === 1 ? sizes[0] : '');
}
/** Problema de una línea: 'falta-talla' (producto con varias tallas y ninguna elegida), 'talla-agotada' (la talla elegida ya no está) o ''. */
export function lineProblem(p, key) {
  const sizes = sizesOf(p), chosen = cartSize(key).toUpperCase();
  if (sizes.length > 1 && !chosen) return 'falta-talla';
  if (chosen && sizes.length && !sizes.includes(chosen)) return 'talla-agotada';
  return '';
}
export function cartLines(cart, products) {
  return Object.entries(sanitizeCart(cart)).map(([key,qty]) => { const product = products.find(p=>p.id === cartId(key)); return {key,product,qty,size:product?lineSize(product,key):''}; }).filter(l=>l.product);
}
export function cartTotal(cart, products) { return cartLines(cart,products).reduce((s,l)=>s+(l.product.quote?0:l.product.cents*l.qty),0); }
export function cartSummary(cart,products) {
  const lines=cartLines(cart,products),quoted=lines.some(l=>l.product.quote);
  if(!quoted)return money(cartTotal(cart,products));
  return lines.some(l=>!l.product.quote)?`${money(cartTotal(cart,products))} + regalos por cotizar`:'Por cotizar';
}

export function cartMessage(cart,products,note='') {
  const lines = cartLines(cart,products);
  if (!lines.length || lines.length !== Object.keys(sanitizeCart(cart)).length || lines.some(l=>!l.product.available || lineProblem(l.product,l.key))) return null;
  return '¡Hola, Alexa! Quiero consultar esta selección:\n\n' + lines.map(l=>`${l.qty} × ${l.product.name} [${l.product.id}]${l.size?` · talla ${l.size}`:''} — ${l.product.quote?'Propuesta por encargo, por cotizar':money(l.product.cents*l.qty)}`).join('\n') +
    `\n\nSubtotal estimado: ${cartSummary(cart,products)}${note?'\nNotas: '+note.slice(0,300):''}\n¿Me confirman contenido, disponibilidad, precio final y opciones de entrega?`;
}
