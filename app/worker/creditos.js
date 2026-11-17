// Gastos, ventas a crédito, abonos y avisos de cobro.
//
// Crédito: el cliente paga `cuotas` pagos de `cuota_monto` (el primero el día de la venta, el resto cada `intervalo_dias`).
// Regla: cuotas × cuota_monto tiene que ser MAYOR que el precio de contado. Con el recargo sugerido (ajustes.credito_pct, 20 % de inicio)
// un tenis de L 1,000 en 2 pagos sale en 2 × L 600 = L 1,200. La venta se anota completa (lo devengado) y lo que falta de cobrar queda en «Por cobrar».
import { falla, json, fechaSql, diaHonduras } from './util.js';
import { enviarCorreo, sitio } from './correo.js';

const dinero = (n) => Math.round((n || 0) * 100) / 100;
const lps = (n) => `L ${dinero(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const CATEGORIAS_GASTO = { bus: 'Bus', envio: 'Envío', empaque: 'Empaque', comision: 'Comisión', otro: 'Otro' };

// --- fechas (días de Honduras, 'AAAA-MM-DD') --------------------------------------------------
const aDia = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const sumarDias = (dia, n) => new Date(aDia(dia) + n * 86400000).toISOString().slice(0, 10);
export const diasEntre = (a, b) => Math.round((aDia(b) - aDia(a)) / 86400000); // b − a

// --- reglas del crédito (puras) ---------------------------------------------------------------
/** Valida el crédito y devuelve el total. Lanza 400 si es igual o mejor que pagar de contado. */
export function validarCredito({ contado, cuotas, cuota }) {
  if (!Number.isInteger(cuotas) || cuotas < 2 || cuotas > 24) falla(400, 'Número de pagos: elige de 2 a 24.');
  if (!(cuota > 0)) falla(400, 'Escribe cuánto es cada pago.');
  const total = dinero(cuotas * cuota);
  if (!(total > contado)) falla(400, `El crédito no puede costar igual o menos que el contado (${lps(contado)}): ${cuotas} pagos de ${lps(cuota)} son ${lps(total)}.`);
  return total;
}
/** Pago sugerido por cuota con el recargo %, redondeado hacia arriba a múltiplos de 10 (nunca por debajo del contado). */
export function cuotaSugerida(contado, cuotas, pct) {
  let c = Math.ceil((contado * (1 + pct / 100)) / cuotas / 10) * 10;
  while (c * cuotas <= contado) c += 10;
  return c;
}
/** Estado de un crédito a partir de lo abonado: saldo, pagos hechos, próximo vencimiento y cuánto ya debería haber pagado. */
export function estadoCredito(c, abonado, hoy) {
  const saldo = Math.max(0, dinero(c.total - abonado));
  const pagadas = Math.min(c.cuotas, Math.floor((abonado + 0.005) / c.cuota_monto));
  const proximo = saldo <= 0.005 ? null : sumarDias(c.inicio, Math.min(pagadas, c.cuotas - 1) * c.intervalo_dias);
  const vencidas = Math.max(0, Math.min(c.cuotas, Math.floor(diasEntre(c.inicio, hoy) / c.intervalo_dias) + 1));
  const montoVencido = saldo <= 0.005 ? 0 : Math.max(0, dinero(Math.min(c.total, vencidas * c.cuota_monto) - abonado));
  return { abonado: dinero(abonado), saldo, pagadas, proximo_vencimiento: proximo, dias: proximo ? diasEntre(hoy, proximo) : null, monto_vencido: montoVencido, vencido: montoVencido > 0.005 };
}

// --- gastos --------------------------------------------------------------------------------
export function validarGasto(g) {
  const monto = dinero(Number(String(g?.monto ?? '').replace(/,/g, '')));
  if (!(monto > 0) || monto > 100000000) falla(400, 'Gasto: escribe un monto mayor que 0.');
  const categoria = g.categoria in CATEGORIAS_GASTO ? g.categoria : 'otro';
  const concepto = String(g.concepto ?? '').trim().slice(0, 80) || CATEGORIAS_GASTO[categoria];
  return { concepto, categoria, monto, nota: String(g.nota ?? '').trim().slice(0, 200) };
}
export async function crearGasto(env, d, sesion) {
  const g = validarGasto(d);
  const r = await env.BD.prepare('INSERT INTO gastos (fecha, concepto, categoria, monto, nota, usuario) VALUES (?, ?, ?, ?, ?, ?)').bind(fechaSql(), g.concepto, g.categoria, g.monto, g.nota, sesion?.correo ?? '').run();
  return json({ id: r.meta.last_row_id }, 201);
}
export async function anularGasto(env, id) {
  const r = await env.BD.prepare('UPDATE gastos SET anulado = 1 WHERE id = ? AND anulado = 0').bind(Number(id)).run();
  if (!r.meta.changes) falla(404, 'Ese gasto ya no existe o ya estaba anulado.');
  return json({ ok: true });
}

// --- créditos y abonos ---------------------------------------------------------------------------
const SUMA_ABONOS = 'coalesce((SELECT sum(monto) FROM abonos a WHERE a.credito_id = c.id AND a.anulado = 0), 0)';

async function conEstado(env, filas) {
  const hoy = diaHonduras();
  const ids = filas.map((c) => c.id);
  const abonos = ids.length ? (await env.BD.prepare(`SELECT * FROM abonos WHERE credito_id IN (${ids.map(() => '?').join(',')}) ORDER BY id DESC`).bind(...ids).all()).results : [];
  return filas.map((c) => {
    const propios = abonos.filter((a) => a.credito_id === c.id).map((a) => ({ ...a, anulado: !!a.anulado }));
    return { ...c, ...estadoCredito(c, propios.filter((a) => !a.anulado).reduce((s, a) => s + a.monto, 0), hoy), abonos: propios };
  });
}

/** GET /api/admin/creditos?todos=1 — por cobrar primero (vencidos, luego por fecha). */
export async function datosCreditos(env, todos) {
  const { results } = await env.BD.prepare(`SELECT c.* FROM creditos c WHERE ${todos ? "c.estado <> 'anulado'" : "c.estado = 'activo'"} ORDER BY c.id DESC LIMIT 200`).all();
  const lista = await conEstado(env, results);
  return lista.sort((a, b) => (a.estado === 'activo' ? 0 : 1) - (b.estado === 'activo' ? 0 : 1) || (a.proximo_vencimiento ?? '9').localeCompare(b.proximo_vencimiento ?? '9'));
}
export async function listarCreditos(env, todos) { return json({ creditos: await datosCreditos(env, todos) }); }
/** Resumen de cobros para el aviso del panel y las finanzas. */
export async function resumenCobros(env) {
  const { results } = await env.BD.prepare("SELECT c.* FROM creditos c WHERE c.estado = 'activo'").all();
  const lista = await conEstado(env, results);
  const cobrado = (await env.BD.prepare('SELECT coalesce(sum(a.monto), 0) AS n FROM abonos a JOIN creditos c ON c.id = a.credito_id WHERE a.anulado = 0 AND c.estado <> \'anulado\'').first()).n;
  return {
    por_cobrar: dinero(lista.reduce((s, c) => s + c.saldo, 0)), activos: lista.length,
    vencidos: lista.filter((c) => c.vencido).length, monto_vencido: dinero(lista.reduce((s, c) => s + c.monto_vencido, 0)),
    abonos_cobrados: dinero(cobrado),
  };
}

/** Abono: suma al crédito; si con él queda en 0, el crédito pasa a «pagado» y se avisa a las administradoras. */
export async function abonar(env, id, d, sesion, ctx) {
  const c = await env.BD.prepare("SELECT c.*, " + SUMA_ABONOS + " AS abonado FROM creditos c WHERE c.id = ? AND c.estado = 'activo'").bind(Number(id)).first();
  if (!c) falla(404, 'Esa deuda ya no existe o ya está pagada.');
  const monto = dinero(Number(String(d.monto ?? '').replace(/,/g, '')));
  const saldo = dinero(c.total - c.abonado);
  if (!(monto > 0)) falla(400, 'Escribe cuánto abona.');
  if (monto > saldo + 0.005) falla(400, `Solo debe ${lps(saldo)}: no puede abonar más que el saldo.`);
  await env.BD.prepare('INSERT INTO abonos (credito_id, fecha, monto, nota, usuario) VALUES (?, ?, ?, ?, ?)').bind(c.id, fechaSql(), monto, String(d.nota ?? '').trim().slice(0, 200), sesion?.correo ?? '').run();
  const pagado = dinero(saldo - monto) <= 0.005;
  if (pagado) {
    await env.BD.prepare("UPDATE creditos SET estado = 'pagado', pagado_en = ? WHERE id = ?").bind(fechaSql(), c.id).run();
    segundoPlano(ctx, avisarAdmins(env, `✅ ${c.cliente} terminó de pagar`, `${c.cliente} terminó de pagar «${c.producto_nombre}»: ${lps(c.total)} en ${c.cuotas} pagos.\nNo le debe nada a la tienda.`));
  }
  return json({ ok: true, pagado, saldo: pagado ? 0 : dinero(saldo - monto) }, 201);
}
export async function anularAbono(env, id) {
  const a = await env.BD.prepare('SELECT credito_id FROM abonos WHERE id = ? AND anulado = 0').bind(Number(id)).first();
  if (!a) falla(404, 'Ese abono ya no existe o ya estaba anulado.');
  await env.BD.batch([
    env.BD.prepare('UPDATE abonos SET anulado = 1 WHERE id = ?').bind(Number(id)),
    env.BD.prepare("UPDATE creditos SET estado = 'activo', pagado_en = NULL WHERE id = ? AND estado = 'pagado'").bind(a.credito_id),
  ]);
  return json({ ok: true });
}

/** Crea el crédito de una venta ya registrada (lo llama finanzas.crearMovimiento). */
export async function registrarCredito(env, { movimientoId, producto, cantidad, contado, credito, sesion, ctx }) {
  const cuotas = Number(credito.cuotas), cuota = dinero(Number(String(credito.cuota ?? '').replace(/,/g, '')));
  const total = validarCredito({ contado, cuotas, cuota });
  const cliente = String(credito.cliente ?? '').trim();
  if (!cliente) falla(400, 'Escribe el nombre de quién se lleva la deuda.');
  const telefono = String(credito.telefono ?? '').replace(/\D/g, '');
  if (telefono.length > 15) falla(400, 'Teléfono: máximo 15 dígitos.');
  const intervalo = Number(credito.intervalo_dias ?? 15);
  if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 90) falla(400, 'Cada cuántos días paga: de 1 a 90.');
  const abono = credito.abono === undefined || credito.abono === '' || credito.abono === null ? 0 : dinero(Number(String(credito.abono).replace(/,/g, '')));
  if (!(abono >= 0) || abono > total + 0.005) falla(400, 'El abono inicial no puede ser mayor que el total del crédito.');
  const r = await env.BD.prepare(`INSERT INTO creditos (fecha, inicio, movimiento_id, producto_id, producto_nombre, cantidad, cliente, telefono, precio_contado, cuotas, cuota_monto, total, intervalo_dias, usuario)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(fechaSql(), diaHonduras(), movimientoId, producto.id, producto.nombre, cantidad, cliente, telefono, contado, cuotas, cuota, total, intervalo, sesion?.correo ?? '').run();
  const id = r.meta.last_row_id;
  await env.BD.prepare('UPDATE movimientos SET credito_id = ? WHERE id = ?').bind(id, movimientoId).run();
  if (abono > 0) await abonar(env, id, { monto: abono, nota: 'Abono inicial' }, sesion, ctx);
  return { id, total };
}

// --- avisos ---------------------------------------------------------------------------------------
const segundoPlano = (ctx, p) => { const q = p.catch((e) => console.error('aviso', e.message)); ctx?.waitUntil ? ctx.waitUntil(q) : q; };
async function avisarAdmins(env, asunto, texto) {
  const { results } = await env.BD.prepare("SELECT correo FROM usuarios WHERE rol = 'admin' AND activo = 1").all();
  for (const u of results) { try { await enviarCorreo(env, { para: u.correo, asunto, texto }); } catch (e) { console.error('aviso', e.message); } }
}

/** Cron diario (8 a. m. Honduras): resumen de a quién hay que cobrarle hoy y a quién ya se le pasó la fecha. */
export async function recordatoriosDeCobro(env) {
  const { results } = await env.BD.prepare("SELECT c.* FROM creditos c WHERE c.estado = 'activo'").all();
  const debe = (await conEstado(env, results)).filter((c) => c.vencido).sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
  if (!debe.length) return { enviados: 0, vencidos: 0 };
  const linea = (c) => `• ${c.cliente} — ${c.producto_nombre}: debe ${lps(c.monto_vencido)} (saldo total ${lps(c.saldo)}) · ${c.dias === 0 ? 'vence HOY' : `vencido hace ${-c.dias} día${c.dias === -1 ? '' : 's'}`}${c.telefono ? ` · tel. ${c.telefono}` : ''}`;
  const texto = `Cobros pendientes (${debe.length}):\n\n${debe.map(linea).join('\n')}\n\nTotal vencido: ${lps(debe.reduce((s, c) => s + c.monto_vencido, 0))}\nRegistra los abonos en ${sitio(env)}/admin/#finanzas`;
  await avisarAdmins(env, `Cobros pendientes: ${debe.length}`, texto);
  return { enviados: 1, vencidos: debe.length };
}
