// Finanzas del negocio: libro de compras y ventas, resumen (inversión, ventas, ganancia) y las hojas CSV que alimentan la hoja de Google.
import { falla, json, fechaSql, iguales } from './util.js';
import { detalleLote } from './lotes.js';

const TIPOS_STOCK = { aparte: 'Stock aparte', local: 'Stock local', sin: 'Sin stock' };
const num = (v, campo, { max = 1000000, nulo = false } = {}) => {
  if (nulo && (v === null || v === undefined || v === '')) return null;
  const n = Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > max) falla(400, `${campo}: escribe un número válido.`);
  return Math.round(n * 100) / 100;
};
const entero = (v, campo) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 100000) falla(400, `${campo}: escribe un número entero de 1 en adelante.`);
  return n;
};
const dinero = (n) => Math.round((n || 0) * 100) / 100;

// --- registrar una compra o una venta -------------------------------------------------------
/**
 * Compra (solo stock local): suma unidades y cuenta como inversión.
 * Venta: stock local rebaja la cantidad si se está contando; stock aparte (dropshipping) no toca cantidades; sin stock no se puede vender.
 */
export async function crearMovimiento(env, d, sesion) {
  const tipo = d.tipo;
  if (!['compra', 'venta'].includes(tipo)) falla(400, 'Elige si es una compra o una venta.');
  const p = await env.BD.prepare('SELECT id, nombre, categoria_id, precio, cotizar, costo, cantidad, tipo_stock FROM productos WHERE id = ? AND borrado_en IS NULL').bind(String(d.producto_id ?? '')).first();
  if (!p) falla(400, 'Ese producto ya no existe.');
  const n = entero(d.cantidad, 'Cantidad');
  const nota = String(d.nota ?? '').trim().slice(0, 200);
  const sentencias = [];
  let precio = null, costo;
  if (tipo === 'compra') {
    if (p.tipo_stock !== 'local') falla(400, 'Solo se registran compras de productos con «Stock local». Cambia el tipo de stock del producto primero.');
    costo = num(d.costo ?? p.costo, 'Costo', { nulo: true });
    if (costo === null) falla(400, 'Escribe cuánto te costó cada unidad.');
    sentencias.push(env.BD.prepare('UPDATE productos SET cantidad = coalesce(cantidad, 0) + ?, costo = ?, actualizado = ? WHERE id = ?').bind(n, costo, fechaSql(), p.id));
  } else {
    if (p.tipo_stock === 'sin') falla(400, 'Este producto está «Sin stock»: cambia su tipo de stock antes de registrar una venta.');
    precio = num(d.precio ?? p.precio, 'Precio', { nulo: true });
    if (precio === null) falla(400, 'Escribe a cuánto vendiste cada unidad.');
    costo = num(d.costo ?? p.costo ?? 0, 'Costo');
    if (p.tipo_stock === 'local' && p.cantidad !== null) {
      if (p.cantidad < n) falla(400, p.cantidad === 0 ? 'No quedan unidades de este producto.' : `Solo quedan ${p.cantidad} unidad${p.cantidad === 1 ? '' : 'es'}.`);
      sentencias.push(env.BD.prepare('UPDATE productos SET cantidad = cantidad - ?, actualizado = ? WHERE id = ?').bind(n, fechaSql(), p.id));
    }
  }
  sentencias.push(env.BD.prepare(`INSERT INTO movimientos (fecha, tipo, producto_id, producto_nombre, tipo_stock, categoria_id, cantidad, precio_unit, costo_unit, nota, usuario)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(fechaSql(), tipo, p.id, p.nombre, p.tipo_stock, p.categoria_id, n, precio, costo, nota, sesion?.correo ?? ''));
  const r = await env.BD.batch(sentencias);
  return json({ id: r.at(-1).meta.last_row_id }, 201);
}

/** Anular un movimiento (por error de dedo): lo marca anulado y devuelve las unidades a su lugar. */
export async function anularMovimiento(env, id) {
  const m = await env.BD.prepare('SELECT * FROM movimientos WHERE id = ? AND anulado = 0').bind(Number(id)).first();
  if (!m) falla(404, 'Ese movimiento ya no existe o ya estaba anulado.');
  const sentencias = [env.BD.prepare('UPDATE movimientos SET anulado = 1 WHERE id = ?').bind(m.id)];
  const p = await env.BD.prepare('SELECT cantidad, tipo_stock FROM productos WHERE id = ?').bind(m.producto_id).first();
  if (p && m.tipo_stock === 'local' && p.cantidad !== null) {
    if (m.tipo === 'venta') sentencias.unshift(env.BD.prepare('UPDATE productos SET cantidad = cantidad + ? WHERE id = ?').bind(m.cantidad, m.producto_id));
    else if (p.cantidad < m.cantidad) falla(400, 'Ya vendiste parte de esas unidades: anula primero esas ventas.');
    else sentencias.unshift(env.BD.prepare('UPDATE productos SET cantidad = cantidad - ? WHERE id = ?').bind(m.cantidad, m.producto_id));
  }
  await env.BD.batch(sentencias);
  return json({ ok: true });
}

// --- resumen -----------------------------------------------------------------------------
const SUMAS = `
  coalesce(sum(CASE WHEN tipo = 'compra' THEN cantidad * costo_unit END), 0) AS invertido,
  coalesce(sum(CASE WHEN tipo = 'venta' THEN cantidad * precio_unit END), 0) AS ingresos,
  coalesce(sum(CASE WHEN tipo = 'venta' THEN cantidad * costo_unit END), 0) AS costo_vendido,
  coalesce(sum(CASE WHEN tipo = 'venta' THEN cantidad END), 0) AS unidades_vendidas`;
const conGanancia = (r) => ({ ...r, invertido: dinero(r.invertido), ingresos: dinero(r.ingresos), costo_vendido: dinero(r.costo_vendido), ganancia: dinero(r.ingresos - r.costo_vendido) });

export async function resumen(env) {
  const hace = (dias) => fechaSql(Date.now() - dias * 86400000);
  const [total, semana, mes, porTipo, porCat, stock, sinCosto, recientes, aj, lotesBD] = await env.BD.batch([
    env.BD.prepare(`SELECT ${SUMAS} FROM movimientos WHERE anulado = 0`),
    env.BD.prepare(`SELECT ${SUMAS} FROM movimientos WHERE anulado = 0 AND fecha >= ?`).bind(hace(7)),
    env.BD.prepare(`SELECT ${SUMAS} FROM movimientos WHERE anulado = 0 AND fecha >= ?`).bind(hace(30)),
    env.BD.prepare(`SELECT tipo_stock, ${SUMAS} FROM movimientos WHERE anulado = 0 GROUP BY tipo_stock`),
    env.BD.prepare(`SELECT m.categoria_id, coalesce(c.nombre, m.categoria_id) AS categoria, ${SUMAS.replace(/\b(tipo|cantidad|costo_unit|precio_unit)\b/g, 'm.$1')}
      FROM movimientos m LEFT JOIN categorias c ON c.id = m.categoria_id WHERE m.anulado = 0 GROUP BY m.categoria_id ORDER BY 4 DESC`),
    env.BD.prepare(`SELECT id, nombre, costo, cantidad FROM productos WHERE borrado_en IS NULL AND tipo_stock = 'local' ORDER BY nombre`),
    env.BD.prepare(`SELECT tipo_stock, count(*) AS n FROM productos WHERE borrado_en IS NULL AND costo IS NULL GROUP BY tipo_stock`),
    env.BD.prepare(`SELECT * FROM movimientos ORDER BY id DESC LIMIT 40`),
    env.BD.prepare('SELECT hoja_url FROM ajustes WHERE id = 1'),
    env.BD.prepare('SELECT id FROM lotes ORDER BY id DESC'),
  ]);
  // La inversión de los lotes (compra grande con costo por producto desconocido) también cuenta como invertido, en stock local.
  const lotes = [];
  for (const { id } of lotesBD.results) lotes.push(await detalleLote(env, id));
  const invertidoLotes = dinero(lotes.reduce((s, l) => s + l.inversion, 0));
  const sumarLotes = (r, tipo) => (tipo === undefined || tipo === 'local' ? { ...r, invertido: r.invertido + invertidoLotes } : r);
  const t = conGanancia(sumarLotes(total.results[0]));
  const enStock = stock.results.filter((p) => p.cantidad !== null);
  const capitalEnStock = dinero(enStock.reduce((s, p) => s + (p.costo ?? 0) * p.cantidad, 0));
  const local = conGanancia(sumarLotes(porTipo.results.find((x) => x.tipo_stock === 'local') ?? { tipo_stock: 'local', invertido: 0, ingresos: 0, costo_vendido: 0, unidades_vendidas: 0 }, 'local'));
  return json({
    total: t,
    semana: conGanancia(semana.results[0]),
    mes: conGanancia(mes.results[0]),
    // Retorno de lo invertido en stock local: ganancia de esas ventas entre lo invertido.
    retorno_local: t.invertido > 0 ? Math.round((local.ganancia / t.invertido) * 1000) / 10 : null,
    capital_en_stock: capitalEnStock,
    unidades_en_stock: enStock.reduce((s, p) => s + p.cantidad, 0),
    por_tipo: [...porTipo.results.filter((r) => r.tipo_stock !== 'local'), ...(invertidoLotes > 0 || porTipo.results.some((r) => r.tipo_stock === 'local') ? [{ ...local, tipo_stock: 'local' }] : [])].map((r) => ({ nombre: TIPOS_STOCK[r.tipo_stock], ...conGanancia(r) })),
    lotes: lotes.map((l) => ({ id: l.id, nombre: l.nombre, inversion: l.inversion, meta: l.meta, ventas_estimadas: l.ventas_estimadas, ganancia_estimada: l.ganancia_estimada, margen_estimado: l.margen_estimado, vendido: l.vendido, unidades: l.unidades, completo: l.completo })),
    por_categoria: porCat.results.map((r) => ({ categoria_id: r.categoria_id, categoria: r.categoria, ...conGanancia(r) })),
    sin_costo: sinCosto.results,
    recientes: recientes.results.map((m) => ({ ...m, anulado: !!m.anulado, total: dinero(m.cantidad * (m.tipo === 'venta' ? m.precio_unit : m.costo_unit)) })),
    hoja_url: aj.results[0]?.hoja_url ?? '',
  });
}

// --- hojas CSV (para la hoja de Google) -------------------------------------------------------
const celda = (v) => {
  let t = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t) && Number.isNaN(Number(t))) t = `'${t}`; // que una hoja de cálculo nunca lo tome como fórmula
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const csv = (filas) => `﻿${filas.map((f) => f.map(celda).join(',')).join('\n')}\n`;
const hondu = (sql) => { const d = new Date(`${sql.replace(' ', 'T')}Z`.replace('ZZ', 'Z')); return Number.isNaN(d.getTime()) ? sql : new Date(d.getTime() - 6 * 3600000).toISOString().replace('T', ' ').slice(0, 16); };

async function hojaProductos(env) {
  const { results } = await env.BD.prepare(`SELECT p.id, p.nombre, coalesce(c.nombre, '') AS categoria, p.tipo_stock, p.costo, p.precio, p.cotizar, p.cantidad, p.visible, p.disponible, coalesce(l.nombre, '') AS lote, p.referencia
    FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id LEFT JOIN lotes l ON l.id = p.lote_id WHERE p.borrado_en IS NULL ORDER BY c.orden, p.orden, p.nombre`).all();
  return csv([['Referencia', 'Producto', 'Categoría', 'Tipo de stock', 'Costo (L)', 'Precio (L)', 'Margen (L)', 'Cantidad', 'Valor en stock (L)', 'Visible', 'Hay', 'Lote', 'Precio de etiqueta (L)'],
    ...results.map((p) => [p.id, p.nombre, p.categoria, TIPOS_STOCK[p.tipo_stock], p.costo ?? '', p.cotizar ? 'Por cotizar' : p.precio ?? '',
      p.costo !== null && !p.cotizar && p.precio !== null ? dinero(p.precio - p.costo) : '', p.cantidad ?? '',
      p.tipo_stock === 'local' && p.cantidad !== null && p.costo !== null ? dinero(p.costo * p.cantidad) : '', p.visible ? 'Sí' : 'No', p.disponible ? 'Sí' : 'No', p.lote, p.referencia ?? ''])]);
}
async function hojaMovimientos(env) {
  const { results } = await env.BD.prepare('SELECT * FROM movimientos ORDER BY id DESC').all();
  return csv([['Nº', 'Fecha', 'Tipo', 'Referencia', 'Producto', 'Tipo de stock', 'Cantidad', 'Precio venta (L)', 'Costo unit. (L)', 'Total (L)', 'Ganancia (L)', 'Nota', 'Anulado'],
    ...results.map((m) => [m.id, hondu(m.fecha), m.tipo === 'venta' ? 'Venta' : 'Compra', m.producto_id, m.producto_nombre, TIPOS_STOCK[m.tipo_stock], m.cantidad,
      m.precio_unit ?? '', m.costo_unit, dinero(m.cantidad * (m.tipo === 'venta' ? m.precio_unit : m.costo_unit)),
      m.tipo === 'venta' ? dinero(m.cantidad * (m.precio_unit - m.costo_unit)) : '', m.nota, m.anulado ? 'Sí' : ''])]);
}
async function hojaResumen(env) {
  const r = await (await resumen(env)).json();
  const fila = (n, x) => [n, x.invertido, x.ingresos, x.costo_vendido, x.ganancia, x.unidades_vendidas];
  return csv([
    ['Resumen', 'Invertido (L)', 'Vendido (L)', 'Costo de lo vendido (L)', 'Ganancia (L)', 'Unidades vendidas'],
    fila('Todo el tiempo', r.total), fila('Últimos 7 días', r.semana), fila('Últimos 30 días', r.mes),
    [],
    ['Capital en stock local (L)', r.capital_en_stock], ['Unidades en stock local', r.unidades_en_stock], ['Retorno sobre lo invertido (%)', r.retorno_local ?? ''],
    [],
    ['Por tipo de stock', 'Invertido (L)', 'Vendido (L)', 'Costo de lo vendido (L)', 'Ganancia (L)', 'Unidades vendidas'],
    ...r.por_tipo.map((x) => fila(x.nombre, x)),
    [],
    ['Lotes', 'Inversión (L)', 'Meta de ventas (L)', 'Ventas estimadas con tus precios (L)', 'Ganancia estimada (L)', 'Vendido de verdad (L)'],
    ...r.lotes.map((l) => [l.nombre, l.inversion, l.meta, l.ventas_estimadas, l.ganancia_estimada, l.vendido.ingresos]),
    [],
    ['Por categoría', 'Invertido (L)', 'Vendido (L)', 'Costo de lo vendido (L)', 'Ganancia (L)', 'Unidades vendidas'],
    ...r.por_categoria.map((x) => fila(x.categoria, x)),
  ]);
}
const HOJAS = { productos: hojaProductos, movimientos: hojaMovimientos, resumen: hojaResumen };

/** GET /api/finanzas/csv/<hoja>?clave=…  Solo con la clave secreta FINANZAS_TOKEN; sin ella la ruta ni existe. */
export async function hojaCsv(env, hoja, clave) {
  if (!env.FINANZAS_TOKEN || !HOJAS[hoja]) falla(404, 'Ruta no encontrada.');
  if (!iguales(clave ?? '', env.FINANZAS_TOKEN)) falla(404, 'Ruta no encontrada.');
  return new Response(await HOJAS[hoja](env), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

/** Enlaces para pegar en la hoja de Google (solo administradora). */
export function enlacesHoja(env, base) {
  if (!env.FINANZAS_TOKEN) return json({ configurado: false, enlaces: {} });
  return json({ configurado: true, enlaces: Object.fromEntries(Object.keys(HOJAS).map((h) => [h, `${base}/api/finanzas/csv/${h}?clave=${env.FINANZAS_TOKEN}`])) });
}
