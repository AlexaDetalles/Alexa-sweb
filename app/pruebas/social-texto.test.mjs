import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarDescripcion, hashtag, precioEnRedes, aISO } from '../public/admin/social.js';

test('descripción con el formato de la tienda', () => {
  assert.equal(armarDescripcion({ nombre: 'Valentino Born in Roma', precio: '4400', categoriaId: 'PHP' }), 'Valentino Born in Roma\nPrecio: 4400Lps\nAlexashop.cc\n#perfumes');
  assert.equal(armarDescripcion({ nombre: ' Cartera X ', precio: 450.5, categoriaId: 'CTA' }), 'Cartera X\nPrecio: 450.5Lps\nAlexashop.cc\n#carteras');
  assert.equal(armarDescripcion({ nombre: 'Regalo', precio: '', cotizar: true, categoriaId: 'PAG' }), 'Regalo\nPrecio: por consultar\nAlexashop.cc\n#regalos');
  assert.equal(armarDescripcion({ nombre: 'Sin precio', precio: '', categoriaId: 'RPM' }), 'Sin precio\nAlexashop.cc\n#ropa');
});
test('hashtag: de la categoría, o del nombre si es una categoría nueva', () => {
  assert.equal(hashtag('CMM'), 'tenis');
  assert.equal(hashtag('GORRAS', 'Gorras y sombreros'), 'gorrasysombreros');
  assert.equal(hashtag('X', 'Ñandú Café'), 'nanducafe');
  assert.equal(hashtag('X', ''), 'alexashop');
});
test('precio y fecha', () => {
  assert.equal(precioEnRedes('4400'), '4400Lps');
  assert.equal(precioEnRedes(''), '');
  assert.equal(aISO('2026-11-24T13:00'), new Date('2026-11-24T13:00').toISOString());
  assert.equal(aISO(''), '');
});
