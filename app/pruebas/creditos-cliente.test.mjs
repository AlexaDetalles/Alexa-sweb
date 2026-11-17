import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuotaSugerida, resumenCredito, enlaceRecordatorio } from '../public/admin/creditos.js';
import { cuotaSugerida as servidor } from '../worker/creditos.js';

test('el pago sugerido del panel es el mismo que calcula el servidor', () => {
  for (const [c, n, p] of [[1000, 2, 20], [800, 3, 20], [850, 3, 20], [990, 2, 20], [999, 3, 5], [10, 2, 1], [1500, 6, 0]]) assert.equal(cuotaSugerida(c, n, p), servidor(c, n, p));
  assert.equal(cuotaSugerida(0, 2, 20), null);
  assert.equal(cuotaSugerida(1000, 1, 20), null);
});

test('resumen del crédito: 2 pagos de 600 por un tenis de 1,000', () => {
  const r = resumenCredito({ contado: 1000, cuotas: 2, cuota: 600, abono: 600 });
  assert.deepEqual([r.listo, r.ok, r.total, r.recargo, r.recargoPct, r.saldo], [true, true, 1200, 200, 20, 600]);
  assert.equal(resumenCredito({ contado: 1000, cuotas: 2, cuota: 500 }).ok, false, 'igual al contado no vale');
  assert.equal(resumenCredito({ contado: 1000, cuotas: 2, cuota: 400 }).ok, false, 'mejor que el contado no vale');
  assert.equal(resumenCredito({ contado: 1000, cuotas: 1, cuota: 2000 }).listo, false);
  assert.equal(resumenCredito({ contado: 1000, cuotas: 2, cuota: 600, abono: 5000 }).abonoValido, false);
});

test('recordatorio por WhatsApp', () => {
  const lps = (n) => `L ${n}`;
  const c = { cliente: 'Ana', telefono: '9999 8888', producto_nombre: 'Tenis', dias: -3, monto_vencido: 600, cuota_monto: 600, saldo: 600, proximo_vencimiento: '2026-12-02' };
  const url = enlaceRecordatorio(c, lps);
  assert.ok(url.startsWith('https://wa.me/50499998888?text='));
  assert.ok(decodeURIComponent(url).includes('desde hace 3 días') && decodeURIComponent(url).includes('L 600'));
  assert.equal(enlaceRecordatorio({ ...c, telefono: '' }, lps), '');
  assert.ok(enlaceRecordatorio({ ...c, telefono: '50499998888' }, lps).includes('wa.me/50499998888'));
});
