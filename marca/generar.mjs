// Genera todo el kit de identidad de Tiendas Alexa en marca/salida/ (PNG).
// Uso: node marca/generar.mjs      (necesita Playwright; en este entorno ya está instalado)
// Fuentes y colores salen de la web (app/public/assets), así que el kit y el sitio no se separan.
import {createRequire} from 'node:module';
import {readFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const aqui = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(aqui, '..', 'app', 'public', 'assets');
const salida = path.join(aqui, 'salida');
mkdirSync(salida, {recursive: true});

const b64 = (f, mime) => `data:${mime};base64,${readFileSync(path.join(web, f)).toString('base64')}`;
const fuentes = `
@font-face{font-family:Corm;font-weight:300 700;font-style:normal;src:url(${b64('fonts/cormorant-garamond-latin-wght-normal.woff2', 'font/woff2')})}
@font-face{font-family:Corm;font-weight:300 700;font-style:italic;src:url(${b64('fonts/cormorant-garamond-latin-wght-italic.woff2', 'font/woff2')})}
@font-face{font-family:Space;font-weight:400;src:url(${b64('fonts/space-grotesk-400.ttf', 'font/ttf')})}`;

const svgDe = (f) => readFileSync(path.join(web, 'images', f), 'utf8');
const tacon = svgDe('logo-mark.svg');      // zapato crema + línea dorada: para fondos oscuros
const taconVino = svgDe('logo-mark-vino.svg'); // zapato vino: para fondos claros
const url = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const C = {night: '#1b1114', wine: '#3b1220', wineLight: '#782f3a', paper: '#f7f4ee', cream: '#f7ead7', gold: '#d2a851', goldSoft: '#efdcab', ink: '#27211f'};
const base = `*{margin:0;box-sizing:border-box}html,body{width:100%;height:100%}${fuentes}`;

const fondoOscuro = `background:radial-gradient(circle at 50% 38%, #4a1626 0%, ${C.wine} 38%, ${C.night} 100%)`;

// ---- piezas ----
const avatar = (claro) => `<style>${base}
body{${claro ? `background:${C.paper}` : fondoOscuro};display:grid;place-items:center;position:relative}
.aro{position:absolute;inset:44px;border-radius:50%;border:5px solid ${C.gold};opacity:${claro ? 0.8 : 0.9}}
img{height:560px;width:auto;position:relative;transform:translateX(-14px)}
</style><div class="aro"></div><img src="${url(claro ? taconVino : tacon)}">`;

const vertical = (claro) => `<style>${base}
body{background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px}
img{height:520px}
.n{font:500 360px/0.9 Corm;letter-spacing:.06em;color:${claro ? C.cream : C.wine}}
.s{font:400 62px Space;letter-spacing:.34em;text-transform:uppercase;color:${claro ? C.goldSoft : C.wineLight}}
</style><img src="${url(claro ? tacon : taconVino)}"><div class="n">Alexa</div><div class="s">Detalles &amp; Obsequios</div>`;

const horizontal = (claro) => `<style>${base}
body{background:transparent;display:flex;align-items:center;justify-content:center;gap:90px}
img{height:520px}
.l{width:6px;height:460px;background:${C.gold}}
.n{font:500 400px/0.85 Corm;letter-spacing:.05em;color:${claro ? C.cream : C.wine}}
.s{font:400 62px Space;letter-spacing:.34em;text-transform:uppercase;color:${claro ? C.goldSoft : C.wineLight};margin-top:26px}
</style><img src="${url(claro ? tacon : taconVino)}"><div class="l"></div><div><div class="n">Alexa</div><div class="s">Detalles &amp; Obsequios</div></div>`;

const portada = `<style>${base}
body{${fondoOscuro};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;position:relative;overflow:hidden}
.f{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,${C.gold},transparent);opacity:.5}
.f.a{top:64px}.f.b{bottom:64px}
.fila{display:flex;align-items:center;gap:34px}
img{height:190px}
.n{font:500 150px/0.9 Corm;letter-spacing:.06em;color:${C.cream}}
.s{font:400 23px Space;letter-spacing:.34em;text-transform:uppercase;color:${C.goldSoft};margin-top:10px}
.w{font:italic 400 40px Corm;color:${C.gold};margin-top:6px}
</style><div class="f a"></div><div class="f b"></div>
<div class="fila"><img src="${url(tacon)}"><div><div class="n">Alexa</div><div class="s">Detalles &amp; Obsequios</div></div></div>
<div class="w">Choluteca, Honduras · alexashop.cc</div>`;

const iconos = {
  closet: '<path d="M12 7a2 2 0 1 0-2-2"/><path d="M12 7v2.2l8.2 5.6a1.4 1.4 0 0 1-.8 2.6H4.6a1.4 1.4 0 0 1-.8-2.6L12 9.2"/>',
  disponible: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  clientes: '<path d="M12 20s-7.5-4.6-7.5-10A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"/>',
  comprar: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  perfumes: '<rect x="8" y="10" width="8" height="11" rx="1.5"/><path d="M10 10V7h4v3"/><path d="M10.5 4h3v3h-3z"/>',
  regalos: '<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M3 7h18v3H3z"/><path d="M12 7v13"/><path d="M12 7s-3-.4-3-2.2A1.8 1.8 0 0 1 12 4c1.3-1.2 3-.2 3 1.2C15 6.6 12 7 12 7z"/>',
};
const destacado = (ico) => `<style>${base}
body{${fondoOscuro};display:grid;place-items:center;position:relative}
.aro{position:absolute;width:760px;height:760px;border-radius:50%;border:5px solid ${C.gold};opacity:.85}
svg{width:360px;height:360px;fill:none;stroke:${C.gold};stroke-width:1;stroke-linecap:round;stroke-linejoin:round}
</style><div class="aro"></div><svg viewBox="0 0 24 24">${iconos[ico]}</svg>`;

const piezas = [
  ['avatar-oscuro', 1080, 1080, avatar(false), false],
  ['avatar-claro', 1080, 1080, avatar(true), false],
  ['logo-vertical-para-fondo-oscuro', 1600, 1500, vertical(true), true],
  ['logo-vertical-para-fondo-claro', 1600, 1500, vertical(false), true],
  ['logo-horizontal-para-fondo-oscuro', 2600, 700, horizontal(true), true],
  ['logo-horizontal-para-fondo-claro', 2600, 700, horizontal(false), true],
  ['portada-facebook', 1640, 624, portada, false],
  ...['closet', 'disponible', 'clientes', 'comprar', 'perfumes', 'regalos'].map((i) => [`destacado-${i}`, 1080, 1920, destacado(i), false]),
];

const nav = await chromium.launch();
for (const [nombre, w, h, html, transparente] of piezas) {
  const pag = await nav.newPage({viewport: {width: w, height: h}, deviceScaleFactor: 1});
  await pag.setContent(html, {waitUntil: 'load'});
  await pag.evaluate(() => document.fonts.ready);
  await pag.screenshot({path: path.join(salida, `${nombre}.png`), omitBackground: transparente});
  await pag.close();
  console.log('listo', nombre);
}
await nav.close();
