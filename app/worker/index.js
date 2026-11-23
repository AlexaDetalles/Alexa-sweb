// Worker de AlexaShop: /api/* (catálogo público, panel y login) y /fotos/* (imágenes en R2).
// Todo lo demás son los archivos estáticos de public/ (la tienda y /admin).
import { ErrorApi, falla, json } from './util.js';
import { rutasAuth } from './auth.js';
import { rutasAdmin, catalogo, regalos, servirFoto, mantenimiento, conCache, purgarCache } from './datos.js';
import { sitemap, paginaProducto, conCatalogoEnHTML, paginaPersonalizador } from './seo.js';
import { redireccion, CON_PRODUCTOS, RE_PERSONALIZADOR } from './rutas.js';
import { sitio } from './correo.js';
import { registrarVista } from './estadisticas.js';
import { hojaCsv } from './finanzas.js';
import { procesarPublicaciones } from './social.js';
import { recordatoriosDeCobro } from './creditos.js';

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
  // Lecturas públicas: caché de 5 min en el borde (protege la base de abuso y de picos); el panel la borra al guardar.
  if (lectura && ruta === 'catalogo') return conCache('catalogo', () => catalogo(env));
  if (lectura && ruta.startsWith('regalos/')) return conCache(ruta, () => regalos(env, ruta.slice(8)));
  // Hojas para la hoja de Google (IMPORTDATA): solo con la clave secreta en la dirección.
  if (lectura && ruta.startsWith('finanzas/csv/')) return hojaCsv(env, ruta.slice(13), new URL(req.url).searchParams.get('clave'));
  // Medición de visitas (solo de quien aceptó en la píldora): anónima, sin IP ni cookies; las de más se descartan en silencio.
  if (req.method === 'POST' && ruta === 'vista') {
    if (!(await dentroDelLimite(req, env.LIMITE_VISTA, env))) return new Response(null, { status: 204 });
    return registrarVista(req, env, await leerJson(req).catch(() => ({})));
  }
  if (req.method === 'POST' && /^auth\/(entrar|configurar|confirmar|recuperar|restablecer|invitacion-aceptar|huella\/opciones-entrar|huella\/entrar)$/.test(ruta) && !(await dentroDelLimite(req, env.LIMITE_AUTH, env))) falla(429, 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.');
  if (ruta.startsWith('auth/')) return rutasAuth(req, env, ruta.slice(5), await leerJson(req), ctx);
  if (ruta.startsWith('admin/')) {
    const resp = await rutasAdmin(req, env, ruta.slice(6), ruta === 'admin/fotos' || (ruta === 'admin/publicaciones' && req.method === 'POST') ? {} : await leerJson(req), ctx);
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
      if (pathname === '/sitemap.xml' && ['GET', 'HEAD'].includes(req.method)) return conCabeceras(await conCache('sitemap', () => sitemap(env), 3600));
      if (pathname.startsWith('/producto/') && ['GET', 'HEAD'].includes(req.method)) return conCabeceras(await conCache(`producto/${pathname.slice(10).replace(/\/$/, '')}`, () => paginaProducto(req, env, decodeURIComponent(pathname.slice(10)).replace(/\/$/, '')), 120));
      if (pathname.startsWith('/fotos/') && req.method === 'GET') return conCabeceras(await servirFoto(env, decodeURIComponent(pathname.slice(7))));
      if (['GET', 'HEAD'].includes(req.method)) {
        // Direcciones antiguas y «.html» → 301 a la dirección limpia (conserva ?consulta).
        const nueva = redireccion(pathname);
        if (nueva) return conCabeceras(new Response(null, { status: 301, headers: { Location: nueva + new URL(req.url).search } }));
        const pers = pathname.match(RE_PERSONALIZADOR);
        if (pers) return conCabeceras(await paginaPersonalizador(env, new URL(req.url), pers[1], pers[2]));
        // Páginas de catálogo: dejan los productos escritos en el HTML (ver seo.js).
        if (CON_PRODUCTOS.has(pathname)) {
          const pagina = await env.ASSETS.fetch(req);
          if (!pagina.ok) return conCabeceras(pagina);
          const datos = await (await conCache('catalogo', () => catalogo(env))).json();
          return conCabeceras(await conCatalogoEnHTML(pagina, datos, sitio(env)));
        }
      }
      return env.ASSETS.fetch(req);
    } catch (e) {
      if (e instanceof ErrorApi) return conCabeceras(json({ error: e.message }, e.estado));
      console.error(e);
      return conCabeceras(json({ error: 'Algo salió mal. Intenta de nuevo en un momento.' }, 500));
    }
  },

  // Cada lunes: respaldo en R2 y limpieza (ver wrangler.jsonc → triggers).
  async scheduled(evento, env, ctx) {
    // Cada 5 minutos: publicaciones programadas en redes. Cada lunes: respaldo y limpieza.
    if (evento.cron === '*/5 * * * *') ctx.waitUntil(procesarPublicaciones(env).then((r) => r.length && console.log('publicaciones', JSON.stringify(r))));
    else if (evento.cron === '0 14 * * *') ctx.waitUntil(recordatoriosDeCobro(env).then((r) => console.log('cobros', JSON.stringify(r))));
    else ctx.waitUntil(mantenimiento(env).then((r) => console.log('mantenimiento', r)));
  },
};
