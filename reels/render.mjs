// Uso:  node render.mjs                 → renderiza los 5 reels en out/
//       node render.mjs 4-Anuncio       → solo uno
//       node render.mjs 6-ProximoDrop --props=sin-voz.json --salida=6-ProximoDrop-sin-voz   (otro nombre de archivo)
//       node render.mjs 4-Anuncio --foto=60   → un cuadro suelto (PNG) para revisar el diseño
//       node render.mjs 6-ProximoDrop --props=props-drop.json   (fecha, hora, incentivo y voz:false para la versión sin voz)
//       node render.mjs 4-Anuncio --props=props.json   → cambia fecha, textos o piezas sin tocar el código
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const ids = args.filter((a) => !a.startsWith('--'));
const todas = ['1-AlgoViene', '2-Closet', '3-CuentaRegresiva', '4-Anuncio', '5-Apertura', '6-ProximoDrop', '6-ProximoDrop-16x9'];
const props = opt('props') ? JSON.parse(readFileSync(path.resolve(opt('props')), 'utf8')) : undefined;
const navegador = ['/opt/pw-browsers/chromium'].find((p) => existsSync(p)); // si existe, evita descargar otro Chrome
const comun = {...(navegador ? {browserExecutable: navegador} : {}), chromiumOptions: {gl: 'angle'}};

mkdirSync(path.join(aqui, 'out'), {recursive: true});
const sitio = await bundle({entryPoint: path.join(aqui, 'src/index.ts')});
for (const id of ids.length ? ids : todas) {
  const comp = await selectComposition({serveUrl: sitio, id, inputProps: props, ...comun});
  if (opt('foto')) {
    const salida = path.join(aqui, 'out', `${id}-f${opt('foto')}.png`);
    await renderStill({composition: comp, serveUrl: sitio, output: salida, frame: Number(opt('foto')), inputProps: props, ...comun});
    console.log('cuadro', salida);
    continue;
  }
  const salida = path.join(aqui, 'out', `${opt('salida') || id}.mp4`);
  await renderMedia({composition: comp, serveUrl: sitio, codec: 'h264', crf: 18, pixelFormat: 'yuv420p', outputLocation: salida, inputProps: props, concurrency: 2, ...comun,
    onProgress: ({progress}) => process.stdout.write(`\r${id} ${(progress * 100).toFixed(0)}%   `)});
  console.log(`\nlisto ${salida}`);
}
