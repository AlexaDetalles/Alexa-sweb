import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerTallas } from '../worker/tallas.js';

// Cada caso sale de una descripción real del catálogo.
const casos = [
  ['Talla 5.5', '5.5'],
  ['Talla L', 'L'],
  ['talla m', 'M'],
  ['Talla Xl', 'XL'],
  ['Talla: M', 'M'],
  ['TALLA: 8', '8'],
  ['talla: 8', '8'],
  ['Talla 12 y 8', '8 · 12'],
  ['Talla S y XXL', 'S · XXL'],
  ['Talla XS y S', 'XS · S'],
  ['Tenis de Basquetbol Talla 11 y 12', '11 · 12'],
  ['Talla 11/12', '11 · 12'],
  ['tallas 7, 7.5 y 8', '7 · 7.5 · 8'],
  ['Tres tallas disponibles, 9.5, 9 y 7', '7 · 9 · 9.5'],
  ['Talla, 8.5, 7.5', '7.5 · 8.5'],
  ['Talla 4, 3', '3 · 4'],
  ['Talla 3, 13', '3 · 13'],
  ['Talla 7,5', '7.5'],
  ['Talla 7.5, 8', '7.5 · 8'],
  ['Talla 28-30 y 36-38', '28-30 · 36-38'],
  ['Color Jean Talla 5 y 6', '5 · 6'],
  ['Talla 16 NIÑO', '16'],
  ['Talla 4 SKINNY JEAN', '4'],
  ['Talla 14 Skinny', '14'],
  ['Talla 8 us', '8'],
  ['Talla 16M', '16M'],
  ['Skinny Jeans\nTalla 26 de Niño', '26'],
  ['Talla M\nDetalles Floreados Blancos', 'M'],
  ['Talla 2\nSkinny Jeans', '2'],
  ['Unitalla', 'ÚNICA'],
  ['unitalla', 'ÚNICA'],
];
test('lee las tallas de las descripciones reales', () => {
  for (const [texto, esperado] of casos) assert.equal(leerTallas(texto), esperado, JSON.stringify(texto));
});

test('no adivina cuando no hay talla o no tiene sentido', () => {
  for (const texto of ['', null, undefined, 'Perfume 100 ml', 'Cartera de cuero negra', 'Talla:28-330', 'Talla 200', 'Talla grande', 'Talla 40-30']) assert.equal(leerTallas(texto), '', JSON.stringify(texto));
});

test('el resultado cabe en el campo Talla (20 caracteres)', () => {
  const r = leerTallas('Tallas 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10');
  assert.ok(r.length > 0 && r.length <= 20, r);
  assert.ok(r.startsWith('5 · 5.5 · 6'));
});
