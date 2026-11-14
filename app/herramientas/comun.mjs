// Piezas compartidas por las herramientas: ejecución de SQL en D1 (local o real) y escape de valores.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const correrWrangler = (args, opciones = {}) =>
  execFileSync(process.execPath, [join(RAIZ, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), ...args], { cwd: RAIZ, ...opciones });

export function nombreBD() {
  const m = readFileSync(join(RAIZ, 'wrangler.jsonc'), 'utf8').match(/"database_name"\s*:\s*"([^"]+)"/);
  if (!m) throw new Error('No encuentro "database_name" en wrangler.jsonc.');
  return m[1];
}

/** Escapa un valor para SQL: texto entre comillas simples, número, booleano o NULL. */
export const sql = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? '1' : '0') : `'${String(v).replace(/'/g, "''")}'`);

/** Ejecuta SQL en D1. `remoto` usa la base real de Cloudflare; si no, la base local de wrangler. */
export function ejecutarSql(contenido, { remoto = false, persistir = process.env.PERSISTIR } = {}) {
  const archivo = join(mkdtempSync(join(tmpdir(), 'alexa-sql-')), 'consulta.sql');
  writeFileSync(archivo, contenido);
  const extra = persistir && !remoto ? ['--persist-to', persistir] : [];
  correrWrangler(['d1', 'execute', nombreBD(), remoto ? '--remote' : '--local', ...extra, '--file', archivo], { stdio: 'inherit' });
}
