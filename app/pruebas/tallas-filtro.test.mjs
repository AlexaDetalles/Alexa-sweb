import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partirTallas, coincideTalla, listaTallas, quitarTalla } from '../public/assets/tallas.mjs';
import { sanitizeCart, cartLines, cartMessage, lineProblem } from '../public/assets/core.mjs';

test('partirTallas: lo guardado y lo escrito a mano', () => {
  assert.deepEqual(partirTallas('11 · 12'), ['11', '12']);
  assert.deepEqual(partirTallas('7 · 9 · 9.5'), ['7', '9', '9.5']);
  assert.deepEqual(partirTallas('9.5, 9 y 7'), ['9.5', '9', '7']);
  assert.deepEqual(partirTallas('11/12'), ['11', '12']);
  assert.deepEqual(partirTallas('xs · s'), ['XS', 'S']);
  assert.deepEqual(partirTallas(''), []);
  assert.deepEqual(partirTallas(null), []);
});

test('coincideTalla: un par con varias tallas aparece al buscar cualquiera de ellas', () => {
  assert.equal(coincideTalla('11 · 12', '12'), true);
  assert.equal(coincideTalla('11 · 12', '11'), true);
  assert.equal(coincideTalla('11 · 12', '9'), false);
  assert.equal(coincideTalla('7 · 9 · 9.5', '9'), true);
  assert.equal(coincideTalla('7 · 9 · 9.5', '9.5'), true);
  assert.equal(coincideTalla('9.5', '9'), false, '9 no es 9.5');
  assert.equal(coincideTalla('28-30 · 36-38', '29'), true, 'un número dentro de un rango');
  assert.equal(coincideTalla('28-30 · 36-38', '31'), false);
  assert.equal(coincideTalla('S · XXL', 'xxl'), true);
  assert.equal(coincideTalla('', '9'), false, 'sin talla no sale al filtrar por talla');
  assert.equal(coincideTalla('', ''), true, 'sin filtro sale todo');
});

test('listaTallas: números primero, luego letras en orden, sin repetir ni rangos', () => {
  assert.deepEqual(listaTallas(['11 · 12', '7 · 9 · 9.5', 'M', 'S · XXL', '9', '28-30 · 36-38', 'ÚNICA', '']), ['7', '9', '9.5', '11', '12', 'S', 'M', 'XXL', 'ÚNICA']);
});

test('quitarTalla: la que se vendió sale de la lista', () => {
  assert.equal(quitarTalla('7 · 9 · 9.5', '9'), '7 · 9.5');
  assert.equal(quitarTalla('11 · 12', '12'), '11');
  assert.equal(quitarTalla('11', '11'), '');
  assert.equal(quitarTalla('11 · 12', '9'), null);
});

const par = { id: 'CHM-08', name: 'Nike Giannis', cents: 150000, available: true, stock: 2, sizes: ['11', '12'] };
const unica = { id: 'CHM-11', name: 'Tenis Vans', cents: 80000, available: true, stock: 1, sizes: ['8'] };
const sinTalla = { id: 'HP-01', name: 'Perfume', cents: 120000, available: true, stock: 5, sizes: [] };
const todos = [par, unica, sinTalla];

test('bolsa: cada talla elegida es una línea y el mensaje de WhatsApp la nombra', () => {
  const cart = sanitizeCart({ 'CHM-08@11': 1, 'CHM-08@12': 1, 'CHM-11': 1, 'HP-01': 2 });
  assert.equal(Object.keys(cart).length, 4);
  const msg = cartMessage(cart, todos);
  assert.match(msg, /1 × Nike Giannis \[CHM-08\] · talla 11/);
  assert.match(msg, /1 × Nike Giannis \[CHM-08\] · talla 12/);
  assert.match(msg, /1 × Tenis Vans \[CHM-11\] · talla 8/, 'con una sola talla se anota sola');
  assert.doesNotMatch(msg, /Perfume \[HP-01\] · talla/);
  assert.equal(cartLines(cart, todos).length, 4);
});

test('bolsa: sin elegir talla (varias) o con una talla que ya no está, no se puede enviar', () => {
  assert.equal(lineProblem(par, 'CHM-08'), 'falta-talla');
  assert.equal(lineProblem(par, 'CHM-08@9'), 'talla-agotada');
  assert.equal(lineProblem(par, 'CHM-08@11'), '');
  assert.equal(lineProblem(unica, 'CHM-11'), '');
  assert.equal(cartMessage({ 'CHM-08': 1 }, todos), null);
  assert.equal(cartMessage({ 'CHM-08@9': 1 }, todos), null);
});

test('bolsa: claves raras se descartan', () => {
  assert.deepEqual(sanitizeCart({ 'A@B@C': 1, 'A@': 1, '@9': 1, 'A@9 9': 1, 'A@9': 1 }), { 'A@9': 1 });
});
