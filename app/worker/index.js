// Worker de AlexaShop: /api/* (catálogo público, panel y login) y /fotos/* (imágenes en R2).
// Todo lo demás son los archivos estáticos de public/ (la tienda y /admin).
import { ErrorApi, falla, json } from './util.js';
import { rutasAuth } from './auth.js';
import { rutasAdmin, catalogo, regalos, servirFoto, mantenimiento, conCache, purgarCache } from './datos.js';
import { sitemap, paginaProducto, conCatalogoEnHTML } from './seo.js';
import { sitio } from './correo.js';
import { registrarVista } from './estadisticas.js';

const CABECERAS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
};
function conCabeceras(resp) {
  const r = new Response(resp.body, resp);
  for (const [k, v] of Object.entries(CABECERAS)) if (!r.headers.has(k)) r.headers.set(k, v);
  return r;
}

async function leerJson(req) {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return {};
  const texto = await req.text();
  if (texto.length > 64 * 1024) falla(413, 'Demasiados datos.');
  if (!texto) return {};
  try {
    const d = JSON.parse(texto);
    return d && typeof d === 'object' && !Array.isArray(d) ? d : falla(400, 'Datos no válidos.');
  } catch (e) { if (e instanceof ErrorApi) throw e; return falla(400, 'Datos no válidos.'); }
}

async function dentroDelLimite(req, limite, env) {
  if (!limite || env.DEV === '1') return true;
  return (await limite.limit({ key: req.headers.get('CF-Connecting-IP') || 'sin-ip' })).success;
}

async function api(req, env, ruta, ctx) {
  // Contra ataques desde otros sitios (CSRF): toda escritura debe venir de esta misma web.
  const lectura = ['GET', 'HEAD'].includes(req.method);
  if (!lectura && req.headers.get('Origin') !== new URL(req.url).origin) falla(403, 'Origen no permitido.');
  // Lecturas públicas: caché de 60 s en el borde (protege la base de abuso y de picos); el panel la borra al guardar.
  if (lectura && ruta === 'catalogo') return conCache('catalogo', () => catalogo(env));
  if (lectura && ruta.startsWith('regalos/')) return conCache(ruta, () => regalos(env, ruta.slice(8)));
  // Medición de visitas (solo de quien aceptó en la píldora): anónima, sin IP ni cookies; las de más se descartan en silencio.
  if (req.method === 'POST' && ruta === 'vista') {
    if (!(await dentroDelLimite(req, env.LIMITE_VISTA, env))) return new Response(null, { status: 204 });
    return registrarVista(req, env, await leerJson(req).catch(() => ({})));
  }
  if (req.method === 'POST' && /^auth\/(entrar|configurar|confirmar|recuperar|restablecer|invitacion-aceptar|huella\/opciones-entrar|huella\/entrar)$/.test(ruta) && !(await dentroDelLimite(req, env.LIMITE_AUTH, env))) falla(429, 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.');
  if (ruta.startsWith('auth/')) return rutasAuth(req, env, ruta.slice(5), await leerJson(req), ctx);
  if (ruta.startsWith('admin/')) {
    const resp = await rutasAdmin(req, env, ruta.slice(6), ruta === 'admin/fotos' ? {} : await leerJson(req), ctx);
    if (!lectura) await purgarCache();
    return resp;
  }
  return falla(404, 'Ruta no encontrada.');
}

export default {
  async fetch(req, env, ctx) {
    const { pathname, hostname } = new URL(req.url);
    // Una sola dirección por página: www.alexashop.cc redirige (301) a alexashop.cc.
    if (hostname.startsWith('www.') && ['GET', 'HEAD'].includes(req.method)) return Response.redirect(req.url.replace('//www.', '//'), 301);
    try {
      if (pathname.startsWith('/api/')) return conCabeceras(await api(req, env, pathname.slice(5), ctx));
      if (pathname === '/sitemap.xml' && ['GET', 'HEAD'].includes(req.method)) return conCabeceras(await sitemap(env));
      if (pathname.startsWith('/producto/') && ['GET', 'HEAD'].includes(req.method)) return conCabeceras(await paginaProducto(req, env, decodeURIComponent(pathname.slice(10)).replace(/\/$/, '')));
      if (pathname.startsWith('/fotos/') && req.method === 'GET') return conCabeceras(await servirFoto(env, decodeURIComponent(pathname.slice(7))));
      // Las direcciones con «.html» se sirven tal cual (sin redirección 307), para que coincidan con el canonical y el sitemap.
      if (pathname.endsWith('.html') && ['GET', 'HEAD'].includes(req.method)) {
        const limpia = pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
        const pagina = await env.ASSETS.fetch(new Request(new URL(limpia + new URL(req.url).search, req.url), req));
        // Páginas de catálogo: dejan los productos escritos en el HTML (ver seo.js).
        if (pagina.ok && (pathname === '/catalogo.html' || pathname.startsWith('/Catalogo/') || pathname.startsWith('/Detalles/pick-and-go')) && !pathname.endsWith('/index.html')) {
          const datos = await (await conCache('catalogo', () => catalogo(env))).json();
          return conCabeceras(await conCatalogoEnHTML(pagina, datos, sitio(env)));
        }
        return conCabeceras(pagina);
      }
      return env.ASSETS.fetch(req);
    } catch (e) {
      if (e instanceof ErrorApi) return conCabeceras(json({ error: e.message }, e.estado));
      console.error(e);
      return conCabeceras(json({ error: 'Algo salió mal. Intenta de nuevo en un momento.' }, 500));
    }
  },

  // Cada lunes: respaldo en R2 y limpieza (ver wrangler.jsonc → triggers).
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(mantenimiento(env).then((r) => console.log('mantenimiento', r)));
  },
};
