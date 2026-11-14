// Prueba local completa, sin cuenta de Cloudflare: base de datos y fotos simuladas en .wrangler/.
//   npm install && npm run dev      →  tienda en http://localhost:8787  y panel en http://localhost:8787/admin
// Crea la base, carga el inventario de las hojas y un usuario de prueba (solo existe en tu computadora).
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { RAIZ, correrWrangler } from './comun.mjs';

const correo = process.env.DEV_CORREO || 'demo@alexashop.local';
const clave = process.env.DEV_CLAVE || 'demo-local-123';
const nodo = (archivo, args = [], env = {}) => new Promise((res, rej) => {
  spawn(process.execPath, [join(RAIZ, 'herramientas', archivo), ...args], { cwd: RAIZ, env: { ...process.env, ...env }, stdio: 'inherit' })
    .on('exit', (c) => (c === 0 ? res() : rej(new Error(`${archivo} terminó con error ${c}`))));
});

correrWrangler(['d1', 'migrations', 'apply', 'BD', '--local'], { stdio: 'inherit' });
await nodo('semilla.mjs');
await nodo('crear-usuario.mjs', [correo], { CLAVE: clave });
console.log(`\n  Panel: http://localhost:8787/admin\n  Correo: ${correo}\n  Contraseña: ${clave}\n`);
spawn(process.execPath, [join(RAIZ, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--local', '--var', 'DEV:1'], { cwd: RAIZ, stdio: 'inherit' });
