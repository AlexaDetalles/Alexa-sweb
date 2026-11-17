// Avisos de cobro: el resumen diario por correo y el aviso de «terminó de pagar». Módulo directo, SQLite en memoria y Resend (fetch) falso.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { RAIZ } from '../herramientas/comun.mjs';
import { recordatoriosDeCobro, abonar } from '../worker/creditos.js';
import { sumarDias } from '../worker/creditos.js';
import { diaHonduras } from '../worker/util.js';

function bdFalsa() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(join(RAIZ, 'migraciones')).sort()) db.exec(readFileSync(join(RAIZ, 'migraciones', f), 'utf8'));
  const sentencia = (sql, args = []) => ({
    bind: (...a) => sentencia(sql, a),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: (sql) => sentencia(sql), db };
}
let env, correos;
beforeEach(() => {
  correos = [];
  env = { BD: bdFalsa(), SITIO: 'https://alexashop.cc', NOMBRE: 'Alexa', REMITENTE: 'no-responder@alexashop.cc', RESEND_API_KEY: 'k' };
  globalThis.fetch = async (url, init) => { correos.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }); };
  env.BD.db.exec(`INSERT INTO usuarios (id, correo, clave, nombre, rol, activo) VALUES ('u1', 'duena@ejemplo.com', 'pbkdf2$1$a$b', 'Dueña', 'admin', 1), ('u2', 'catalogo@ejemplo.com', 'pbkdf2$1$a$b', 'Cat', 'catalogo', 1)`);
});
const credito = (inicio, extra = '') => env.BD.db.exec(`INSERT INTO creditos (inicio, movimiento_id, producto_id, producto_nombre, cantidad, cliente, telefono, precio_contado, cuotas, cuota_monto, total, intervalo_dias ${extra ? ', ' + extra.split('|')[0] : ''}) VALUES ('${inicio}', 1, 'P-1', 'Tenis Columbia', 1, 'Ana Pérez', '99998888', 1000, 2, 600, 1200, 15 ${extra ? ', ' + extra.split('|')[1] : ''})`);

test('resumen diario: avisa solo de lo vencido o que vence hoy, y solo a las administradoras', async () => {
  credito(sumarDias(diaHonduras(), -3));                       // debía pagar hace 3 días
  const al_dia = sumarDias(diaHonduras(), 5);                 // la primera cuota es en 5 días: todavía no
  credito(al_dia);
  const r = await recordatoriosDeCobro(env);
  assert.deepEqual(r, { enviados: 1, vencidos: 1 });
  assert.equal(correos.length, 1);
  assert.deepEqual(correos[0].to, ['duena@ejemplo.com'], 'solo administradoras');
  assert.equal(correos[0].subject, 'Cobros pendientes: 1');
  assert.match(correos[0].text, /Ana Pérez — Tenis Columbia: debe L 600\.00/);
  assert.match(correos[0].text, /vencido hace 3 días/);
  assert.match(correos[0].text, /tel\. 99998888/);
});

test('sin vencidos no se manda nada', async () => {
  credito(sumarDias(diaHonduras(), 10));
  assert.deepEqual(await recordatoriosDeCobro(env), { enviados: 0, vencidos: 0 });
  assert.equal(correos.length, 0);
});

test('al pagar la última cuota se avisa que terminó de pagar (y un abono a medias no avisa)', async () => {
  credito(diaHonduras());
  const pendientes = []; const ctx = { waitUntil: (p) => pendientes.push(p) };
  const parcial = await (await abonar(env, 1, { monto: 600 }, { correo: 'duena@ejemplo.com' }, ctx)).json();
  assert.equal(parcial.pagado, false);
  await Promise.all(pendientes); assert.equal(correos.length, 0);
  const final = await (await abonar(env, 1, { monto: 600 }, { correo: 'duena@ejemplo.com' }, ctx)).json();
  assert.equal(final.pagado, true);
  await Promise.all(pendientes);
  assert.equal(correos.length, 1);
  assert.match(correos[0].subject, /Ana Pérez terminó de pagar/);
  assert.match(correos[0].text, /L 1,200\.00 en 2 pagos/);
  assert.equal(env.BD.db.prepare('SELECT estado FROM creditos WHERE id = 1').get().estado, 'pagado');
  await assert.rejects(() => abonar(env, 1, { monto: 10 }, {}, ctx), (e) => e.estado === 404, 'ya está pagada');
});
