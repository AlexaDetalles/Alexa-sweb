// Imagen para Instagram desde el panel: foto + nombre + precio + talla, en 4:5 (1080×1350) y guardada al doble (2160×2700).
// Todo ocurre en el navegador con <canvas>: la foto no sale a ningún servicio. Mismo estilo que el carrusel «New Drop»:
// rojo con degradado, grano de película en toda la lámina y moteado en las letras.
const ANCHO = 1080, ALTO = 1350, ALTO_HISTORIA = 1920, ESCALA = 2;
/**
 * Paletas de la lámina. fondo: 4 tonos del degradado (de arriba-izquierda a abajo-derecha); brillo: luz arriba a la izquierda;
 * texto: degradado de las letras; trazo: contorno del precio; marco: borde de la foto; pildora/pildoraTexto: etiqueta de talla;
 * suave: textos pequeños; vineta: oscurecimiento de los bordes (0 a 1).
 */
export const PALETAS = [
  { id: 'rojo', nombre: 'Rojo Alexa', fondo: ['#e63946', '#c1121f', '#8b0a14', '#2f0307'], brillo: 'rgba(255,90,104,.85)', luz: 'rgba(255,120,110,.55)', texto: ['#fff', '#fff', '#ffc9c2'], trazo: '#fff', marco: '#f6f2ea', pildora: '#050505', pildoraTexto: '#fff', suave: 'rgba(255,255,255,.8)', vineta: 0.6 },
  { id: 'dorado', nombre: 'Negro y dorado', fondo: ['#2a2418', '#15120b', '#0a0905', '#030302'], brillo: 'rgba(212,175,55,.5)', luz: 'rgba(212,175,55,.5)', texto: ['#fff3c4', '#e9c75a', '#a8801c'], trazo: '#d4af37', marco: '#efe6cf', pildora: '#d4af37', pildoraTexto: '#0a0905', suave: 'rgba(233,199,90,.85)', vineta: 0.55 },
  { id: 'rosa', nombre: 'Rosa', fondo: ['#ff8fb1', '#e0457b', '#9c2158', '#3b0a1f'], brillo: 'rgba(255,190,214,.8)', luz: 'rgba(255,160,200,.5)', texto: ['#fff', '#fff', '#ffd6e6'], trazo: '#fff', marco: '#fff7f9', pildora: '#fff', pildoraTexto: '#9c2158', suave: 'rgba(255,255,255,.85)', vineta: 0.45 },
  { id: 'azul', nombre: 'Azul noche', fondo: ['#4f7cff', '#1f3490', '#0d1850', '#03050f'], brillo: 'rgba(120,160,255,.7)', luz: 'rgba(130,170,255,.5)', texto: ['#fff', '#e6efff', '#a9c4ff'], trazo: '#cfe0ff', marco: '#f2f5fc', pildora: '#fff', pildoraTexto: '#0d1850', suave: 'rgba(214,228,255,.85)', vineta: 0.55 },
  { id: 'verde', nombre: 'Esmeralda', fondo: ['#2fd08a', '#0f7a4f', '#064430', '#021a12'], brillo: 'rgba(120,255,190,.6)', luz: 'rgba(120,255,190,.45)', texto: ['#fff', '#eafff4', '#aef0cf'], trazo: '#d6ffe9', marco: '#f3faf6', pildora: '#050505', pildoraTexto: '#aef0cf', suave: 'rgba(220,255,238,.85)', vineta: 0.5 },
  { id: 'crema', nombre: 'Crema', fondo: ['#fbf5ea', '#eddcc0', '#d3b88c', '#b8956a'], brillo: 'rgba(255,255,255,.9)', luz: 'rgba(255,255,255,.0)', texto: ['#7a0b17', '#b11226', '#3a0a0e'], trazo: '#8b0a14', marco: '#ffffff', pildora: '#2a0d0a', pildoraTexto: '#fbf5ea', suave: 'rgba(58,10,14,.75)', vineta: 0.22 },
];

// --- paleta a partir de cualquier color elegido -----------------------------------------------
const aRGB = (hex) => { const h = String(hex).replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const aHex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const mezclar = (c, destino, t) => aHex(...c.map((v, i) => v + (destino[i] - v) * t));          // t = 0 → c, t = 1 → destino
const luminancia = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
export const esColor = (v) => /^#[0-9a-f]{6}$/i.test(String(v));

/** Paleta completa (fondo, brillo, letras, marco…) derivada de UN color: sirve para «el color que yo elija». */
export function paletaDesdeColor(hex) {
  const c = aRGB(esColor(hex) ? hex : '#c1121f'), BLANCO = [255, 255, 255], NEGRO = [0, 0, 0];
  if (luminancia(c) > 0.72) { // color claro: fondo claro y letras oscuras (como «Crema»)
    const oscuro = mezclar(c, NEGRO, 0.78);
    return { id: 'color', nombre: 'Mi color', fondo: [mezclar(c, BLANCO, 0.55), mezclar(c, BLANCO, 0.15), aHex(...c), mezclar(c, NEGRO, 0.18)], brillo: 'rgba(255,255,255,.9)', luz: 'rgba(255,255,255,0)',
      texto: [mezclar(c, NEGRO, 0.55), oscuro, mezclar(c, NEGRO, 0.85)], trazo: oscuro, marco: '#ffffff', pildora: oscuro, pildoraTexto: mezclar(c, BLANCO, 0.9), suave: 'rgba(30,20,20,.75)', vineta: 0.2 };
  }
  const [r, g, b] = c;
  return { id: 'color', nombre: 'Mi color', fondo: [mezclar(c, BLANCO, 0.12), aHex(r, g, b), mezclar(c, NEGRO, 0.45), mezclar(c, NEGRO, 0.88)],
    brillo: `rgba(${Math.round(r + (255 - r) * 0.45)},${Math.round(g + (255 - g) * 0.45)},${Math.round(b + (255 - b) * 0.45)},.8)`, luz: `rgba(${Math.round(r + (255 - r) * 0.35)},${Math.round(g + (255 - g) * 0.35)},${Math.round(b + (255 - b) * 0.35)},.5)`,
    texto: ['#fff', '#fff', mezclar(c, BLANCO, 0.78)], trazo: '#fff', marco: '#f6f2ea', pildora: '#050505', pildoraTexto: '#fff', suave: 'rgba(255,255,255,.8)', vineta: 0.55 };
}
/** id de una paleta de la lista, o un color «#rrggbb» elegido a mano. */
export const paletaPorId = (id) => (esColor(id) ? paletaDesdeColor(id) : PALETAS.find((p) => p.id === id) || PALETAS[0]);

let fuentes = null;
/** Carga una sola vez las letras de la tienda (están en /assets/fonts; el panel solo permite fuentes propias). */
function cargarFuentes() {
  fuentes ||= Promise.all([
    new FontFace('AlexaAnton', 'url(/assets/fonts/anton.ttf)'),
    new FontFace('AlexaGrotesk', 'url(/assets/fonts/space-grotesk-700.ttf)', { weight: '700' }),
  ].map((f) => f.load().then((x) => document.fonts.add(x)))).catch(() => { /* sin fuentes propias se dibuja con las del sistema */ });
  return fuentes;
}

/** Cuántas líneas ocupa el nombre y de qué tamaño, para que siempre quepa: 1 línea si es corto, hasta 2 si no. */
export function repartirNombre(nombre, medir, ancho, maxTam = 120, minTam = 62) {
  const palabras = String(nombre || '').toUpperCase().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!palabras.length) return { lineas: [''], tam: maxTam };
  for (let tam = maxTam; tam >= minTam; tam -= 4) {
    if (medir(palabras.join(' '), tam) <= ancho) return { lineas: [palabras.join(' ')], tam };
    // la división de dos líneas más pareja posible
    let mejor = null;
    for (let i = 1; i < palabras.length; i++) {
      const a = palabras.slice(0, i).join(' '), b = palabras.slice(i).join(' ');
      const peor = Math.max(medir(a, tam), medir(b, tam));
      if (peor <= ancho && (!mejor || peor < mejor.peor)) mejor = { lineas: [a, b], peor };
    }
    if (mejor) return { lineas: mejor.lineas, tam };
  }
  // un nombre larguísimo o una sola palabra enorme: se recorta con puntos suspensivos en el tamaño mínimo
  let t = palabras.join(' ');
  while (t.length > 1 && medir(`${t}…`, minTam) > ancho) t = t.slice(0, -1);
  return { lineas: [`${t.trimEnd()}…`], tam: minTam };
}

export function textoPrecio({ precio, cotizar }) {
  if (cotizar) return 'CONSULTA PRECIO';
  const n = Number(precio);
  if (precio === '' || precio === null || precio === undefined || !Number.isFinite(n)) return '';
  return `L ${n.toLocaleString('es-HN', { maximumFractionDigits: 2 })}`;
}

// Grano: se crea una sola vez un cuadrito de ruido y se repite por toda la lámina.
function mosaico(tam, fn) {
  const c = document.createElement('canvas'); c.width = c.height = tam;
  const x = c.getContext('2d'), im = x.createImageData(tam, tam);
  for (let i = 0; i < im.data.length; i += 4) { const v = fn(); im.data[i] = im.data[i + 1] = im.data[i + 2] = v[0]; im.data[i + 3] = v[1]; }
  x.putImageData(im, 0, 0);
  return c;
}
let granoCache = null, motasCache = null;
const grano = () => (granoCache ||= mosaico(512, () => [Math.max(0, Math.min(255, 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 150)), 255]));
const motas = () => (motasCache ||= mosaico(512, () => [0, Math.random() < 0.07 ? 255 : 0]));

function cargarFoto(url) {
  return new Promise((res) => {
    if (!url) return res(null);
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = url;
  });
}

/**
 * Texto con degradado, resplandor suave y moteado de grano (como la tinta de un cartel).
 * Se dibuja en una capa del tamaño del texto (no de toda la lámina): así crear decenas de imágenes seguidas es rápido y gasta poca memoria.
 */
function letras(ctx, linea, x, y, tam, familia, pal, { relleno = true } = {}) {
  const dy = ctx.getTransform().f / ESCALA; // desplazamiento vertical de la composición (historia)
  ctx.save(); ctx.font = `${tam}px ${familia}`; const ancho = ctx.measureText(linea).width; ctx.restore();
  const margen = 70, x0 = Math.floor(x - ancho / 2 - margen), y0 = Math.floor(y - tam * 1.05 - margen / 2), w = Math.ceil(ancho + margen * 2), h = Math.ceil(tam * 1.35 + margen);
  const capa = document.createElement('canvas'); capa.width = w * ESCALA; capa.height = h * ESCALA;
  const c = capa.getContext('2d'); c.scale(ESCALA, ESCALA); c.translate(-x0, -y0);
  c.font = `${tam}px ${familia}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const g = c.createLinearGradient(0, y - tam * 0.8, 0, y);
  g.addColorStop(0, pal.texto[0]); g.addColorStop(0.45, pal.texto[1]); g.addColorStop(1, pal.texto[2]);
  c.fillStyle = relleno ? g : 'transparent'; c.strokeStyle = pal.trazo; c.lineWidth = relleno ? 0 : 4;
  c.fillText(linea, x, y); if (!relleno) c.strokeText(linea, x, y);
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = c.createPattern(motas(), 'repeat'); c.setTransform(1, 0, 0, 1, 0, 0); c.fillRect(0, 0, capa.width, capa.height);
  ctx.save();
  ctx.shadowColor = pal.luz; ctx.shadowBlur = 22;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(capa, x0 * ESCALA, (y0 + dy) * ESCALA);
  ctx.restore();
}

// --- fotos recortadas (sin fondo) y fondos con textura ------------------------------------------------
export const ESTILOS = [
  { id: 'auto', nombre: 'Automático (detecta si la foto está recortada)' },
  { id: 'marco', nombre: 'Foto con marco' },
  { id: 'recorte', nombre: 'Sin fondo (el producto solo)' },
];
export const FONDOS = [
  { id: 'liso', nombre: 'Liso (solo el color)' },
  { id: 'concreto', nombre: 'Concreto' },
  { id: 'madera', nombre: 'Madera' },
  { id: 'tela', nombre: 'Tela' },
];
const USUARIO = '@TIENDASALEXA_'; // lo que sale al pie de cada lámina

/**
 * Mira los píxeles (RGBA) de una miniatura y dice si la foto es un recorte: transparente en casi todo el borde,
 * con una caja que envuelve al objeto (así se quita el espacio vacío que deja el recorte del iPhone).
 */
export function analizarAlfa(data, ancho, alto, umbral = 24) {
  let transp = 0, borde = 0, bordeTransp = 0, minX = ancho, minY = alto, maxX = -1, maxY = -1;
  const grosor = Math.max(1, Math.round(Math.min(ancho, alto) * 0.02));
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const a = data[(y * ancho + x) * 4 + 3], enBorde = x < grosor || y < grosor || x >= ancho - grosor || y >= alto - grosor;
      if (enBorde) borde++;
      if (a < umbral) { transp++; if (enBorde) bordeTransp++; }
      else { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
  }
  const total = ancho * alto, hay = maxX >= 0, fraccion = transp / total;
  const recorte = hay && fraccion >= 0.05 && (bordeTransp / borde >= 0.6 || fraccion >= 0.3);
  return { recorte, transparente: fraccion, caja: hay ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : { x: 0, y: 0, w: ancho, h: alto } };
}

/** Analiza la foto en una miniatura. Si el navegador no deja leer los píxeles, se trata como foto normal. */
function analizarFoto(foto) {
  try {
    const k = Math.min(1, 256 / Math.max(foto.width, foto.height)), w = Math.max(1, Math.round(foto.width * k)), h = Math.max(1, Math.round(foto.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(foto, 0, 0, w, h);
    const r = analizarAlfa(x.getImageData(0, 0, w, h).data, w, h);
    const m = 2; // un poquito de aire alrededor del objeto
    const cx = Math.max(0, Math.floor(r.caja.x / k) - m), cy = Math.max(0, Math.floor(r.caja.y / k) - m);
    const cw = Math.min(foto.width - cx, Math.ceil(r.caja.w / k) + m * 2), ch = Math.min(foto.height - cy, Math.ceil(r.caja.h / k) + m * 2);
    return { recorte: r.recorte, caja: { x: cx, y: cy, w: Math.max(1, cw), h: Math.max(1, ch) } };
  } catch { return { recorte: false, caja: { x: 0, y: 0, w: foto.width, h: foto.height } }; }
}

// Texturas: ruido de valor generado una sola vez (en gris medio) y mezclado con «overlay» sobre el color de la paleta, así conserva su tono.
const TEX_W = 540, TEX_H = 960;
const ruido2D = (n) => { const g = Float32Array.from({ length: n * n }, Math.random); const at = (i, j) => g[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }; };
const ruido1D = (n) => { const g = Float32Array.from({ length: n }, Math.random); return (t) => { const i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f); return g[((i % n) + n) % n] * (1 - s) + g[(((i + 1) % n) + n) % n] * s; }; };
function lienzoGris(w, h, valor) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), im = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = Math.max(0, Math.min(255, valor(i, j))), p = (j * w + i) * 4; im.data[p] = im.data[p + 1] = im.data[p + 2] = v; im.data[p + 3] = 255; }
  x.putImageData(im, 0, 0);
  return c;
}
const texturas = {};
const FUERZA = { concreto: 0.6, madera: 0.8, tela: 0.5 };
function texturaDe(id) {
  if (texturas[id]) return texturas[id];
  if (id === 'concreto') {
    const o = [ruido2D(64), ruido2D(64), ruido2D(64), ruido2D(64)];
    return (texturas[id] = lienzoGris(TEX_W, TEX_H, (x, y) => 128 + ((o[0](x / 150, y / 150) - 0.5) * 0.9 + (o[1](x / 48, y / 48) - 0.5) * 0.6 + (o[2](x / 14, y / 14) - 0.5) * 0.35 + (o[3](x / 4, y / 4) - 0.5) * 0.3) * 130));
  }
  if (id === 'madera') { // tablas verticales con veta ondulada y una junta oscura entre ellas
    const tablas = 4, ancho = TEX_W / tablas, vetas = Array.from({ length: tablas }, () => ({ a: ruido1D(96), b: ruido1D(96), tono: (Math.random() - 0.5) * 36, fase: Math.random() * 6 }));
    return (texturas[id] = lienzoGris(TEX_W, TEX_H, (x, y) => {
      const t = Math.min(tablas - 1, Math.floor(x / ancho)), v = vetas[t], local = x - t * ancho;
      const u = x + 5 * Math.sin(y * 0.009 + v.fase) + 2.5 * Math.sin(y * 0.041 + v.fase * 2); // veta casi recta, como un piso de tablas
      const veta = v.a(u * 0.30) * 0.6 + v.b(u * 1.25) * 0.4, junta = local < 1.5 || local > ancho - 1.5 ? -55 : 0;
      return 128 + (veta - 0.5) * 110 + v.tono + junta + (Math.random() - 0.5) * 8;
    }));
  }
  if (id === 'tela') { // trama de hilos
    return (texturas[id] = lienzoGris(64, 64, (x, y) => 128 + ((x + y) % 2 ? 11 : -11) + ((((x >> 1) + (y >> 1)) % 2) ? 7 : -7) + (Math.random() - 0.5) * 10));
  }
  return null;
}
function aplicarTextura(ctx, id, H) {
  const t = texturaDe(id); if (!t) return;
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = FUERZA[id] ?? 0.6;
  if (id === 'tela') { ctx.fillStyle = ctx.createPattern(t, 'repeat'); ctx.fillRect(0, 0, ANCHO, H); }
  else ctx.drawImage(t, 0, 0, TEX_W, H / 2, 0, 0, ANCHO, H); // se recorta de arriba hacia abajo: nada se estira
  ctx.restore();
}

/** Foto recortada: el producto solo, grande, con luz detrás y sombra en el piso; la talla y el precio van chicos arriba. */
function dibujarRecorte(ctx, foto, caja, pal, { nombre, precio, cotizar, talla }) {
  const precioTxt = textoPrecio({ precio, cotizar }), tallaTxt = String(talla || '').trim().toUpperCase().slice(0, 20);
  // arriba: dos etiquetas pequeñas
  ctx.save(); ctx.font = '700 27px AlexaGrotesk, sans-serif'; ctx.letterSpacing = '5px'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const alto = 54, y0 = 62;
  if (tallaTxt) {
    const t = `TALLA ${tallaTxt}`, w = ctx.measureText(t).width + 52;
    ctx.strokeStyle = pal.suave; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(64, y0, w, alto, alto / 2); ctx.stroke();
    ctx.fillStyle = pal.suave; ctx.fillText(t, 64 + 26, y0 + alto / 2 + 2);
  }
  if (precioTxt) {
    const w = ctx.measureText(precioTxt).width + 52, x = ANCHO - 64 - w;
    ctx.fillStyle = pal.pildora; ctx.beginPath(); ctx.roundRect(x, y0, w, alto, alto / 2); ctx.fill();
    ctx.fillStyle = pal.pildoraTexto; ctx.fillText(precioTxt, x + 26, y0 + alto / 2 + 2);
  }
  ctx.restore();

  // el producto: ocupa casi todo el cuadro, centrado
  const aw = 960, ah = 940, k = Math.min(aw / caja.w, ah / caja.h), dw = caja.w * k, dh = caja.h * k, dx = (ANCHO - dw) / 2, dy = 170 + (ah - dh) / 2;
  let g = ctx.createRadialGradient(ANCHO / 2, dy + dh / 2, 0, ANCHO / 2, dy + dh / 2, Math.max(dw, dh) * 0.78);
  g.addColorStop(0, pal.brillo); g.addColorStop(1, pal.brillo.replace(/[\d.]+\)$/, '0)'));
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO); ctx.restore();
  ctx.save(); ctx.translate(ANCHO / 2, dy + dh + 8); ctx.scale(1, 0.15); // sombra de contacto en el piso
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, dw * 0.5); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, dw * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 90; ctx.shadowOffsetY = 40; ctx.filter = 'saturate(1.04) contrast(1.03)';
  ctx.drawImage(foto, caja.x, caja.y, caja.w, caja.h, dx, dy, dw, dh);
  ctx.restore();

  // nombre, discreto
  const fam = 'AlexaAnton, Impact, sans-serif';
  const medir = (t, tam) => { ctx.font = `${tam}px ${fam}`; return ctx.measureText(t).width; };
  const { lineas, tam } = repartirNombre(nombre, medir, 900, 62, 40);
  let y = 1140 + Math.max(0, (120 - lineas.length * tam * 0.98) / 2);
  for (const l of lineas) { y += tam * 0.98; letras(ctx, l, ANCHO / 2, y - tam * 0.08, tam, fam, pal); }
}

/** Foto con marco blanco y el nombre, el precio y la talla grandes: la lámina de siempre. */
function dibujarMarco(ctx, foto, pal, { nombre, precio, cotizar, talla }) {
  // etiqueta superior
  ctx.fillStyle = pal.suave; ctx.font = '700 26px AlexaGrotesk, sans-serif'; ctx.textAlign = 'center';
  ctx.letterSpacing = '12px'; ctx.fillText('NEW IN', ANCHO / 2 + 6, 92); ctx.letterSpacing = '0px';

  // foto con marco blanco, un poco girada
  const cw = 700, ch = 590, cx = ANCHO / 2, cy = 130 + ch / 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate((-2.2 * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  ctx.fillStyle = pal.marco; ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
  ctx.shadowColor = 'transparent';
  const m = 14, iw = cw - m * 2, ih = ch - m * 2;
  ctx.beginPath(); ctx.rect(-iw / 2, -ih / 2, iw, ih); ctx.clip();
  if (foto) {
    const k = Math.max(iw / foto.width, ih / foto.height);
    ctx.filter = 'saturate(.95)';
    ctx.drawImage(foto, -(foto.width * k) / 2, -(foto.height * k) / 2, foto.width * k, foto.height * k);
    ctx.filter = 'none';
  } else {
    const f = ctx.createLinearGradient(0, -ih / 2, 0, ih / 2); f.addColorStop(0, '#2c2c2c'); f.addColorStop(1, '#141414');
    ctx.fillStyle = f; ctx.fillRect(-iw / 2, -ih / 2, iw, ih);
  }
  ctx.restore();

  // nombre (hasta 2 líneas), precio y talla: el bloque se centra entre la foto y el pie
  const medir = (t, tam) => { ctx.font = `${tam}px AlexaAnton, Impact, sans-serif`; return ctx.measureText(t).width; };
  const { lineas, tam } = repartirNombre(nombre, medir, 920, 104);
  const precioTxt = textoPrecio({ precio, cotizar }), tallaTxt = String(talla || '').trim().toUpperCase().slice(0, 20);
  const tamPrecio = precioTxt.length > 8 ? 76 : 108, altNombre = lineas.length * tam * 0.98;
  const alto = altNombre + (precioTxt ? 34 + tamPrecio * 0.82 : 0) + (tallaTxt ? 34 + 64 : 0);
  const zonaTop = 130 + ch + 20, zonaBase = ALTO - 90;
  let y = zonaTop + Math.max(0, (zonaBase - zonaTop - alto) / 2);
  const fam = 'AlexaAnton, Impact, sans-serif';
  for (const l of lineas) { y += tam * 0.98; letras(ctx, l, ANCHO / 2, y - tam * 0.08, tam, fam, pal); }
  if (precioTxt) { y += 34 + tamPrecio * 0.82; letras(ctx, precioTxt, ANCHO / 2, y, tamPrecio, fam, pal, { relleno: false }); }
  if (tallaTxt) {
    y += 34;
    ctx.font = '700 32px AlexaGrotesk, sans-serif'; ctx.letterSpacing = '6px';
    const t = `TALLA ${tallaTxt}`, w = ctx.measureText(t).width + 76;
    ctx.fillStyle = pal.pildora; ctx.beginPath(); ctx.roundRect(ANCHO / 2 - w / 2, y, w, 64, 32); ctx.fill();
    ctx.fillStyle = pal.pildoraTexto; ctx.textBaseline = 'middle'; ctx.fillText(t, ANCHO / 2 + 3, y + 34); ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  }
}

/**
 * Dibuja la lámina en `canvas`. datos: { fotoUrl, nombre, precio, cotizar, talla, paleta, formato, estilo, fondo }.
 * estilo: 'auto' (detecta si la foto está recortada), 'marco' o 'recorte'. fondo: 'liso', 'concreto', 'madera' o 'tela'.
 * El canvas queda en 2160×2700; en pantalla se muestra pequeño con CSS.
 */
export async function dibujarInstagram(canvas, { fotoUrl, nombre, precio, cotizar, talla, paleta, formato, estilo = 'auto', fondo = 'liso' }) {
  const pal = paletaPorId(paleta);
  await cargarFuentes();
  const foto = await cargarFoto(fotoUrl);
  const analisis = foto && estilo !== 'marco' ? analizarFoto(foto) : null;
  const recorte = !!foto && (estilo === 'recorte' || (estilo !== 'marco' && analisis?.recorte));
  // Historia: lienzo vertical 9:16 (1080×1920). La composición de siempre queda centrada, dentro de las zonas que no tapa la app (arriba 250 px, abajo 320 px).
  const H = formato === 'historia' ? ALTO_HISTORIA : ALTO, dy = formato === 'historia' ? 250 : 0;
  canvas.width = ANCHO * ESCALA; canvas.height = H * ESCALA;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);

  // fondo: degradado con brillo arriba a la izquierda y fondo oscuro abajo a la derecha, y la textura si se eligió
  let g = ctx.createLinearGradient(ANCHO * 0.2, 0, ANCHO * 0.8, H);
  g.addColorStop(0, pal.fondo[0]); g.addColorStop(0.4, pal.fondo[1]); g.addColorStop(0.75, pal.fondo[2]); g.addColorStop(1, pal.fondo[3]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, H);
  g = ctx.createRadialGradient(ANCHO * 0.2, H * 0.08, 0, ANCHO * 0.2, H * 0.08, ANCHO * 0.9);
  g.addColorStop(0, pal.brillo); g.addColorStop(1, pal.brillo.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, H);
  aplicarTextura(ctx, fondo, H);
  ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, dy * ESCALA); // desde aquí todo se dibuja con el desplazamiento de la historia

  const textos = { nombre, precio, cotizar, talla };
  if (recorte) dibujarRecorte(ctx, foto, analisis?.caja ?? { x: 0, y: 0, w: foto.width, h: foto.height }, pal, textos);
  else dibujarMarco(ctx, foto, pal, textos);
  ctx.fillStyle = pal.suave; ctx.font = '700 24px AlexaGrotesk, sans-serif'; ctx.textAlign = 'center'; ctx.letterSpacing = '8px';
  ctx.fillText(`TIENDAS ALEXA · ${USUARIO}`, ANCHO / 2 + 4, ALTO - 44); ctx.letterSpacing = '0px';

  // viñeta y grano de película sobre todo
  ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);
  g = ctx.createRadialGradient(ANCHO / 2, H / 2, ANCHO * 0.45, ANCHO / 2, H / 2, ANCHO * (formato === 'historia' ? 1.15 : 0.95));
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${pal.vineta})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, H);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.4;
  ctx.fillStyle = ctx.createPattern(grano(), 'repeat'); ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

export function nombreArchivo(nombre, id) {
  const base = String(nombre || id || 'producto').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `alexa-${base || 'producto'}-instagram.png`;
}

/** Crea la imagen y la devuelve como archivo (JPEG por defecto: es lo único que acepta Instagram). */
export async function crearImagen(datos, { tipo = 'image/jpeg', calidad = 0.92 } = {}) {
  const lienzo = document.createElement('canvas');
  await dibujarInstagram(lienzo, datos);
  return new Promise((res) => lienzo.toBlob(res, tipo, calidad));
}
