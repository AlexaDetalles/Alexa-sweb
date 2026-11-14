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
  servidor = spawn(process.execPath, [join(RAIZ, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--local', '--port', String(PUERTO), '--local-upstream', `localhost:${PUERTO}`, '--persist-to', estado, '--var', 'DEV:1'], { cwd: RAIZ, stdio: 'ignore' });
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
  assert.ok(!datos.categorias.some((c) => ['CHM', 'CMM', 'CALZADO'].includes(c.id)), 'el calzado se importó oculto');
  assert.ok(!datos.productos.some((p) => ['CHM', 'CMM'].includes(p.group)));
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

test('personalizador: pasos encadenados, completitud, cascada y orden', async () => {
  const pub = async (p = 'mujer') => (await llamar('GET', `/api/regalos/${p}`, undefined, { conSesion: false })).datos.opciones;
  const antes = await pub();
  assert.ok(antes.some((o) => o.category === 'Base') && antes.some((o) => o.category === 'Delivery'));
  assert.equal((await llamar('GET', '/api/regalos/niño', undefined, { conSesion: false })).estado, 404);

  // reglas de encadenado
  assert.equal((await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'tamano', nombre: 'Huérfano', precio: 10 })).estado, 400);
  assert.equal((await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'peluches', nombre: 'X', precio: 1, padre_id: 'B1' })).estado, 400);
  assert.equal((await llamar('POST', '/api/admin/opciones', { publico: 'otro', paso: 'base', nombre: 'X' })).estado, 400);

  const base = (await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'base', nombre: 'Caja Cristal', precio: 25 })).datos.id;
  assert.ok(!(await pub()).some((o) => o.id === base), 'una base sin tamaños no se ofrece');
  assert.equal((await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'contenido', nombre: 'Salta', precio: 1, padre_id: base })).estado, 400, 'el contenido va dentro de un tamaño');
  const tam = (await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'tamano', nombre: 'Cristal Mediana', precio: 120, padre_id: base })).datos.id;
  assert.ok(!(await pub()).some((o) => o.id === tam), 'un tamaño sin contenido no se ofrece');
  const con = (await llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'contenido', nombre: 'Ramo de tulipanes', precio: '550', padre_id: tam })).datos.id;
  const lista = await pub();
  const b = lista.find((o) => o.id === base), t = lista.find((o) => o.id === tam), c = lista.find((o) => o.id === con);
  assert.ok(b && t && c);
  assert.equal(t.parent, b.code, 'el tamaño apunta al código de su base');
  assert.equal(c.parent, t.code, 'el contenido apunta al código de su tamaño');
  assert.equal(c.cents, 55000);
  assert.ok(!(await pub('hombre')).some((o) => o.id === base), 'cada público tiene lo suyo');

  // apagar la base esconde todo lo que cuelga de ella
  await llamar('PUT', `/api/admin/opciones/mujer/${base}`, { activa: false });
  const oculto = await pub();
  assert.ok(![base, tam, con].some((x) => oculto.some((o) => o.id === x)));
  await llamar('PUT', `/api/admin/opciones/mujer/${base}`, { activa: true });
  assert.ok((await pub()).some((o) => o.id === con));

  // mover el tamaño a otra base y borrar en cascada
  assert.equal((await llamar('PUT', `/api/admin/opciones/mujer/${tam}`, { padre_id: con })).estado, 400);
  assert.equal((await llamar('DELETE', `/api/admin/opciones/mujer/${base}`)).estado, 200);
  const d = await admin();
  assert.ok(![base, tam, con].some((x) => d.opciones.some((o) => o.publico === 'mujer' && o.id === x)), 'al borrar la base se van sus tamaños y contenidos');
  assert.equal((await llamar('DELETE', `/api/admin/opciones/mujer/${base}`)).estado, 404);

  // ids y códigos nuevos nunca chocan; peluches libres
  const p1 = (await llamar('POST', '/api/admin/opciones', { publico: 'hombre', paso: 'peluches', nombre: 'Oso azul', precio: 300 })).datos.id;
  const p2 = (await llamar('POST', '/api/admin/opciones', { publico: 'hombre', paso: 'peluches', nombre: 'Conejo', precio: 300 })).datos.id;
  assert.notEqual(p1, p2);
  const orden = (await admin()).opciones.filter((o) => o.publico === 'hombre' && o.paso === 'peluches').map((o) => o.id).reverse();
  await llamar('POST', '/api/admin/orden', { tabla: 'opciones', publico: 'hombre', ids: orden });
  assert.deepEqual((await admin()).opciones.filter((o) => o.publico === 'hombre' && o.paso === 'peluches').map((o) => o.id), orden);
});

test('ajustes de contacto', async () => {
  assert.equal((await llamar('PUT', '/api/admin/ajustes', { asesora1_whatsapp: '123' })).estado, 400);
  assert.equal((await llamar('PUT', '/api/admin/ajustes', { asesora1_nombre: 'María', asesora1_whatsapp: '+504 9999-8888' })).estado, 200);
  const { asesoras } = (await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos;
  assert.deepEqual(asesoras[0], { nombre: 'María', whatsapp: '50499998888' });
  await llamar('PUT', '/api/admin/ajustes', { asesora2_whatsapp: '' });
  assert.equal((await llamar('GET', '/api/catalogo', undefined, { conSesion: false })).datos.asesoras.length, 1, 'sin número no hay botón');
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
