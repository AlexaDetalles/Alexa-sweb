// Cuentas y rangos: alta de la primera administradora con código, recuperar contraseña, invitaciones y permisos.
// Arranca su propio Worker con la base VACÍA (sin usuarios) y ADMIN_EMAIL puesto.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RAIZ } from '../herramientas/comun.mjs';

const PUERTO = 8792, URL_BASE = `http://localhost:${PUERTO}`;
const DUENA = 'duena@ejemplo.com', CLAVE = 'una-clave-muy-larga-1';
let servidor;
const wr = (args) => execFileSync(process.execPath, [join(RAIZ, 'node_modules/wrangler/bin/wrangler.js'), ...args], { cwd: RAIZ, stdio: 'pipe' });

before(async () => {
  const estado = mkdtempSync(join(tmpdir(), 'alexa-acceso-'));
  wr(['d1', 'migrations', 'apply', 'BD', '--local', '--persist-to', estado]);
  execFileSync(process.execPath, [join(RAIZ, 'herramientas/semilla.mjs')], { cwd: RAIZ, env: { ...process.env, PERSISTIR: estado }, stdio: 'pipe' });
  servidor = spawn(process.execPath, [join(RAIZ, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--local', '--port', String(PUERTO), '--local-upstream', `localhost:${PUERTO}`, '--persist-to', estado, '--var', 'DEV:1', '--var', `ADMIN_EMAIL:${DUENA}`], { cwd: RAIZ, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${URL_BASE}/api/catalogo`)).ok) return; } catch { /* aún no */ } await new Promise((r) => setTimeout(r, 500)); }
  throw new Error('El Worker no arrancó.');
});
after(() => servidor?.kill());

// Cada "persona" tiene su propia cookie.
const persona = () => {
  const p = { cookie: '' };
  p.llamar = async (metodo, ruta, cuerpo) => {
    const cab = { Origin: URL_BASE, ...(p.cookie ? { Cookie: p.cookie } : {}) };
    if (cuerpo !== undefined) cab['Content-Type'] = 'application/json';
    const r = await fetch(URL_BASE + ruta, { method: metodo, headers: cab, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    const sc = r.headers.get('set-cookie');
    if (sc) p.cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const t = await r.text(); let datos; try { datos = JSON.parse(t); } catch { datos = t; }
    return { estado: r.status, datos };
  };
  return p;
};
const dueña = persona();
const token = (enlace) => enlace.split('=')[1];

test('sin cuentas, el panel ofrece crear la administradora principal', async () => {
  const anon = persona();
  assert.deepEqual((await anon.llamar('GET', '/api/auth/sesion')).datos, { sesion: null, configurar: true });
});

test('primera administradora: correo autorizado, contraseña fuerte y código por correo', async () => {
  const anon = persona();
  assert.equal((await anon.llamar('POST', '/api/auth/configurar', { correo: 'intruso@ejemplo.com', clave: CLAVE })).estado, 403, 'otro correo no puede adelantarse');
  assert.equal((await anon.llamar('POST', '/api/auth/configurar', { correo: DUENA, clave: 'corta' })).estado, 400);
  assert.equal((await anon.llamar('POST', '/api/auth/configurar', { correo: DUENA, clave: 'aaaaaaaaaaaaaaaa' })).estado, 400, 'contraseña repetitiva');
  const { estado, datos } = await dueña.llamar('POST', '/api/auth/configurar', { correo: DUENA, clave: CLAVE, nombre: 'Alexa' });
  assert.equal(estado, 200);
  assert.match(datos.codigo_dev, /^\d{6}$/);
  assert.equal((await dueña.llamar('GET', '/api/auth/sesion')).datos.sesion, null, 'aún no hay sesión: falta el código');
  const malo = datos.codigo_dev === '000000' ? '111111' : '000000';
  assert.equal((await dueña.llamar('POST', '/api/auth/confirmar', { correo: DUENA, codigo: malo })).estado, 401);
  const ok = await dueña.llamar('POST', '/api/auth/confirmar', { correo: DUENA, codigo: datos.codigo_dev });
  assert.equal(ok.estado, 200);
  assert.equal(ok.datos.rol, 'admin');
  const s = (await dueña.llamar('GET', '/api/auth/sesion')).datos.sesion;
  assert.deepEqual([s.correo, s.nombre, s.rol], [DUENA, 'Alexa', 'admin']);
  assert.equal((await dueña.llamar('POST', '/api/auth/confirmar', { correo: DUENA, codigo: datos.codigo_dev })).estado, 401, 'el código sirve una sola vez');
});

test('el alta de administradora se cierra cuando ya existe una', async () => {
  const anon = persona();
  assert.equal((await anon.llamar('POST', '/api/auth/configurar', { correo: DUENA, clave: CLAVE })).estado, 403);
  assert.deepEqual((await anon.llamar('GET', '/api/auth/sesion')).datos, { sesion: null, configurar: false });
});

test('recuperar contraseña: enlace de un solo uso, misma respuesta exista o no la cuenta', async () => {
  const anon = persona();
  const noExiste = await anon.llamar('POST', '/api/auth/recuperar', { correo: 'nadie@ejemplo.com' });
  const existe = await anon.llamar('POST', '/api/auth/recuperar', { correo: DUENA });
  assert.equal(noExiste.estado, 200); assert.equal(existe.estado, 200);
  assert.equal(noExiste.datos.enlace_dev, undefined);
  const t = token(existe.datos.enlace_dev);
  assert.match(existe.datos.enlace_dev, /\/admin\/#restablecer=/);
  assert.equal((await anon.llamar('POST', '/api/auth/restablecer', { token: t, nueva: 'corta' })).estado, 400);
  assert.equal((await anon.llamar('POST', '/api/auth/restablecer', { token: 'token-falso', nueva: 'otra-clave-muy-larga-2' })).estado, 400);
  assert.equal((await anon.llamar('POST', '/api/auth/restablecer', { token: t, nueva: 'otra-clave-muy-larga-2' })).estado, 200);
  assert.equal((await anon.llamar('POST', '/api/auth/restablecer', { token: t, nueva: 'otra-clave-muy-larga-3' })).estado, 400, 'el enlace sirve una vez');
  assert.equal((await dueña.llamar('GET', '/api/auth/sesion')).datos.sesion, null, 'se cerraron las sesiones abiertas');
  assert.equal((await dueña.llamar('POST', '/api/auth/entrar', { correo: DUENA, clave: CLAVE })).estado, 401);
  assert.equal((await dueña.llamar('POST', '/api/auth/entrar', { correo: DUENA, clave: 'otra-clave-muy-larga-2' })).estado, 200);
});

const invitar = async (nombre, correo, rol) => {
  const r = await dueña.llamar('POST', '/api/admin/usuarios', { nombre, correo, rol });
  assert.equal(r.estado, 201);
  const p = persona();
  const info = await p.llamar('POST', '/api/auth/invitacion-ver', { token: token(r.datos.enlace_dev) });
  assert.equal(info.datos.correo, correo);
  const ok = await p.llamar('POST', '/api/auth/invitacion-aceptar', { token: token(r.datos.enlace_dev), nombre, clave: 'clave-de-la-empleada-1' });
  assert.equal(ok.estado, 200);
  assert.equal((await p.llamar('POST', '/api/auth/invitacion-aceptar', { token: token(r.datos.enlace_dev), nombre, clave: 'clave-de-la-empleada-1' })).estado, 400, 'invitación de un solo uso');
  return p;
};

test('invitaciones y rangos: cada una hace solo lo suyo', async () => {
  const cat = await invitar('Marta', 'marta@ejemplo.com', 'catalogo');
  const ate = await invitar('Rosa', 'rosa@ejemplo.com', 'atencion');
  const lec = await invitar('Lucía', 'lucia@ejemplo.com', 'lectura');
  const prod = { nombre: 'Prueba rangos', categoria_id: 'HP', precio: 10 };
  const ajuste = { asesora1_nombre: 'Rosa' };

  assert.equal((await cat.llamar('POST', '/api/admin/productos', prod)).estado, 201);
  assert.equal((await cat.llamar('PUT', '/api/admin/ajustes', ajuste)).estado, 403);
  assert.equal((await cat.llamar('GET', '/api/admin/usuarios')).estado, 403);
  assert.equal((await cat.llamar('POST', '/api/admin/opciones', { publico: 'mujer', paso: 'base', nombre: 'X' })).estado, 201);

  assert.equal((await ate.llamar('PUT', '/api/admin/ajustes', ajuste)).estado, 200);
  assert.equal((await ate.llamar('POST', '/api/admin/productos', prod)).estado, 403);
  assert.equal((await ate.llamar('POST', '/api/admin/usuarios', { nombre: 'x', correo: 'x@ejemplo.com', rol: 'admin' })).estado, 403, 'nadie se da rango de administradora');

  assert.equal((await lec.llamar('GET', '/api/admin/datos')).estado, 200, 'ver sí');
  for (const [m, r, c] of [['POST', '/api/admin/productos', prod], ['PUT', '/api/admin/ajustes', ajuste], ['POST', '/api/admin/orden', { tabla: 'productos', ids: [] }], ['DELETE', '/api/admin/productos/HP-01']]) {
    assert.equal((await lec.llamar(m, r, c)).estado, 403, `${m} ${r}`);
  }
  assert.equal((await lec.llamar('GET', '/api/auth/sesion')).datos.sesion.rolNombre, 'Supervisora (solo lectura)');
  assert.equal((await lec.llamar('POST', '/api/auth/clave', { actual: 'clave-de-la-empleada-1', nueva: 'otra-clave-empleada-22' })).estado, 200, 'cualquiera cambia su propia contraseña');

  const lista = (await dueña.llamar('GET', '/api/admin/usuarios')).datos;
  assert.equal(lista.usuarios.length, 4);
  assert.equal(lista.invitaciones.length, 0);

  // cambiar el rango o desactivar corta sus sesiones al instante
  const idMarta = lista.usuarios.find((u) => u.correo === 'marta@ejemplo.com').id;
  assert.equal((await dueña.llamar('PUT', `/api/admin/usuarios/${idMarta}`, { rol: 'lectura' })).estado, 200);
  assert.equal((await cat.llamar('GET', '/api/auth/sesion')).datos.sesion, null);
  const idRosa = lista.usuarios.find((u) => u.correo === 'rosa@ejemplo.com').id;
  await dueña.llamar('PUT', `/api/admin/usuarios/${idRosa}`, { activo: false });
  assert.equal((await ate.llamar('GET', '/api/auth/sesion')).datos.sesion, null);
  assert.equal((await ate.llamar('POST', '/api/auth/entrar', { correo: 'rosa@ejemplo.com', clave: 'clave-de-la-empleada-1' })).estado, 401, 'desactivada no entra');
  assert.equal((await dueña.llamar('DELETE', `/api/admin/usuarios/${idRosa}`)).estado, 200);
});

test('invitar: correo repetido y reglas de la última administradora', async () => {
  assert.equal((await dueña.llamar('POST', '/api/admin/usuarios', { nombre: 'Otra', correo: DUENA, rol: 'lectura' })).estado, 409);
  assert.equal((await dueña.llamar('POST', '/api/admin/usuarios', { nombre: 'Otra', correo: 'otra@ejemplo.com', rol: 'jefa' })).estado, 400);
  // una invitación pendiente se ve y se cancela
  await dueña.llamar('POST', '/api/admin/usuarios', { nombre: 'Pendiente', correo: 'pendiente@ejemplo.com', rol: 'catalogo' });
  const { invitaciones, usuarios } = (await dueña.llamar('GET', '/api/admin/usuarios')).datos;
  assert.equal(invitaciones.length, 1);
  assert.equal((await dueña.llamar('DELETE', `/api/admin/invitaciones/${invitaciones[0].id}`)).estado, 200);
  assert.equal((await dueña.llamar('GET', '/api/admin/usuarios')).datos.invitaciones.length, 0);
  const yo = usuarios.find((u) => u.correo === DUENA).id;
  assert.equal((await dueña.llamar('PUT', `/api/admin/usuarios/${yo}`, { rol: 'lectura' })).estado, 400, 'no te quitas el rango');
  assert.equal((await dueña.llamar('PUT', `/api/admin/usuarios/${yo}`, { activo: false })).estado, 400);
  assert.equal((await dueña.llamar('DELETE', `/api/admin/usuarios/${yo}`)).estado, 400);
});

test('segunda administradora: ahora sí se puede cambiar la primera, pero nunca dejar el panel sin ninguna', async () => {
  const seg = await invitar('Segunda', 'segunda@ejemplo.com', 'admin');
  const lista = (await dueña.llamar('GET', '/api/admin/usuarios')).datos.usuarios;
  const idSeg = lista.find((u) => u.correo === 'segunda@ejemplo.com').id, idDuena = lista.find((u) => u.correo === DUENA).id;
  assert.equal((await seg.llamar('PUT', `/api/admin/usuarios/${idDuena}`, { rol: 'lectura' })).estado, 200);
  assert.equal((await seg.llamar('PUT', `/api/admin/usuarios/${idSeg}`, { rol: 'lectura' })).estado, 400);
  assert.equal((await seg.llamar('DELETE', `/api/admin/usuarios/${idDuena}`)).estado, 200);
});
