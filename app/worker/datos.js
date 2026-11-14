// Datos de la tienda: lectura pública, escritura del panel, fotos en R2 y mantenimiento semanal.
import { falla, json, fechaSql, diaHonduras } from './util.js';
import { exigirSesion } from './auth.js';
import * as V from './validacion.js';
import { completeOptions } from '../public/assets/core.mjs';

const CATEGORIA_PASO = { base: 'Base', tamano: 'Tamaño', contenido: 'Contenido', peluches: 'Peluches', globos: 'Globos', entrega: 'Delivery' };
const PREFIJO_PASO = { base: 'B', tamano: 'T', contenido: 'C', peluches: 'P', globos: 'G', entrega: 'D' };
const ABIERTO = { 'Access-Control-Allow-Origin': '*' }; // lectura pública: cualquier página puede mostrar el catálogo

const miniatura = (url) => (url?.startsWith('/fotos/') ? url.replace('-1200.', '-600.') : url);
const dinero = (n) => (n === null || n === undefined ? null : Math.round(n * 100));

// --- lectura pública (la tienda) -----------------------------------------------------
/** GET /api/catalogo: categorías activas, productos visibles y los WhatsApp de las asesoras. */
export async function catalogo(env) {
  const [cats, prods, aj] = await env.BD.batch([
    env.BD.prepare(`SELECT c.id, c.nombre, c.padre_id FROM categorias c LEFT JOIN categorias p ON p.id = c.padre_id
      WHERE c.activa = 1 AND (p.id IS NULL OR p.activa = 1) ORDER BY c.orden, c.nombre`),
    env.BD.prepare(`SELECT p.id, p.nombre, p.categoria_id, p.descripcion, p.precio, p.cotizar, p.imagen_url, p.disponible
      FROM productos p JOIN categorias c ON c.id = p.categoria_id LEFT JOIN categorias pa ON pa.id = c.padre_id
      WHERE p.borrado_en IS NULL AND p.visible = 1 AND c.activa = 1 AND (pa.id IS NULL OR pa.activa = 1)
      ORDER BY p.orden, p.nombre`),
    env.BD.prepare('SELECT * FROM ajustes WHERE id = 1'),
  ]);
  const a = aj.results[0] || {};
  return json({
    categorias: cats.results,
    productos: prods.results.map((p) => ({
      id: p.id, name: p.nombre, group: p.categoria_id, description: p.descripcion,
      cents: p.cotizar ? null : dinero(p.precio), quote: !!p.cotizar, available: !!p.disponible,
      img: p.imagen_url || '/assets/images/no-photo.svg', thumb: miniatura(p.imagen_url) || '/assets/images/no-photo.svg',
    })),
    asesoras: [
      { nombre: a.asesora1_nombre, whatsapp: a.asesora1_whatsapp },
      { nombre: a.asesora2_nombre, whatsapp: a.asesora2_whatsapp },
    ].filter((x) => x.whatsapp),
  }, 200, { ...ABIERTO, 'Cache-Control': 'no-cache' });
}

/** GET /api/regalos/mujer|hombre: opciones del personalizador, con el mismo formato que usaba la hoja. */
export async function regalos(env, publico) {
  if (!V.PUBLICOS.includes(publico)) falla(404, 'Ruta no encontrada.');
  const { results } = await env.BD.prepare('SELECT * FROM opciones WHERE publico = ? AND activa = 1 ORDER BY orden, nombre').bind(publico).all();
  const porId = new Map(results.map((o) => [o.id, o]));
  // Si una base se apaga, sus tamaños y su contenido desaparecen con ella.
  const visible = (o) => !o.padre_id || (porId.has(o.padre_id) && visible(porId.get(o.padre_id)));
  const opciones = results.filter(visible).map((o) => ({
    id: o.id, parent: o.padre_id ? porId.get(o.padre_id).codigo : '', category: CATEGORIA_PASO[o.paso],
    name: o.nombre, cents: dinero(o.precio), code: o.codigo,
  }));
  return json({ opciones: completeOptions(opciones) }, 200, { ...ABIERTO, 'Cache-Control': 'no-cache' });
}

// --- fotos --------------------------------------------------------------------------
const RE_CLAVE_FOTO = /^productos\/[0-9a-f-]{36}-(600|1200)\.(webp|jpg)$/;
const ascii = (b, de, a) => String.fromCharCode(...b.slice(de, a));
// WebP (RIFF....WEBP) o JPEG (FF D8 FF): la firma se comprueba aquí; el panel nunca manda otra cosa.
const tipoDeFoto = (b) => (b.length > 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' ? 'webp' : b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'jpg' : null);
const TIPOS_FOTO = { webp: 'image/webp', jpg: 'image/jpeg' };

/** El panel reduce la foto a 1200 y 600 px (WebP; JPEG en navegadores que no crean WebP) y manda las dos del mismo tipo. */
async function subirFoto(req, env) {
  const form = await req.formData();
  const id = crypto.randomUUID();
  const piezas = [];
  let tipo = null;
  for (const tam of ['1200', '600']) {
    const f = form.get(tam);
    if (!f || typeof f === 'string') falla(400, 'Falta la foto.');
    if (f.size > 2 * 1024 * 1024) falla(400, 'La foto pesa demasiado (máximo 2 MB después de reducirla).');
    const bytes = new Uint8Array(await f.arrayBuffer());
    const t = tipoDeFoto(bytes);
    if (!t || (tipo && t !== tipo)) falla(400, 'Formato de foto no válido.');
    tipo = t;
    piezas.push([`productos/${id}-${tam}.${t}`, bytes]);
  }
  await Promise.all(piezas.map(([clave, bytes]) => env.FOTOS.put(clave, bytes, { httpMetadata: { contentType: TIPOS_FOTO[tipo], cacheControl: 'public, max-age=31536000, immutable' } })));
  return json({ url: `/fotos/productos/${id}-1200.${tipo}` });
}

export async function servirFoto(env, clave) {
  if (!RE_CLAVE_FOTO.test(clave)) return new Response('No encontrada', { status: 404 });
  const obj = await env.FOTOS.get(clave);
  if (!obj) return new Response('No encontrada', { status: 404 });
  return new Response(obj.body, { headers: { 'Content-Type': TIPOS_FOTO[clave.endsWith('.jpg') ? 'jpg' : 'webp'], 'Cache-Control': 'public, max-age=31536000, immutable', ETag: obj.httpEtag, 'X-Content-Type-Options': 'nosniff' } });
}

/** Borra los archivos de una foto subida, salvo que otro producto (duplicado) todavía la use. */
async function soltarFoto(env, url) {
  if (!url?.startsWith('/fotos/')) return; // las fotos que vienen con la web no se tocan
  if (await env.BD.prepare('SELECT 1 FROM productos WHERE imagen_url = ?').bind(url).first()) return;
  await env.FOTOS.delete([url, url.replace('-1200.', '-600.')].map((u) => u.replace('/fotos/', '')));
}

// --- ayudas de escritura --------------------------------------------------------------
const insertar = (env, tabla, fila) => {
  const ks = Object.keys(fila);
  return env.BD.prepare(`INSERT INTO ${tabla} (${ks.join(', ')}) VALUES (${ks.map(() => '?').join(', ')})`).bind(...ks.map((k) => fila[k]));
};
/** `donde` es una lista de [columna, valor]; los nombres de columna salen del código, nunca del usuario. */
const actualizar = (env, tabla, donde, campos) => {
  const ks = Object.keys(campos);
  if (!ks.length) return null;
  return env.BD.prepare(`UPDATE ${tabla} SET ${ks.map((k) => `${k} = ?`).join(', ')} WHERE ${donde.map(([c]) => `${c} = ?`).join(' AND ')}`)
    .bind(...ks.map((k) => campos[k]), ...donde.map(([, v]) => v)).run();
};
const duplicado = (e) => /UNIQUE constraint failed/i.test(String(e?.message));
const noExiste = (r, texto) => { if (r && !r.meta.changes) falla(404, texto); };
const quitarAcentos = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '');

// --- panel: categorías --------------------------------------------------------------
async function revisarPadre(env, id, padreId) {
  if (!padreId) return;
  if (padreId === id) falla(400, 'Una categoría no puede ir dentro de sí misma.');
  const padre = await env.BD.prepare('SELECT padre_id FROM categorias WHERE id = ?').bind(padreId).first();
  if (!padre) falla(400, 'La categoría principal ya no existe.');
  if (padre.padre_id) falla(400, 'Solo hay un nivel de subcategorías: elige una categoría principal.');
  if (id && (await env.BD.prepare('SELECT 1 FROM categorias WHERE padre_id = ?').bind(id).first())) falla(400, 'Esta categoría tiene subcategorías, por eso no puede ir dentro de otra.');
}

async function crearCategoria(env, d) {
  const c = V.categoria(d, true);
  await revisarPadre(env, null, c.padre_id);
  // El código corto sale del nombre ("Zapatos de niño" → ZAPATOSDENIN) y se vuelve único si ya existe.
  const base = quitarAcentos(c.nombre).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'CAT';
  const usados = new Set((await env.BD.prepare("SELECT id FROM categorias WHERE id LIKE ? || '%'").bind(base).all()).results.map((r) => r.id));
  let id = base;
  for (let i = 2; usados.has(id); i++) id = `${base}${i}`;
  const orden = c.orden ?? ((await env.BD.prepare('SELECT coalesce(max(orden), 0) + 10 AS n FROM categorias').first()).n);
  await insertar(env, 'categorias', { id, ...c, orden }).run();
  return json({ id }, 201);
}

async function cambiarCategoria(env, id, d) {
  const c = V.categoria(d);
  if ('padre_id' in c) await revisarPadre(env, id, c.padre_id);
  noExiste(await actualizar(env, 'categorias', [['id', id]], c), 'La categoría ya no existe.');
  return json({ ok: true });
}

async function borrarCategoria(env, id) {
  const [hijas, prods] = await env.BD.batch([
    env.BD.prepare('SELECT count(*) AS n FROM categorias WHERE padre_id = ?').bind(id),
    env.BD.prepare('SELECT count(*) AS n FROM productos WHERE categoria_id = ?').bind(id),
  ]);
  if (hijas.results[0].n) falla(400, 'Esta categoría tiene subcategorías. Muévelas o bórralas primero.');
  if (prods.results[0].n) falla(400, `Esta categoría tiene ${prods.results[0].n} producto(s) (incluidos los de la papelera). Pásalos a otra categoría primero, o ocúltala en vez de borrarla.`);
  await env.BD.prepare('DELETE FROM categorias WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// --- panel: productos ---------------------------------------------------------------
async function revisarCategoria(env, id) {
  if (!(await env.BD.prepare('SELECT 1 FROM categorias WHERE id = ?').bind(id).first())) falla(400, 'La categoría ya no existe.');
}

/** Referencia automática: PREFIJO-NN, donde NN sigue al número más alto de ese prefijo (HP-22 → HP-23). */
async function referenciaLibre(env, categoriaId) {
  const prefijo = categoriaId;
  const { results } = await env.BD.prepare("SELECT id FROM productos WHERE id LIKE ? || '-%'").bind(prefijo).all();
  const max = results.reduce((m, r) => { const n = Number(r.id.slice(prefijo.length + 1)); return Number.isInteger(n) ? Math.max(m, n) : m; }, 0);
  return `${prefijo}-${String(max + 1).padStart(2, '0')}`;
}

async function crearProducto(env, d) {
  const p = V.producto(d, true);
  await revisarCategoria(env, p.categoria_id);
  const id = p.id || await referenciaLibre(env, p.categoria_id);
  const orden = p.orden ?? ((await env.BD.prepare('SELECT coalesce(max(orden), 0) + 10 AS n FROM productos').first()).n);
  try { await insertar(env, 'productos', { ...p, id, orden }).run(); } catch (e) {
    if (duplicado(e)) falla(409, `Ya existe un producto con la referencia ${id}.`);
    throw e;
  }
  return json({ id }, 201);
}

async function cambiarProducto(env, id, d) {
  const p = V.producto(d);
  if ('categoria_id' in p) await revisarCategoria(env, p.categoria_id);
  const antes = 'imagen_url' in p ? (await env.BD.prepare('SELECT imagen_url FROM productos WHERE id = ?').bind(id).first())?.imagen_url : null;
  noExiste(await actualizar(env, 'productos', [['id', id]], { ...p, actualizado: fechaSql() }), 'El producto ya no existe.');
  if (antes && antes !== p.imagen_url) await soltarFoto(env, antes);
  return json({ ok: true });
}

/** Duplicar: copia el producto con una referencia nueva (y la misma foto, que se borra solo cuando nadie la usa). */
async function duplicarProducto(env, id) {
  const o = await env.BD.prepare('SELECT * FROM productos WHERE id = ?').bind(id).first();
  if (!o) falla(404, 'El producto ya no existe.');
  const nuevo = await referenciaLibre(env, o.categoria_id);
  const orden = (await env.BD.prepare('SELECT coalesce(max(orden), 0) + 10 AS n FROM productos').first()).n;
  await insertar(env, 'productos', {
    id: nuevo, nombre: `${o.nombre} (copia)`.slice(0, 120), categoria_id: o.categoria_id, descripcion: o.descripcion, precio: o.precio,
    cotizar: o.cotizar, imagen_url: o.imagen_url, disponible: o.disponible, visible: 0, orden,
  }).run();
  return json({ id: nuevo }, 201);
}

// --- panel: personalizador de regalos ---------------------------------------------------
const PADRE_DE = { tamano: 'base', contenido: 'tamano' };
async function revisarPadreOpcion(env, publico, paso, padreId) {
  const esperado = PADRE_DE[paso];
  if (!esperado) { if (padreId) falla(400, 'Este paso no depende de otro.'); return; }
  if (!padreId) falla(400, esperado === 'base' ? 'Elige a qué base pertenece este tamaño.' : 'Elige a qué tamaño pertenece este contenido.');
  const padre = await env.BD.prepare('SELECT paso FROM opciones WHERE publico = ? AND id = ?').bind(publico, padreId).first();
  if (padre?.paso !== esperado) falla(400, esperado === 'base' ? 'Un tamaño debe pertenecer a una base.' : 'El contenido debe pertenecer a un tamaño.');
}

async function crearOpcion(env, d) {
  const o = V.opcion(d, true);
  await revisarPadreOpcion(env, o.publico, o.paso, o.padre_id ?? null);
  const prefijo = PREFIJO_PASO[o.paso];
  const { results } = await env.BD.prepare("SELECT id, codigo FROM opciones WHERE publico = ? AND (id LIKE ?2 || '%' OR codigo LIKE ?2 || '%')").bind(o.publico, prefijo).all();
  const usados = new Set(results.flatMap((r) => [r.id, r.codigo]));
  let n = results.reduce((m, r) => { const x = Number(r.id.slice(prefijo.length)); return Number.isInteger(x) ? Math.max(m, x) : m; }, 0) + 1;
  while (usados.has(`${prefijo}${n}`)) n++;
  const id = `${prefijo}${n}`;
  const orden = o.orden ?? ((await env.BD.prepare('SELECT coalesce(max(orden), 0) + 10 AS n FROM opciones WHERE publico = ? AND paso = ?').bind(o.publico, o.paso).first()).n);
  await insertar(env, 'opciones', { ...o, id, codigo: id, padre_id: o.padre_id ?? null, orden }).run();
  return json({ id }, 201);
}

async function cambiarOpcion(env, publico, id, d) {
  const o = V.opcion(d);
  const actual = await env.BD.prepare('SELECT paso FROM opciones WHERE publico = ? AND id = ?').bind(publico, id).first();
  if (!actual) falla(404, 'La opción ya no existe.');
  if ('padre_id' in o) await revisarPadreOpcion(env, publico, actual.paso, o.padre_id);
  await actualizar(env, 'opciones', [['publico', publico], ['id', id]], o);
  return json({ ok: true });
}

async function borrarOpcion(env, publico, id) {
  // Borrar una base borra sus tamaños y el contenido de esos tamaños (la base de datos lo hace en cascada).
  const r = await env.BD.prepare('DELETE FROM opciones WHERE publico = ? AND id = ?').bind(publico, id).run();
  noExiste(r, 'La opción ya no existe.');
  return json({ ok: true });
}

const ORDENABLES = { productos: ['id'], categorias: ['id'], opciones: ['publico', 'id'] };
/** Guarda el orden de una lista: el primero de `ids` queda arriba. */
async function ordenar(env, d) {
  const claves = ORDENABLES[d.tabla];
  if (!claves || !Array.isArray(d.ids) || d.ids.length > 2000) falla(400, 'Orden no válido.');
  if (d.tabla === 'opciones' && !V.PUBLICOS.includes(d.publico)) falla(400, 'Orden no válido.');
  const donde = d.tabla === 'opciones' ? 'publico = ?2 AND id = ?3' : 'id = ?3';
  await env.BD.batch(d.ids.map((id, i) => env.BD.prepare(`UPDATE ${d.tabla} SET orden = ?1 WHERE ${donde}`).bind((i + 1) * 10, d.publico ?? null, String(id))));
  return json({ ok: true });
}

// --- rutas /api/admin/* (todas exigen sesión) -----------------------------------------
export async function rutasAdmin(req, env, ruta, d) {
  await exigirSesion(req, env);
  const m = req.method;
  const [recurso, id, accion] = ruta.split('/').map(decodeURIComponent);

  if (m === 'GET' && recurso === 'datos') {
    const [cats, prods, ops, aj] = await env.BD.batch([
      env.BD.prepare('SELECT * FROM categorias ORDER BY orden, nombre'),
      env.BD.prepare('SELECT * FROM productos ORDER BY orden, nombre'),
      env.BD.prepare('SELECT * FROM opciones ORDER BY orden, nombre'),
      env.BD.prepare('SELECT * FROM ajustes WHERE id = 1'),
    ]);
    const bool = (p) => ({ ...p, cotizar: !!p.cotizar, disponible: !!p.disponible, visible: !!p.visible });
    const todos = prods.results.map(bool);
    const { id: _, ...ajustes } = aj.results[0] || {};
    return json({
      categorias: cats.results.map((c) => ({ ...c, activa: !!c.activa })),
      productos: todos.filter((p) => !p.borrado_en), papelera: todos.filter((p) => p.borrado_en),
      opciones: ops.results.map((o) => ({ ...o, activa: !!o.activa })), ajustes,
    });
  }

  if (recurso === 'fotos' && m === 'POST') return subirFoto(req, env);
  if (recurso === 'orden' && m === 'POST') return ordenar(env, d);
  if (recurso === 'ajustes' && m === 'PUT') { await actualizar(env, 'ajustes', [['id', 1]], V.ajustes(d)); return json({ ok: true }); }

  if (recurso === 'productos') {
    if (m === 'POST' && !id) return crearProducto(env, d);
    if (m === 'PUT' && id && !accion) return cambiarProducto(env, id, d);
    if (m === 'POST' && accion === 'duplicar') return duplicarProducto(env, id);
    if (m === 'POST' && accion === 'restaurar') { noExiste(await env.BD.prepare('UPDATE productos SET borrado_en = NULL WHERE id = ? AND borrado_en IS NOT NULL').bind(id).run(), 'El producto ya no está en la papelera.'); return json({ ok: true }); }
    if (m === 'DELETE' && id && new URL(req.url).searchParams.get('definitivo') === '1') {
      // Solo se elimina de verdad lo que ya está en la papelera, junto con su foto.
      const p = await env.BD.prepare('SELECT imagen_url FROM productos WHERE id = ? AND borrado_en IS NOT NULL').bind(id).first();
      if (!p) falla(400, 'Primero manda el producto a la papelera.');
      await env.BD.prepare('DELETE FROM productos WHERE id = ?').bind(id).run();
      await soltarFoto(env, p.imagen_url);
      return json({ ok: true });
    }
    if (m === 'DELETE' && id) { noExiste(await env.BD.prepare('UPDATE productos SET borrado_en = ? WHERE id = ? AND borrado_en IS NULL').bind(fechaSql(), id).run(), 'El producto ya no existe.'); return json({ ok: true }); }
  } else if (recurso === 'categorias') {
    if (m === 'POST' && !id) return crearCategoria(env, d);
    if (m === 'PUT' && id) return cambiarCategoria(env, id, d);
    if (m === 'DELETE' && id) return borrarCategoria(env, id);
  } else if (recurso === 'opciones') {
    // /opciones (crear) · /opciones/<publico>/<id> (cambiar o borrar)
    if (m === 'POST' && !id) return crearOpcion(env, d);
    if (m === 'PUT' && id && accion) return cambiarOpcion(env, id, accion, d);
    if (m === 'DELETE' && id && accion) return borrarOpcion(env, id, accion);
  }
  return falla(404, 'Ruta no encontrada.');
}

// --- mantenimiento semanal (cron) -----------------------------------------------------
/** Respaldo en R2 (12 semanas), papelera de más de 30 días, sesiones viejas y fotos huérfanas. */
export async function mantenimiento(env) {
  const datos = {};
  for (const t of ['categorias', 'productos', 'opciones', 'ajustes']) datos[t] = (await env.BD.prepare(`SELECT * FROM ${t}`).all()).results;
  await env.FOTOS.put(`respaldos/${diaHonduras()}.json`, JSON.stringify({ fecha: fechaSql(), datos }), { httpMetadata: { contentType: 'application/json' } });
  const limite = diaHonduras(Date.now() - 84 * 86400000);
  const viejos = (await env.FOTOS.list({ prefix: 'respaldos/' })).objects.filter((o) => o.key.slice(10, 20) < limite).map((o) => o.key);
  if (viejos.length) await env.FOTOS.delete(viejos);

  const { results: papelera } = await env.BD.prepare('SELECT id, imagen_url FROM productos WHERE borrado_en < ?').bind(fechaSql(Date.now() - 30 * 86400000)).all();
  for (const p of papelera) { await env.BD.prepare('DELETE FROM productos WHERE id = ?').bind(p.id).run(); await soltarFoto(env, p.imagen_url); }

  // Fotos subidas que ningún producto usa (se subió la foto pero no se guardó el producto) y tienen más de un día.
  const usadas = new Set((await env.BD.prepare("SELECT imagen_url FROM productos WHERE imagen_url LIKE '/fotos/%'").all()).results.map((r) => r.imagen_url.replace('/fotos/', '').replace(/-1200\./, '-')));
  const huerfanas = (await env.FOTOS.list({ prefix: 'productos/' })).objects
    .filter((o) => Date.now() - o.uploaded.getTime() > 86400000 && !usadas.has(o.key.replace(/-(600|1200)\./, '-'))).map((o) => o.key);
  if (huerfanas.length) await env.FOTOS.delete(huerfanas);

  const ahora = fechaSql();
  await env.BD.batch([
    env.BD.prepare('DELETE FROM sesiones WHERE expira < ?').bind(ahora),
    env.BD.prepare('DELETE FROM intentos WHERE bloqueado_hasta IS NOT NULL AND bloqueado_hasta < ?').bind(ahora),
  ]);
  return { respaldo: `respaldos/${diaHonduras()}.json`, papelera: papelera.length, huerfanas: huerfanas.length };
}
