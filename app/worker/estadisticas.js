// Medición propia de visitas (solo de quien acepta en la píldora) y resumen para el panel.
import { json, sha256, diaHonduras } from './util.js';

const RE_VID = /^[0-9a-f-]{16,64}$/i;
const RE_RUTA = /^\/(|catalogo|redes|condiciones|privacidad|terminos|Catalogo\/[A-Za-z]{1,20}\/[A-Za-z]{1,20}|Catalogo\/[A-Za-z]{1,20}|Detalles(\/[A-Za-z0-9-]{1,30}){0,2}|producto\/[A-Za-z0-9._-]{1,80})$/;
const EVENTOS_ANONIMOS = ['acepta', 'rechaza']; // se cuentan sin identificador
const EVENTOS = ['whatsapp', 'agregar'];

const normalizar = (r) => String(r || '/').split(/[?#]/)[0].replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1') || '/';

/** POST /api/vista: nunca falla de cara a la persona (siempre 204). No guarda IP, cookies ni datos personales. */
export async function registrarVista(req, env, d) {
  const fin = new Response(null, { status: 204 });
  if (/bot|crawl|spider|preview|facebookexternalhit|whatsapp|headless/i.test(req.headers.get('User-Agent') || '')) return fin;
  const dia = diaHonduras();
  const sql = [];

  // Elección en la píldora: se cuenta sin identificador.
  if (EVENTOS_ANONIMOS.includes(d.evento)) {
    sql.push(env.BD.prepare('INSERT INTO eventos (dia, tipo, cantidad) VALUES (?, ?, 1) ON CONFLICT (dia, tipo) DO UPDATE SET cantidad = cantidad + 1').bind(dia, d.evento));
    await env.BD.batch(sql);
    return fin;
  }

  // Lo demás exige haber aceptado (el navegador manda un identificador aleatorio solo si aceptó).
  if (typeof d.vid !== 'string' || !RE_VID.test(d.vid)) return fin;
  const hash = (await sha256(`${d.vid}:${dia}`)).slice(0, 32);
  sql.push(env.BD.prepare('INSERT OR IGNORE INTO visitantes (dia, hash) VALUES (?, ?)').bind(dia, hash));

  const ruta = normalizar(d.ruta);
  if (typeof d.ruta === 'string' && ruta.length <= 120 && RE_RUTA.test(ruta) && !d.evento) {
    // Las fichas de producto solo cuentan si el producto existe: nadie puede llenar la base con direcciones inventadas.
    const ok = !ruta.startsWith('/producto/') || await env.BD.prepare('SELECT 1 FROM productos WHERE id = ?').bind(decodeURIComponent(ruta.slice(10))).first();
    if (ok) sql.push(env.BD.prepare('INSERT INTO visitas (dia, ruta, vistas) VALUES (?, ?, 1) ON CONFLICT (dia, ruta) DO UPDATE SET vistas = vistas + 1').bind(dia, ruta));
  }
  if (typeof d.producto === 'string' && /^[\w.-]{1,80}$/.test(d.producto) && await env.BD.prepare('SELECT 1 FROM productos WHERE id = ?').bind(d.producto).first()) {
    sql.push(env.BD.prepare('INSERT INTO vistas_producto (dia, producto_id, vistas) VALUES (?, ?, 1) ON CONFLICT (dia, producto_id) DO UPDATE SET vistas = vistas + 1').bind(dia, d.producto));
  }
  if (EVENTOS.includes(d.evento)) {
    sql.push(env.BD.prepare('INSERT INTO eventos (dia, tipo, cantidad) VALUES (?, ?, 1) ON CONFLICT (dia, tipo) DO UPDATE SET cantidad = cantidad + 1').bind(dia, d.evento));
  }
  await env.BD.batch(sql);
  return fin;
}

/** GET /api/admin/actividad: resumen de los últimos 30 días para el panel. */
export async function actividad(env) {
  const desde = (dias) => diaHonduras(Date.now() - (dias - 1) * 86400000);
  const hoy = diaHonduras();
  const [vis, vp, top, prods, ev, serie] = await env.BD.batch([
    env.BD.prepare('SELECT sum(CASE WHEN dia = ?1 THEN n END) AS hoy, sum(CASE WHEN dia >= ?2 THEN n END) AS semana, sum(n) AS mes FROM (SELECT dia, count(*) AS n FROM visitantes WHERE dia >= ?3 GROUP BY dia)').bind(hoy, desde(7), desde(30)),
    env.BD.prepare('SELECT sum(CASE WHEN dia = ?1 THEN vistas END) AS hoy, sum(CASE WHEN dia >= ?2 THEN vistas END) AS semana, sum(vistas) AS mes FROM visitas WHERE dia >= ?3').bind(hoy, desde(7), desde(30)),
    env.BD.prepare('SELECT ruta, sum(vistas) AS vistas FROM visitas WHERE dia >= ? GROUP BY ruta ORDER BY vistas DESC LIMIT 8').bind(desde(30)),
    env.BD.prepare('SELECT v.producto_id AS id, coalesce(p.nombre, v.producto_id) AS nombre, sum(v.vistas) AS vistas FROM vistas_producto v LEFT JOIN productos p ON p.id = v.producto_id WHERE v.dia >= ? GROUP BY v.producto_id ORDER BY vistas DESC LIMIT 8').bind(desde(30)),
    env.BD.prepare('SELECT tipo, sum(cantidad) AS n FROM eventos WHERE dia >= ? GROUP BY tipo').bind(desde(30)),
    env.BD.prepare('SELECT d.dia, d.visitantes, coalesce(v.vistas, 0) AS vistas FROM (SELECT dia, count(*) AS visitantes FROM visitantes WHERE dia >= ? GROUP BY dia) d LEFT JOIN (SELECT dia, sum(vistas) AS vistas FROM visitas WHERE dia >= ? GROUP BY dia) v ON v.dia = d.dia ORDER BY d.dia').bind(desde(14), desde(14)),
  ]);
  const e = Object.fromEntries(ev.results.map((r) => [r.tipo, r.n]));
  const dias = []; // 14 días seguidos, con ceros donde no hubo visitas
  const porDia = new Map(serie.results.map((r) => [r.dia, r]));
  for (let i = 13; i >= 0; i--) { const dia = diaHonduras(Date.now() - i * 86400000); dias.push({ dia, visitantes: porDia.get(dia)?.visitantes || 0, vistas: porDia.get(dia)?.vistas || 0 }); }
  const eleccion = (e.acepta || 0) + (e.rechaza || 0);
  return json({
    visitantes: { hoy: vis.results[0]?.hoy || 0, semana: vis.results[0]?.semana || 0, mes: vis.results[0]?.mes || 0 },
    vistas: { hoy: vp.results[0]?.hoy || 0, semana: vp.results[0]?.semana || 0, mes: vp.results[0]?.mes || 0 },
    paginas: top.results, productos: prods.results, serie: dias,
    whatsapp: e.whatsapp || 0, agregados: e.agregar || 0,
    consentimiento: { acepta: e.acepta || 0, rechaza: e.rechaza || 0, porcentaje: eleccion ? Math.round(((e.acepta || 0) / eleccion) * 100) : null },
  });
}

export const limpiarEstadisticas = (env) => {
  const corte = diaHonduras(Date.now() - 400 * 86400000);
  return env.BD.batch(['visitas', 'visitantes', 'vistas_producto', 'eventos'].map((t) => env.BD.prepare(`DELETE FROM ${t} WHERE dia < ?`).bind(corte)));
};
