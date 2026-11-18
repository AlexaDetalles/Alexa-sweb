// SEO: sitemap.xml dinámico y una ficha con dirección propia por producto (/producto/<referencia>),
// con título, descripción, Open Graph y datos estructurados (Product + BreadcrumbList) para buscadores.
import { sitio } from './correo.js';
import { hayExistencias, SQL_EN_TIENDA } from './util.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON dentro de <script type="application/ld+json">: se escapa "<" para que un nombre con "</script>" no rompa la página.
const jsonLd = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const lempiras = (n) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);
const recortar = (t, n) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s; };

// Página de cada colección de la tienda (las páginas estáticas que ya existían).
const PAGINA_DE = {
  HP: '/perfumes/hombre', MP: '/perfumes/mujer', PHP: '/perfumes/premium-hombre', PMP: '/perfumes/premium-mujer',
  JYA: '/accesorios/joyeria', RLA: '/accesorios/relojes', CTA: '/accesorios/carteras',
  RPM: '/ropa/mujer', RPH: '/ropa/hombre', CMM: '/tenis/mujer', CHM: '/tenis/hombre',
  PAG: '/regalos/prearmados/ella', PAGH: '/regalos/prearmados/el',
};
const paginaDe = (id) => PAGINA_DE[id] || `/catalogo?categoria=${encodeURIComponent(id)}`;

// Fecha de la última revisión de las páginas fijas (se actualiza cuando cambian sus textos).
const REVISION_PAGINAS = '2026-11-17';
const ESTATICAS = ['/', '/catalogo', '/perfumes', '/perfumes/hombre', '/perfumes/mujer', '/perfumes/premium', '/perfumes/premium-hombre', '/perfumes/premium-mujer',
  '/ropa', '/ropa/mujer', '/ropa/hombre', '/tenis', '/tenis/mujer', '/tenis/hombre',
  '/accesorios', '/accesorios/joyeria', '/accesorios/relojes', '/accesorios/carteras', '/regalos', '/regalos/personalizar', '/regalos/personalizar/ella', '/regalos/personalizar/el',
  '/regalos/prearmados', '/regalos/prearmados/ella', '/regalos/prearmados/el', '/contacto', '/condiciones', '/privacidad', '/terminos'];

export async function sitemap(env) {
  const base = sitio(env);
  const { results } = await env.BD.prepare(`SELECT p.id, p.actualizado FROM productos p JOIN categorias c ON c.id = p.categoria_id LEFT JOIN categorias pa ON pa.id = c.padre_id
    WHERE p.borrado_en IS NULL AND ${SQL_EN_TIENDA} AND c.activa = 1 AND (pa.id IS NULL OR pa.activa = 1) ORDER BY p.orden`).all();
  const hoy = REVISION_PAGINAS;
  const url = (loc, mod, prio) => `<url><loc>${esc(base + loc)}</loc><lastmod>${mod}</lastmod>${prio ? `<priority>${prio}</priority>` : ''}</url>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
    + ESTATICAS.map((p) => url(p, hoy, p === '/' ? '1.0' : p === '/catalogo' ? '0.9' : '0.7')).join('')
    + results.map((p) => url(`/producto/${encodeURIComponent(p.id)}`, String(p.actualizado || hoy).slice(0, 10), '0.6')).join('') + '</urlset>';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

export async function paginaProducto(req, env, id) {
  const u = new URL(req.url);
  const base = sitio(env);
  const p = await env.BD.prepare(`SELECT p.*, c.nombre AS cat_nombre, c.id AS cat_id FROM productos p JOIN categorias c ON c.id = p.categoria_id LEFT JOIN categorias pa ON pa.id = c.padre_id
    WHERE p.id = ? AND p.borrado_en IS NULL AND ${SQL_EN_TIENDA} AND c.activa = 1 AND (pa.id IS NULL OR pa.activa = 1)`).bind(id).first();
  if (!p) {
    const r = await env.ASSETS.fetch(new Request(`${u.origin}/404.html`));
    return new Response(r.body, { status: 404, headers: r.headers });
  }
  const plantilla = await (await env.ASSETS.fetch(new Request(`${u.origin}/assets/producto.tpl.html`))).text();
  const { results: relacionados } = await env.BD.prepare(`SELECT id, nombre, precio, cotizar, imagen_url FROM productos p WHERE p.categoria_id = ? AND p.id <> ? AND p.borrado_en IS NULL AND ${SQL_EN_TIENDA} ORDER BY p.orden LIMIT 4`).bind(p.cat_id, p.id).all();

  const canonical = `${base}/producto/${encodeURIComponent(p.id)}`;
  const imgRel = p.imagen_url || '/assets/images/hero.webp';
  const img = imgRel.startsWith('http') ? imgRel : `${base}${imgRel}`;
  const precio = p.cotizar ? 'Por cotizar por WhatsApp' : lempiras(p.precio);
  const catUrl = paginaDe(p.cat_id);
  const cola = ' Disponible en Tiendas Alexa, Choluteca, Honduras: consulta precio y pide por WhatsApp.';
  const descripcion = recortar((p.descripcion || '').length >= 70 ? p.descripcion : `${p.nombre}. ${p.descripcion ? `${p.descripcion.replace(/[.\s]+$/, '')}.` : ''}${cola}`, 158);
  // Máx. 60 caracteres: nombre + colección si caben; si no, solo el nombre (nunca cortado a media palabra por la colección).
  const conColeccion = `${p.nombre} · ${p.cat_nombre}`;
  const titulo = `${conColeccion.length <= 51 ? conColeccion : recortar(p.nombre, 51)} | ALEXA`;
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, sku: p.id, description: recortar(p.descripcion || p.nombre, 500), image: [img], url: canonical,
      category: p.cat_nombre,
      ...(p.cotizar ? {} : { offers: { '@type': 'Offer', url: canonical, priceCurrency: 'HNL', price: Number(p.precio).toFixed(2), availability: hayExistencias(p) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Store', name: 'Alexa Detalles & Obsequios', url: base } } }),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${base}/` }, { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${base}/catalogo` },
        { '@type': 'ListItem', position: 3, name: p.cat_nombre, item: base + catUrl }, { '@type': 'ListItem', position: 4, name: p.nombre, item: canonical }],
    },
  ];
  const rel = relacionados.length ? `<section class="related" aria-labelledby="rel-t"><h2 id="rel-t">También te puede gustar</h2><div class="related-grid">${relacionados.map((r) => {
    const ri = r.imagen_url ? (r.imagen_url.startsWith('/fotos/') ? r.imagen_url.replace('-1200.', '-600.') : r.imagen_url) : '/assets/images/no-photo.svg';
    return `<a class="related-card" href="/producto/${encodeURIComponent(r.id)}"><img src="${esc(ri)}" alt="${esc(r.nombre)}" width="300" height="360" loading="lazy" decoding="async"><span>${esc(r.nombre)}</span><b>${r.cotizar ? 'Por cotizar' : esc(lempiras(r.precio))}</b></a>`;
  }).join('')}</div></section>` : '';

  const valores = {
    TITULO: esc(titulo), DESC: esc(descripcion), URL: esc(canonical), IMG: esc(img), IMG_REL: esc(imgRel), JSONLD: jsonLd(ld),
    CAT_NOMBRE: esc(p.cat_nombre), CAT_URL: esc(catUrl), NOMBRE: esc(p.nombre), PRECIO: esc(precio), ID: esc(p.id),
    DESCRIPCION: esc(p.descripcion || 'Te ayudamos a confirmar presentación, medidas y detalles de este artículo por WhatsApp.'), RELACIONADOS: rel,
    DISPONIBILIDAD: hayExistencias(p) ? 'Disponible para consultar' : 'Actualmente no disponible',
  };
  const html = plantilla.replace(/%%([A-Z_]+)%%/g, (_, k) => (k in valores ? valores[k] : ''));
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
}

// --- Catálogo con contenido en el HTML ----------------------------------------------------------------
// Las páginas de catálogo y de cada colección se pintan con JavaScript desde /api/catalogo. Para que buscadores y
// asistentes de IA que no ejecutan JavaScript vean los productos (y los enlaces a cada ficha), el servidor deja en el
// HTML las primeras 24 tarjetas con el mismo formato que usa shop.mjs, y una lista de datos estructurados (ItemList).
// shop.mjs las reemplaza al cargar, así que no se duplica nada.
const NOMBRE_FOTO = '/assets/images/no-photo.svg';
const miniaturaDe = (u) => (u ? (u.startsWith('/fotos/') ? u.replace('-1200.', '-600.') : u) : NOMBRE_FOTO);

/** «Últimas unidades» cuando se lleva el control y quedan pocas (5 o menos). */
const ultimas = (p) => (Number.isInteger(p.stock) && p.stock > 0 && p.stock <= 5 ? (p.stock === 1 ? 'Última unidad' : `Últimas ${p.stock} unidades`) : '');
export function tarjetaHTML(p, nombresGrupo) {
  const id = encodeURIComponent(p.id);
  const precio = p.quote ? 'Cotizar por WhatsApp' : lempiras(p.cents / 100);
  const etiqueta = p.quote ? '<span class="availability">Por encargo · imagen ilustrativa</span>' : !p.available ? '<span class="availability">No disponible</span>' : ultimas(p) ? `<span class="availability">${ultimas(p)}</span>` : '';
  return `<article class="product-card"><button class="product-image" type="button" data-product="${esc(p.id)}" aria-label="Ver detalles de ${esc(p.name)}"><img src="${esc(p.thumb || p.img)}" alt="${esc(p.name)}" width="400" height="480" loading="lazy" decoding="async">${etiqueta}</button><p class="product-group">${esc(nombresGrupo[p.group] || '')}</p><h2><a class="product-name-button" href="/producto/${id}" data-product="${esc(p.id)}">${esc(p.name)}</a></h2><p class="price">${esc(precio)}</p><div class="add-slot" data-slot="${esc(p.id)}"></div></article>`;
}

/** Reescribe una página de catálogo: rellena #product-grid con los productos de sus colecciones y añade ItemList. */
export async function conCatalogoEnHTML(resp, datos, base) {
  let grupos = null;
  const productos = () => (grupos && grupos.length ? datos.productos.filter((p) => grupos.includes(p.group)) : datos.productos)
    .slice().sort((a, b) => Number(b.available) - Number(a.available)).slice(0, 24);
  const nombres = Object.fromEntries(datos.categorias.map((c) => [c.id, c.nombre]));
  return new HTMLRewriter()
    .on('body', { element(el) { const g = el.getAttribute('data-groups'); grupos = g ? g.split(',').filter(Boolean) : []; } })
    .on('#product-grid', { element(el) { el.setInnerContent(productos().map((p) => tarjetaHTML(p, nombres)).join(''), { html: true }); } })
    .on('head', { element(el) {
      const lista = productos().filter((p) => !p.quote && Number.isInteger(p.cents));
      if (!lista.length) return;
      const ld = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: lista.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${base}/producto/${encodeURIComponent(p.id)}`, name: p.name })) };
      el.append(`<script type="application/ld+json">${jsonLd(ld)}</script>`, { html: true });
    } })
    .transform(resp);
}

/**
 * Personalizador de regalos: una sola plantilla sirve /regalos/personalizar/ella|el y cada paso.
 * Solo la primera pantalla se indexa; los pasos y el resumen llevan noindex y apuntan al canonical de la primera.
 */
export async function paginaPersonalizador(env, u, publico, paso) {
  const resp = await env.ASSETS.fetch(new Request(`${u.origin}/assets/personalizador.tpl.html`));
  if (!resp.ok) return new Response('No encontrada', { status: 404 });
  const base = sitio(env);
  const canonica = `${base}/regalos/personalizar/${publico}`;
  const quien = publico === 'el' ? 'él' : 'ella';
  const titulo = `Regalo personalizado para ${quien} | ALEXA`;
  const desc = `Arma un regalo para ${quien} paso a paso: elige base, tamaño, contenido y dedicatoria, y confirma tu pedido por WhatsApp. Choluteca, Honduras.`;
  const html = new HTMLRewriter()
    .on('html', { element(el) { el.setAttribute('data-theme', publico); } })
    .on('title', { element(el) { el.setInnerContent(titulo); } })
    .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', { element(el) { el.setAttribute('content', desc); } })
    .on('meta[property="og:title"], meta[name="twitter:title"]', { element(el) { el.setAttribute('content', titulo); } })
    .on('link[rel="canonical"]', { element(el) { el.setAttribute('href', canonica); } })
    .on('meta[property="og:url"]', { element(el) { el.setAttribute('content', canonica); } })
    .on('meta[name="robots"]', { element(el) { el.setAttribute('content', paso ? 'noindex,follow' : 'index,follow'); } })
    .on('body', { element(el) { el.setAttribute('data-publico', publico); if (paso) el.setAttribute('data-paso', paso); } })
    .transform(resp);
  const salida = new Response(html.body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
  if (paso) salida.headers.set('X-Robots-Tag', 'noindex, follow');
  return salida;
}
