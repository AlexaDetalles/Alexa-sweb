import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCredito, cuotaSugerida, estadoCredito, sumarDias, diasEntre, validarGasto } from '../worker/creditos.js';

const rechaza = (fn) => assert.throws(fn, (e) => e.estado === 400);

test('el crédito nunca sale igual o mejor que el contado', () => {
  assert.equal(validarCredito({ contado: 1000, cuotas: 2, cuota: 600 }), 1200);
  assert.equal(validarCredito({ contado: 1000, cuotas: 3, cuota: 400 }), 1200);
  rechaza(() => validarCredito({ contado: 1000, cuotas: 2, cuota: 500 }));   // 1,000 = igual
  rechaza(() => validarCredito({ contado: 1000, cuotas: 2, cuota: 400 }));   // 800 = mejor
  rechaza(() => validarCredito({ contado: 1000, cuotas: 1, cuota: 2000 }));  // mínimo 2 pagos
  rechaza(() => validarCredito({ contado: 1000, cuotas: 2, cuota: 0 }));
  assert.equal(validarCredito({ contado: 1000, cuotas: 2, cuota: 500.01 }), 1000.02);
});

test('pago sugerido con el recargo: 1,000 en 2 pagos a +20 % = 600', () => {
  assert.equal(cuotaSugerida(1000, 2, 20), 600);
  assert.equal(cuotaSugerida(800, 3, 20), 320);          // 960 / 3
  assert.equal(cuotaSugerida(850, 3, 20), 340);          // 1,020 / 3 = 340
  assert.equal(cuotaSugerida(900, 4, 20), 270);          // 1,080 / 4 = 270
  assert.equal(cuotaSugerida(990, 2, 20), 600);          // 1,188 / 2 = 594 → sube a múltiplo de 10
  assert.ok(cuotaSugerida(1000, 2, 0) * 2 > 1000, 'aunque el recargo sea 0 el total supera al contado');
  for (const [c, n, p] of [[999, 3, 5], [1500, 6, 0], [10, 2, 1]]) assert.ok(cuotaSugerida(c, n, p) * n > c);
});

test('estado: abonos, próximo pago y lo vencido', () => {
  const c = { total: 1200, cuotas: 2, cuota_monto: 600, inicio: '2026-11-17', intervalo_dias: 15 };
  const hoy = '2026-11-17';
  assert.deepEqual(estadoCredito(c, 0, hoy), { abonado: 0, saldo: 1200, pagadas: 0, proximo_vencimiento: '2026-11-17', dias: 0, monto_vencido: 600, vencido: true }); // la 1.ª cuota es hoy
  const conAbono = estadoCredito(c, 600, hoy);
  assert.deepEqual([conAbono.saldo, conAbono.pagadas, conAbono.proximo_vencimiento, conAbono.vencido], [600, 1, '2026-12-02', false]);
  assert.equal(estadoCredito(c, 600, '2026-12-02').vencido, true, 'vence el día 15');
  assert.equal(estadoCredito(c, 600, '2026-12-05').dias, -3, 'vencido hace 3 días');
  assert.equal(estadoCredito(c, 600, '2026-12-05').monto_vencido, 600);
  const parcial = estadoCredito(c, 800, '2026-12-05');
  assert.deepEqual([parcial.pagadas, parcial.monto_vencido], [1, 400], 'pagó 800: de los 1,200 que ya debía le faltan 400');
  const pagado = estadoCredito(c, 1200, '2027-01-01');
  assert.deepEqual([pagado.saldo, pagado.proximo_vencimiento, pagado.vencido], [0, null, false]);
  assert.equal(estadoCredito(c, 1200, '2027-01-01').pagadas, 2);
});

test('fechas y gastos', () => {
  assert.equal(sumarDias('2026-11-17', 15), '2026-12-02');
  assert.equal(sumarDias('2026-12-20', 15), '2027-01-04');
  assert.equal(diasEntre('2026-11-17', '2026-11-20'), 3);
  assert.deepEqual(validarGasto({ monto: '50', categoria: 'bus' }), { concepto: 'Bus', categoria: 'bus', monto: 50, nota: '' });
  assert.equal(validarGasto({ monto: 20, categoria: 'inventada', concepto: ' Bolsa ' }).categoria, 'otro');
  rechaza(() => validarGasto({ monto: 0 }));
  rechaza(() => validarGasto({ monto: 'abc' }));
});
