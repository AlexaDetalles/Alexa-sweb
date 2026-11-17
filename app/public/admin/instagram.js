// Imagen para Instagram desde el panel: foto + nombre + precio + talla, en 4:5 (1080×1350) y guardada al doble (2160×2700).
// Todo ocurre en el navegador con <canvas>: la foto no sale a ningún servicio. Mismo estilo que el carrusel «New Drop»:
// rojo con degradado, grano de película en toda la lámina y moteado en las letras.
const ANCHO = 1080, ALTO = 1350, ESCALA = 2;
const ROJO = ['#ff5a68', '#e63946', '#8b0a14', '#2f0307'];

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

/** Texto con degradado blanco→rosado, resplandor suave y moteado de grano (como la tinta de un cartel). */
function letras(ctx, linea, x, y, tam, familia, { relleno = true } = {}) {
  const w = ctx.canvas.width / ESCALA, h = ctx.canvas.height / ESCALA;
  const capa = document.createElement('canvas'); capa.width = w * ESCALA; capa.height = h * ESCALA;
  const c = capa.getContext('2d'); c.scale(ESCALA, ESCALA);
  c.font = `${tam}px ${familia}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const g = c.createLinearGradient(0, y - tam * 0.8, 0, y);
  g.addColorStop(0, '#fff'); g.addColorStop(0.45, '#fff'); g.addColorStop(1, '#ffc9c2');
  c.fillStyle = relleno ? g : 'transparent'; c.strokeStyle = '#fff'; c.lineWidth = relleno ? 0 : 4;
  c.fillText(linea, x, y); if (!relleno) c.strokeText(linea, x, y);
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = c.createPattern(motas(), 'repeat'); c.setTransform(1, 0, 0, 1, 0, 0); c.fillRect(0, 0, capa.width, capa.height);
  ctx.save();
  ctx.shadowColor = 'rgba(255,120,110,.55)'; ctx.shadowBlur = 22;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(capa, 0, 0);
  ctx.restore();
}

/**
 * Dibuja la lámina en `canvas`. datos: { fotoUrl, nombre, precio, cotizar, talla }.
 * El canvas queda en 2160×2700; en pantalla se muestra pequeño con CSS.
 */
export async function dibujarInstagram(canvas, { fotoUrl, nombre, precio, cotizar, talla }) {
  await cargarFuentes();
  const foto = await cargarFoto(fotoUrl);
  canvas.width = ANCHO * ESCALA; canvas.height = ALTO * ESCALA;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);

  // fondo: degradado rojo con brillo arriba a la izquierda y fondo oscuro abajo a la derecha
  let g = ctx.createLinearGradient(ANCHO * 0.2, 0, ANCHO * 0.8, ALTO);
  g.addColorStop(0, ROJO[1]); g.addColorStop(0.4, '#c1121f'); g.addColorStop(0.75, ROJO[2]); g.addColorStop(1, ROJO[3]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO);
  g = ctx.createRadialGradient(ANCHO * 0.2, ALTO * 0.08, 0, ANCHO * 0.2, ALTO * 0.08, ANCHO * 0.9);
  g.addColorStop(0, 'rgba(255,90,104,.85)'); g.addColorStop(1, 'rgba(255,90,104,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO);

  // etiqueta superior
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '700 26px AlexaGrotesk, sans-serif'; ctx.textAlign = 'center';
  ctx.letterSpacing = '12px'; ctx.fillText('NEW IN', ANCHO / 2 + 6, 92); ctx.letterSpacing = '0px';

  // foto con marco blanco, un poco girada
  const cw = 700, ch = 590, cx = ANCHO / 2, cy = 130 + ch / 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate((-2.2 * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#f6f2ea'; ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
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
  const precioTxt = textoPrecio({ precio, cotizar }), tallaTxt = String(talla || '').trim().toUpperCase().slice(0, 14);
  const tamPrecio = precioTxt.length > 8 ? 76 : 108, altNombre = lineas.length * tam * 0.98;
  const alto = altNombre + (precioTxt ? 34 + tamPrecio * 0.82 : 0) + (tallaTxt ? 34 + 64 : 0);
  const zonaTop = 130 + ch + 20, zonaBase = ALTO - 90;
  let y = zonaTop + Math.max(0, (zonaBase - zonaTop - alto) / 2);
  const fam = 'AlexaAnton, Impact, sans-serif';
  for (const l of lineas) { y += tam * 0.98; letras(ctx, l, ANCHO / 2, y - tam * 0.08, tam, fam); }
  if (precioTxt) { y += 34 + tamPrecio * 0.82; letras(ctx, precioTxt, ANCHO / 2, y, tamPrecio, fam, { relleno: false }); }
  if (tallaTxt) {
    y += 34;
    ctx.font = '700 32px AlexaGrotesk, sans-serif'; ctx.letterSpacing = '6px';
    const t = `TALLA ${tallaTxt}`, w = ctx.measureText(t).width + 76;
    ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.roundRect(ANCHO / 2 - w / 2, y, w, 64, 32); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(t, ANCHO / 2 + 3, y + 34); ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  }
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '700 24px AlexaGrotesk, sans-serif'; ctx.letterSpacing = '8px';
  ctx.fillText('TIENDAS ALEXA · @TIENDASALEXA_', ANCHO / 2 + 4, ALTO - 44); ctx.letterSpacing = '0px';

  // viñeta y grano de película sobre todo
  g = ctx.createRadialGradient(ANCHO / 2, ALTO / 2, ANCHO * 0.45, ANCHO / 2, ALTO / 2, ANCHO * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.4;
  ctx.fillStyle = ctx.createPattern(grano(), 'repeat'); ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

export function nombreArchivo(nombre, id) {
  const base = String(nombre || id || 'producto').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `alexa-${base || 'producto'}-instagram.png`;
}
