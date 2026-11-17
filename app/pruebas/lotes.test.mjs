import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularLote } from '../worker/lotes.js';

const P = (id, referencia, unidades, precio = referencia) => ({ id, nombre: id, referencia, lote_cantidad: unidades, cantidad: unidades, precio, cotizar: 0 });

test('reparto: el costo sigue a la etiqueta y todos ganan el mismo porcentaje con el precio sugerido', () => {
  const lote = { inversion: 45000, meta: 80000, completo: 1 };
  const c = calcularLote(lote, [P('a', 800, 50), P('b', 400, 100)]); // etiquetas: 40,000 + 40,000
  assert.deepEqual(c.filas.map((f) => [f.costo, f.sugerido]), [[450, 800], [225, 400]]);
  assert.equal(c.ventas_estimadas, 80000);
  assert.equal(c.ganancia_estimada, 35000);
});

test('mientras se carga el lote los costos no se disparan; al completarlo se reparte exacto', () => {
  const lote = { inversion: 45000, meta: 80000, completo: 0 };
  const uno = calcularLote(lote, [P('a', 800, 1)]);
  assert.equal(uno.filas[0].costo, 450);   // con la meta como base: 800 × 45000/80000
  assert.equal(uno.filas[0].sugerido, 800);
  // completo con etiquetas que suman menos que la meta: el reparto exacto sube costos y precios sugeridos
  const completo = calcularLote({ ...lote, completo: 1 }, [P('a', 800, 25), P('b', 400, 50)]); // 20,000 + 20,000 = 40,000
  assert.deepEqual(completo.filas.map((f) => [f.costo, f.sugerido]), [[900, 1600], [450, 800]]);
  assert.equal(completo.filas.reduce((s, f) => s + f.costo * f.unidades, 0), 45000, 'el costo repartido suma la inversión');
});

test('tu precio manda: ventas y ganancia estimadas se calculan con él; sin etiqueta se usa el precio', () => {
  const lote = { inversion: 45000, meta: 80000, completo: 1 };
  const c = calcularLote(lote, [P('a', 800, 50, 1000), P('b', 400, 100, 400)]);
  assert.equal(c.ventas_estimadas, 50 * 1000 + 100 * 400);
  assert.equal(c.ganancia_estimada, 90000 - 45000);
  assert.equal(c.margen_estimado, 100);
  assert.equal(c.falta_para_meta, 0);
  const sinEtiqueta = calcularLote(lote, [{ id: 'x', nombre: 'x', referencia: null, precio: 500, cantidad: 160, lote_cantidad: 160, cotizar: 0 }]); // 500 × 160 = 80,000
  assert.equal(sinEtiqueta.filas[0].costo, 281.25);
  assert.equal(calcularLote(lote, []).filas.length, 0);
});
