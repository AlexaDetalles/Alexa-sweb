// Lógica del personalizador de regalos, sin DOM: se prueba en pruebas/regalo.test.mjs.
// Un regalo es una lista de pasos (definidos en el panel); cada paso tiene opciones. La selección es
// { sel: { [pasoId]: [opcionId, …] }, mensaje } y siempre se «limpia» contra lo que hoy ofrece la tienda.
import { money } from './core.mjs';

const ID = /^[A-Za-z0-9._-]{1,40}$/;
const entero = (v, def, min, max) => { const n = Number(v); return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : def; };
const texto = (v, max) => String(v ?? '').slice(0, max);
const imagenLocal = (v) => (typeof v === 'string' && /^\/(fotos\/productos\/[0-9a-f-]{36}-(600|1200)\.(webp|jpg)|assets\/images\/[A-Za-z0-9._-]+\.(webp|png|svg|jpg))$/.test(v) ? v : '');

/** Valida lo que llega de /api/regalos/<publico> y deja los pasos con sus dependencias primero. */
export function preparar(data) {
  const c = data?.config || {}, d = c.dedication || {};
  const config = {
    activo: c.active !== false, titulo: texto(c.title, 80), intro: texto(c.intro, 240), nota: texto(c.note, 240),
    dedicatoria: { activa: d.enabled !== false, titulo: texto(d.title, 70) || 'Las últimas palabras.', ayuda: texto(d.help, 240), max: entero(d.max, 250, 20, 600) },
  };
  const vistos = new Set();
  let pasos = (Array.isArray(data?.pasos) ? data.pasos : []).flatMap((p) => {
    if (!p || !/^[a-z0-9-]{1,30}$/.test(p.id) || vistos.has(p.id) || ['resumen', 'dedicatoria'].includes(p.id)) return [];
    vistos.add(p.id);
    const tipo = p.type === 'multiple' ? 'multiple' : 'unico';
    const max = tipo === 'unico' ? 1 : entero(p.max, 1, 1, 50);
    return [{ id: p.id, nombre: texto(p.name, 24), titulo: texto(p.title, 70), desc: texto(p.desc, 240), tipo, min: Math.min(entero(p.min, 1, 0, 20), max), max, depende: /^[a-z0-9-]{1,30}$/.test(p.dependsOn) ? p.dependsOn : '' }];
  });
  const ids = new Set(pasos.map((p) => p.id));
  const opciones = (Array.isArray(data?.opciones) ? data.opciones : []).flatMap((o) => (
    o && ID.test(o.id) && ids.has(o.paso) && o.name
      ? [{ id: o.id, paso: o.paso, padre: ID.test(o.parent) ? o.parent : '', nombre: texto(o.name, 80), desc: texto(o.desc, 200), etiqueta: texto(o.badge, 20), cents: entero(o.cents, 0, 0, 100000000), img: imagenLocal(o.img), mini: imagenLocal(o.thumb) || imagenLocal(o.img) }]
      : []));
  // Se respeta el orden del panel; solo se adelanta lo necesario para que un paso vaya después del que lo alimenta.
  const ordenados = [];
  const faltan = [...pasos];
  while (faltan.length) {
    const i = faltan.findIndex((p) => !p.depende || !ids.has(p.depende) || ordenados.some((o) => o.id === p.depende));
    if (i < 0) { ordenados.push(...faltan); break; }
    ordenados.push(...faltan.splice(i, 1));
  }
  return { config, pasos: ordenados, opciones, porPaso: new Map(ordenados.map((p) => [p.id, p])), porId: new Map(opciones.map((o) => [o.id, o])) };
}

/** Rutas del recorrido: cada paso, la dedicatoria (si está activa) y el resumen. */
export const recorrido = (g) => [...g.pasos.map((p) => p.id), ...(g.config.dedicatoria.activa ? ['dedicatoria'] : []), 'resumen'];

/** Opciones que se pueden elegir hoy en un paso, según lo elegido en el paso del que depende. */
export function opcionesDe(g, pasoId, sel) {
  const p = g.porPaso.get(pasoId);
  if (!p) return [];
  const todas = g.opciones.filter((o) => o.paso === pasoId);
  if (!p.depende) return todas;
  const padres = new Set(sel?.[p.depende] || []);
  return todas.filter((o) => padres.has(o.padre));
}

/** Quita lo que ya no existe o no corresponde (ids ajenos, de más, hijas de una elección cambiada) y recorta el mensaje. */
export function limpiar(g, crudo) {
  const r = { sel: {}, mensaje: '' };
  for (const p of g.pasos) {
    const validas = new Set(opcionesDe(g, p.id, r.sel).map((o) => o.id));
    const pedidas = Array.isArray(crudo?.sel?.[p.id]) ? crudo.sel[p.id] : [];
    r.sel[p.id] = [...new Set(pedidas)].filter((id) => typeof id === 'string' && validas.has(id)).slice(0, p.max);
  }
  if (g.config.dedicatoria.activa && typeof crudo?.mensaje === 'string') r.mensaje = crudo.mensaje.slice(0, g.config.dedicatoria.max);
  return r;
}

/** Elegir o quitar una opción. Devuelve { borrador, error }: `error` explica por qué no se pudo. */
export function alternar(g, b, pasoId, opcionId) {
  const p = g.porPaso.get(pasoId);
  if (!p || !opcionesDe(g, pasoId, b.sel).some((o) => o.id === opcionId)) return { borrador: b, error: 'Esa opción ya no está disponible.' };
  const actual = b.sel[pasoId] || [];
  let nuevo;
  if (actual.includes(opcionId)) {
    if (p.tipo === 'unico' && p.min >= 1) return { borrador: b, error: '' };
    nuevo = actual.filter((id) => id !== opcionId);
  } else if (p.tipo === 'unico' || p.max === 1) nuevo = [opcionId];
  else if (actual.length >= p.max) return { borrador: b, error: `Puedes elegir hasta ${p.max}.` };
  else nuevo = [...actual, opcionId];
  return { borrador: limpiar(g, { ...b, sel: { ...b.sel, [pasoId]: nuevo } }), error: '' };
}

export function lineas(g, b) {
  return g.pasos.flatMap((p) => (b.sel[p.id] || []).flatMap((id) => (g.porId.has(id) ? [{ paso: p, opcion: g.porId.get(id) }] : [])));
}
export const total = (g, b) => lineas(g, b).reduce((s, l) => s + l.opcion.cents, 0);

/** Primer paso que todavía no cumple su mínimo (o null si el regalo está completo). */
export const pendiente = (g, b) => g.pasos.find((p) => (b.sel[p.id] || []).length < p.min)?.id ?? null;
export const completo = (g, b) => g.pasos.length > 0 && pendiente(g, b) === null;

/** Avance 0..1: pasos obligatorios cumplidos entre los obligatorios. */
export function avance(g, b) {
  const obligatorios = g.pasos.filter((p) => p.min >= 1);
  if (!obligatorios.length) return 1;
  return obligatorios.filter((p) => (b.sel[p.id] || []).length >= p.min).length / obligatorios.length;
}

/** Hasta qué paso se puede navegar: el pendiente (los siguientes esperan). */
export function alcanzable(g, b, ruta) {
  const r = recorrido(g), i = r.indexOf(ruta), p = pendiente(g, b);
  if (i < 0) return false;
  return p === null || i <= r.indexOf(p);
}

export function mensajeWhatsApp(g, b, publico) {
  const filas = lineas(g, b).map((l) => `${l.paso.nombre}: ${l.opcion.nombre} [${l.opcion.id}] — ${money(l.opcion.cents)}`);
  return `¡Hola, Alexa! Quiero confirmar este regalo personalizado (${publico === 'hombre' || publico === 'el' ? 'para él' : 'para ella'}):\n\n${filas.join('\n')}`
    + `${g.config.dedicatoria.activa ? `\n\nDedicatoria: ${b.mensaje.trim() || 'Sin dedicatoria'}` : ''}\nTotal estimado: ${money(total(g, b))}\n¿Me confirman disponibilidad, precio final y fecha de entrega?`;
}
