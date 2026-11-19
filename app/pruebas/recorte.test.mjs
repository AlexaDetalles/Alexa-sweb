import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizarAlfa, ESTILOS, FONDOS } from '../public/admin/instagram.js';

// Una miniatura RGBA de w×h donde `opaco(x, y)` dice qué píxeles tienen color.
const miniatura = (w, h, opaco) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = opaco(x, y) ? 255 : 0; return d; };

test('una foto normal (opaca) no se toma por recorte', () => {
  const r = analizarAlfa(miniatura(100, 100, () => true), 100, 100);
  assert.equal(r.recorte, false);
  assert.deepEqual(r.caja, { x: 0, y: 0, w: 100, h: 100 });
});

test('un recorte: transparente alrededor, con la caja justa del objeto', () => {
  const r = analizarAlfa(miniatura(100, 100, (x, y) => x >= 30 && x < 70 && y >= 20 && y < 90), 100, 100);
  assert.equal(r.recorte, true);
  assert.deepEqual(r.caja, { x: 30, y: 20, w: 40, h: 70 });
});

test('esquinas redondeadas o un poquito de transparencia no cuentan como recorte', () => {
  const r = analizarAlfa(miniatura(100, 100, (x, y) => !((x < 3 && y < 3) || (x > 96 && y < 3))), 100, 100);
  assert.equal(r.recorte, false);
});

test('una imagen totalmente transparente no rompe nada', () => {
  const r = analizarAlfa(miniatura(40, 40, () => false), 40, 40);
  assert.equal(r.recorte, false);
  assert.deepEqual(r.caja, { x: 0, y: 0, w: 40, h: 40 });
});

test('estilos y fondos disponibles', () => {
  assert.deepEqual(ESTILOS.map((e) => e.id), ['auto', 'marco', 'recorte']);
  assert.deepEqual(FONDOS.map((f) => f.id), ['liso', 'concreto', 'madera', 'tela']);
});
