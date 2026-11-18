// Finanzas del negocio: libro de compras y ventas, resumen (inversión, ventas, ganancia) y las hojas CSV que alimentan la hoja de Google.
import { falla, json, fechaSql, iguales, TIPOS_STOCK, esLocal } from './util.js';
import { detalleLote } from './lotes.js';
import { quitarTalla } from '../public/assets/tallas.mjs';
import { puede } from './auth.js';
import { validarGasto, validarCredito, registrarCredito, resumenCobros, datosCreditos, CATEGORIAS_GASTO } from './creditos.js';

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
export async function crearMovimiento(env, d, sesion, ctx) {
  const tipo = d.tipo;
  if (!['compra', 'venta'].includes(tipo)) falla(400, 'Elige si es una compra o una venta.');
  const p = await env.BD.prepare('SELECT id, nombre, categoria_id, precio, cotizar, costo, cantidad, tipo_stock, talla FROM productos WHERE id = ? AND borrado_en IS NULL').bind(String(d.producto_id ?? '')).first();
  if (!p) falla(400, 'Ese producto ya no existe.');
  const n = entero(d.cantidad, 'Cantidad');
  let nota = String(d.nota ?? '').trim().slice(0, 200);
  const sentencias = [];
  let precio = null, costo, contado = null;
  // Gastos de la venta (bus, envío…) y venta a crédito: solo administradora, porque tocan las finanzas.
  const gastos = (Array.isArray(d.gastos) ? d.gastos : []).filter((g) => g && String(g.monto ?? '').trim() !== '' && Number(String(g.monto).replace(/,/g, '')) !== 0).slice(0, 6).map(validarGasto);
  if ((d.credito || gastos.length) && !puede(sesion, 'finanzas')) falla(403, 'Tu rango no permite registrar gastos ni ventas a crédito.');
  if (d.credito && tipo !== 'venta') falla(400, 'El crédito es solo para ventas.');
  if (d.credito && !String(d.credito.cliente ?? '').trim()) falla(400, 'Escribe el nombre de quién se lleva la deuda.');
  if (tipo === 'compra') {
    if (p.tipo_stock !== 'local2') falla(400, p.tipo_stock === 'local1' ? 'El «Stock local 1» no tiene inversión: no se registran compras. Si lo compraste, cámbialo a «Stock local 2».' : 'Solo se registran compras de productos con «Stock local 2». Cambia el tipo de stock del producto primero.');
    costo = num(d.costo ?? p.costo, 'Costo', { nulo: true });
    if (costo === null) falla(400, 'Escribe cuánto te costó cada unidad.');
    sentencias.push(env.BD.prepare('UPDATE productos SET cantidad = coalesce(cantidad, 0) + ?, costo = ?, actualizado = ? WHERE id = ?').bind(n, costo, fechaSql(), p.id));
  } else {
    if (p.tipo_stock === 'sin') falla(400, 'Este producto está «Sin stock»: cambia su tipo de stock antes de registrar una venta.');
    precio = num(d.precio ?? p.precio, 'Precio', { nulo: true });
    if (precio === null) falla(400, 'Escribe a cuánto vendiste cada unidad.');
    if (d.credito) {
      // Al crédito se vende por más que al contado (cuotas × pago > contado): la venta se anota por el total del crédito.
      contado = Math.round(precio * n * 100) / 100;
      const total = validarCredito({ contado, cuotas: Number(d.credito.cuotas), cuota: num(d.credito.cuota, 'Pago', { nulo: true }) });
      precio = total / n;
    }
    costo = p.tipo_stock === 'local1' ? 0 : num(d.costo ?? p.costo ?? 0, 'Costo'); // el stock local 1 no tuvo inversión
    if (esLocal(p.tipo_stock) && p.cantidad !== null) {
      if (p.cantidad < n) falla(400, p.cantidad === 0 ? 'No quedan unidades de este producto.' : `Solo quedan ${p.cantidad} unidad${p.cantidad === 1 ? '' : 'es'}.`);
      sentencias.push(env.BD.prepare('UPDATE productos SET cantidad = cantidad - ?, actualizado = ? WHERE id = ?').bind(n, fechaSql(), p.id));
    }
    // Si el producto tiene varias tallas y dijiste cuál se vendió, esa talla sale de la lista (así la tienda no la sigue ofreciendo).
    const vendida = String(d.talla ?? '').trim();
    if (vendida) {
      const quedan = quitarTalla(p.talla, vendida);
      if (quedan === null) falla(400, `La talla ${vendida} ya no está en este producto.`);
      if (n > 1) falla(400, 'Para quitar una talla vende de una en una (o deja la talla en blanco).');
      sentencias.push(env.BD.prepare('UPDATE productos SET talla = ? WHERE id = ?').bind(quedan, p.id));
      nota = `Talla ${vendida.toUpperCase()}${nota ? ` · ${nota}` : ''}`.slice(0, 200);
    }
  }
  sentencias.push(env.BD.prepare(`INSERT INTO movimientos (fecha, tipo, producto_id, producto_nombre, tipo_stock, categoria_id, cantidad, precio_unit, costo_unit, nota, usuario)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(fechaSql(), tipo, p.id, p.nombre, p.tipo_stock, p.categoria_id, n, precio, costo, nota, sesion?.correo ?? ''));
  const r = await env.BD.batch(sentencias);
  const id = r.at(-1).meta.last_row_id;
  if (gastos.length) await env.BD.batch(gastos.map((g) => env.BD.prepare('INSERT INTO gastos (fecha, concepto, categoria, monto, nota, usuario, movimiento_id) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(fechaSql(), g.concepto, g.categoria, g.monto, g.nota, sesion?.correo ?? '', id)));
  if (d.credito) {
    try { const c = await registrarCredito(env, { movimientoId: id, producto: p, cantidad: n, contado, credito: d.credito, sesion, ctx }); return json({ id, credito_id: c.id, total: c.total }, 201); }
    catch (e) { await anularMovimiento(env, id); throw e; } // si el crédito no se pudo guardar, la venta no se queda a medias
  }
  return json({ id }, 201);
}

/** Anular un movimiento (por error de dedo): lo marca anulado y devuelve las unidades a su lugar. */
export async function anularMovimiento(env, id) {
  const m = await env.BD.prepare('SELECT * FROM movimientos WHERE id = ? AND anulado = 0').bind(Number(id)).first();
  if (!m) falla(404, 'Ese movimiento ya no existe o ya estaba anulado.');
  const sentencias = [env.BD.prepare('UPDATE movimientos SET anulado = 1 WHERE id = ?').bind(m.id), env.BD.prepare('UPDATE gastos SET anulado = 1 WHERE movimiento_id = ?').bind(m.id)];
  if (m.credito_id) {
    const ab = await env.BD.prepare('SELECT count(*) AS n FROM abonos WHERE credito_id = ? AND anulado = 0').bind(m.credito_id).first();
    if (ab.n) falla(400, 'Esta venta a crédito ya tiene abonos: anula primero los abonos.');
    sentencias.push(env.BD.prepare("UPDATE creditos SET estado = 'anulado' WHERE id = ?").bind(m.credito_id));
  }
  const p = await env.BD.prepare('SELECT cantidad, tipo_stock FROM productos WHERE id = ?').bind(m.producto_id).first();
  if (p && esLocal(m.tipo_stock) && p.cantidad !== null) {
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

/**
 * El contador del stock local (lo que se va sumando mientras cargas productos): cuánto vale lo cargado a TUS precios
 * (en stock + lo ya vendido), cuánto falta para cubrir la inversión y la meta, y la ganancia si lo vendes todo.
 * El stock local 1 (sin inversión) también suma: todo lo que vendas ayuda a recuperar lo invertido.
 */
export async function contadorStock(env) {
  const [stock, vendido, compras, lotes] = await env.BD.batch([
    env.BD.prepare(`SELECT tipo_stock, count(*) AS productos, coalesce(sum(coalesce(cantidad, 1)), 0) AS unidades, coalesce(sum(coalesce(cantidad, 1) * precio), 0) AS valor
      FROM productos WHERE borrado_en IS NULL AND tipo_stock IN ('local1', 'local2') AND cotizar = 0 GROUP BY tipo_stock`),
    env.BD.prepare(`SELECT tipo_stock, coalesce(sum(cantidad * precio_unit), 0) AS ingresos FROM movimientos WHERE anulado = 0 AND tipo = 'venta' AND tipo_stock IN ('local1', 'local2') GROUP BY tipo_stock`),
    env.BD.prepare(`SELECT coalesce(sum(cantidad * costo_unit), 0) AS n FROM movimientos WHERE anulado = 0 AND tipo = 'compra'`),
    env.BD.prepare('SELECT coalesce(sum(inversion), 0) AS inversion, coalesce(sum(meta), 0) AS meta, count(*) AS n FROM lotes'),
  ]);
  const por = (rs, t, k) => rs.results.find((x) => x.tipo_stock === t)?.[k] ?? 0;
  const enStock = (t) => ({ productos: por(stock, t, 'productos'), unidades: por(stock, t, 'unidades'), valor: dinero(por(stock, t, 'valor')) });
  const vendidoLocal = dinero(por(vendido, 'local1', 'ingresos') + por(vendido, 'local2', 'ingresos'));
  const valorEnStock = dinero(enStock('local1').valor + enStock('local2').valor);
  const valorTotal = dinero(valorEnStock + vendidoLocal);
  const inversion = dinero(lotes.results[0].inversion + compras.results[0].n);
  const publico = (await env.BD.prepare('SELECT mostrar_local2 FROM ajustes WHERE id = 1').first())?.mostrar_local2 === 1;
  const meta = lotes.results[0].n ? dinero(lotes.results[0].meta) : inversion > 0 ? Math.round(inversion * 1.8) : 0; // sin lote: +80 %
  const pct = (n, base) => (base > 0 ? Math.round((n / base) * 1000) / 10 : null);
  return {
    local1: enStock('local1'), local2: enStock('local2'), local2_publico: publico,
    valor_en_stock: valorEnStock, vendido: vendidoLocal, valor_total: valorTotal,
    inversion, meta,
    falta_cubrir: dinero(Math.max(0, inversion - valorTotal)),          // cuánto más en productos (a tus precios) para cubrir lo invertido
    falta_meta: meta ? dinero(Math.max(0, meta - valorTotal)) : null,
    falta_recuperar: dinero(Math.max(0, inversion - vendidoLocal)),     // cuánto falta VENDER para recuperar lo invertido
    ganancia_si_vendes_todo: dinero(valorTotal - inversion),
    margen_si_vendes_todo: pct(valorTotal - inversion, inversion),
    subida_pct: meta && valorTotal > 0 && valorTotal < meta ? Math.round((meta / valorTotal - 1) * 1000) / 10 : 0, // cuánto tendrían que subir tus precios para llegar a la meta
    progreso_inversion: inversion > 0 ? Math.min(100, Math.round((valorTotal / inversion) * 100)) : null,
    progreso_recuperado: inversion > 0 ? Math.min(100, Math.round((vendidoLocal / inversion) * 100)) : null,
  };
}

export async function resumen(env) {
  const hace = (dias) => fechaSql(Date.now() - dias * 86400000);
  const [total, semana, mes, porTipo, porCat, stock, sinCosto, recientes, aj, lotesBD, gTotal, gSemana, gMes, gCat, gRecientes, cfg] = await env.BD.batch([
    env.BD.prepare(`SELECT ${SUMAS} FROM movimientos WHERE anulado = 0`),
    env.BD.prepare(`SELECT ${SUMAS} FROM movimientos WHERE anulado = 0 AND fecha >= ?`).bind(hace(7)),
    env.BD.prepare(`SELECT ${SUMAS} FROM movimientos WHERE anulado = 0 AND fecha >= ?`).bind(hace(30)),
    env.BD.prepare(`SELECT tipo_stock, ${SUMAS} FROM movimientos WHERE anulado = 0 GROUP BY tipo_stock`),
    env.BD.prepare(`SELECT m.categoria_id, coalesce(c.nombre, m.categoria_id) AS categoria, ${SUMAS.replace(/\b(tipo|cantidad|costo_unit|precio_unit)\b/g, 'm.$1')}
      FROM movimientos m LEFT JOIN categorias c ON c.id = m.categoria_id WHERE m.anulado = 0 GROUP BY m.categoria_id ORDER BY 4 DESC`),
    env.BD.prepare(`SELECT id, nombre, costo, cantidad FROM productos WHERE borrado_en IS NULL AND tipo_stock IN ('local1', 'local2') ORDER BY nombre`),
    env.BD.prepare(`SELECT tipo_stock, count(*) AS n FROM productos WHERE borrado_en IS NULL AND costo IS NULL GROUP BY tipo_stock`),
    env.BD.prepare(`SELECT * FROM movimientos ORDER BY id DESC LIMIT 40`),
    env.BD.prepare('SELECT hoja_url FROM ajustes WHERE id = 1'),
    env.BD.prepare('SELECT id FROM lotes ORDER BY id DESC'),
    env.BD.prepare('SELECT coalesce(sum(monto), 0) AS n FROM gastos WHERE anulado = 0'),
    env.BD.prepare('SELECT coalesce(sum(monto), 0) AS n FROM gastos WHERE anulado = 0 AND fecha >= ?').bind(hace(7)),
    env.BD.prepare('SELECT coalesce(sum(monto), 0) AS n FROM gastos WHERE anulado = 0 AND fecha >= ?').bind(hace(30)),
    env.BD.prepare('SELECT categoria, coalesce(sum(monto), 0) AS monto FROM gastos WHERE anulado = 0 GROUP BY categoria ORDER BY 2 DESC'),
    env.BD.prepare('SELECT * FROM gastos ORDER BY id DESC LIMIT 40'),
    env.BD.prepare('SELECT credito_pct FROM ajustes WHERE id = 1'),
  ]);
  const cobros = await resumenCobros(env);
  const creditos = await datosCreditos(env, false);
  // Neta = ganancia de las ventas − los gastos (bus, envío…). El recargo del crédito ya va dentro del precio de venta.
  const conNeta = (r, g) => ({ ...r, gastos: dinero(g), neta: dinero(r.ganancia - g) });
  // La inversión de los lotes (compra grande con costo por producto desconocido) también cuenta como invertido, en stock local.
  const lotes = [];
  for (const { id } of lotesBD.results) lotes.push(await detalleLote(env, id));
  const invertidoLotes = dinero(lotes.reduce((s, l) => s + l.inversion, 0));
  const sumarLotes = (r, tipo) => (tipo === undefined || tipo === 'local2' ? { ...r, invertido: r.invertido + invertidoLotes } : r);
  const t = conGanancia(sumarLotes(total.results[0]));
  const enStock = stock.results.filter((p) => p.cantidad !== null);
  const capitalEnStock = dinero(enStock.reduce((s, p) => s + (p.costo ?? 0) * p.cantidad, 0));
  const local = conGanancia(sumarLotes(porTipo.results.find((x) => x.tipo_stock === 'local2') ?? { tipo_stock: 'local2', invertido: 0, ingresos: 0, costo_vendido: 0, unidades_vendidas: 0 }, 'local2'));
  return json({
    total: conNeta(t, gTotal.results[0].n),
    semana: conNeta(conGanancia(semana.results[0]), gSemana.results[0].n),
    mes: conNeta(conGanancia(mes.results[0]), gMes.results[0].n),
    cobros, creditos, credito_pct: cfg.results[0]?.credito_pct ?? 20, contador: await contadorStock(env),
    gastos_por_categoria: gCat.results.map((g) => ({ categoria: g.categoria, nombre: CATEGORIAS_GASTO[g.categoria], monto: dinero(g.monto) })),
    gastos_recientes: gRecientes.results.map((g) => ({ ...g, anulado: !!g.anulado, nombre_categoria: CATEGORIAS_GASTO[g.categoria] })),
    // Retorno de lo invertido en stock local: ganancia de esas ventas entre lo invertido.
    retorno_local: t.invertido > 0 ? Math.round((local.ganancia / t.invertido) * 1000) / 10 : null,
    capital_en_stock: capitalEnStock,
    unidades_en_stock: enStock.reduce((s, p) => s + p.cantidad, 0),
    por_tipo: [...porTipo.results.filter((r) => r.tipo_stock !== 'local2'), ...(invertidoLotes > 0 || porTipo.results.some((r) => r.tipo_stock === 'local2') ? [{ ...local, tipo_stock: 'local2' }] : [])].map((r) => ({ nombre: TIPOS_STOCK[r.tipo_stock], ...conGanancia(r) })),
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
  return csv([['Referencia', 'Producto', 'Categoría', 'Tipo de stock', 'Costo (L)', 'Precio (L)', 'Margen (L)', 'Cantidad', 'Costo × cantidad (L)', 'Visible', 'Hay', 'Lote', 'Precio de etiqueta (L)', 'Valor a tu precio (L)'],
    ...results.map((p) => [p.id, p.nombre, p.categoria, TIPOS_STOCK[p.tipo_stock], p.costo ?? '', p.cotizar ? 'Por cotizar' : p.precio ?? '',
      p.costo !== null && !p.cotizar && p.precio !== null ? dinero(p.precio - p.costo) : '', p.cantidad ?? '',
      esLocal(p.tipo_stock) && p.cantidad !== null && p.costo !== null ? dinero(p.costo * p.cantidad) : '', p.visible ? 'Sí' : 'No', p.disponible ? 'Sí' : 'No', p.lote, p.referencia ?? '',
      esLocal(p.tipo_stock) && !p.cotizar && p.precio !== null ? dinero((p.cantidad ?? 1) * p.precio) : ''])]);
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
    ['Gastos totales (L)', r.total.gastos], ['Ganancia neta (L) (ganancia − gastos)', r.total.neta], ['Por cobrar de créditos (L)', r.cobros.por_cobrar], ['Créditos vencidos', r.cobros.vencidos],
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
async function hojaGastos(env) {
  const { results } = await env.BD.prepare('SELECT * FROM gastos ORDER BY id DESC').all();
  return csv([['Nº', 'Fecha', 'Concepto', 'Categoría', 'Monto (L)', 'Venta Nº', 'Nota', 'Anulado'],
    ...results.map((g) => [g.id, hondu(g.fecha), g.concepto, CATEGORIAS_GASTO[g.categoria], g.monto, g.movimiento_id ?? '', g.nota, g.anulado ? 'Sí' : ''])]);
}
async function hojaCreditos(env) {
  const lista = await datosCreditos(env, true);
  return csv([['Nº', 'Fecha', 'Cliente', 'Teléfono', 'Producto', 'Contado (L)', 'Pagos', 'Pago (L)', 'Total crédito (L)', 'Abonado (L)', 'Saldo (L)', 'Próximo pago', 'Vencido (L)', 'Estado'],
    ...lista.map((c) => [c.id, hondu(c.fecha), c.cliente, c.telefono, c.producto_nombre, c.precio_contado, c.cuotas, c.cuota_monto, c.total, c.abonado, c.saldo, c.proximo_vencimiento ?? '', c.monto_vencido, c.estado === 'pagado' ? 'Pagado' : c.vencido ? 'Vencido' : 'Al día'])]);
}
async function hojaLotes(env) {
  const { results } = await env.BD.prepare('SELECT id FROM lotes ORDER BY id').all();
  const lotes = []; for (const { id } of results) lotes.push(await detalleLote(env, id));
  return csv([['Nº', 'Lote', 'Inversión (L)', 'Meta de ventas (L)', 'Valor a tus precios (L)', 'Ganancia estimada (L)', 'Margen estimado (%)', 'Falta para cubrir la inversión (L)', 'Falta para la meta (L)', 'Vendido de verdad (L)', 'Ganancia real (L)', 'Unidades', 'Completo'],
    ...lotes.map((l) => [l.id, l.nombre, l.inversion, l.meta, l.ventas_estimadas, l.ganancia_estimada, l.margen_estimado ?? '', l.falta_cubrir, l.falta_para_meta, l.vendido.ingresos, l.vendido.ganancia, l.unidades, l.completo ? 'Sí' : 'No'])]);
}
/** Hoja propia de un tipo de stock local (local1 / local2): cada producto con su costo, ganancia y lo vendido. */
const hojaLocal = (tipo) => async (env) => {
  const [{ results }, aj] = await Promise.all([
    env.BD.prepare(`SELECT p.id, p.nombre, coalesce(c.nombre, '') AS categoria, coalesce(l.nombre, '') AS lote, p.cantidad, p.referencia, p.precio, p.cotizar, p.costo, p.visible,
        coalesce((SELECT sum(m.cantidad) FROM movimientos m WHERE m.producto_id = p.id AND m.tipo = 'venta' AND m.anulado = 0), 0) AS vendidas,
        coalesce((SELECT sum(m.cantidad * m.precio_unit) FROM movimientos m WHERE m.producto_id = p.id AND m.tipo = 'venta' AND m.anulado = 0), 0) AS vendido
      FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id LEFT JOIN lotes l ON l.id = p.lote_id
      WHERE p.borrado_en IS NULL AND p.tipo_stock = ? ORDER BY p.orden, p.nombre`).bind(tipo).all(),
    env.BD.prepare('SELECT mostrar_local2 FROM ajustes WHERE id = 1').first(),
  ]);
  const publico = aj?.mostrar_local2 === 1;
  return csv([['Referencia', 'Producto', 'Categoría', 'Lote', 'En stock', 'Vendidas', 'Precio de etiqueta (L)', 'Tu precio (L)', 'Costo por unidad (L)', 'Ganancia por unidad (L)', 'Margen (%)',
      'Valor en stock a tu precio (L)', 'Costo del stock (L)', 'Ganancia si vendes el stock (L)', 'Vendido (L)', 'Ganancia real (L)', 'En la tienda'],
    ...results.map((p) => {
      const cant = p.cantidad ?? 1, costo = p.costo ?? 0, precio = p.cotizar ? null : p.precio;
      const tienda = !p.visible ? 'Oculto' : tipo === 'local2' && !publico ? 'Privado' : 'Visible';
      return [p.id, p.nombre, p.categoria, p.lote, p.cantidad ?? '', p.vendidas, p.referencia ?? '', precio ?? 'Por cotizar', costo, precio === null ? '' : dinero(precio - costo),
        precio ? Math.round(((precio - costo) / precio) * 1000) / 10 : '', precio === null ? '' : dinero(cant * precio), dinero(cant * costo), precio === null ? '' : dinero(cant * (precio - costo)),
        dinero(p.vendido), dinero(p.vendido - p.vendidas * costo), tienda];
    })]);
};
const HOJAS = { productos: hojaProductos, local2: hojaLocal('local2'), local1: hojaLocal('local1'), movimientos: hojaMovimientos, resumen: hojaResumen, gastos: hojaGastos, creditos: hojaCreditos, lotes: hojaLotes };

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
