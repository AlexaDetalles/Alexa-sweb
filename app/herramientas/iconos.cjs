// Regenera los íconos de la tienda (PNG, ICO, Apple, manifest) desde public/assets/images/favicon.svg.
// Uso: node herramientas/iconos.cjs      (necesita Playwright instalado en tu computadora)
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const raiz = path.resolve(__dirname, '../public');
const svg = fs.readFileSync(path.join(raiz, 'assets/images/favicon.svg'), 'utf8');

(async () => {
  const browser = await chromium.launch();
  const png = async (tam, margen = 0) => {
    const page = await browser.newPage({ viewport: { width: tam, height: tam } });
    await page.setContent(`<body style="margin:0;background:transparent"><div style="width:${tam}px;height:${tam}px;padding:${margen}px;box-sizing:border-box">${svg.replace('<svg ', `<svg width="${tam - margen * 2}" height="${tam - margen * 2}" `)}</div></body>`);
    const buf = await page.screenshot({ omitBackground: true, type: 'png' });
    await page.close();
    return buf;
  };
  const guardar = async (archivo, tam, margen) => fs.writeFileSync(path.join(raiz, archivo), await png(tam, margen));
  await guardar('assets/images/icon-192.png', 192);
  await guardar('assets/images/icon-512.png', 512);
  // Apple no recorta con transparencia: cuadrado completo con fondo propio (la esquina redondeada la pone iOS).
  const apple = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await apple.setContent(`<body style="margin:0;background:#7a2f3b">${svg.replace('<svg ', '<svg width="180" height="180" ').replace('rx="15"', 'rx="0"')}</body>`);
  fs.writeFileSync(path.join(raiz, 'assets/images/apple-touch-icon.png'), await apple.screenshot({ type: 'png' }));
  // favicon.ico con PNG de 16, 32 y 48 px
  const tams = [16, 32, 48], imgs = [];
  for (const t of tams) imgs.push(await png(t));
  const cab = Buffer.alloc(6 + 16 * tams.length); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(tams.length, 4);
  let offset = cab.length;
  imgs.forEach((b, i) => { const o = 6 + 16 * i; cab[o] = tams[i]; cab[o + 1] = tams[i]; cab.writeUInt16LE(1, o + 4); cab.writeUInt16LE(32, o + 6); cab.writeUInt32LE(b.length, o + 8); cab.writeUInt32LE(offset, o + 12); offset += b.length; });
  fs.writeFileSync(path.join(raiz, 'favicon.ico'), Buffer.concat([cab, ...imgs]));
  await browser.close();
  console.log('Íconos listos.');
})();
