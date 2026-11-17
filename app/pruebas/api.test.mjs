// Prueba de punta a punta de la API: arranca el Worker en local (base y bucket simulados, en una carpeta temporal),
// aplica migraciones y semilla, y recorre login, catálogo, fotos, categorías, personalizador y papelera.
// Para repetirla rápido contra un servidor ya encendido: API_URL=http://localhost:8799 node --test pruebas/api.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RAIZ } from '../herramientas/comun.mjs';

const PUERTO = 8791;
let URL_BASE = process.env.API_URL || `http://localhost:${PUERTO}`;
let servidor, cookie = '';
const FINANZAS_TOKEN = 'token-de-prueba-finanzas';
const CORREO = 'prueba@ejemplo.com', CLAVE = 'clave-de-prueba-123';

const wrangler = (args, env = {}) => execFileSync(process.execPath, [join(RAIZ, 'node_modules/wrangler/bin/wrangler.js'), ...args], { cwd: RAIZ, env: { ...process.env, ...env }, stdio: 'pipe' });

async function esperarServidor() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${URL_BASE}/api/catalogo`)).ok) return; } catch { /* aún no arranca */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('El Worker no arrancó.');
}

before(async () => {
  if (process.env.API_URL) return;
  const estado = mkdtempSync(join(tmpdir(), 'alexa-prueba-'));
  const env = { PERSISTIR: estado, CLAVE };
  wrangler(['d1', 'migrations', 'apply', 'BD', '--local', '--persist-to', estado]);
  execFileSync(process.execPath, [join(RAIZ, 'herramientas/semilla.mjs')], { cwd: RAIZ, env: { ...process.env, ...env }, stdio: 'pipe' });
  execFileSync(process.execPath, [join(RAIZ, 'herramientas/crear-usuario.mjs'), CORREO], { cwd: RAIZ, env: { ...process.env, ...env }, stdio: 'pipe' });
  const variables = ['DEV:1', `FINANZAS_TOKEN:${FINANZAS_TOKEN}`].flatMap((v) => ['--var', v]);
  servidor = spawn(process.execPath, [join(RAIZ, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--local', '--port', String(PUERTO), '--local-upstream', `localhost:${PUERTO}`, '--persist-to', estado, ...variables], { cwd: RAIZ, stdio: 'ignore' });
  await esperarServidor();
});
after(() => { servidor?.kill(); });

async function llamar(metodo, ruta, cuerpo, { origen = URL_BASE, conSesion = true, crudo = false } = {}) {
  const cab = { Origin: origen };
  if (conSesion && cookie) cab.Cookie = cookie;
  let body;
  if (cuerpo instanceof FormData) body = cuerpo;
  else if (cuerpo !== undefined) { cab['Content-Type'] = 'application/json'; body = JSON.stringify(cuerpo); }
  const r = await fetch(URL_BASE + ruta, { method: metodo, headers: cab, body });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
  if (crudo) return r;
  const texto = await r.text();
  let datos; try { datos = JSON.parse(texto); } catch { datos = texto; }
  return { estado: r.status, datos };
}
const entrar = (clave = CLAVE) => llamar('POST', '/api/auth/entrar', { correo: CORREO, clave });
const admin = async () => (await llamar('GET', '/api/admin/datos')).datos;

test('catálogo público: lo migrado de la hoja, sin lo oculto', async () => {
  const { estado, datos } = await llamar('GET', '/api/catalogo', undefined, { conSesion: false });
  assert.equal(estado, 200);
  assert.ok(datos.productos.length >= 100);
  assert.ok(datos.categorias.some((c) => c.id === 'HP' && c.padre_id === 'PERFUMES'));
  // Tenis (antes «Calzado») y Ropa son colecciones visibles; nacen sin productos y se llenan desde el panel.
  const nombre = (id) => datos.categorias.find((c) => c.id === id)?.nombre;
  assert.deepEqual(['CALZADO', 'CHM', 'CMM', 'ROPA', 'RPM', 'RPH'].map(nombre), ['Tenis', 'Tenis para él', 'Tenis para ella', 'Ropa', 'Ropa para ella', 'Ropa para él']);
  assert.ok(datos.categorias.some((c) => c.id === 'RPM' && c.padre_id === 'ROPA'));
  assert.ok(!datos.productos.some((p) => ['CHM', 'CMM', 'RPM', 'RPH'].includes(p.group)));
  assert.equal(datos.asesoras.length, 2);
  const regalo = datos.productos.find((p) => p.id === 'REG-EL-CAFE');
  assert.deepEqual([regalo.quote, regalo.cents], [true, null]);
  const perfume = datos.productos.find((p) => p.id === 'PHP-01');
  assert.equal(perfume.cents, 460000);
  assert.equal(perfume.img, '/assets/images/1.webp');
});

test('lo del panel exige sesión y origen propio', async () => {
  assert.equal((await llamar('GET', '/api/admin/datos', undefined, { conSesion: false })).estado, 401);
  assert.equal((await llamar('POST', '/api/admin/productos', { nombre: 'x' }, { conSesion: false, origen: 'https://malo.example' })).estado, 403);
  assert.equal((await llamar('GET', '/api/auth/sesion', undefined, { conSesion: false })).datos.sesion, null);
});

test('login: contraseña incorrecta, correcta, sesión y salida', async () => {
  assert.equal((await entrar('otra-clave-larga')).estado, 401);
  assert.equal((await llamar('POST', '/api/auth/entrar', { correo: 'nadie@ejemplo.com', clave: 'lo-que-sea-12345' })).estado, 401);
  const ok = await entrar();
  assert.equal(ok.estado, 200);
  assert.equal((await llamar('GET', '/api/auth/sesion')).datos.sesion.correo, CORREO);
  const d = await admin();
  assert.ok(d.productos.length >= 100 && d.opciones.length === 41);
  assert.equal(d.papelera.length, 0);
});

test('categorías: crear, subcategoría, ocultar, no borrar con productos', async () => {
  const { estado, datos } = await llamar('POST', '/api/admin/categorias', { nombre: 'Zapatos de niño' });
  assert.equal(estado, 201);
  assert.equal(datos.id, 'ZAPATOSDENIN');
  assert.equal((await llamar('POST', '/api/admin/categorias', { nombre: 'Zapatos de niño' })).datos.id, 'ZAPATOSDENIN2');
  assert.equal((await llamar('POST', '/api/admin/categorias', { nombre: 'Tenis', padre_id: 'ZAPATOSDENIN' })).estado, 201);
  // un solo nivel: una hija no puede tener hijas, ni una madre con hijas pasar a ser hija
  assert.equal((await llamar('POST', '/api/admin/categorias', { nombre: 'Nieta', padre_id: 'TENIS' })).estado, 400);
  assert.equal((await llamar('PUT', '/api/admin/categorias/ZAPATOSDENIN', { padre_id: 'PERFUMES' })).estado, 400);
  assert.equal((await llamar('DELETE', '/api/admin/categorias/ZAPATOSDENIN')).estado, 400); // tiene subcategoría
  assert.equal((await llamar('DELETE', '/api/admin/categorias/HP')).estado, 400);          // tiene productos
  assert.equal((await llamar('DELETE', '/api/admin/categorias/ZAPATOSDENIN2')).estado, 200);
});

test('productos: crear con referencia automática, validar, ocultar, agotar, cotizar', async () => {
  const mal = await llamar('POST', '/api/admin/productos', { nombre: 'Sin precio', categoria_id: 'HP' });
  assert.equal(mal.estado, 400);
  assert.equal((await llamar('POST', '/api/admin/productos', { nombre: 'Sin categoría', precio: 10 })).estado, 400);
  assert.equal((await llamar('POST', '/api/admin/productos', { nombre: 'Cat falsa', precio: 10, categoria_id: 'NOEXISTE' })).estado, 400);
  assert.equal((await llamar('POST', '/api/admin/productos', { nombre: 'Foto ajena', precio: 10, categoria_id: 'HP', imagen_url: 'https://malo.example/x.png' })).estado, 400);

  const { estado, datos } = await llamar('POST', '/api/admin/productos', { nombre: 'Perfume de prueba', categoria_id: 'HP', precio: '1,250.50', descripcion: 'Hola' });
  assert.equal(estado, 201);
  assert.match(datos.id, /^HP-\d{2}$/);
  const id = datos.id;
  let pub = (await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.productos.find((p) => p.id === id);
  assert.equal(pub.cents, 125050);
  assert.equal(pub.available, true);

  await llamar('PUT', `/api/admin/productos/${id}`, { disponible: false });
  pub = (await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.productos.find((p) => p.id === id);
  assert.equal(pub.available, false, 'agotado se sigue viendo, marcado como no disponible');

  await llamar('PUT', `/api/admin/productos/${id}`, { visible: false });
  assert.ok(!(await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.productos.some((p) => p.id === id), 'oculto no sale en la tienda');
  await llamar('PUT', `/api/admin/productos/${id}`, { visible: true });

  // por cotizar: el precio se ignora
  await llamar('PUT', `/api/admin/productos/${id}`, { cotizar: true, precio: '' });
  pub = (await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.productos.find((p) => p.id === id);
  assert.deepEqual([pub.quote, pub.cents], [true, null]);

  // referencia propia y repetida
  assert.equal((await llamar('POST', '/api/admin/productos', { id: 'MI-REF.1', nombre: 'Propia', categoria_id: 'RLA', precio: 5 })).estado, 201);
  assert.equal((await llamar('POST', '/api/admin/productos', { id: 'MI-REF.1', nombre: 'Repetida', categoria_id: 'RLA', precio: 5 })).estado, 409);
  assert.equal((await llamar('POST', '/api/admin/productos', { id: 'con espacio', nombre: 'x', categoria_id: 'RLA', precio: 5 })).estado, 400);
  // categoría oculta: sus productos dejan de verse
  await llamar('PUT', '/api/admin/categorias/RLA', { activa: false });
  assert.ok(!(await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.productos.some((p) => p.id === 'MI-REF.1'));
  await llamar('PUT', '/api/admin/categorias/RLA', { activa: true });
});

// WebP mínimo válido para la prueba (cabecera RIFF/WEBP; el servidor comprueba la firma y el tamaño).
const webp = (n) => new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, n, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20, ...new Array(20).fill(n)])], { type: 'image/webp' });
const subir = async (n = 1) => { const f = new FormData(); f.set('1200', webp(n), 'a.webp'); f.set('600', webp(n), 'b.webp'); return llamar('POST', '/api/admin/fotos', f); };

test('fotos: subir a R2, servir, reemplazar borra la anterior, solo WebP', async () => {
  const f = new FormData(); f.set('1200', new Blob(['no soy una imagen'.repeat(3)]), 'a.webp'); f.set('600', new Blob(['no soy una imagen'.repeat(3)]), 'b.webp');
  assert.equal((await llamar('POST', '/api/admin/fotos', f)).estado, 400);
  assert.equal((await llamar('POST', '/api/admin/fotos', new FormData())).estado, 400);

  const a = await subir(1);
  assert.equal(a.estado, 200);
  assert.match(a.datos.url, /^\/fotos\/productos\/[0-9a-f-]{36}-1200\.webp$/);
  const { datos } = await llamar('POST', '/api/admin/productos', { nombre: 'Con foto', categoria_id: 'CTA', precio: 100, imagen_url: a.datos.url });
  const id = datos.id;
  const v1 = await fetch(URL_BASE + a.datos.url);
  assert.equal(v1.status, 200);
  assert.equal(v1.headers.get('content-type'), 'image/webp');
  assert.equal((await fetch(URL_BASE + a.datos.url.replace('-1200', '-600'))).status, 200);
  const pub = (await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.productos.find((p) => p.id === id);
  assert.equal(pub.img, a.datos.url);
  assert.equal(pub.thumb, a.datos.url.replace('-1200', '-600'));

  // duplicar comparte la foto: reemplazarla en el original no la borra mientras la copia la use
  const copia = (await llamar('POST', `/api/admin/productos/${id}/duplicar`)).datos.id;
  const b = await subir(2);
  await llamar('PUT', `/api/admin/productos/${id}`, { imagen_url: b.datos.url });
  assert.equal((await fetch(URL_BASE + a.datos.url)).status, 200, 'la copia aún usa la foto vieja');
  await llamar('PUT', `/api/admin/productos/${copia}`, { imagen_url: null });
  assert.equal((await fetch(URL_BASE + a.datos.url)).status, 404, 'ya nadie la usa: se borró');
  assert.equal((await fetch(URL_BASE + '/fotos/productos/no-es-una-clave.webp')).status, 404);
});

test('papelera: borrar, restaurar y eliminar para siempre', async () => {
  const id = (await llamar('POST', '/api/admin/productos', { nombre: 'Para borrar', categoria_id: 'CTA', precio: 1 })).datos.id;
  assert.equal((await llamar('DELETE', `/api/admin/productos/${id}?definitivo=1`)).estado, 400, 'no se elimina directo');
  assert.equal((await llamar('DELETE', `/api/admin/productos/${id}`)).estado, 200);
  let d = await admin();
  assert.ok(d.papelera.some((p) => p.id === id) && !d.productos.some((p) => p.id === id));
  assert.ok(!(await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.productos.some((p) => p.id === id));
  assert.equal((await llamar('POST', `/api/admin/productos/${id}/restaurar`)).estado, 200);
  assert.ok((await admin()).productos.some((p) => p.id === id));
  await llamar('DELETE', `/api/admin/productos/${id}`);
  assert.equal((await llamar('DELETE', `/api/admin/productos/${id}?definitivo=1`)).estado, 200);
  d = await admin();
  assert.ok(!d.papelera.some((p) => p.id === id) && !d.productos.some((p) => p.id === id));
  assert.equal((await llamar('DELETE', `/api/admin/categorias/CTA`)).estado, 400);
});

test('reordenar productos', async () => {
  const ids = (await admin()).productos.filter((p) => p.categoria_id === 'JYA').map((p) => p.id);
  const inverso = [...ids].reverse();
  assert.equal((await llamar('POST', '/api/admin/orden', { tabla: 'productos', ids: inverso })).estado, 200);
  const nuevo = (await admin()).productos.filter((p) => p.categoria_id === 'JYA').map((p) => p.id);
  assert.deepEqual(nuevo, inverso);
  assert.equal((await llamar('POST', '/api/admin/orden', { tabla: 'usuarios', ids: ['x'] })).estado, 400);
});

test('personalizador: pasos configurables, completitud, cascada, fotos y orden', async () => {
  const gift = async (p = 'mujer') => (await llamar('GET', `/api/regalos/${p}`, undefined, { conSesion: false })).datos;
  const pub = async (p = 'mujer') => (await gift(p)).opciones;
  const antes = await gift();
  assert.deepEqual(antes.pasos.map((p) => p.id), ['base', 'tamano', 'contenido', 'peluches', 'globos', 'entrega']);
  assert.equal(antes.pasos[2].type, 'multiple');
  assert.equal(antes.pasos[1].dependsOn, 'base');
  assert.ok(antes.config.title && antes.config.dedication.enabled);
  assert.equal((await llamar('GET', '/api/regalos/niño', undefined, { conSesion: false })).estado, 404);

  // reglas de encadenado
  assert.equal((await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'tamano', nombre: 'Huérfano', precio: 10 })).estado, 400);
  assert.equal((await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'peluches', nombre: 'X', precio: 1, padre_id: 'B1' })).estado, 400);
  assert.equal((await llamar('POST', '/api/admin/opciones', { publico: 'otro', paso: 'base', nombre: 'X' })).estado, 400);
  assert.equal((await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'no-existe', nombre: 'X' })).estado, 400);

  const base = (await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'base', nombre: 'Caja Cristal', precio: 25, descripcion: 'Con tapa', etiqueta: 'Nuevo' })).datos.id;
  assert.ok(!(await pub()).some((o) => o.id === base), 'una base sin tamaños no se ofrece');
  assert.equal((await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'contenido', nombre: 'Salta', precio: 1, padre_id: base })).estado, 400, 'el contenido va dentro de un tamaño');
  const tam = (await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'tamano', nombre: 'Cristal Mediana', precio: 120, padre_id: base })).datos.id;
  assert.ok(!(await pub()).some((o) => o.id === tam), 'un tamaño sin contenido no se ofrece');
  const con = (await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'contenido', nombre: 'Ramo de tulipanes', precio: '550', padre_id: tam })).datos.id;
  const lista = await pub();
  const b = lista.find((o) => o.id === base), t = lista.find((o) => o.id === tam), c = lista.find((o) => o.id === con);
  assert.ok(b && t && c);
  assert.equal(t.parent, base, 'el tamaño apunta al id de su base');
  assert.equal(c.parent, tam);
  assert.equal(c.cents, 55000);
  assert.equal(b.desc, 'Con tapa'); assert.equal(b.badge, 'Nuevo'); assert.equal(b.paso, 'base');
  assert.ok(!(await pub('hombre')).some((o) => o.id === base), 'cada público tiene lo suyo');

  // foto en una opción: solo direcciones propias
  assert.equal((await llamar('PUT', `/api/admin/opciones/mujer/${base}`, { imagen_url: 'https://malo.example/x.jpg' })).estado, 400);
  assert.equal((await llamar('PUT', `/api/admin/opciones/mujer/${base}`, { imagen_url: '/assets/images/logo-mark.svg' })).estado, 200);
  assert.equal((await pub()).find((o) => o.id === base).img, '/assets/images/logo-mark.svg');

  // apagar la base esconde todo lo que cuelga de ella
  await llamar('PUT', `/api/admin/opciones/mujer/${base}`, { activa: false });
  const oculto = await pub();
  assert.ok(![base, tam, con].some((x) => oculto.some((o) => o.id === x)));
  await llamar('PUT', `/api/admin/opciones/mujer/${base}`, { activa: true });
  assert.ok((await pub()).some((o) => o.id === con));

  // borrar en cascada
  assert.equal((await llamar('PUT', `/api/admin/opciones/mujer/${tam}`, { padre_id: con })).estado, 400);
  assert.equal((await llamar('DELETE', `/api/admin/opciones/mujer/${base}`)).estado, 200);
  const d = await admin();
  assert.ok(![base, tam, con].some((x) => d.opciones.some((o) => o.publico === 'mujer' && o.id === x)), 'al borrar la base se van sus tamaños y contenidos');
  assert.equal((await llamar('DELETE', `/api/admin/opciones/mujer/${base}`)).estado, 404);

  // ids nuevos nunca chocan; peluches libres; orden
  const p1 = (await llamar('POST', '/api/admin/opciones', { publico: 'hombre', paso: 'peluches', nombre: 'Oso azul', precio: 300 })).datos.id;
  const p2 = (await llamar('POST', '/api/admin/opciones', { publico: 'hombre', paso: 'peluches', nombre: 'Conejo', precio: 300 })).datos.id;
  assert.notEqual(p1, p2);
  const orden = (await admin()).opciones.filter((o) => o.publico === 'hombre' && o.paso === 'peluches').map((o) => o.id).reverse();
  await llamar('POST', '/api/admin/orden', { tabla: 'opciones', publico: 'hombre', ids: orden });
  assert.deepEqual((await admin()).opciones.filter((o) => o.publico === 'hombre' && o.paso === 'peluches').map((o) => o.id), orden);

  // pasos propios: crear, depender, validar, ordenar, apagar y borrar
  assert.equal((await llamar('POST', '/api/admin/pasos', { publico: 'mujer', nombre: 'Tarjeta', titulo: 'x', tipo: 'multiple', minimo: 3, maximo: 2 })).estado, 400, 'mínimo ≤ máximo');
  assert.equal((await llamar('POST', '/api/admin/pasos', { publico: 'mujer', nombre: 'Tarjeta', titulo: 'x', depende_de: 'fantasma' })).estado, 400);
  const paso = (await llamar('POST', '/api/admin/pasos', { publico: 'mujer', nombre: 'Aroma', titulo: 'Elige un aroma', descripcion: 'Para que huela a ti.', tipo: 'multiple', minimo: 0, maximo: 3 })).datos.id;
  assert.equal(paso, 'aroma');
  assert.equal((await llamar('POST', '/api/admin/pasos', { publico: 'mujer', nombre: 'Aroma', titulo: 'otro' })).datos.id, 'aroma-2', 'el id se vuelve único');
  assert.ok(!(await gift()).pasos.some((p) => p.id === paso), 'un paso sin opciones no sale');
  const ar = (await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso, nombre: 'Vainilla', precio: 40 })).datos.id;
  assert.match(ar, /^A\d+$/);
  const g = await gift();
  const pa = g.pasos.find((p) => p.id === paso);
  assert.deepEqual([pa.type, pa.min, pa.max, pa.title], ['multiple', 0, 3, 'Elige un aroma']);
  assert.ok(g.opciones.some((o) => o.id === ar && o.paso === paso));
  assert.equal((await llamar('PUT', `/api/admin/pasos/mujer/${paso}`, { depende_de: paso })).estado, 400, 'no depende de sí mismo');
  assert.equal((await llamar('PUT', `/api/admin/pasos/mujer/${paso}`, { tipo: 'unico' })).estado, 200);
  const unico = (await admin()).pasos.find((p) => p.publico === 'mujer' && p.id === paso);
  assert.deepEqual([unico.tipo, unico.maximo], ['unico', 1], 'un paso de una sola elección admite una');
  assert.equal((await llamar('PUT', `/api/admin/pasos/mujer/${paso}`, { depende_de: 'base' })).estado, 400, 'ya tiene opciones');
  assert.equal((await llamar('DELETE', '/api/admin/pasos/mujer/base')).estado, 400, 'de la base cuelga el tamaño');
  const ids = (await admin()).pasos.filter((p) => p.publico === 'mujer').map((p) => p.id).reverse();
  assert.equal((await llamar('POST', '/api/admin/orden', { tabla: 'pasos', publico: 'mujer', ids })).estado, 200);
  assert.deepEqual((await admin()).pasos.filter((p) => p.publico === 'mujer').map((p) => p.id), ids);
  await llamar('PUT', `/api/admin/pasos/mujer/${paso}`, { activo: false });
  assert.ok(!(await gift()).pasos.some((p) => p.id === paso), 'un paso apagado no sale');
  assert.equal((await llamar('DELETE', `/api/admin/pasos/mujer/${paso}`)).estado, 200);
  assert.ok(!(await admin()).opciones.some((o) => o.id === ar && o.publico === 'mujer'), 'las opciones se van con su paso');
  await llamar('DELETE', '/api/admin/pasos/mujer/aroma-2');

  // textos y dedicatoria
  assert.equal((await llamar('PUT', '/api/admin/regalo-config/mujer', { dedicatoria_max: 5 })).estado, 400);
  assert.equal((await llamar('PUT', '/api/admin/regalo-config/mujer', { titulo: 'Para mamá', dedicatoria_max: 120, dedicatoria_activa: false })).estado, 200);
  const cfg = (await gift()).config;
  assert.deepEqual([cfg.title, cfg.dedication.max, cfg.dedication.enabled], ['Para mamá', 120, false]);
  assert.equal((await gift('hombre')).config.title, 'Un regalo para él, a tu gusto.', 'cada público tiene sus textos');
  await llamar('PUT', '/api/admin/regalo-config/mujer', { titulo: 'Un regalo para ella, a tu gusto.', dedicatoria_max: 250, dedicatoria_activa: true });
  // apagar todo el personalizador
  await llamar('PUT', '/api/admin/regalo-config/hombre', { activo: false });
  assert.equal((await gift('hombre')).pasos.length, 0);
  await llamar('PUT', '/api/admin/regalo-config/hombre', { activo: true });
});

test('ajustes de contacto', async () => {
  assert.equal((await llamar('PUT', '/api/admin/ajustes', { asesora1_whatsapp: '123' })).estado, 400);
  assert.equal((await llamar('PUT', '/api/admin/ajustes', { asesora1_nombre: 'María', asesora1_whatsapp: '+504 9999-8888' })).estado, 200);
  const { asesoras } = (await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos;
  assert.deepEqual(asesoras[0], { nombre: 'María', whatsapp: '50499998888' });
  await llamar('PUT', '/api/admin/ajustes', { asesora2_whatsapp: '' });
  assert.equal((await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.asesoras.length, 1, 'sin número no hay botón');
});

test('SEO: ficha por producto, sitemap, escape de HTML y caché con purga', async () => {
  // HEAD se trata como lectura
  const cab = await fetch(`${URL_BASE}/api/catalogo`, { method: 'HEAD' });
  assert.equal(cab.status, 200);

  // ficha pública con título, canonical, Open Graph y datos estructurados
  const ficha = await (await fetch(`${URL_BASE}/producto/PHP-01`)).text();
  assert.match(ficha, /<title>Valentino Born in Roma Eau de Toilette \| ALEXA<\/title>/);
  assert.match(ficha, /<link rel="canonical" href="https:\/\/alexashop\.cc\/producto\/PHP-01">/);
  assert.match(ficha, /"@type":"Product"/);
  assert.match(ficha, /"priceCurrency":"HNL","price":"4600\.00"/);
  assert.match(ficha, /"@type":"BreadcrumbList"/);
  assert.match(ficha, /data-slot="PHP-01"/);
  assert.match(ficha, /También te puede gustar/);
  assert.ok(!ficha.includes('%%'), 'no quedan marcas de la plantilla');

  // un nombre malicioso no puede inyectar HTML ni cerrar el bloque de datos estructurados
  const peligro = '<script>alert(1)</script></script><img src=x onerror=alert(2)>';
  const id = (await llamar('POST', '/api/admin/productos', { nombre: peligro, categoria_id: 'HP', precio: 10, descripcion: peligro })).datos.id;
  const html = await (await fetch(`${URL_BASE}/producto/${id}`)).text();
  assert.ok(!html.includes('<script>alert(1)'), 'sin script inyectado');
  assert.ok(!/<img src=x onerror/.test(html), 'sin etiqueta inyectada');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'el texto se muestra escapado');

  // caché: el cambio hecho en el panel se ve al instante en el catálogo público
  await llamar('PUT', `/api/admin/productos/${id}`, { nombre: 'Nombre nuevo' });
  assert.equal((await (await fetch(`${URL_BASE}/api/catalogo`)).json()).productos.find((p) => p.id === id).name, 'Nombre nuevo');

  // oculto o inexistente: 404 y fuera del sitemap
  const sm = await (await fetch(`${URL_BASE}/sitemap.xml`)).text();
  assert.match(sm, new RegExp(`<loc>https://alexashop\\.cc/producto/${id}</loc>`));
  assert.match(sm, /<loc>https:\/\/alexashop\.cc\/catalogo<\/loc>/);
  await llamar('PUT', `/api/admin/productos/${id}`, { visible: false });
  assert.equal((await fetch(`${URL_BASE}/producto/${id}`)).status, 404);
  assert.equal((await fetch(`${URL_BASE}/producto/NO-EXISTE`)).status, 404);
  assert.ok(!(await (await fetch(`${URL_BASE}/sitemap.xml`)).text()).includes(`/producto/${id}<`));
});

test('medición propia: solo con identificador, anónima y con rutas válidas', async () => {
  const vista = (cuerpo, ua = 'Mozilla/5.0 (Macintosh) Safari') => fetch(`${URL_BASE}/api/vista`, { method: 'POST', headers: { Origin: URL_BASE, 'Content-Type': 'application/json', 'User-Agent': ua }, body: JSON.stringify(cuerpo) });
  const vid1 = 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', vid2 = 'ffeeddcc-bbaa-4988-8776-655443322110';
  assert.equal((await vista({ vid: vid1, ruta: '/catalogo' })).status, 204);
  assert.equal((await vista({ vid: vid1, ruta: '/catalogo' })).status, 204);     // mismo visitante: 2 páginas vistas, 1 visitante
  assert.equal((await vista({ vid: vid2, ruta: '/producto/PHP-01', producto: 'PHP-01' })).status, 204);
  await vista({ vid: vid2, evento: 'whatsapp' });
  await vista({ vid: vid2, evento: 'agregar' });
  await vista({ evento: 'acepta' }); await vista({ evento: 'acepta' }); await vista({ evento: 'rechaza' });
  // basura que se descarta sin error
  await vista({ vid: 'corto', ruta: '/catalogo' });                             // identificador inválido
  await vista({ vid: vid1, ruta: '/ruta/inventada/que/no/existe' });                  // ruta fuera de la lista
  await vista({ vid: vid1, ruta: '/producto/NO-EXISTE' });                            // producto inexistente
  await vista({ vid: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', ruta: '/' }, 'Googlebot/2.1'); // robots no cuentan
  await vista({ evento: 'whatsapp' });                                                // sin identificador: no cuenta
  assert.equal((await fetch(`${URL_BASE}/api/vista`, { method: 'POST', headers: { Origin: 'https://malo.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);

  const a = (await llamar('GET', '/api/admin/actividad')).datos;
  assert.equal(a.visitantes.hoy, 2, 'dos personas distintas (los robots y los inválidos no cuentan)');
  assert.equal(a.vistas.hoy, 3, 'catálogo x2 + una ficha');
  assert.deepEqual(a.paginas.map((p) => p.ruta).sort(), ['/catalogo', '/producto/PHP-01']);
  assert.equal(a.productos[0].id, 'PHP-01');
  assert.deepEqual([a.whatsapp, a.agregados], [1, 1]);
  assert.deepEqual(a.consentimiento, { acepta: 2, rechaza: 1, porcentaje: 67 });
  assert.equal(a.serie.length, 14);
  // la base no guarda la IP ni el identificador original: solo un código de 32 caracteres que cambia cada día
  assert.equal((await llamar('GET', '/api/auth/sesion')).datos.sesion.rol, 'admin');
});

test('URLs limpias: sin .html, con 301 desde las direcciones antiguas', async () => {
  const ir = (ruta) => fetch(`${URL_BASE}${ruta}`, { redirect: 'manual' });
  for (const [vieja, nueva] of [
    ['/catalogo.html', '/catalogo'], ['/redes.html', '/contacto'], ['/redes', '/contacto'], ['/Catalogo/Perfumes/index.html', '/perfumes'],
    ['/Catalogo/Perfumes/premiumhombre.html', '/perfumes/premium-hombre'], ['/Catalogo/accesorios/joyeria.html', '/accesorios/joyeria'],
    ['/Detalles/index.html', '/regalos'], ['/Detalles/indexforhm.html', '/regalos/personalizar'], ['/Detalles/pick-and-go-hombre.html', '/regalos/prearmados/el'],
    ['/Detalles/mujer/personalizar3.html', '/regalos/personalizar/ella'], ['/Detalles/hombre/resumen.html', '/regalos/personalizar/el/resumen'],
    ['/perfumes/', '/perfumes'], ['/terminos.html', '/terminos'], ['/index.html', '/'],
  ]) {
    const r = await ir(vieja);
    assert.equal(r.status, 301, vieja);
    assert.equal(new URL(r.headers.get('location'), URL_BASE).pathname, nueva, vieja);
  }
  assert.equal(new URL((await ir('/Detalles/pick-and-go.html?q=Rosas')).headers.get('location'), URL_BASE).search, '?q=Rosas', 'conserva la consulta');
  for (const ruta of ['/', '/catalogo', '/perfumes', '/perfumes/hombre', '/perfumes/premium-mujer', '/accesorios', '/accesorios/relojes', '/regalos', '/regalos/personalizar',
    '/regalos/prearmados', '/regalos/prearmados/ella', '/contacto', '/condiciones', '/privacidad', '/terminos']) {
    const r = await ir(ruta);
    assert.equal(r.status, 200, ruta);
    const html = await r.text();
    assert.ok(!/(href|content)="[^"]*\.html/.test(html), `${ruta}: sin .html en enlaces ni canonical`);
    assert.ok(!/\/(Catalogo|Detalles)\//.test(html), `${ruta}: sin rutas antiguas`);
    assert.ok(html.includes(`rel="canonical" href="https://alexashop.cc${ruta === '/' ? '/' : ruta}"`), `${ruta}: canonical limpio`);
  }
  // personalizador: una plantilla para todos los pasos; solo la primera pantalla se indexa
  const p1 = await (await fetch(`${URL_BASE}/regalos/personalizar/ella`)).text();
  assert.match(p1, /<html lang="es-HN" data-theme="ella"/);
  assert.match(p1, /rel="canonical" href="https:\/\/alexashop\.cc\/regalos\/personalizar\/ella"/);
  assert.match(p1, /name="robots" content="index,follow"/);
  const p2 = await fetch(`${URL_BASE}/regalos/personalizar/el/tamano`);
  assert.equal(p2.status, 200);
  assert.equal(p2.headers.get('x-robots-tag'), 'noindex, follow');
  const t2 = await p2.text();
  assert.match(t2, /data-theme="el"/);
  assert.match(t2, /name="robots" content="noindex,follow"/);
  assert.match(t2, /rel="canonical" href="https:\/\/alexashop\.cc\/regalos\/personalizar\/el"/);
  const sm = await (await fetch(`${URL_BASE}/sitemap.xml`)).text();
  assert.ok(!sm.includes('.html') && !sm.includes('/Catalogo/') && !sm.includes('/Detalles/'));
  assert.equal((await ir('/no-existe')).status, 404);
});

test('SEO: el catálogo sale con productos en el HTML y robots deja leer la API pública', async () => {
  const pagina = async (ruta) => (await fetch(`${URL_BASE}${ruta}`)).text();
  const cat = await pagina('/catalogo');
  assert.equal((cat.match(/<article class="product-card">/g) || []).length, 24, 'primeras 24 tarjetas');
  assert.ok((cat.match(/href="\/producto\//g) || []).length >= 24, 'enlaces a las fichas');
  assert.match(cat, /"@type":"ItemList"/);
  const hombre = await pagina('/perfumes/hombre');
  const ids = [...hombre.matchAll(/href="\/producto\/([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 10 && ids.every((i) => i.startsWith('HP-')), 'solo productos de esa colección');
  assert.ok(!hombre.includes('sk-card'), 'sin esqueletos cuando ya hay productos');
  assert.ok(!cat.includes('%%'));
  const robots = await pagina('/robots.txt');
  assert.match(robots, /Allow: \/api\/catalogo/);
  assert.match(robots, /Disallow: \/api\/admin\//);
  assert.ok(!/Disallow: \/api\/\s/.test(robots), 'no se bloquea toda la API');
  // títulos de ficha ≤ 60 caracteres y descripciones ≥ 70
  for (const id of ['PHP-01', 'JYA-01', 'MP-11.5']) {
    const f = await pagina(`/producto/${id}`);
    const titulo = f.match(/<title>([^<]*)<\/title>/)[1];
    const desc = f.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(titulo.length <= 60, `${id}: título de ${titulo.length}`);
    assert.ok(desc.length >= 70, `${id}: descripción de ${desc.length}`);
  }
  assert.ok((await pagina('/llms.txt')).includes('Choluteca'));
});

test('Ropa y Tenis: páginas con su categoría, en el sitemap y producto nuevo visible en su colección', async () => {
  for (const [ruta, grupo] of [['/ropa/mujer', 'RPM'], ['/ropa/hombre', 'RPH'], ['/tenis/mujer', 'CMM'], ['/tenis/hombre', 'CHM']]) {
    const r = await fetch(`${URL_BASE}${ruta}`);
    assert.equal(r.status, 200, ruta);
    assert.ok((await r.text()).includes(`<body data-groups="${grupo}">`), ruta);
  }
  for (const ruta of ['/ropa', '/tenis']) assert.equal((await fetch(`${URL_BASE}${ruta}`)).status, 200, ruta);
  const sm = await (await fetch(`${URL_BASE}/sitemap.xml`)).text();
  for (const ruta of ['/ropa', '/ropa/mujer', '/tenis/hombre']) assert.ok(sm.includes(`https://alexashop.cc${ruta}<`), `sitemap sin ${ruta}`);
  const { estado, datos } = await llamar('POST', '/api/admin/productos', { nombre: 'Jeans negro talla 28', categoria_id: 'RPM', precio: 450, descripcion: 'Prueba', disponible: 1, visible: 1 });
  assert.equal(estado, 201);
  assert.equal(datos.id, 'RPM-01');
  const pagina = await (await fetch(`${URL_BASE}/ropa/mujer`)).text();
  assert.ok(pagina.includes('Jeans negro talla 28'));
  assert.ok((await (await fetch(`${URL_BASE}/sitemap.xml`)).text()).includes('/producto/RPM-01<'));
  await llamar('DELETE', `/api/admin/productos/RPM-01?definitivo=1`);
});

test('cantidades: se agota solo al llegar a 0, avisa si quedan pocas y se puede dejar de contar', async () => {
  const pub = async (id) => (await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.productos.find((p) => p.id === id);
  const { estado, datos } = await llamar('POST', '/api/admin/productos', { nombre: 'Tenis con cantidad', categoria_id: 'CMM', precio: 900, visible: 1, disponible: 1, cantidad: '3' });
  assert.equal(estado, 201);
  const id = datos.id;
  let p = await pub(id);
  assert.deepEqual([p.available, p.stock], [true, 3]);
  assert.equal((await admin()).productos.find((x) => x.id === id).cantidad, 3);
  // la ficha y la página de la colección muestran «Últimas 3 unidades»
  assert.ok((await (await fetch(`${URL_BASE}/tenis/mujer`)).text()).includes('Últimas 3 unidades'));
  // a 0 se agota sola aunque siga marcado «Hay»
  assert.equal((await llamar('PUT', `/api/admin/productos/${id}`, { cantidad: 0 })).estado, 200);
  p = await pub(id);
  assert.deepEqual([p.available, p.stock], [false, 0]);
  const ficha = await (await fetch(`${URL_BASE}/producto/${id}`)).text();
  assert.ok(ficha.includes('OutOfStock') && !ficha.includes('schema.org/InStock'));
  // valores no válidos
  for (const malo of [-1, 1.5, 'abc', 1000000]) assert.equal((await llamar('PUT', `/api/admin/productos/${id}`, { cantidad: malo })).estado, 400, `cantidad ${malo}`);
  // vacío = sin control: vuelve a depender solo de «Hay»
  assert.equal((await llamar('PUT', `/api/admin/productos/${id}`, { cantidad: '' })).estado, 200);
  p = await pub(id);
  assert.deepEqual([p.available, p.stock], [true, null]);
  // duplicar conserva la cantidad
  await llamar('PUT', `/api/admin/productos/${id}`, { cantidad: 7 });
  const copia = (await llamar('POST', `/api/admin/productos/${id}/duplicar`)).datos.id;
  assert.equal((await admin()).productos.find((x) => x.id === copia).cantidad, 7);
  for (const x of [id, copia]) await llamar('DELETE', `/api/admin/productos/${x}?definitivo=1`);
});

test('finanzas: stock local (compra = inversión), stock aparte (sin inversión) y sin stock', async () => {
  const crear = async (extra) => (await llamar('POST', '/api/admin/productos', { nombre: 'Prueba finanzas', categoria_id: 'MP', visible: 1, disponible: 1, ...extra })).datos.id;
  const local = await crear({ tipo_stock: 'local', costo: 100, precio: 150 });
  const aparte = await crear({ tipo_stock: 'aparte', costo: 80, precio: 120 });
  const sin = await crear({ tipo_stock: 'sin', costo: 50, precio: 90 });
  const antes = (await llamar('GET', '/api/admin/finanzas')).datos;
  const mov = (cuerpo) => llamar('POST', '/api/admin/movimientos', cuerpo);
  // compra de stock local: suma unidades e inversión
  assert.equal((await mov({ tipo: 'compra', producto_id: local, cantidad: 10 })).estado, 201);
  assert.equal((await admin()).productos.find((p) => p.id === local).cantidad, 10);
  // venta de 3: rebaja stock y deja ganancia
  const v = await mov({ tipo: 'venta', producto_id: local, cantidad: 3 });
  assert.equal(v.estado, 201);
  assert.equal((await admin()).productos.find((p) => p.id === local).cantidad, 7);
  assert.equal((await mov({ tipo: 'venta', producto_id: local, cantidad: 8 })).estado, 400, 'no se vende más de lo que hay');
  // dropshipping: vende sin tocar cantidades y no se puede «comprar»
  assert.equal((await mov({ tipo: 'venta', producto_id: aparte, cantidad: 2 })).estado, 201);
  assert.equal((await mov({ tipo: 'compra', producto_id: aparte, cantidad: 1, costo: 80 })).estado, 400);
  assert.equal((await mov({ tipo: 'venta', producto_id: sin, cantidad: 1 })).estado, 400, 'sin stock no se vende');
  assert.equal((await mov({ tipo: 'venta', producto_id: local, cantidad: 0 })).estado, 400);
  const r = (await llamar('GET', '/api/admin/finanzas')).datos;
  const d = (campo) => Math.round((r.total[campo] - antes.total[campo]) * 100) / 100;
  assert.deepEqual([d('invertido'), d('ingresos'), d('costo_vendido'), d('ganancia')], [1000, 450 + 240, 300 + 160, 230]);
  assert.equal(r.por_tipo.find((x) => x.tipo_stock === 'aparte').invertido, 0, 'el dropshipping no es inversión');
  assert.equal(r.capital_en_stock - antes.capital_en_stock, 700);
  // «sin stock» se ve «No disponible» en la tienda aunque esté marcado «Hay»
  assert.equal((await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.productos.find((p) => p.id === sin).available, false);
  // anular una venta devuelve las unidades
  assert.equal((await llamar('DELETE', `/api/admin/movimientos/${v.datos.id}`)).estado, 200);
  assert.equal((await admin()).productos.find((p) => p.id === local).cantidad, 10);
  assert.equal((await llamar('DELETE', `/api/admin/movimientos/${v.datos.id}`)).estado, 404, 'ya estaba anulado');
  // hojas CSV para la hoja de Google: solo con la clave
  assert.equal((await fetch(`${URL_BASE}/api/finanzas/csv/resumen`)).status, 404);
  assert.equal((await fetch(`${URL_BASE}/api/finanzas/csv/resumen?clave=mala`)).status, 404);
  for (const hoja of ['productos', 'movimientos', 'resumen']) {
    const resp = await fetch(`${URL_BASE}/api/finanzas/csv/${hoja}?clave=${FINANZAS_TOKEN}`);
    assert.equal(resp.status, 200, hoja);
    assert.ok((await resp.text()).length > 40, hoja);
  }
  const prods = await (await fetch(`${URL_BASE}/api/finanzas/csv/productos?clave=${FINANZAS_TOKEN}`)).text();
  assert.ok(prods.includes('Stock local') && prods.includes('Stock aparte') && prods.includes('Sin stock'));
  assert.ok((await llamar('GET', '/api/admin/finanzas/enlaces')).datos.enlaces.resumen.includes('/api/finanzas/csv/resumen?clave='));
  assert.equal((await llamar('GET', '/api/admin/finanzas', undefined, { conSesion: false })).estado, 401);
  for (const id of [local, aparte, sin]) { await llamar('DELETE', `/api/admin/productos/${id}`); await llamar('DELETE', `/api/admin/productos/${id}?definitivo=1`); }
});

test('lotes: la inversión se reparte por precio de etiqueta, el precio lo pones tú y todo se suma', async () => {
  const mov = (cuerpo) => llamar('POST', '/api/admin/movimientos', cuerpo);
  const antes = (await llamar('GET', '/api/admin/finanzas')).datos;
  // L 45,000 por todo; meta 80,000 (sin meta, el sistema propone +80 %)
  const sinMeta = await llamar('POST', '/api/admin/lotes', { nombre: 'Prueba sin meta', inversion: 1000 });
  assert.equal((await llamar('GET', `/api/admin/lotes/${sinMeta.datos.id}`)).datos.meta, 1800);
  await llamar('DELETE', `/api/admin/lotes/${sinMeta.datos.id}`);
  const lote = (await llamar('POST', '/api/admin/lotes', { nombre: 'Drop de prueba', inversion: 45000, meta: 80000 })).datos.id;
  const crear = async (extra) => (await llamar('POST', '/api/admin/productos', { categoria_id: 'RPM', visible: 1, disponible: 1, tipo_stock: 'local', lote_id: lote, ...extra }));
  assert.equal((await crear({ nombre: 'No local', precio: 1, tipo_stock: 'aparte' })).estado, 400, 'un lote solo lleva stock local');
  const A = (await crear({ nombre: 'Tenis lote', precio: 800, referencia: 800, cantidad: 50 })).datos.id;
  const B = (await crear({ nombre: 'Camiseta lote', precio: 400, referencia: 400, cantidad: 100 })).datos.id;
  let l = (await llamar('GET', `/api/admin/lotes/${lote}`)).datos;
  const f = (id) => l.filas.find((x) => x.id === id);
  // etiquetas por 80,000 en total = la meta: costo 450 y 225, sugerido = la etiqueta
  assert.deepEqual([f(A).costo, f(B).costo, f(A).sugerido, f(B).sugerido], [450, 225, 800, 400]);
  assert.deepEqual([l.ventas_estimadas, l.ganancia_estimada, l.margen_estimado, l.margen_meta], [80000, 35000, 77.8, 77.8]);
  assert.equal((await admin()).productos.find((p) => p.id === A).costo, 450, 'el costo repartido queda en el producto');
  // pones tu propio precio (900): el total se suma con ese precio
  await llamar('PUT', `/api/admin/productos/${A}`, { precio: 900 });
  l = (await llamar('GET', `/api/admin/lotes/${lote}`)).datos;
  assert.deepEqual([l.ventas_estimadas, l.ganancia_estimada, f(A).costo], [85000, 40000, 450]);
  // finanzas: la inversión del lote cuenta como invertida y la ganancia sale con el costo repartido
  assert.equal((await mov({ tipo: 'venta', producto_id: A, cantidad: 2 })).estado, 201);
  const r = (await llamar('GET', '/api/admin/finanzas')).datos;
  assert.equal(r.total.invertido - antes.total.invertido, 45000);
  assert.equal(Math.round((r.total.ganancia - antes.total.ganancia) * 100) / 100, 900, '2 × (900 − 450)');
  assert.equal(r.lotes.find((x) => x.id === lote).vendido.ganancia, 900);
  l = (await llamar('GET', `/api/admin/lotes/${lote}`)).datos;
  assert.equal(l.vendido.unidades, 2);
  assert.equal(l.filas.find((x) => x.id === A).costo, 450, 'vender no cambia el costo repartido');
  // comprar más unidades del lote mueve las existencias
  await llamar('PUT', `/api/admin/productos/${B}`, { lote_cantidad: 110 });
  assert.equal((await admin()).productos.find((p) => p.id === B).cantidad, 110);
  // aplicar los precios sugeridos
  assert.equal((await llamar('POST', `/api/admin/lotes/${lote}/precios`, { modo: 'todos' })).datos.cambiados, 2);
  l = (await llamar('GET', `/api/admin/lotes/${lote}`)).datos;
  assert.ok(l.filas.every((x) => x.precio === x.sugerido));
  // rangos: el lote es solo de administradora (validaciones)
  assert.equal((await llamar('PUT', `/api/admin/lotes/${lote}`, { inversion: -5 })).estado, 400);
  assert.equal((await llamar('GET', '/api/admin/lotes', undefined, { conSesion: false })).estado, 401);
  // borrar el lote deja los productos
  assert.equal((await llamar('DELETE', `/api/admin/lotes/${lote}`)).estado, 200);
  assert.equal((await admin()).productos.find((p) => p.id === A).lote_id, null);
  for (const id of [A, B]) { await llamar('DELETE', `/api/admin/productos/${id}`); await llamar('DELETE', `/api/admin/productos/${id}?definitivo=1`); }
});

test('gastos, crédito y abonos: el crédito cuesta más que el contado, se avisa al pagar y todo entra a finanzas', async () => {
  const mov = (cuerpo) => llamar('POST', '/api/admin/movimientos', cuerpo);
  const fin = async () => (await llamar('GET', '/api/admin/finanzas')).datos;
  const producto = (await llamar('POST', '/api/admin/productos', { nombre: 'Tenis a crédito', categoria_id: 'CHM', precio: 1000, costo: 500, tipo_stock: 'local', cantidad: 5, visible: 1, disponible: 1 })).datos.id;
  const antes = await fin();
  const credito = (extra = {}) => ({ tipo: 'venta', producto_id: producto, cantidad: 1, credito: { cliente: 'Ana Pérez', telefono: '9999 8888', cuotas: 2, cuota: 600, ...extra } });
  // reglas: igual o mejor que el contado no se acepta, y la venta no se queda a medias
  for (const cuota of [500, 400]) assert.equal((await mov(credito({ cuota }))).estado, 400, `2 × ${cuota}`);
  assert.equal((await mov(credito({ cliente: '' }))).estado, 400, 'falta quién se lleva la deuda');
  assert.equal((await mov(credito({ cuotas: 1, cuota: 2000 }))).estado, 400);
  assert.equal((await admin()).productos.find((p) => p.id === producto).cantidad, 5, 'las ventas rechazadas no mueven el stock');
  // 2 pagos de 600 con 600 de abono inicial: debe 600
  const v = await mov(credito({ abono: 600 }));
  assert.equal(v.estado, 201);
  assert.equal(v.datos.total, 1200);
  assert.equal((await admin()).productos.find((p) => p.id === producto).cantidad, 4);
  let creditos = (await llamar('GET', '/api/admin/creditos')).datos.creditos;
  const c = creditos.find((x) => x.id === v.datos.credito_id);
  assert.deepEqual([c.cliente, c.telefono, c.total, c.abonado, c.saldo, c.pagadas, c.estado], ['Ana Pérez', '99998888', 1200, 600, 600, 1, 'activo']);
  let r = await fin();
  assert.equal(Math.round((r.total.ingresos - antes.total.ingresos) * 100) / 100, 1200, 'la venta a crédito se anota por el total del crédito');
  assert.equal(Math.round((r.total.ganancia - antes.total.ganancia) * 100) / 100, 700, '1,200 − 500 de costo');
  assert.equal(r.cobros.por_cobrar - antes.cobros.por_cobrar, 600);
  // abonar de más no se puede; abonar lo que falta la marca pagada y avisa
  assert.equal((await llamar('POST', `/api/admin/creditos/${c.id}/abonos`, { monto: 700 })).estado, 400);
  assert.equal((await llamar('POST', `/api/admin/creditos/${c.id}/abonos`, { monto: 0 })).estado, 400);
  const parcial = await llamar('POST', `/api/admin/creditos/${c.id}/abonos`, { monto: 200 });
  assert.deepEqual([parcial.datos.pagado, parcial.datos.saldo], [false, 400]);
  const ultimo = await llamar('POST', `/api/admin/creditos/${c.id}/abonos`, { monto: 400, nota: 'Último pago' });
  assert.deepEqual([ultimo.datos.pagado, ultimo.datos.saldo], [true, 0]);
  creditos = (await llamar('GET', '/api/admin/creditos?todos=1')).datos.creditos;
  assert.equal(creditos.find((x) => x.id === c.id).estado, 'pagado');
  assert.equal((await fin()).cobros.por_cobrar, antes.cobros.por_cobrar);
  // un abono anulado reabre la deuda
  const ab = creditos.find((x) => x.id === c.id).abonos.find((a) => a.nota === 'Último pago');
  assert.equal((await llamar('DELETE', `/api/admin/abonos/${ab.id}`)).estado, 200);
  assert.equal((await llamar('GET', '/api/admin/creditos')).datos.creditos.find((x) => x.id === c.id).saldo, 400);
  // con abonos no se puede anular el crédito; sin ellos sí, y el producto vuelve
  assert.equal((await llamar('DELETE', `/api/admin/creditos/${c.id}`)).estado, 400);
  const abonos = (await llamar('GET', '/api/admin/creditos')).datos.creditos.find((x) => x.id === c.id).abonos.filter((a) => !a.anulado);
  for (const a of abonos) await llamar('DELETE', `/api/admin/abonos/${a.id}`);
  assert.equal((await llamar('DELETE', `/api/admin/creditos/${c.id}`)).estado, 200);
  assert.equal((await admin()).productos.find((p) => p.id === producto).cantidad, 5, 'anular el crédito devuelve la unidad');
  // gastos de una venta al contado (bus y bolsa) restan de la ganancia; anular la venta los anula
  const base = await fin();
  const contado = await mov({ tipo: 'venta', producto_id: producto, cantidad: 1, gastos: [{ categoria: 'bus', monto: 50 }, { concepto: 'Bolsa', categoria: 'empaque', monto: 20 }, { monto: '' }] });
  assert.equal(contado.estado, 201);
  r = await fin();
  assert.equal(r.total.gastos - base.total.gastos, 70);
  assert.equal(Math.round((r.total.neta - base.total.neta) * 100) / 100, 430, '1,000 − 500 − 70');
  assert.deepEqual(r.gastos_por_categoria.map((g) => g.categoria).sort(), ['bus', 'empaque']);
  await llamar('DELETE', `/api/admin/movimientos/${contado.datos.id}`);
  assert.equal((await fin()).total.gastos, base.total.gastos, 'sin la venta no hay gastos');
  // gasto suelto
  const g = await llamar('POST', '/api/admin/gastos', { concepto: 'Pasaje a Tegucigalpa', categoria: 'bus', monto: 300 });
  assert.equal(g.estado, 201);
  assert.equal((await fin()).total.gastos - base.total.gastos, 300);
  assert.equal((await llamar('POST', '/api/admin/gastos', { concepto: 'x', monto: 0 })).estado, 400);
  assert.equal((await llamar('DELETE', `/api/admin/gastos/${g.datos.id}`)).estado, 200);
  // recargo sugerido
  assert.equal((await llamar('PUT', '/api/admin/finanzas/config', { credito_pct: 25 })).estado, 200);
  assert.equal((await fin()).credito_pct, 25);
  assert.equal((await llamar('PUT', '/api/admin/finanzas/config', { credito_pct: 900 })).estado, 400);
  await llamar('PUT', '/api/admin/finanzas/config', { credito_pct: 20 });
  // hojas
  for (const hoja of ['gastos', 'creditos']) assert.equal((await fetch(`${URL_BASE}/api/finanzas/csv/${hoja}?clave=${FINANZAS_TOKEN}`)).status, 200, hoja);
  assert.equal((await llamar('GET', '/api/admin/creditos', undefined, { conSesion: false })).estado, 401);
  await llamar('DELETE', `/api/admin/productos/${producto}`); await llamar('DELETE', `/api/admin/productos/${producto}?definitivo=1`);
});

test('contraseña: cambiarla cierra otras sesiones; 5 fallos bloquean', async () => {
  const miCookie = cookie;
  const nueva = 'otra-clave-nueva-456';
  assert.equal((await llamar('POST', '/api/auth/clave', { actual: 'mal-mal-mal-mal', nueva })).estado, 401);
  assert.equal((await llamar('POST', '/api/auth/clave', { actual: CLAVE, nueva: 'corta' })).estado, 400);
  assert.equal((await llamar('POST', '/api/auth/clave', { actual: CLAVE, nueva: CLAVE })).estado, 400);
  // segunda sesión (otro dispositivo)
  cookie = '';
  await entrar();
  const otra = cookie;
  cookie = miCookie;
  assert.equal((await llamar('POST', '/api/auth/clave', { actual: CLAVE, nueva })).estado, 200);
  assert.equal((await llamar('GET', '/api/auth/sesion')).datos.sesion.correo, CORREO, 'esta sesión sigue');
  cookie = otra;
  assert.equal((await llamar('GET', '/api/auth/sesion')).datos.sesion, null, 'la otra se cerró');
  cookie = '';
  assert.equal((await entrar(CLAVE)).estado, 401, 'la clave vieja ya no sirve');
  assert.equal((await entrar(nueva)).estado, 200);
  assert.equal((await llamar('POST', '/api/auth/salir')).estado, 200);
  assert.equal((await llamar('GET', '/api/admin/datos')).estado, 401, 'sin sesión tras salir');
  for (let i = 0; i < 5; i++) assert.equal((await entrar('mal-mal-mal-mal')).estado, 401);
  assert.equal((await entrar(nueva)).estado, 429, 'bloqueado 15 minutos aunque ahora acierte');
});
