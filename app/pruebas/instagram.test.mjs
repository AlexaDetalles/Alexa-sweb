// Partes puras de la imagen para Instagram del panel (el dibujo en sí se prueba a ojo en el navegador).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repartirNombre, textoPrecio, nombreArchivo } from '../public/admin/instagram.js';

const medir = (t, tam) => t.length * tam * 0.5; // ancho simulado: 0.5 × tamaño por letra

test('nombre: una línea si cabe, dos si no, y siempre dentro del ancho', () => {
  assert.deepEqual(repartirNombre('Tenis rojos', medir, 920).lineas, ['TENIS ROJOS']);
  const largo = repartirNombre('Tenis Columbia gris para hombre', medir, 920);
  assert.equal(largo.lineas.length, 2);
  assert.ok(largo.lineas.every((l) => medir(l, largo.tam) <= 920));
  const enorme = repartirNombre('Supercalifragilisticoespialidosisimo '.repeat(6), medir, 920);
  assert.ok(enorme.lineas.at(-1).endsWith('…') || enorme.lineas.every((l) => medir(l, enorme.tam) <= 920));
  assert.deepEqual(repartirNombre('', medir, 920).lineas, ['']);
});

test('precio: lempiras con miles, por cotizar y vacío', () => {
  assert.equal(textoPrecio({ precio: '4600', cotizar: false }), 'L 4,600');
  assert.equal(textoPrecio({ precio: '450.5', cotizar: false }), 'L 450.5');
  assert.equal(textoPrecio({ precio: '', cotizar: false }), '');
  assert.equal(textoPrecio({ precio: '', cotizar: true }), 'CONSULTA PRECIO');
});

test('archivo: nombre limpio, sin acentos ni símbolos', () => {
  assert.equal(nombreArchivo('Camiseta Negra Ñandú!', 'RPH-01'), 'alexa-camiseta-negra-nandu-instagram.png');
  assert.equal(nombreArchivo('', 'RPH-01'), 'alexa-rph-01-instagram.png');
});
