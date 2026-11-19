import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mascaraFondo, aplicarMascara, bordeClaro, bordePuro } from '../public/admin/instagram.js';

// Imagen RGBA de w×h, toda blanca; `pintar(x, y)` devuelve [r, g, b] para cambiar un píxel (o null para dejarlo).
const imagen = (w, h, pintar) => {
  const d = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = pintar(x, y); if (c) { const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; } }
  return d;
};
const NEGRO = [20, 20, 22], BLANCO = [255, 255, 255];
const dentro = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
const quitado = (m, w, x, y) => m.mask[y * w + x] === 1;

test('fondo blanco: se quita lo de afuera y el producto se queda', () => {
  const w = 300, h = 300, d = imagen(w, h, (x, y) => (dentro(x, y, 40, 40, 260, 260) ? NEGRO : null));
  const m = mascaraFondo(d, w, h);
  assert.equal(m.hay, true);
  assert.equal(quitado(m, w, 5, 5), true);
  assert.equal(quitado(m, w, 150, 150), false);
  assert.ok(m.fraccion > 0.3 && m.fraccion < 0.5, String(m.fraccion));
});

test('un estampado blanco en medio del producto NO se quita', () => {
  const w = 300, h = 300, d = imagen(w, h, (x, y) => (dentro(x, y, 40, 40, 260, 260) ? (dentro(x, y, 100, 100, 200, 200) ? BLANCO : NEGRO) : null));
  const m = mascaraFondo(d, w, h);
  assert.equal(quitado(m, w, 150, 150), false, 'el estampado se queda');
});

test('un hueco blanco cerrado pegado al contorno (lazo de una correa) sí se quita', () => {
  const w = 300, h = 300, d = imagen(w, h, (x, y) => (dentro(x, y, 40, 40, 260, 260) ? (dentro(x, y, 52, 120, 92, 180) ? BLANCO : NEGRO) : null));
  const m = mascaraFondo(d, w, h);
  assert.equal(quitado(m, w, 70, 150), true, 'el hueco se quita');
  assert.equal(quitado(m, w, 150, 150), false, 'el producto se queda');
});

test('una rayita blanca fina cerca del borde (como una costura o una letra) se queda', () => {
  const w = 300, h = 300, d = imagen(w, h, (x, y) => (dentro(x, y, 40, 40, 260, 260) ? (dentro(x, y, 55, 60, 58, 240) ? BLANCO : NEGRO) : null));
  const m = mascaraFondo(d, w, h);
  assert.equal(quitado(m, w, 56, 150), false);
});

test('fondo gris claro parejo también se quita; una escena oscura o de color no se toca', () => {
  const gris = imagen(200, 200, (x, y) => (dentro(x, y, 50, 50, 150, 150) ? NEGRO : [232, 232, 234]));
  assert.equal(mascaraFondo(gris, 200, 200).hay, true);
  const oscura = imagen(200, 200, (x, y) => (dentro(x, y, 50, 50, 150, 150) ? [240, 240, 240] : [30, 30, 40]));
  assert.equal(mascaraFondo(oscura, 200, 200).hay, false);
  const colorida = imagen(200, 200, (x, y) => (dentro(x, y, 50, 50, 150, 150) ? NEGRO : [200, 60, 60]));
  assert.equal(mascaraFondo(colorida, 200, 200).hay, false);
});

test('un borde que no es parejo (producto que toca casi todo el borde) no se adivina', () => {
  const w = 200, h = 200, d = imagen(w, h, (x, y) => (dentro(x, y, 0, 0, 200, 150) ? NEGRO : null));
  assert.equal(mascaraFondo(d, w, h).hay, false);
});

test('aplicarMascara: transparencia afuera, opaco adentro y la caja justa', () => {
  const w = 300, h = 300, d = imagen(w, h, (x, y) => (dentro(x, y, 40, 60, 260, 240) ? NEGRO : null));
  const m = mascaraFondo(d, w, h), r = aplicarMascara(d, m.mask, w, h, m.fondo);
  assert.equal(r.alfa[5 * w + 5], 0);
  assert.equal(r.alfa[150 * w + 150], 255);
  assert.ok(Math.abs(r.caja.x - 40) <= 2 && Math.abs(r.caja.y - 60) <= 2 && Math.abs(r.caja.w - 220) <= 4 && Math.abs(r.caja.h - 180) <= 4, JSON.stringify(r.caja));
});

test('agresivo (Sin fondo a mano): quita también un hueco más lejos del contorno; Automático lo deja', () => {
  // hueco blanco a ~36 px del contorno (el límite prudente es 18 px y el agresivo 45 px), dentro de una correa gruesa
  const w = 300, h = 300, d = imagen(w, h, (x, y) => (dentro(x, y, 20, 20, 280, 280) ? (dentro(x, y, 56, 110, 116, 190) ? BLANCO : NEGRO) : null));
  assert.equal(quitado(mascaraFondo(d, w, h), w, 86, 150), false, 'prudente: se queda');
  assert.equal(quitado(mascaraFondo(d, w, h, 34, true), w, 86, 150), true, 'agresivo: se quita');
});

test('bordeClaro: un producto oscuro casi no tiene contorno claro; uno blanco/pastel sí (y Automático no lo recorta)', () => {
  const w = 300, h = 300;
  const oscuro = imagen(w, h, (x, y) => (dentro(x, y, 40, 40, 260, 260) ? NEGRO : null));
  const mo = mascaraFondo(oscuro, w, h);
  assert.ok(bordeClaro(oscuro, mo.mask, w, h) < 0.02);
  // una caja casi blanca (240) sobre fondo blanco: el fondo se confunde con el producto
  const claro = imagen(w, h, (x, y) => (dentro(x, y, 40, 40, 260, 260) ? [236, 236, 236] : null));
  const mc = mascaraFondo(claro, w, h);
  assert.ok(!mc.hay || bordeClaro(claro, mc.mask, w, h) > 0.5 || mc.fraccion > 0.9);
  // una caja rosa pastel: contorno claro
  const pastel = imagen(w, h, (x, y) => (dentro(x, y, 40, 40, 260, 260) ? [250, 214, 220] : null));
  const mp = mascaraFondo(pastel, w, h);
  assert.ok(mp.hay && bordeClaro(pastel, mp.mask, w, h) > 0.15, 'el pastel pasa del límite de Automático (0.15)');
});

test('bordePuro: solo el blanco de catálogo (255 parejo) cuenta como puro', () => {
  const w = 200, h = 200;
  assert.equal(bordePuro(imagen(w, h, (x, y) => (dentro(x, y, 50, 50, 150, 150) ? NEGRO : null)), w, h), true);
  assert.equal(bordePuro(imagen(w, h, (x, y) => (dentro(x, y, 50, 50, 150, 150) ? NEGRO : [232, 232, 234])), w, h), false, 'gris claro: no es puro');
  assert.equal(bordePuro(imagen(w, h, (x, y) => (dentro(x, y, 50, 50, 150, 150) ? NEGRO : [255, 255, 255])), w, h), true);
  assert.equal(bordePuro(imagen(w, h, (x, y) => (dentro(x, y, 50, 50, 150, 150) ? NEGRO : [200, 60, 60])), w, h), false);
});

test('producto blanco (suela de un tenis): con tolerancia baja se conserva; con la normal se come', () => {
  const w = 300, h = 300, SUELA = [240, 238, 244]; // blanco con sombreado: a unos 25 de distancia del 255 del fondo
  const d = imagen(w, h, (x, y) => (dentro(x, y, 60, 60, 240, 160) ? NEGRO : dentro(x, y, 50, 160, 250, 215) ? SUELA : null));
  const fino = mascaraFondo(d, w, h, 8), normal = mascaraFondo(d, w, h, 34);
  assert.equal(quitado(fino, w, 150, 190), false, 'tolerancia baja: la suela se queda');
  assert.equal(quitado(fino, w, 10, 10), true, 'y el fondo se va');
  assert.equal(quitado(normal, w, 150, 190), true, 'tolerancia normal: la suela se come (por eso se usa la baja en fondos puros)');
});

test('fondo puro en Automático no toca el blanco puro de adentro; el modo manual sí quita los huecos', () => {
  const w = 300, h = 300, d = imagen(w, h, (x, y) => (dentro(x, y, 40, 40, 260, 260) ? (dentro(x, y, 52, 120, 92, 180) ? BLANCO : NEGRO) : null));
  assert.equal(quitado(mascaraFondo(d, w, h, 8), w, 70, 150), false, 'Automático: es blanco del producto');
  assert.equal(quitado(mascaraFondo(d, w, h, 8, true), w, 70, 150), true, 'manual: se quita (lazo de una correa)');
});
