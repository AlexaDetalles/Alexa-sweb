// Publicar en Instagram y Facebook desde el panel (API oficial de Meta, Graph API). Inmediato o programado.
//
// Secretos del Worker (npx wrangler secret put …), se configuran UNA vez:
//   META_TOKEN   token de acceso de la página de Facebook (de larga duración)
//   META_PAGE_ID id de la página de Facebook
//   META_IG_ID   id de la cuenta de Instagram profesional enlazada a esa página
// Opcional: variable META_API para apuntar a otro servidor (las pruebas usan uno falso).
import { falla, json, fechaSql } from './util.js';
import { sitio } from './correo.js';

const API = (env) => (env.META_API || 'https://graph.facebook.com/v21.0').replace(/\/$/, '');
const REDES = { ig: 'Instagram', fb: 'Facebook' };

export const estadoMeta = (env) => ({
  instagram: !!(env.META_TOKEN && env.META_IG_ID),
  facebook: !!(env.META_TOKEN && env.META_PAGE_ID),
});

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Llamada a Meta. Nunca devuelve ni registra el token: los errores solo llevan el mensaje que da Meta. */
async function meta(env, ruta, params, metodo = 'POST') {
  const url = new URL(`${API(env)}/${ruta}`);
  const cuerpo = new URLSearchParams({ ...params, access_token: env.META_TOKEN });
  let r;
  if (metodo === 'GET') { cuerpo.forEach((v, k) => url.searchParams.set(k, v)); r = await fetch(url, { method: 'GET' }); }
  else r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: cuerpo });
  let datos = {};
  try { datos = await r.json(); } catch { /* respuesta sin JSON */ }
  if (!r.ok || datos.error) {
    const e = new Error(String(datos.error?.message || `Meta respondió ${r.status}`).replace(/access_token=[^&\s]+/g, 'access_token=…').slice(0, 300));
    e.codigo = datos.error?.code; e.subcodigo = datos.error?.error_subcode;
    throw e;
  }
  return datos;
}

async function publicarInstagram(env, imagen, descripcion, historia) {
  // Historia: imagen vertical 9:16 sin texto (las Stories de Instagram no llevan descripción).
  const c = await meta(env, `${env.META_IG_ID}/media`, historia ? { image_url: imagen, media_type: 'STORIES' } : { image_url: imagen, caption: descripcion });
  // Instagram procesa la imagen unos segundos: se reintenta hasta que esté lista.
  let ultimo;
  for (let i = 0; i < 6; i++) {
    try { return (await meta(env, `${env.META_IG_ID}/media_publish`, { creation_id: c.id })).id; }
    catch (e) { ultimo = e; if (e.codigo !== 9007 && e.subcodigo !== 2207027) throw e; await esperar(env.META_API ? 10 : 2500); }
  }
  throw ultimo;
}
async function publicarFacebook(env, imagen, descripcion, historia) {
  if (historia) { // historia de la página: se sube la foto sin publicarla y luego se publica como historia
    const f = await meta(env, `${env.META_PAGE_ID}/photos`, { url: imagen, published: 'false' });
    const h = await meta(env, `${env.META_PAGE_ID}/photo_stories`, { photo_id: f.id });
    return h.post_id || f.id;
  }
  const r = await meta(env, `${env.META_PAGE_ID}/photos`, { url: imagen, caption: descripcion, published: 'true' });
  return r.post_id || r.id;
}

/** Publica una fila de `publicaciones`. Si una red ya salió bien en un intento anterior, no se repite. */
async function publicar(env, fila) {
  const resultado = JSON.parse(fila.resultado || '{}');
  const imagen = `${sitio(env)}/fotos/${fila.imagen_clave}`;
  for (const red of fila.redes.split(',')) {
    if (resultado[red]?.ok) continue;
    try {
      if (!estadoMeta(env)[red === 'ig' ? 'instagram' : 'facebook']) throw new Error(`${REDES[red]} no está conectado todavía (faltan las claves de Meta).`);
      const id = red === 'ig' ? await publicarInstagram(env, imagen, fila.descripcion, fila.formato === 'historia') : await publicarFacebook(env, imagen, fila.descripcion, fila.formato === 'historia');
      resultado[red] = { ok: true, id };
    } catch (e) { resultado[red] = { ok: false, error: e.message }; }
  }
  const todoBien = fila.redes.split(',').every((r) => resultado[r]?.ok);
  await env.BD.prepare('UPDATE publicaciones SET estado = ?, resultado = ?, intentos = intentos + 1 WHERE id = ?').bind(todoBien ? 'publicada' : 'error', JSON.stringify(resultado), fila.id).run();
  return { estado: todoBien ? 'publicada' : 'error', resultado };
}

// --- rutas del panel -----------------------------------------------------------------------
const esJpeg = (b) => b.length > 12 && b[0] === 255 && b[1] === 216 && b[2] === 255;

/** POST /api/admin/publicaciones (multipart): imagen JPEG, descripcion, redes, programada_en (opcional, ISO) y producto_id (opcional). */
export async function crearPublicacion(req, env, sesion) {
  const form = await req.formData();
  const f = form.get('imagen');
  if (!f || typeof f === 'string') falla(400, 'Falta la imagen.');
  if (f.size > 8 * 1024 * 1024) falla(400, 'La imagen pesa demasiado (máximo 8 MB).');
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (!esJpeg(bytes)) falla(400, 'La imagen debe ser JPEG (Instagram no acepta PNG).');
  const formato = String(form.get('formato') ?? 'post') === 'historia' ? 'historia' : 'post';
  let descripcion = String(form.get('descripcion') ?? '').replace(/\r\n?/g, '\n').trim(); // los formularios mandan saltos de línea CRLF
  if (formato === 'historia' && !descripcion) descripcion = 'Historia'; // las historias no llevan texto: esto solo identifica la publicación en el panel
  if (!descripcion || descripcion.length > 2200) falla(400, 'Escribe la descripción (máximo 2200 caracteres).');
  const pedidas = String(form.get('redes') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!pedidas.length || pedidas.some((r) => !REDES[r])) falla(400, 'Elige Instagram, Facebook o las dos.');
  const redes = ['ig', 'fb'].filter((r) => pedidas.includes(r));
  const cuando = String(form.get('programada_en') ?? '').trim();
  let programada = fechaSql();
  if (cuando) {
    const t = Date.parse(cuando);
    if (Number.isNaN(t)) falla(400, 'La fecha programada no es válida.');
    if (t > Date.now() + 60000) programada = fechaSql(t);
    if (t > Date.now() + 90 * 86400000) falla(400, 'Programa dentro de los próximos 90 días.');
  }
  const clave = `social/${crypto.randomUUID()}.jpg`;
  await env.FOTOS.put(clave, bytes, { httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' } });
  const productoId = String(form.get('producto_id') ?? '').slice(0, 80) || null;
  const r = await env.BD.prepare('INSERT INTO publicaciones (producto_id, descripcion, imagen_clave, redes, programada_en, usuario, formato) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(productoId, descripcion, clave, redes.join(','), programada, sesion?.correo ?? '', formato).run();
  const id = r.meta.last_row_id;
  if (programada > fechaSql()) return json({ id, estado: 'pendiente', programada_en: programada }, 201);
  const fila = await env.BD.prepare('SELECT * FROM publicaciones WHERE id = ?').bind(id).first();
  return json({ id, ...(await publicar(env, fila)) }, 201);
}

export async function listarPublicaciones(env) {
  const { results } = await env.BD.prepare('SELECT * FROM publicaciones ORDER BY id DESC LIMIT 30').all();
  return json({
    conexion: estadoMeta(env),
    publicaciones: results.map((p) => ({ ...p, resultado: JSON.parse(p.resultado || '{}'), redes: p.redes.split(',') })),
  });
}

export async function reintentarPublicacion(env, id) {
  const fila = await env.BD.prepare("SELECT * FROM publicaciones WHERE id = ? AND estado IN ('error', 'pendiente')").bind(Number(id)).first();
  if (!fila) falla(404, 'Esa publicación ya salió o no existe.');
  return json(await publicar(env, fila));
}

export async function cancelarPublicacion(env, id) {
  const r = await env.BD.prepare("UPDATE publicaciones SET estado = 'cancelada' WHERE id = ? AND estado IN ('pendiente', 'error')").bind(Number(id)).run();
  if (!r.meta.changes) falla(404, 'Esa publicación ya salió o no existe.');
  return json({ ok: true });
}

/** Cron (cada 5 minutos): publica las programadas que ya les toca. */
export async function procesarPublicaciones(env) {
  const { results } = await env.BD.prepare("SELECT * FROM publicaciones WHERE estado = 'pendiente' AND programada_en <= ? ORDER BY programada_en LIMIT 5").bind(fechaSql()).all();
  const salida = [];
  for (const fila of results) salida.push({ id: fila.id, ...(await publicar(env, fila)) });
  return salida;
}
