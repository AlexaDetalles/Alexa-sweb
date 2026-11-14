// Crea una persona que puede entrar al panel, o le pone contraseña nueva. No hay registro público: solo así se crean.
// Uso:  CLAVE='una contraseña larga' node herramientas/crear-usuario.mjs correo@ejemplo.com [--remoto]
// Sin --remoto escribe en la base local de wrangler (pruebas). La contraseña va por variable de entorno
// para que no quede en el historial de la terminal.
import { webcrypto as cripto } from 'node:crypto';
import { ejecutarSql, sql } from './comun.mjs';

const args = process.argv.slice(2);
const correo = args.find((a) => !a.startsWith('--'));
const remoto = args.includes('--remoto');
const demo = args.includes('--demo');
const clave = process.env.CLAVE || '';

const DEBILES = new Set(['123456', '1234567', '12345678', '123456789', '1234567890', 'password', 'contraseña', 'contrasena', 'qwerty', 'admin', 'admin123', 'abc123', 'alexa123']);
if (!/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(correo || '')) throw new Error('Escribe un correo válido.');
if (demo && remoto) throw new Error('--demo es solo para la base local: en la base real la contraseña debe ser larga y no común.');
if (!demo) {
  if (clave.length < 10) throw new Error('La contraseña (variable CLAVE) debe tener al menos 10 caracteres.');
  if (DEBILES.has(clave.toLowerCase())) throw new Error('Esa contraseña es demasiado común. Usa otra, larga.');
} else if (!clave) throw new Error('Falta la variable CLAVE.');

// Mismo formato que worker/util.js: pbkdf2$<iteraciones>$<sal>$<hash>.
const hex = (b) => Buffer.from(b).toString('hex');
const sal = cripto.getRandomValues(new Uint8Array(16));
const base = await cripto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
const bits = await cripto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 100000 }, base, 256);
const hash = `pbkdf2$100000$${hex(sal)}$${hex(bits)}`;
const c = correo.toLowerCase();

ejecutarSql(`INSERT INTO usuarios (id, correo, clave) VALUES (${sql(cripto.randomUUID())}, ${sql(c)}, ${sql(hash)})
ON CONFLICT (correo) DO UPDATE SET clave = excluded.clave;
DELETE FROM sesiones WHERE usuario_id = (SELECT id FROM usuarios WHERE correo = ${sql(c)});\n`, { remoto });
console.log(`Listo: ${correo} puede entrar al panel${remoto ? '' : ' (base local)'}.`);
