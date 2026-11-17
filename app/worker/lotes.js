// Lotes de inversión: reparto del costo de una compra grande entre sus productos y precios sugeridos.
//
//   peso de un producto  = su precio de etiqueta (referencia); si no tiene, su precio de venta; si no, 0
//   peso total del lote  = Σ peso × unidades     (si el lote ya está «completo»)
//                        = lo mayor entre Σ y la meta (si todavía se está cargando: así los costos no se disparan con pocos productos)
//   costo por unidad     = peso × inversión / peso total
//   precio sugerido      = peso × meta / peso total          (redondeado a múltiplos de 10)
// Todos los productos del lote ganan el mismo porcentaje con el precio sugerido; con otro precio la ganancia cambia y el total se recalcula.
import { falla, json } from './util.js';

const redondeo = (n) => Math.round(n * 100) / 100;
const aDiez = (n) => Math.max(10, Math.round(n / 10) * 10);
const num = (v, campo, max) => {
  const n = Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > max) falla(400, `${campo}: escribe un número válido.`);
  return redondeo(n);
};

/** Lo que se calcula de un lote a partir de sus productos (puro: se prueba sin base de datos). */
export function calcularLote(lote, productos) {
  const items = productos.map((p) => {
    const unidades = p.lote_cantidad ?? p.cantidad ?? 1;
    const peso = p.referencia ?? p.precio ?? 0;
    return { ...p, unidades, peso };
  });
  const suma = items.reduce((s, p) => s + p.peso * p.unidades, 0);
  const pesoTotal = lote.completo ? suma : Math.max(suma, lote.meta);
  const costoPorPeso = pesoTotal > 0 ? lote.inversion / pesoTotal : 0;
  const precioPorPeso = pesoTotal > 0 ? lote.meta / pesoTotal : 0;
  const filas = items.map((p) => ({
    id: p.id, nombre: p.nombre, unidades: p.unidades, referencia: p.referencia ?? null, precio: p.precio ?? null, cotizar: !!p.cotizar,
    costo: redondeo(p.peso * costoPorPeso), sugerido: p.peso > 0 ? aDiez(p.peso * precioPorPeso) : null,
  }));
  const ventas = filas.reduce((s, f) => s + (f.precio ?? 0) * f.unidades, 0);
  const sinPrecio = filas.filter((f) => f.precio === null).length;
  return {
    filas, sin_precio: sinPrecio,
    unidades: filas.reduce((s, f) => s + f.unidades, 0),
    peso_total: redondeo(suma),
    ventas_estimadas: redondeo(ventas),
    ganancia_estimada: redondeo(ventas - lote.inversion),
    margen_estimado: lote.inversion > 0 ? Math.round(((ventas - lote.inversion) / lote.inversion) * 1000) / 10 : null,
    margen_meta: lote.inversion > 0 ? Math.round(((lote.meta - lote.inversion) / lote.inversion) * 1000) / 10 : null,
    falta_para_meta: redondeo(Math.max(0, lote.meta - ventas)),
    falta_cubrir: redondeo(Math.max(0, lote.inversion - ventas)),   // cuánto más en productos (a tus precios) para cubrir lo invertido
    subida_pct: ventas > 0 && ventas < lote.meta ? Math.round((lote.meta / ventas - 1) * 1000) / 10 : 0, // cuánto tendrían que subir tus precios para llegar a la meta
  };
}

const PRODUCTOS_DEL_LOTE = 'SELECT id, nombre, precio, cotizar, cantidad, referencia, lote_cantidad FROM productos WHERE lote_id = ? AND borrado_en IS NULL ORDER BY orden, nombre';

/** Vuelve a repartir el costo entre los productos de un lote (se llama cada vez que algo del lote cambia). */
export async function recalcularLote(env, loteId) {
  if (!loteId) return;
  const lote = await env.BD.prepare('SELECT * FROM lotes WHERE id = ?').bind(loteId).first();
  if (!lote) return;
  const { results } = await env.BD.prepare(PRODUCTOS_DEL_LOTE).bind(loteId).all();
  const calc = calcularLote(lote, results);
  if (!calc.filas.length) return;
  await env.BD.batch(calc.filas.map((f) => env.BD.prepare('UPDATE productos SET costo = ? WHERE id = ?').bind(f.costo, f.id)));
}

export async function detalleLote(env, id) {
  const lote = await env.BD.prepare('SELECT * FROM lotes WHERE id = ?').bind(Number(id)).first();
  if (!lote) falla(404, 'Ese lote ya no existe.');
  const { results } = await env.BD.prepare(PRODUCTOS_DEL_LOTE).bind(lote.id).all();
  const vendido = await env.BD.prepare(`SELECT coalesce(sum(m.cantidad * m.precio_unit), 0) AS ingresos, coalesce(sum(m.cantidad * (m.precio_unit - m.costo_unit)), 0) AS ganancia, coalesce(sum(m.cantidad), 0) AS unidades
    FROM movimientos m JOIN productos p ON p.id = m.producto_id WHERE m.tipo = 'venta' AND m.anulado = 0 AND p.lote_id = ?`).bind(lote.id).first();
  const ingresos = redondeo(vendido.ingresos);
  return { ...lote, completo: !!lote.completo, ...calcularLote(lote, results), vendido: { ingresos, ganancia: redondeo(vendido.ganancia), unidades: vendido.unidades }, falta_recuperar: redondeo(Math.max(0, lote.inversion - ingresos)) };
}

export async function listarLotes(env) {
  const { results } = await env.BD.prepare('SELECT id FROM lotes ORDER BY id DESC').all();
  const lotes = [];
  for (const { id } of results) lotes.push(await detalleLote(env, id));
  return json({ lotes });
}
export async function verLote(env, id) { return json(await detalleLote(env, id)); }

function campos(d, crear) {
  const r = {};
  if (crear || 'nombre' in d) { r.nombre = String(d.nombre ?? '').trim(); if (!r.nombre || r.nombre.length > 80) falla(400, 'Nombre: escribe un nombre (máximo 80 caracteres).'); }
  if (crear || 'inversion' in d) r.inversion = num(d.inversion, 'Inversión', 100000000);
  if (crear || 'meta' in d) r.meta = num(d.meta, 'Meta de ventas', 1000000000);
  if ('completo' in d) r.completo = d.completo === true || d.completo === 1 || d.completo === '1' ? 1 : 0;
  return r;
}
export async function crearLote(env, d) {
  const meta = d.meta === undefined || d.meta === null || d.meta === '' ? Math.round(num(d.inversion, 'Inversión', 100000000) * 1.8) : d.meta; // sin meta: 80 % de ganancia
  const c = campos({ ...d, meta }, true);
  const r = await env.BD.prepare('INSERT INTO lotes (nombre, inversion, meta, completo) VALUES (?, ?, ?, ?)').bind(c.nombre, c.inversion, c.meta, c.completo ?? 0).run();
  return json({ id: r.meta.last_row_id }, 201);
}
export async function cambiarLote(env, id, d) {
  const c = campos(d, false), ks = Object.keys(c);
  if (!ks.length) return json({ ok: true });
  const r = await env.BD.prepare(`UPDATE lotes SET ${ks.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...ks.map((k) => c[k]), Number(id)).run();
  if (!r.meta.changes) falla(404, 'Ese lote ya no existe.');
  await recalcularLote(env, Number(id));
  return json({ ok: true });
}
export async function borrarLote(env, id) {
  const r = await env.BD.prepare('DELETE FROM lotes WHERE id = ?').bind(Number(id)).run(); // los productos quedan sin lote (ON DELETE SET NULL) y conservan su último costo
  if (!r.meta.changes) falla(404, 'Ese lote ya no existe.');
  return json({ ok: true });
}

/** Pone el precio sugerido: solo a los que no tienen precio ('faltantes') o a todos ('todos'). */
export async function aplicarSugeridos(env, id, modo) {
  if (!['faltantes', 'todos'].includes(modo)) falla(400, 'Elige a cuáles aplicar los precios sugeridos.');
  const d = await detalleLote(env, id);
  const cambios = d.filas.filter((f) => f.sugerido !== null && !f.cotizar && (modo === 'todos' || f.precio === null));
  if (cambios.length) await env.BD.batch(cambios.map((f) => env.BD.prepare('UPDATE productos SET precio = ?, cotizar = 0 WHERE id = ?').bind(f.sugerido, f.id)));
  await recalcularLote(env, Number(id));
  return json({ cambiados: cambios.length });
}
