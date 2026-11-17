// Genera las páginas de Ropa y Tenis (dama/hombre) a partir de las de Accesorios y agrega sus enlaces al resto de la tienda.
// Es idempotente: correrlo dos veces no duplica nada.   Uso: node herramientas/paginas-categoria.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './comun.mjs';

const P = join(RAIZ, 'public');
const leer = (r) => readFileSync(join(P, r), 'utf8');
const guardar = (r, t) => { mkdirSync(join(P, r, '..'), { recursive: true }); writeFileSync(join(P, r), t); };
const FLECHA = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';

// Colecciones nuevas. ids = códigos de categoría en la base de datos (ver migraciones/0006).
const DEP = {
  ropa: { ruta: '/ropa', nombre: 'Ropa', padre: 'ROPA', lema: 'Prendas para ella y para él.', hijas: [
    { ruta: '/ropa/mujer', id: 'RPM', nombre: 'Ropa para ella', corto: 'Para ella', alt: 'Jeans negros de la colección', foto: 'ropa-dama.webp', texto: 'Jeans, pantalones y más.' },
    { ruta: '/ropa/hombre', id: 'RPH', nombre: 'Ropa para él', corto: 'Para él', alt: 'Camiseta de la colección', foto: 'ropa-hombre.webp', texto: 'Camisetas, pantalones y más.' } ] },
  tenis: { ruta: '/tenis', nombre: 'Tenis', padre: 'CALZADO', lema: 'Comodidad y estilo para cada paso.', hijas: [
    { ruta: '/tenis/mujer', id: 'CMM', nombre: 'Tenis para ella', corto: 'Para ella', alt: 'Tenis de la colección para ella', foto: 'tenis-dama.webp', texto: 'Tenis ligeros y cómodos.' },
    { ruta: '/tenis/hombre', id: 'CHM', nombre: 'Tenis para él', corto: 'Para él', alt: 'Tenis de la colección para él', foto: 'tenis-hombre.webp', texto: 'Tenis para todos los días.' } ] },
};
const DESC = (n) => `${n} en Choluteca, Honduras. Mira precios y fotos en Tiendas Alexa y haz tu pedido por WhatsApp.`;
const URL = 'https://alexashop.cc';

function ajustarMeta(t, { ruta, titulo, desc }) {
  return t
    .replace(/<title>.*?<\/title>/, `<title>${titulo} | ALEXA</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${desc}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${titulo} | ALEXA`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${desc}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${titulo} | ALEXA`)
    .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${desc}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${URL}${ruta}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${URL}${ruta}`);
}

const OPCIONES = (d) => `<option value="${d.hijas.map((h) => h.id).join(',')}" >${d.nombre}</option>${d.hijas.map((h) => `<option value="${h.id}" >  ${h.nombre}</option>`).join('')}`;

// 1) Páginas de colección (hojas): copia de Carteras con otro nombre y otro grupo.
const hoja = leer('accesorios/carteras.html');
for (const d of Object.values(DEP)) for (const h of d.hijas) {
  let t = ajustarMeta(hoja, { ruta: h.ruta, titulo: h.nombre, desc: DESC(h.nombre) });
  t = t.replace('<body data-groups="CTA">', `<body data-groups="${h.id}">`)
    .replace('<span aria-current="page">Carteras</span>', `<span aria-current="page">${h.nombre}</span>`)
    .replace('<h1>Carteras</h1>', `<h1>${h.nombre}</h1>`)
    .replace('<option value="CTA" selected>Carteras</option>', '<option value="CTA" >Carteras</option>')
    .replace(/<option value="JYA,RLA,CTA"/, `${Object.values(DEP).map(OPCIONES).join('')}<option value="JYA,RLA,CTA"`)
    .replace(new RegExp(`<option value="${h.id}" >`), `<option value="${h.id}" selected>`);
  guardar(`${h.ruta.slice(1)}.html`, t);
}

// 2) Páginas índice (/ropa y /tenis): copia de Accesorios con dos tarjetas.
const indice = leer('accesorios.html');
for (const d of Object.values(DEP)) {
  const tarjetas = d.hijas.map((h) => `<a class="collection" href="${h.ruta}"><div class="collection-photo "><img src="/assets/images/${h.foto}" alt="${h.alt}" width="400" height="500" loading="lazy" decoding="async"></div><div class="collection-title"><span>${h.corto}</span>${FLECHA}</div><p class="collection-description">${h.texto}</p></a>`).join('');
  let t = ajustarMeta(indice, { ruta: d.ruta, titulo: d.nombre, desc: DESC(d.nombre) });
  t = t.replace(/El toque que lo cambia todo\./g, d.nombre)
    .replace('Pequeños favoritos para acompañar tu estilo o sorprender a alguien.', d.lema)
    .replace(/<div class="collection-grid">.*?<\/section>/s, `<div class="collection-grid">${tarjetas}</div></section>`);
  guardar(`${d.ruta.slice(1)}.html`, t);
}

// 3) Enlaces nuevos en la navegación de colecciones y en el selector de todas las páginas de catálogo.
function recorrer(dir) {
  return readdirSync(dir).flatMap((n) => { const r = join(dir, n); return statSync(r).isDirectory() && !/admin|assets/.test(n) ? recorrer(r) : r.endsWith('.html') ? [r] : []; });
}
for (const ruta of recorrer(P)) {
  let t = readFileSync(ruta, 'utf8');
  if (!t.includes('<nav class="category-links"')) continue;
  let n = t;
  if (!n.includes('href="/ropa"')) n = n.replace(/<a href="\/accesorios" class="([^"]*)">Accesorios<\/a>/, (m, c) => `<a href="/ropa" class="">Ropa</a><a href="/tenis" class="">Tenis</a>${m}`);
  if (!n.includes('value="RPM,RPH"')) n = n.replace('<option value="JYA,RLA,CTA"', `${Object.values(DEP).map(OPCIONES).join('')}<option value="JYA,RLA,CTA"`);
  if (n !== t) writeFileSync(ruta, n);
}

// 4) Portada: dos filas nuevas en «Tu próximo favorito, por aquí.» y renumeradas.
{
  let t = leer('index.html');
  if (!t.includes('href="/ropa"')) {
    const fila = (h, i, nom, foto, alt) => `<a class="department-row" href="${h}"><span class="department-index">${i}</span><h3>${nom}</h3><div class="department-image"><img src="/assets/images/${foto}" alt="${alt}" width="400" height="400" loading="lazy"></div><span class="round-arrow">${FLECHA}</span></a>`;
    t = t.replace(/(<a class="department-row" href="\/accesorios"><span class="department-index">)02/, `${fila('/ropa', '02', 'Ropa', 'ropa-dama.webp', 'Ropa de la colección Alexa')}${fila('/tenis', '03', 'Tenis', 'tenis-hombre.webp', 'Tenis de la colección Alexa')}$104`)
      .replace(/(<a class="department-row" href="\/regalos"><span class="department-index">)03/, '$105');
    writeFileSync(join(P, 'index.html'), t);
  }
}
console.log('Páginas de Ropa y Tenis listas.');
