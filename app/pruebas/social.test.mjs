// Publicación en Instagram y Facebook: se prueba el módulo directo, con una base SQLite en memoria y un Meta (fetch) falso.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { RAIZ } from '../herramientas/comun.mjs';
import { crearPublicacion, listarPublicaciones, reintentarPublicacion, cancelarPublicacion, procesarPublicaciones, estadoMeta } from '../worker/social.js';

/** D1 mínimo sobre node:sqlite: prepare().bind().run()/first()/all() y batch(). */
function bdFalsa() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(join(RAIZ, 'migraciones')).sort()) db.exec(readFileSync(join(RAIZ, 'migraciones', f), 'utf8'));
  const sentencia = (sql, args = []) => ({
    bind: (...a) => sentencia(sql, a),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql) => sentencia(sql), db };
}

let env, llamadas, fallaFacebook;
const respuesta = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  llamadas = []; fallaFacebook = false;
  env = { BD: bdFalsa(), FOTOS: { put: async () => {} }, SITIO: 'https://alexashop.cc', META_TOKEN: 'token-secreto', META_IG_ID: 'ig-1', META_PAGE_ID: 'pg-1', META_API: 'https://meta.falso/v21.0' };
  globalThis.fetch = async (url, init) => {
    const cuerpo = Object.fromEntries(new URLSearchParams(String(init?.body ?? '')));
    llamadas.push({ ruta: new URL(url).pathname, cuerpo });
    if (String(url).endsWith('/photos') && fallaFacebook) return respuesta({ error: { message: 'Token inválido access_token=SECRETO', code: 190 } }, 400);
    return respuesta(String(url).endsWith('/media') ? { id: 'contenedor-1' } : String(url).endsWith('/media_publish') ? { id: 'ig-post-1' } : { id: 'fb-foto-1', post_id: 'pg_fb-post-1' });
  };
});

const JPEG = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1]);
const peticion = (campos = {}, bytes = JPEG) => {
  const f = new FormData(); f.set('imagen', new Blob([bytes], { type: 'image/jpeg' }), 'x.jpg');
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return new Request('https://alexashop.cc/api/admin/publicaciones', { method: 'POST', body: f });
};
const crear = async (campos, bytes) => { const r = await crearPublicacion(peticion(campos, bytes), env, { correo: 'a@b.co' }); return { estado: r.status, datos: await r.json() }; };
const falla = async (campos, bytes) => assert.rejects(() => crearPublicacion(peticion(campos, bytes), env, {}), (e) => e.estado === 400);
const TEXTO = 'Valentino Born in Roma\nPrecio: 4400Lps\nAlexashop.cc\n#perfumes';

test('publica en Instagram y Facebook con la descripción y una imagen pública', async () => {
  const { estado, datos } = await crear({ descripcion: TEXTO, redes: 'fb,ig' });
  assert.equal(estado, 201);
  assert.equal(datos.estado, 'publicada');
  const ig = llamadas.find((c) => c.ruta.endsWith('/ig-1/media'));
  assert.match(ig.cuerpo.image_url, /^https:\/\/alexashop\.cc\/fotos\/social\/[0-9a-f-]{36}\.jpg$/);
  assert.equal(ig.cuerpo.caption, TEXTO);
  assert.equal(ig.cuerpo.access_token, 'token-secreto');
  assert.ok(llamadas.some((c) => c.ruta.endsWith('/ig-1/media_publish') && c.cuerpo.creation_id === 'contenedor-1'));
  assert.ok(llamadas.some((c) => c.ruta.endsWith('/pg-1/photos') && c.cuerpo.caption === TEXTO && c.cuerpo.url === ig.cuerpo.image_url));
});

test('valida imagen JPEG, descripción y redes', async () => {
  await falla({ descripcion: '', redes: 'ig' });
  await falla({ descripcion: 'x', redes: 'tiktok' });
  await falla({ descripcion: 'x', redes: '' });
  await falla({ descripcion: 'x'.repeat(2201), redes: 'ig' });
  await falla({ descripcion: 'x', redes: 'ig' }, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0])); // PNG
  assert.equal(llamadas.length, 0);
});

test('si Facebook falla, Instagram ya salió: el reintento solo repite Facebook y el token no se filtra', async () => {
  fallaFacebook = true;
  const { datos } = await crear({ descripcion: 'Otra', redes: 'ig,fb' });
  assert.equal(datos.estado, 'error');
  assert.equal(datos.resultado.ig.ok, true);
  assert.equal(datos.resultado.fb.ok, false);
  assert.ok(!JSON.stringify(datos).includes('SECRETO') && !JSON.stringify(datos).includes('token-secreto'));
  fallaFacebook = false; llamadas.length = 0;
  const r = await (await reintentarPublicacion(env, datos.id)).json();
  assert.equal(r.estado, 'publicada');
  assert.ok(!llamadas.some((c) => c.ruta.includes('/ig-1/')), 'Instagram no se publica dos veces');
});

test('programada: no sale antes de hora, el cron la publica cuando toca y se puede cancelar', async () => {
  const futura = await crear({ descripcion: 'Martes 1pm', redes: 'fb', programada_en: new Date(Date.now() + 3600000).toISOString() });
  assert.equal(futura.datos.estado, 'pendiente');
  assert.equal(llamadas.length, 0);
  assert.deepEqual(await procesarPublicaciones(env), [], 'todavía no le toca');
  env.BD.db.exec(`UPDATE publicaciones SET programada_en = datetime('now', '-1 minute')`); // llega la hora
  const hechas = await procesarPublicaciones(env);
  assert.deepEqual(hechas.map((h) => [h.id, h.estado]), [[futura.datos.id, 'publicada']]);
  assert.equal(llamadas.filter((c) => c.ruta.endsWith('/pg-1/photos')).length, 1);
  assert.deepEqual(await procesarPublicaciones(env), [], 'no se publica dos veces');
  const otra = await crear({ descripcion: 'Cancelame', redes: 'ig', programada_en: new Date(Date.now() + 7200000).toISOString() });
  assert.equal((await cancelarPublicacion(env, otra.datos.id)).status, 200);
  assert.equal((await listarPublicaciones(env).then((r) => r.json())).publicaciones.find((p) => p.id === otra.datos.id).estado, 'cancelada');
  await assert.rejects(() => cancelarPublicacion(env, futura.datos.id), (e) => e.estado === 404, 'la que ya salió no se cancela');
});

test('sin claves de Meta no publica y lo dice claro', async () => {
  env.META_TOKEN = undefined;
  assert.deepEqual(estadoMeta(env), { instagram: false, facebook: false });
  const { datos } = await crear({ descripcion: 'x', redes: 'ig,fb' });
  assert.equal(datos.estado, 'error');
  assert.match(datos.resultado.ig.error, /no está conectado/);
  assert.equal(llamadas.length, 0);
});

test('historias: Instagram con media_type STORIES (sin texto) y Facebook como historia de la página', async () => {
  const { estado, datos } = await crear({ redes: 'ig,fb', formato: 'historia' }); // sin descripción: las historias no la llevan
  assert.equal(estado, 201);
  assert.equal(datos.estado, 'publicada');
  const ig = llamadas.find((c) => c.ruta.endsWith('/ig-1/media'));
  assert.equal(ig.cuerpo.media_type, 'STORIES');
  assert.equal(ig.cuerpo.caption, undefined, 'las historias de Instagram no llevan texto');
  assert.match(ig.cuerpo.image_url, /\/fotos\/social\/[0-9a-f-]{36}\.jpg$/);
  assert.ok(llamadas.some((c) => c.ruta.endsWith('/ig-1/media_publish') && c.cuerpo.creation_id === 'contenedor-1'));
  const foto = llamadas.find((c) => c.ruta.endsWith('/pg-1/photos'));
  assert.equal(foto.cuerpo.published, 'false', 'primero se sube la foto sin publicarla');
  assert.ok(llamadas.some((c) => c.ruta.endsWith('/pg-1/photo_stories') && c.cuerpo.photo_id === 'fb-foto-1'));
  const lista = (await listarPublicaciones(env).then((r) => r.json())).publicaciones;
  assert.equal(lista[0].formato, 'historia');
  // una publicación normal sigue siendo normal
  llamadas.length = 0;
  await crear({ descripcion: 'Texto', redes: 'ig' });
  assert.equal(llamadas.find((c) => c.ruta.endsWith('/ig-1/media')).cuerpo.media_type, undefined);
});
