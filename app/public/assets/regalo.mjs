// Personalizador de regalos: /regalos/personalizar/ella|el. Pasos, opciones y textos vienen del panel (/api/regalos/<público>).
import { money, escapeHTML as e } from './core.mjs';
import { medir } from './consent.mjs';
import { preparar, recorrido, opcionesDe, limpiar, alternar, lineas, total, pendiente, avance, alcanzable, mensajeWhatsApp } from './regalo-core.mjs';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const quieto = matchMedia('(prefers-reduced-motion: reduce)');
const slug = document.body.dataset.publico === 'el' ? 'el' : 'ella';
const publico = slug === 'el' ? 'hombre' : 'mujer';
const BASE = `/regalos/personalizar/${slug}`;
const LLAVE = `alexa_gift_v3_${publico}`;
const FLECHA = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
const VOLVER = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4m6-6-6 6 6 6"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const LUPA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const SUGERENCIAS = ['Con todo mi cariño.', 'Feliz cumpleaños. Que este año te traiga todo lo bonito.', 'Gracias por existir en mi vida.', 'Te quiero mucho.', 'Felices fiestas, con cariño.'];

let g = null, b = { sel: {}, mensaje: '' };
let asesoras = [{ nombre: 'asesora 1', whatsapp: '50497320939' }, { nombre: 'asesora 2', whatsapp: '50499226664' }];
let totalMostrado = 0, enCollage = new Set(), confetiVisto = false;

const leer = () => { try { return JSON.parse(localStorage.getItem(LLAVE)); } catch { return null; } };
const guardar = () => { try { localStorage.setItem(LLAVE, JSON.stringify(b)); } catch { /* sin almacenamiento: el regalo vive mientras la página esté abierta */ } };
let temporizador;
function aviso(texto) {
  const t = $('#toast'); if (!t) return;
  t.textContent = texto; t.classList.add('visible'); clearTimeout(temporizador); temporizador = setTimeout(() => t.classList.remove('visible'), 3200);
}

// --- rutas -----------------------------------------------------------------------------
const urlDe = (ruta) => (ruta === recorrido(g)[0] ? BASE : `${BASE}/${ruta}`);
const rutaActual = () => { const m = location.pathname.replace(/\/$/, '').match(/^\/regalos\/personalizar\/(?:ella|el)\/([a-z0-9-]+)$/); return m ? m[1] : null; };
const indice = (ruta) => recorrido(g).indexOf(ruta);
const cumple = (ruta) => { const p = g.porPaso.get(ruta); return !p || (b.sel[ruta] || []).length >= p.min; };

function ir(ruta, { reemplazar = false } = {}) {
  const previo = rutaActual() || recorrido(g)[0];
  history[reemplazar ? 'replaceState' : 'pushState'](null, '', urlDe(ruta));
  pintar(indice(ruta) >= indice(previo) ? 1 : -1);
  if (!reemplazar) {
    $('.rg-main').scrollIntoView({ behavior: quieto.matches ? 'auto' : 'smooth', block: 'start' });
    $('#rg-paso').focus({ preventScroll: true });
    medir({ ruta: location.pathname });
  }
}

// --- pintar ----------------------------------------------------------------------------
function pintar(dir = 1) {
  const r = recorrido(g);
  let ruta = rutaActual();
  if (!ruta || !r.includes(ruta)) ruta = r[0];
  if (!alcanzable(g, b, ruta)) {
    ruta = pendiente(g, b);
    history.replaceState(null, '', urlDe(ruta));
    aviso('Primero completa este paso.');
  }
  $('#rg-titulo').textContent = g.config.titulo || 'Tu regalo, a tu gusto.';
  $('#rg-intro').textContent = g.config.intro || '';
  const paso = g.porPaso.get(ruta);
  $('#rg-crumb').textContent = ruta === 'resumen' ? 'Resumen' : ruta === 'dedicatoria' ? 'Dedicatoria' : paso.nombre;
  document.title = `${$('#rg-crumb').textContent} · Regalo para ${slug === 'el' ? 'él' : 'ella'} | ALEXA`;
  progreso(r, ruta);
  const cont = $('#rg-paso');
  cont.classList.remove('entra-der', 'entra-izq'); void cont.offsetWidth;
  cont.innerHTML = ruta === 'resumen' ? vistaResumen() : ruta === 'dedicatoria' ? vistaDedicatoria() : vistaPaso(paso, r);
  cont.classList.add(dir >= 0 ? 'entra-der' : 'entra-izq');
  cont.dataset.ruta = ruta;
  if (ruta === 'resumen') alResumen();
  if (ruta === 'dedicatoria') alDedicatoria();
  acciones(r, ruta);
  lado();
}

function progreso(r, ruta) {
  const etiquetas = (id) => (id === 'dedicatoria' ? 'Dedicatoria' : id === 'resumen' ? 'Resumen' : g.porPaso.get(id).nombre);
  $('#rg-progreso').style.setProperty('--avance', String(Math.round(Math.max(0, indice(ruta)) / Math.max(1, r.length - 1) * 100)));
  $('#rg-progreso').innerHTML = r.map((id, i) => {
    const hecho = id === 'resumen' ? false : id === 'dedicatoria' ? indice(ruta) > i : cumple(id) && (g.porPaso.get(id).min >= 1 ? true : indice(ruta) > i);
    const libre = alcanzable(g, b, id);
    const clase = `${id === ruta ? 'actual' : ''} ${hecho && id !== ruta ? 'hecho' : ''} ${libre ? '' : 'bloqueado'}`;
    const cuerpo = `<span class="rg-num">${hecho && id !== ruta ? CHECK : i + 1}</span><span class="rg-nombre">${e(etiquetas(id))}</span>`;
    return `<li class="${clase.trim()}">${libre ? `<a href="${urlDe(id)}" data-ir="${e(id)}" ${id === ruta ? 'aria-current="step"' : ''}>${cuerpo}</a>` : `<span aria-disabled="true">${cuerpo}</span>`}</li>`;
  }).join('');
  const caja = $('#rg-progreso'), actual = $('.actual', caja);
  if (actual) caja.scrollLeft = actual.offsetLeft - (caja.clientWidth - actual.clientWidth) / 2; // en el celular, el paso actual queda a la vista
}

function vistaPaso(p, r) {
  const opciones = opcionesDe(g, p.id, b.sel), n = (b.sel[p.id] || []).length;
  const anterior = p.depende ? g.porPaso.get(p.depende) : null;
  const cabeza = `<div class="rg-cabecera"><p class="rg-kicker">Paso ${indice(p.id) + 1} de ${g.pasos.length} · ${e(p.nombre)}</p><h2>${e(p.titulo)}</h2>${p.desc ? `<p>${e(p.desc)}</p>` : ''}${contador(p, n)}</div>`;
  if (!opciones.length) return `${cabeza}<div class="empty-state"><h2>Aún no hay opciones aquí.</h2><p>${anterior ? `Elige primero ${e(anterior.nombre.toLowerCase())}.` : 'Estamos actualizando este paso.'}</p>${anterior ? `<a class="btn" href="${urlDe(anterior.id)}" data-ir="${e(anterior.id)}">${VOLVER} Volver a ${e(anterior.nombre)}</a>` : ''}</div>`;
  return `${cabeza}<div class="rg-rejilla" role="group" aria-label="${e(p.titulo)}">${opciones.map((o, i) => tarjeta(o, p, i)).join('')}</div>`;
}
function contador(p, n) {
  if (p.tipo === 'unico') return p.min === 0 ? '<p class="rg-contador">Opcional</p>' : '';
  const tope = p.max < 50 ? ` de ${p.max}` : '';
  return `<p class="rg-contador" data-contador><b>${n}</b> elegido${n === 1 ? '' : 's'}${tope}${p.min === 0 ? ' · opcional' : p.min > 1 ? ` · mínimo ${p.min}` : ''}</p>`;
}
function foto(o, clase = '') {
  const src = o.mini || o.img;
  return src ? `<img class="${clase}" src="${e(src)}" alt="${e(o.nombre)}" width="400" height="480" loading="lazy" decoding="async">` : `<span class="rg-mono ${clase}"><img src="/assets/images/logo-mark-vino.svg" alt="" width="64" height="74"></span>`;
}
function tarjeta(o, p, i) {
  const on = (b.sel[p.id] || []).includes(o.id);
  return `<div class="rg-op ${on ? 'elegida' : ''}" style="--i:${Math.min(i, 12)}">
  <button type="button" class="rg-pick" data-op="${e(o.id)}" aria-pressed="${on}">
   <span class="rg-foto ${o.mini || o.img ? 'cargando' : ''}">${foto(o)}${o.etiqueta ? `<span class="rg-etiqueta">${e(o.etiqueta)}</span>` : ''}<span class="rg-marca" aria-hidden="true">${CHECK}</span></span>
   <span class="rg-cuerpo"><b>${e(o.nombre)}</b>${o.desc ? `<small>${e(o.desc)}</small>` : ''}<em>${o.cents ? `+ ${money(o.cents)}` : 'Incluido'}</em></span>
  </button>${o.img ? `<button type="button" class="rg-lupa" data-zoom="${e(o.id)}" aria-label="Ver foto grande de ${e(o.nombre)}">${LUPA}</button>` : ''}</div>`;
}

function vistaDedicatoria() {
  const d = g.config.dedicatoria;
  return `<div class="rg-cabecera"><p class="rg-kicker">Casi listo · Dedicatoria</p><h2>${e(d.titulo)}</h2>${d.ayuda ? `<p>${e(d.ayuda)}</p>` : ''}</div>
  <div class="rg-dedic"><div class="rg-escribe field"><label for="rg-msg">Tu mensaje <span>(opcional)</span></label>
   <textarea id="rg-msg" maxlength="${d.max}" rows="6" placeholder="Escribe algo que le saque una sonrisa…">${e(b.mensaje)}</textarea>
   <div class="rg-cuenta"><span><b id="rg-n">${b.mensaje.length}</b> / ${d.max}</span></div>
   <div class="rg-sugerencias" aria-label="Ideas para tu mensaje">${SUGERENCIAS.map((t, i) => `<button type="button" data-sug="${i}">${e(t)}</button>`).join('')}</div></div>
   <figure class="rg-tarjeta" aria-label="Así se verá tu tarjeta"><div class="rg-papel"><span class="rg-cinta" aria-hidden="true"></span><p id="rg-vista" class="${b.mensaje.trim() ? '' : 'vacio'}">${e(b.mensaje.trim() || 'Aquí aparecerá tu mensaje.')}</p><span class="rg-firma">— de parte de alguien que te quiere</span></div><figcaption>Vista previa de la tarjeta</figcaption></figure></div>`;
}
function alDedicatoria() {
  const area = $('#rg-msg'), max = g.config.dedicatoria.max;
  area.addEventListener('input', () => {
    b.mensaje = area.value.slice(0, max); guardar();
    $('#rg-n').textContent = b.mensaje.length;
    const v = $('#rg-vista'); v.textContent = b.mensaje.trim() || 'Aquí aparecerá tu mensaje.'; v.classList.toggle('vacio', !b.mensaje.trim());
    lado(false);
  });
  $$('[data-sug]').forEach((btn) => btn.addEventListener('click', () => {
    const t = SUGERENCIAS[Number(btn.dataset.sug)];
    area.value = (area.value.trim() ? `${area.value.trim()} ${t}` : t).slice(0, max);
    area.dispatchEvent(new Event('input')); area.focus();
  }));
}

function vistaResumen() {
  const ls = lineas(g, b), msg = b.mensaje.trim();
  const wa = encodeURIComponent(mensajeWhatsApp(g, b, publico));
  return `<div class="rg-cabecera rg-celebra"><p class="rg-kicker">¡Listo!</p><h2>Tu regalo está listo para hacerse realidad.</h2><p>Revisa cada detalle y confírmalo con una asesora por WhatsApp.</p></div>
  <ul class="rg-recibo">${ls.map((l, i) => `<li style="--i:${i}"><span class="rg-mini">${foto(l.opcion)}</span><span class="rg-linea"><small>${e(l.paso.nombre)} · ${e(l.opcion.id)}</small><b>${e(l.opcion.nombre)}</b></span><span class="rg-precio">${l.opcion.cents ? money(l.opcion.cents) : 'Incluido'}</span><a class="text-link" href="${urlDe(l.paso.id)}" data-ir="${e(l.paso.id)}">Editar</a></li>`).join('')}</ul>
  ${g.config.dedicatoria.activa ? `<blockquote class="rg-cita ${msg ? '' : 'vacio'}"><small>Dedicatoria</small>${msg ? `<p>${e(msg)}</p>` : '<p>Sin dedicatoria.</p>'}<a class="text-link" href="${urlDe('dedicatoria')}" data-ir="dedicatoria">${msg ? 'Editar' : 'Añadir'}</a></blockquote>` : ''}
  <div class="rg-gran-total"><span>Total estimado</span><strong>${money(total(g, b))}</strong></div>
  <div class="rg-wa">${asesoras.map((a) => `<a class="btn" href="https://wa.me/${e(a.whatsapp)}?text=${wa}" target="_blank" rel="noopener noreferrer">Confirmar con ${e(a.nombre)} ${FLECHA}</a>`).join('')}</div>
  <div class="rg-otras"><button type="button" class="btn secondary" id="rg-copiar">Copiar resumen</button><button type="button" class="text-link" id="rg-nuevo">Crear otro regalo</button></div>
  ${g.config.nota ? `<p class="fine-print">${e(g.config.nota)}</p>` : ''}`;
}
function alResumen() {
  $('#rg-copiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(mensajeWhatsApp(g, b, publico)); aviso('Resumen copiado.'); } catch { aviso('No se pudo copiar. Usa los botones de WhatsApp.'); }
  });
  $('#rg-nuevo').addEventListener('click', () => {
    if (!confirm('¿Crear otro regalo? Se reemplazará este.')) return;
    b = limpiar(g, {}); guardar(); confetiVisto = false; ir(recorrido(g)[0]);
  });
  if (!confetiVisto) { confetiVisto = true; confeti(); }
}

// --- acciones (atrás / continuar) -------------------------------------------------------
function acciones(r, ruta) {
  const caja = $('#rg-acciones'), i = indice(ruta);
  if (ruta === 'resumen') { caja.hidden = true; return; }
  caja.hidden = false;
  const p = g.porPaso.get(ruta), ok = cumple(ruta), sig = r[i + 1];
  const faltan = p ? p.min - (b.sel[ruta] || []).length : 0;
  const vacioOpcional = p && p.min === 0 && !(b.sel[ruta] || []).length;
  const etiqueta = sig === 'resumen' ? 'Ver mi regalo' : vacioOpcional ? 'Continuar sin añadir' : ruta === 'dedicatoria' && !b.mensaje.trim() ? 'Continuar sin dedicatoria' : 'Continuar';
  caja.innerHTML = `${i > 0 ? `<a class="btn secondary rg-atras" href="${urlDe(r[i - 1])}" data-ir="${e(r[i - 1])}">${VOLVER}<span>Atrás</span></a>` : '<span></span>'}
   <button type="button" class="rg-total-chip" data-lado aria-expanded="false" aria-controls="rg-lado"><span>Tu regalo</span><b data-total>${money(total(g, b))}</b></button>
   <button type="button" class="btn rg-seguir ${ok ? 'listo' : ''}" data-siguiente ${ok ? '' : 'aria-disabled="true"'}>${e(etiqueta)} ${FLECHA}</button>
   <p class="rg-pista" ${ok ? 'hidden' : ''}>${faltan === 1 ? 'Elige una opción para continuar.' : `Elige ${faltan} opciones para continuar.`}</p>`;
}

// --- panel «Tu regalo» -----------------------------------------------------------------
function lado(contar = true) {
  const ls = lineas(g, b), t = total(g, b), pct = Math.round(avance(g, b) * 100);
  const conFoto = ls.filter((l) => l.opcion.mini || l.opcion.img).slice(0, 5);
  const ahora = new Set(conFoto.map((l) => l.opcion.id));
  const circ = 2 * Math.PI * 22;
  $('#rg-lado').innerHTML = `<div class="rg-sheet-handle" data-lado aria-hidden="true"></div><div class="rg-regalo">
   <svg class="rg-lazo" viewBox="0 0 120 40" aria-hidden="true"><path d="M60 30C42 30 28 18 30 9c2-8 18-4 30 21Zm0 0c18 0 32-12 30-21-2-8-18-4-30 21Z"/><circle cx="60" cy="30" r="5"/></svg>
   <header><h2>Tu regalo</h2><span class="rg-anillo" role="img" aria-label="${pct}% completo"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="22"/><circle class="v" cx="26" cy="26" r="22" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${(circ * (1 - pct / 100)).toFixed(1)}"/></svg><b>${pct}%</b></span></header>
   <div class="rg-collage ${conFoto.length ? '' : 'vacio'}" aria-hidden="true">${conFoto.length ? conFoto.map((l, i) => `<span class="rg-tile t${i} ${enCollage.has(l.opcion.id) ? '' : 'nuevo'}"><img src="${e(l.opcion.mini || l.opcion.img)}" alt="" width="120" height="144"></span>`).join('') : '<span class="rg-vacio">Cada elección aparecerá aquí.</span>'}</div>
   ${ls.length ? `<ul class="rg-lineas">${ls.map((l) => `<li><a href="${urlDe(l.paso.id)}" data-ir="${e(l.paso.id)}"><small>${e(l.paso.nombre)}</small><span>${e(l.opcion.nombre)}</span><b>${l.opcion.cents ? money(l.opcion.cents) : 'Incluido'}</b></a></li>`).join('')}</ul>` : ''}
   ${b.mensaje.trim() ? `<p class="rg-nota-lado">“${e(b.mensaje.trim().slice(0, 90))}${b.mensaje.trim().length > 90 ? '…' : ''}”</p>` : ''}
   <div class="rg-total"><span>Total estimado</span><strong data-total>${money(totalMostrado)}</strong></div>
   ${g.config.nota ? `<p class="fine-print">${e(g.config.nota)}</p>` : ''}</div>`;
  enCollage = ahora;
  contarHasta(t, contar);
}
function contarHasta(destino, animar) {
  const els = $$('[data-total]');
  if (!animar || quieto.matches || destino === totalMostrado) { totalMostrado = destino; els.forEach((el) => { el.textContent = money(destino); }); return; }
  const desde = totalMostrado, t0 = performance.now();
  totalMostrado = destino;
  const paso = (ahora) => {
    const k = Math.min(1, (ahora - t0) / 450), v = Math.round(desde + (destino - desde) * (1 - (1 - k) ** 3));
    els.forEach((el) => { el.textContent = money(v); });
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// --- elegir ----------------------------------------------------------------------------
function elegir(id) {
  const ruta = rutaActual() || recorrido(g)[0], p = g.porPaso.get(ruta);
  if (!p) return;
  const r = alternar(g, b, ruta, id);
  if (r.error) { aviso(r.error); return; }
  b = r.borrador; guardar();
  const n = (b.sel[ruta] || []).length;
  $$('.rg-op').forEach((caja) => {
    const on = (b.sel[ruta] || []).includes($('[data-op]', caja).dataset.op);
    caja.classList.toggle('elegida', on); $('[data-op]', caja).setAttribute('aria-pressed', String(on));
  });
  const c = $('[data-contador]'); if (c) c.innerHTML = contador(p, n).replace(/^<p[^>]*>|<\/p>$/g, '');
  progreso(recorrido(g), ruta);
  acciones(recorrido(g), ruta);
  lado();
}

// --- vista ampliada --------------------------------------------------------------------
function ampliar(id) {
  const o = g.porId.get(id); if (!o?.img) return;
  let d = $('#rg-zoom');
  if (!d) {
    d = document.createElement('dialog'); d.id = 'rg-zoom'; d.className = 'rg-zoom'; d.setAttribute('aria-label', 'Foto ampliada');
    d.innerHTML = '<button type="button" class="close-button" data-cerrar aria-label="Cerrar">✕</button><img alt="" width="900" height="1080"><p></p>';
    document.body.append(d);
    d.addEventListener('click', (ev) => { if (ev.target === d || ev.target.closest('[data-cerrar]')) d.close(); });
    d.addEventListener('close', () => document.body.classList.remove('modal-open'));
  }
  $('img', d).src = o.img; $('img', d).alt = o.nombre; $('p', d).textContent = `${o.nombre}${o.cents ? ` · + ${money(o.cents)}` : ''}`;
  document.body.classList.add('modal-open'); d.showModal();
}

// --- confeti (se salta con «reducir movimiento») --------------------------------------
function confeti() {
  if (quieto.matches) return;
  const lienzo = $('#rg-confeti'), ctx = lienzo.getContext('2d');
  const estilo = getComputedStyle(document.documentElement);
  const colores = ['--wine', '--orange', '--tint', '--ink'].map((v) => estilo.getPropertyValue(v).trim()).filter(Boolean).concat(['#d9a441', '#fff']);
  const dpr = Math.min(2, devicePixelRatio || 1);
  lienzo.width = innerWidth * dpr; lienzo.height = innerHeight * dpr; lienzo.style.display = 'block';
  const ps = Array.from({ length: 150 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.55, vx: (Math.random() - 0.5) * 16, vy: -8 - Math.random() * 12,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colores[Math.floor(Math.random() * colores.length)],
  }));
  const t0 = performance.now();
  (function cuadro(ahora) {
    const k = (ahora - t0) / 2600;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (k < 1) requestAnimationFrame(cuadro); else { ctx.clearRect(0, 0, innerWidth, innerHeight); lienzo.style.display = 'none'; }
  })(t0);
}

// --- eventos ---------------------------------------------------------------------------
document.addEventListener('click', (ev) => {
  const op = ev.target.closest('[data-op]'); if (op && g) { elegir(op.dataset.op); return; }
  const zoom = ev.target.closest('[data-zoom]'); if (zoom && g) { ampliar(zoom.dataset.zoom); return; }
  const nav = ev.target.closest('a[data-ir]');
  if (nav && g && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && ev.button === 0) { ev.preventDefault(); cerrarLado(); ir(nav.dataset.ir); return; }
  const sig = ev.target.closest('[data-siguiente]');
  if (sig && g) {
    const r = recorrido(g), ruta = rutaActual() || r[0];
    if (sig.getAttribute('aria-disabled') === 'true') { aviso($('.rg-pista')?.textContent || 'Completa este paso para continuar.'); $('.rg-pista')?.removeAttribute('hidden'); return; }
    cerrarLado(); ir(r[indice(ruta) + 1]); return;
  }
  const lado_ = ev.target.closest('[data-lado]'); if (lado_ && g) { alternarLado(); return; }
  if (document.body.classList.contains('rg-lado-abierto') && !ev.target.closest('#rg-lado')) cerrarLado();
});
const alternarLado = () => { const abre = !document.body.classList.contains('rg-lado-abierto'); document.body.classList.toggle('rg-lado-abierto', abre); $$('[data-lado][aria-expanded]').forEach((x) => x.setAttribute('aria-expanded', String(abre))); };
const cerrarLado = () => { document.body.classList.remove('rg-lado-abierto'); $$('[data-lado][aria-expanded]').forEach((x) => x.setAttribute('aria-expanded', 'false')); };
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrarLado(); });
window.addEventListener('popstate', () => { if (g) pintar(1); });
// Las fotos que llegan se quitan del esqueleto; las que fallan se cambian por la marca.
document.addEventListener('load', (ev) => { if (ev.target.tagName === 'IMG') ev.target.closest('.rg-foto')?.classList.remove('cargando'); }, true);
document.addEventListener('error', (ev) => {
  const img = ev.target; if (img.tagName !== 'IMG' || !img.closest('.rg-op, .rg-recibo, .rg-collage')) return;
  const f = img.closest('.rg-foto'); f?.classList.remove('cargando');
  img.replaceWith(Object.assign(document.createElement('span'), { className: 'rg-mono', innerHTML: '<img src="/assets/images/logo-mark-vino.svg" alt="" width="64" height="74">' }));
}, true);
window.addEventListener('storage', (ev) => { if (g && (ev.key === LLAVE || ev.key === null)) { b = limpiar(g, leer()); pintar(1); } });

// --- carga -----------------------------------------------------------------------------
async function traer(url) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
  try { const r = await fetch(url, { signal: c.signal, cache: 'no-cache' }); if (!r.ok) throw new Error('API'); return await r.json(); } finally { clearTimeout(t); }
}
function falloCarga() {
  $('#rg-paso').innerHTML = `<div class="empty-state"><h2>No pudimos cargar las opciones.</h2><p>Revisa tu conexión y vuelve a intentar, o pide tu regalo directo por WhatsApp.</p><button type="button" class="btn" id="rg-reintentar">Volver a intentar</button> <a class="text-link" href="https://wa.me/${e(asesoras[0].whatsapp)}" target="_blank" rel="noopener noreferrer">Escribir por WhatsApp ${FLECHA}</a></div>`;
  $('#rg-reintentar').addEventListener('click', () => { $('#rg-paso').innerHTML = '<p class="sr">Preparando tu regalo…</p>'; cargar(); });
}
async function cargar() {
  try {
    const [datos, cat] = await Promise.all([traer(`/api/regalos/${publico}`), traer('/api/catalogo').catch(() => null)]);
    const adv = (cat?.asesoras || []).filter((a) => /^\d{10,15}$/.test(a.whatsapp)).map((a) => ({ nombre: String(a.nombre || 'asesora').slice(0, 40), whatsapp: a.whatsapp }));
    if (adv.length) asesoras = adv;
    g = preparar(datos);
    if (!g.config.activo || !g.pasos.length) {
      $('#rg-paso').innerHTML = `<div class="empty-state"><h2>Estamos preparando este regalo.</h2><p>Por ahora pídelo directo a una asesora y lo armamos contigo.</p><a class="btn" href="https://wa.me/${e(asesoras[0].whatsapp)}" target="_blank" rel="noopener noreferrer">Escribir por WhatsApp ${FLECHA}</a></div>`;
      return;
    }
    b = limpiar(g, leer());
    pintar(1);
  } catch { falloCarga(); }
}
cargar();
