// Direcciones limpias (sin «.html») y redirecciones desde las direcciones antiguas.
// Los archivos estáticos viven en public/ con el mismo nombre que su dirección (perfumes/hombre.html → /perfumes/hombre).

/** Direcciones antiguas → nueva (se responde 301, para que Google y los enlaces guardados se muden). */
const ANTIGUAS = {
  '/index': '/',
  '/redes': '/contacto', '/Catalogo/Perfumes/redes': '/contacto', '/Catalogo/accesorios/redes': '/contacto',
  '/Catalogo': '/catalogo',
  '/Catalogo/Perfumes': '/perfumes', '/Catalogo/Perfumes/index': '/perfumes',
  '/Catalogo/Perfumes/hombre': '/perfumes/hombre', '/Catalogo/Perfumes/mujer': '/perfumes/mujer',
  '/Catalogo/Perfumes/premiumindex': '/perfumes/premium', '/Catalogo/Perfumes/premiumhombre': '/perfumes/premium-hombre', '/Catalogo/Perfumes/premiummujer': '/perfumes/premium-mujer',
  '/Catalogo/accesorios': '/accesorios', '/Catalogo/accesorios/index': '/accesorios',
  '/Catalogo/accesorios/joyeria': '/accesorios/joyeria', '/Catalogo/accesorios/relojes': '/accesorios/relojes', '/Catalogo/accesorios/carteras': '/accesorios/carteras',
  '/Detalles': '/regalos', '/Detalles/index': '/regalos', '/Detalles/indexforhm': '/regalos/personalizar', '/Detalles/pagindex': '/regalos/prearmados',
  '/Detalles/pick-and-go': '/regalos/prearmados/ella', '/Detalles/pick-and-go-hombre': '/regalos/prearmados/el',
  '/Detalles/mujer': '/regalos/personalizar/ella', '/Detalles/hombre': '/regalos/personalizar/el',
};
const PASOS_ANTIGUOS = { personalizar: '', personalizar2: '', personalizar3: '', personalizar4: '', personalizar5: '', personalizarfinal: '', resumen: '/resumen' };

/** Si `ruta` es una dirección antigua o termina en «.html», devuelve la nueva; si ya es limpia, null. */
export function redireccion(ruta) {
  if (ruta === '/' || /^\/(admin|api|fotos|producto|assets)(\/|$)/.test(ruta)) return null;
  const sinBarra = ruta.replace(/\/+$/, '');
  const limpia = sinBarra.replace(/\.html$/, '').replace(/\/index$/, '') || '/';
  if (ANTIGUAS[limpia]) return ANTIGUAS[limpia];
  const paso = limpia.match(/^\/Detalles\/(mujer|hombre)\/([a-z0-9]+)$/);
  if (paso && paso[2] in PASOS_ANTIGUOS) return `/regalos/personalizar/${paso[1] === 'mujer' ? 'ella' : 'el'}${PASOS_ANTIGUOS[paso[2]]}`;
  if (/^\/(Catalogo|Detalles)(\/|$)/.test(limpia)) return limpia.startsWith('/Catalogo') ? '/catalogo' : '/regalos';
  if (limpia !== sinBarra || sinBarra !== ruta) return limpia; // «/algo.html» → «/algo»; «/algo/» → «/algo»
  return null;
}

/** Páginas que dejan los productos escritos en el HTML (ver seo.js). */
export const CON_PRODUCTOS = new Set([
  '/catalogo', '/perfumes', '/perfumes/hombre', '/perfumes/mujer', '/perfumes/premium', '/perfumes/premium-hombre', '/perfumes/premium-mujer',
  '/ropa', '/ropa/mujer', '/ropa/hombre', '/tenis', '/tenis/mujer', '/tenis/hombre',
  '/accesorios', '/accesorios/joyeria', '/accesorios/relojes', '/accesorios/carteras', '/regalos/prearmados/ella', '/regalos/prearmados/el',
]);

/** Personalizador de regalos: /regalos/personalizar/ella|el y cada paso (/<paso>) o /resumen. Una sola plantilla para todos. */
export const RE_PERSONALIZADOR = /^\/regalos\/personalizar\/(ella|el)(?:\/([a-z0-9-]{1,30}))?\/?$/;
export const PLANTILLA_PERSONALIZADOR = '/assets/personalizador.tpl.html';
