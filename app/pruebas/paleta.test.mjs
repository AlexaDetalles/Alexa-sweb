import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletaDesdeColor, paletaPorId, esColor, PALETAS } from '../public/admin/instagram.js';

const claves = ['fondo', 'brillo', 'luz', 'texto', 'trazo', 'marco', 'pildora', 'pildoraTexto', 'suave', 'vineta'];
test('un color cualquiera da una paleta completa', () => {
  for (const hex of ['#c1121f', '#000000', '#2563eb', '#ffffff', '#fbbf24', '#10b981', '#ff00ff']) {
    const p = paletaDesdeColor(hex);
    for (const k of claves) assert.ok(p[k] !== undefined && p[k] !== null, `${hex}: falta ${k}`);
    assert.equal(p.fondo.length, 4); assert.equal(p.texto.length, 3);
    for (const c of [...p.fondo, ...p.texto, p.trazo, p.marco, p.pildora, p.pildoraTexto]) assert.match(c, /^#[0-9a-f]{6}$|^#fff$/i, `${hex}: color raro ${c}`);
    assert.match(p.brillo, /^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
  }
});
test('el fondo parte del color elegido y se oscurece; los colores claros llevan letras oscuras', () => {
  const rojo = paletaDesdeColor('#c1121f');
  assert.equal(rojo.fondo[1], '#c1121f');
  assert.ok(parseInt(rojo.fondo[3].slice(1, 3), 16) < parseInt(rojo.fondo[1].slice(1, 3), 16));
  assert.equal(rojo.texto[0], '#fff');
  const claro = paletaDesdeColor('#fbf5ea');
  assert.notEqual(claro.texto[0], '#fff', 'sobre un fondo claro las letras no pueden ser blancas');
  assert.equal(paletaDesdeColor('#000000').texto[0], '#fff');
});
test('paletaPorId acepta las de la lista y un color «#rrggbb»; lo raro vuelve al rojo', () => {
  assert.equal(paletaPorId('azul').id, 'azul');
  assert.equal(paletaPorId('#2563eb').id, 'color');
  assert.equal(paletaPorId('cualquier-cosa').id, PALETAS[0].id);
  assert.equal(paletaPorId('#xyz').id, PALETAS[0].id);
  assert.ok(esColor('#AbCdEf') && !esColor('#abc') && !esColor('rojo'));
});
