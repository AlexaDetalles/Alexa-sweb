// SEO: sitemap.xml dinámico y una ficha con dirección propia por producto (/producto/<referencia>),
// con título, descripción, Open Graph y datos estructurados (Product + BreadcrumbList) para buscadores.
import { sitio } from './correo.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON dentro de <script type="application/ld+json">: se escapa "<" para que un nombre con "</script>" no rompa la página.
const jsonLd = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const lempiras = (n) => new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);
const recortar = (t, n) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s; };

// Página de cada colección de la tienda (las páginas estáticas que ya existían).
const PAGINA_DE = {
  HP: '/Catalogo/Perfumes/hombre.html', MP: '/Catalogo/Perfumes/mujer.html', PHP: '/Catalogo/Perfumes/premiumhombre.html', PMP: '/Catalogo/Perfumes/premiummujer.html',
  JYA: '/Catalogo/accesorios/joyeria.html', RLA: '/Catalogo/accesorios/relojes.html', CTA: '/Catalogo/accesorios/carteras.html',
  PAG: '/Detalles/pick-and-go.html', PAGH: '/Detalles/pick-and-go-hombre.html',
};
const paginaDe = (id) => PAGINA_DE[id] || `/catalogo.html?categoria=${encodeURIComponent(id)}`;

const ESTATICAS = ['/', '/catalogo.html', '/Catalogo/Perfumes/index.html', '/Catalogo/Perfumes/hombre.html', '/Catalogo/Perfumes/mujer.html', '/Catalogo/Perfumes/premiumindex.html', '/Catalogo/Perfumes/premiumhombre.html', '/Catalogo/Perfumes/premiummujer.html',
  '/Catalogo/accesorios/index.html', '/Catalogo/accesorios/joyeria.html', '/Catalogo/accesorios/relojes.html', '/Catalogo/accesorios/carteras.html', '/Detalles/index.html', '/Detalles/indexforhm.html', '/Detalles/pick-and-go.html', '/Detalles/pick-and-go-hombre.html',
  '/redes.html', '/condiciones.html', '/privacidad.html', '/terminos.html'];

export async function sitemap(env) {
  const base = sitio(env);
  const { results } = await env.BD.prepare(`SELECT p.id, p.actualizado FROM productos p JOIN categorias c ON c.id = p.categoria_id LEFT JOIN categorias pa ON pa.id = c.padre_id
    WHERE p.borrado_en IS NULL AND p.visible = 1 AND c.activa = 1 AND (pa.id IS NULL OR pa.activa = 1) ORDER BY p.orden`).all();
  const hoy = new Date().toISOString().slice(0, 10);
  const url = (loc, mod, prio) => `<url><loc>${esc(base + loc)}</loc><lastmod>${mod}</lastmod>${prio ? `<priority>${prio}</priority>` : ''}</url>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`
    + ESTATICAS.map((p) => url(p, hoy, p === '/' ? '1.0' : p === '/catalogo.html' ? '0.9' : '0.7')).join('')
    + results.map((p) => url(`/producto/${encodeURIComponent(p.id)}`, String(p.actualizado || hoy).slice(0, 10), '0.6')).join('') + '</urlset>';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

export async function paginaProducto(req, env, id) {
  const u = new URL(req.url);
  const base = sitio(env);
  const p = await env.BD.prepare(`SELECT p.*, c.nombre AS cat_nombre, c.id AS cat_id FROM productos p JOIN categorias c ON c.id = p.categoria_id LEFT JOIN categorias pa ON pa.id = c.padre_id
    WHERE p.id = ? AND p.borrado_en IS NULL AND p.visible = 1 AND c.activa = 1 AND (pa.id IS NULL OR pa.activa = 1)`).bind(id).first();
  if (!p) {
    const r = await env.ASSETS.fetch(new Request(`${u.origin}/404.html`));
    return new Response(r.body, { status: 404, headers: r.headers });
  }
  const plantilla = await (await env.ASSETS.fetch(new Request(`${u.origin}/assets/producto.tpl.html`))).text();
  const { results: relacionados } = await env.BD.prepare(`SELECT id, nombre, precio, cotizar, imagen_url FROM productos WHERE categoria_id = ? AND id <> ? AND borrado_en IS NULL AND visible = 1 ORDER BY orden LIMIT 4`).bind(p.cat_id, p.id).all();

  const canonical = `${base}/producto/${encodeURIComponent(p.id)}`;
  const imgRel = p.imagen_url || '/assets/images/hero.webp';
  const img = imgRel.startsWith('http') ? imgRel : `${base}${imgRel}`;
  const precio = p.cotizar ? 'Por cotizar por WhatsApp' : lempiras(p.precio);
  const catUrl = paginaDe(p.cat_id);
  const descripcion = recortar(p.descripcion || `${p.nombre} en Tiendas Alexa, Choluteca, Honduras. Consulta precio y disponibilidad y pide por WhatsApp.`, 158);
  const titulo = `${recortar(p.nombre, 60)} · ${p.cat_nombre} | ALEXA`;
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Product', name: p.nombre, sku: p.id, description: recortar(p.descripcion || p.nombre, 500), image: [img], url: canonical,
      category: p.cat_nombre,
      ...(p.cotizar ? {} : { offers: { '@type': 'Offer', url: canonical, priceCurrency: 'HNL', price: Number(p.precio).toFixed(2), availability: p.disponible ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition', seller: { '@type': 'Store', name: 'Alexa Detalles & Obsequios', url: base } } }),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${base}/` }, { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${base}/catalogo.html` },
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
    DISPONIBILIDAD: p.disponible ? 'Disponible para consultar' : 'Actualmente no disponible',
  };
  const html = plantilla.replace(/%%([A-Z_]+)%%/g, (_, k) => (k in valores ? valores[k] : ''));
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
}
