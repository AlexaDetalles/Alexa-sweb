// Worker de AlexaShop: /api/* (catálogo público, panel y login) y /fotos/* (imágenes en R2).
// Todo lo demás son los archivos estáticos de public/ (la tienda y /admin).
import { ErrorApi, falla, json } from './util.js';
import { rutasAuth } from './auth.js';
import { rutasAdmin, catalogo, regalos, servirFoto, mantenimiento } from './datos.js';

const CABECERAS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
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

async function api(req, env, ruta) {
  // Contra ataques desde otros sitios (CSRF): toda escritura debe venir de esta misma web.
  if (req.method !== 'GET' && req.headers.get('Origin') !== new URL(req.url).origin) falla(403, 'Origen no permitido.');
  if (req.method === 'GET' && ruta === 'catalogo') return catalogo(env);
  if (req.method === 'GET' && ruta.startsWith('regalos/')) return regalos(env, ruta.slice(8));
  if (req.method === 'POST' && ruta === 'auth/entrar' && !(await dentroDelLimite(req, env.LIMITE_AUTH, env))) falla(429, 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.');
  if (ruta.startsWith('auth/')) return rutasAuth(req, env, ruta.slice(5), await leerJson(req));
  if (ruta.startsWith('admin/')) return rutasAdmin(req, env, ruta.slice(6), ruta === 'admin/fotos' ? {} : await leerJson(req));
  return falla(404, 'Ruta no encontrada.');
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    try {
      if (pathname.startsWith('/api/')) return conCabeceras(await api(req, env, pathname.slice(5)));
      if (pathname.startsWith('/fotos/') && req.method === 'GET') return conCabeceras(await servirFoto(env, decodeURIComponent(pathname.slice(7))));
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
