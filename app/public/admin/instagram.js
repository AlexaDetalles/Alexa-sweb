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

/**
 * Dibuja la lámina en `canvas`. datos: { fotoUrl, nombre, precio, cotizar, talla }.
 * El canvas queda en 2160×2700; en pantalla se muestra pequeño con CSS.
 */
export async function dibujarInstagram(canvas, { fotoUrl, nombre, precio, cotizar, talla, paleta, formato }) {
  const pal = paletaPorId(paleta);
  await cargarFuentes();
  const foto = await cargarFoto(fotoUrl);
  // Historia: lienzo vertical 9:16 (1080×1920). La composición de siempre queda centrada, dentro de las zonas que no tapa la app (arriba 250 px, abajo 320 px).
  const H = formato === 'historia' ? ALTO_HISTORIA : ALTO, dy = formato === 'historia' ? 250 : 0;
  canvas.width = ANCHO * ESCALA; canvas.height = H * ESCALA;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);

  // fondo: degradado rojo con brillo arriba a la izquierda y fondo oscuro abajo a la derecha
  let g = ctx.createLinearGradient(ANCHO * 0.2, 0, ANCHO * 0.8, H);
  g.addColorStop(0, pal.fondo[0]); g.addColorStop(0.4, pal.fondo[1]); g.addColorStop(0.75, pal.fondo[2]); g.addColorStop(1, pal.fondo[3]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, H);
  g = ctx.createRadialGradient(ANCHO * 0.2, H * 0.08, 0, ANCHO * 0.2, H * 0.08, ANCHO * 0.9);
  g.addColorStop(0, pal.brillo); g.addColorStop(1, pal.brillo.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, H);
  ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, dy * ESCALA); // desde aquí todo se dibuja con el desplazamiento de la historia

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
  ctx.fillStyle = pal.suave; ctx.font = '700 24px AlexaGrotesk, sans-serif'; ctx.letterSpacing = '8px';
  ctx.fillText('TIENDAS ALEXA · @TIENDASALEXA_', ANCHO / 2 + 4, ALTO - 44); ctx.letterSpacing = '0px';

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
