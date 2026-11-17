import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimarEnLote } from '../public/admin/lotes.js';

test('precio sugerido en el editor: igual que el del servidor', () => {
  const lote = { inversion: 45000, meta: 80000, completo: false };
  assert.deepEqual(estimarEnLote(lote, [], { referencia: 800, unidades: 1 }), { sugerido: 800, costo: 450 });
  assert.deepEqual(estimarEnLote(lote, [{ referencia: 400, unidades: 100 }], { referencia: 800, unidades: 50 }), { sugerido: 800, costo: 450 });
  // lote completo cuyas etiquetas suman 40,000: todo sube al doble
  assert.deepEqual(estimarEnLote({ ...lote, completo: true }, [{ referencia: 400, unidades: 50 }], { referencia: 800, unidades: 25 }), { sugerido: 1600, costo: 900 });
  assert.equal(estimarEnLote(lote, [], { referencia: '', unidades: 1 }), null);
  assert.equal(estimarEnLote(null, [], { referencia: 800, unidades: 1 }), null);
});
