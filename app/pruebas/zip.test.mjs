import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearZip, crc32, nombreSeguro } from '../public/admin/zip.js';

test('crc32 de referencia', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('nombres seguros', () => {
  assert.equal(nombreSeguro('a/b\\c:d*e?.jpg'), 'a-b-c-d-e-.jpg');
  assert.equal(nombreSeguro('...oculto.jpg'), 'oculto.jpg');
  assert.equal(nombreSeguro(''), 'archivo');
});

test('el zip es válido: lo abre un descompresor real, con nombres con acentos y repetidos', async () => {
  const grande = new Uint8Array(300000).map((_, i) => (i * 7) % 251);
  const zip = await crearZip([
    { nombre: 'RPM-01-camiseta-negra.jpg', datos: new Blob([grande]) },
    { nombre: 'Zapatilla Ñandú.jpg', datos: new TextEncoder().encode('hola ñ') },
    { nombre: 'Zapatilla Ñandú.jpg', datos: new TextEncoder().encode('segunda') },
    { nombre: 'vacío.txt', datos: new Uint8Array(0) },
  ], new Date(2026, 10, 17, 21, 30, 10));
  const dir = mkdtempSync(join(tmpdir(), 'zip-prueba-'));
  const ruta = join(dir, 'prueba.zip');
  writeFileSync(ruta, new Uint8Array(await zip.arrayBuffer()));
  const py = `import zipfile,sys,json
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print(json.dumps({'nombres':z.namelist(),'tam':[z.getinfo(n).file_size for n in z.namelist()],'hola':z.read('Zapatilla Ñandú.jpg').decode(),'segunda':z.read('Zapatilla Ñandú (2).jpg').decode(),'fecha':list(z.getinfo('vacío.txt').date_time)}))`;
  const r = JSON.parse(execFileSync('python3', ['-I', '-c', py, ruta]).toString());
  assert.deepEqual(r.nombres, ['RPM-01-camiseta-negra.jpg', 'Zapatilla Ñandú.jpg', 'Zapatilla Ñandú (2).jpg', 'vacío.txt']);
  assert.deepEqual(r.tam, [300000, 7, 7, 0]);
  assert.equal(r.hola, 'hola ñ'); assert.equal(r.segunda, 'segunda');
  assert.deepEqual(r.fecha, [2026, 11, 17, 21, 30, 10]);
  const dentro = readFileSync(ruta); // contenido idéntico byte a byte
  assert.ok(Buffer.from(grande).equals(dentro.subarray(dentro.indexOf(Buffer.from(grande.subarray(0, 64))), dentro.indexOf(Buffer.from(grande.subarray(0, 64))) + 300000)));
});
