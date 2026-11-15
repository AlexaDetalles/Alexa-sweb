import test from 'node:test';
import assert from 'node:assert/strict';
import { preparar, recorrido, opcionesDe, limpiar, alternar, lineas, total, pendiente, completo, avance, alcanzable, mensajeWhatsApp } from '../public/assets/regalo-core.mjs';

const DATOS = {
  config: { active: true, title: 'Para ella', intro: 'Hola', note: 'Nota', dedication: { enabled: true, title: 'Palabras', help: 'Ayuda', max: 40 } },
  pasos: [
    { id: 'tamano', name: 'Tamaño', title: 'T', desc: '', type: 'unico', min: 1, max: 1, dependsOn: 'base' }, // llega antes que su base: se reordena
    { id: 'base', name: 'Base', title: 'B', desc: '', type: 'unico', min: 1, max: 1, dependsOn: '' },
    { id: 'extras', name: 'Extras', title: 'E', desc: '', type: 'multiple', min: 0, max: 2, dependsOn: '' },
    { id: 'resumen', name: 'Malo', title: 'x', type: 'unico', min: 1, max: 1 }, // id reservado
  ],
  opciones: [
    { id: 'B1', paso: 'base', parent: '', name: 'Caja', desc: 'Con tapa', badge: 'Nuevo', cents: 2500, img: '/assets/images/1.webp', thumb: '/assets/images/2.webp' },
    { id: 'B2', paso: 'base', parent: '', name: 'Bolsa', cents: 1000, img: 'https://malo.example/x.png' },
    { id: 'T1', paso: 'tamano', parent: 'B1', name: 'Mediana', cents: 12000 },
    { id: 'T2', paso: 'tamano', parent: 'B2', name: 'Pequeña', cents: 5000 },
    { id: 'X1', paso: 'extras', parent: '', name: 'Oso', cents: 30000 },
    { id: 'X2', paso: 'extras', parent: '', name: 'Globo', cents: 4000 },
    { id: 'X3', paso: 'extras', parent: '', name: 'Vela', cents: 1500 },
    { id: 'Z9', paso: 'fantasma', parent: '', name: 'Sin paso', cents: 1 },
  ],
};

test('preparar: valida, ordena dependencias primero y descarta lo ajeno', () => {
  const g = preparar(DATOS);
  assert.deepEqual(g.pasos.map((p) => p.id).sort(), ['base', 'extras', 'tamano']);
  assert.ok(g.pasos.findIndex((p) => p.id === 'base') < g.pasos.findIndex((p) => p.id === 'tamano'), 'la base va antes del tamaño');
  assert.ok(!g.porPaso.has('resumen'), 'ids reservados fuera');
  assert.ok(!g.porId.has('Z9'), 'opción de un paso inexistente fuera');
  assert.equal(g.porId.get('B2').img, '', 'imágenes ajenas no se cargan');
  assert.equal(g.porId.get('B1').mini, '/assets/images/2.webp');
  assert.deepEqual(recorrido(g), [...g.pasos.map((p) => p.id), 'dedicatoria', 'resumen']);
  assert.equal(preparar({ ...DATOS, config: { dedication: { enabled: false } } }).config.dedicatoria.activa, false);
  assert.deepEqual(preparar(null).pasos, []);
});

test('elegir: único reemplaza, dependientes se vacían, múltiple respeta máximo y mínimo', () => {
  const g = preparar(DATOS);
  let b = limpiar(g, {});
  assert.equal(pendiente(g, b), 'base');
  assert.deepEqual(opcionesDe(g, 'tamano', b.sel), [], 'sin base no hay tamaños');
  b = alternar(g, b, 'base', 'B1').borrador;
  assert.deepEqual(opcionesDe(g, 'tamano', b.sel).map((o) => o.id), ['T1']);
  b = alternar(g, b, 'tamano', 'T1').borrador;
  assert.equal(completo(g, b), true);
  assert.equal(total(g, b), 14500);
  // cambiar la base invalida el tamaño elegido
  b = alternar(g, b, 'base', 'B2').borrador;
  assert.deepEqual(b.sel.tamano, []);
  assert.equal(pendiente(g, b), 'tamano');
  // un paso único obligatorio no se deselecciona
  assert.deepEqual(alternar(g, b, 'base', 'B2').borrador.sel.base, ['B2']);
  // múltiple: máximo 2
  b = alternar(g, b, 'extras', 'X1').borrador; b = alternar(g, b, 'extras', 'X2').borrador;
  const r = alternar(g, b, 'extras', 'X3');
  assert.match(r.error, /hasta 2/);
  assert.deepEqual(r.borrador.sel.extras, ['X1', 'X2']);
  assert.deepEqual(alternar(g, b, 'extras', 'X1').borrador.sel.extras, ['X2'], 'se puede quitar');
  assert.match(alternar(g, b, 'extras', 'NO').error, /ya no está/);
});

test('limpiar: ids ajenos, repetidos y de más; el mensaje se recorta al máximo configurado', () => {
  const g = preparar(DATOS);
  const b = limpiar(g, { sel: { base: ['B1', 'B2', 'XX'], tamano: ['T2', 'T1'], extras: ['X1', 'X1', 'X2', 'X3', '__proto__'] }, mensaje: 'a'.repeat(100) });
  assert.deepEqual(b.sel.base, ['B1'], 'un paso único guarda una sola');
  assert.ok(b.sel.tamano.every((id) => id === 'T1'), 'solo tamaños de la base elegida');
  assert.deepEqual(b.sel.extras, ['X1', 'X2']);
  assert.equal(b.mensaje.length, 40);
  assert.equal(Object.getPrototypeOf(b.sel), Object.prototype);
  assert.deepEqual(limpiar(g, 'basura').sel.base, []);
});

test('avance, rutas alcanzables, líneas y mensaje de WhatsApp', () => {
  const g = preparar(DATOS);
  let b = limpiar(g, {});
  assert.equal(avance(g, b), 0);
  assert.equal(alcanzable(g, b, 'base'), true);
  assert.equal(alcanzable(g, b, 'tamano'), false, 'no se salta un paso obligatorio');
  assert.equal(alcanzable(g, b, 'inventada'), false);
  b = alternar(g, alternar(g, b, 'base', 'B1').borrador, 'tamano', 'T1').borrador;
  assert.equal(avance(g, b), 1);
  assert.equal(alcanzable(g, b, 'resumen'), true);
  assert.deepEqual(lineas(g, b).map((l) => l.opcion.id), ['B1', 'T1']);
  b = { ...b, mensaje: 'Con cariño' };
  const m = mensajeWhatsApp(g, b, 'mujer');
  assert.match(m, /para ella/);
  assert.match(m, /Base: Caja \[B1\]/);
  assert.match(m, /Dedicatoria: Con cariño/);
  assert.match(m, /Total estimado: .*145/);
  assert.match(mensajeWhatsApp(g, b, 'el'), /para él/);
});
