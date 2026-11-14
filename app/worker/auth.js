// Inicio de sesión del panel: correo y contraseña. Sesiones en D1 con solo el hash del token,
// cookie __Host- (HTTPS, sin JavaScript, SameSite=Strict) y bloqueo de 15 minutos tras 5 fallos.
import { falla, json, sha256, azar, b64url, hashClave, revisarClave, CLAVE_FALSA, leerCookie, cookie, borrarCookie, fechaSql } from './util.js';
import * as V from './validacion.js';

const SESION = '__Host-sesion';
const DURACION = 12 * 3600;          // la sesión dura 12 horas como máximo
const INACTIVIDAD = 60 * 60 * 1000;  // y se cierra tras 1 hora sin uso
const MIN = 60 * 1000;

// En http://localhost el prefijo __Host- y Secure no funcionan: solo en pruebas locales (DEV=1) se usa una cookie simple.
const nombreCookie = (env) => (env.DEV === '1' ? 'sesion' : SESION);
const crearCookie = (env, token, seg) => (env.DEV === '1' ? `sesion=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seg}` : cookie(SESION, token, seg));
const quitarCookie = (env) => crearCookie(env, '', 0);

async function crearSesion(env, usuarioId) {
  const token = b64url(azar(32));
  await env.BD.prepare('INSERT INTO sesiones (token_hash, usuario_id, expira) VALUES (?, ?, ?)')
    .bind(await sha256(token), usuarioId, fechaSql(Date.now() + DURACION * 1000)).run();
  return crearCookie(env, token, DURACION);
}

/** Usuario de la sesión, o null. Cierra la sesión si venció o pasó una hora sin uso. */
export async function sesionDe(req, env) {
  const token = leerCookie(req, nombreCookie(env));
  if (!token) return null;
  const hash = await sha256(token);
  const s = await env.BD.prepare('SELECT s.usuario_id, s.expira, s.ultimo, u.correo FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ?').bind(hash).first();
  if (!s) return null;
  const ahora = Date.now();
  const ultimo = Date.parse(`${s.ultimo}Z`);
  if (Date.parse(`${s.expira}Z`) < ahora || ahora - ultimo > INACTIVIDAD) {
    await env.BD.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  // La actividad se anota como mucho una vez por minuto, para no escribir en cada clic.
  if (ahora - ultimo > MIN) await env.BD.prepare('UPDATE sesiones SET ultimo = ? WHERE token_hash = ?').bind(fechaSql(ahora), hash).run();
  return { id: s.usuario_id, correo: s.correo, tokenHash: hash };
}
export async function exigirSesion(req, env) {
  return (await sesionDe(req, env)) || falla(401, 'Tu sesión terminó. Vuelve a entrar.');
}

// --- intentos fallidos: bloquean 15 minutos ------------------------------------
// 5 fallos del mismo correo desde la misma IP lo bloquean para esa IP; 50 fallos desde cualquier IP bloquean la cuenta.
// Así un tercero no deja a la dueña sin entrar con 5 intentos, y un ataque repartido igual se frena.
async function revisarBloqueo(env, clave) {
  const r = await env.BD.prepare('SELECT bloqueado_hasta FROM intentos WHERE clave = ?').bind(clave).first();
  if (r?.bloqueado_hasta && Date.parse(`${r.bloqueado_hasta}Z`) > Date.now()) falla(429, 'Demasiados intentos. Espera 15 minutos y vuelve a probar.');
}
async function anotarFallo(env, clave, maximo = 5) {
  await env.BD.prepare(`INSERT INTO intentos (clave, fallos) VALUES (?1, 1)
    ON CONFLICT (clave) DO UPDATE SET fallos = CASE WHEN fallos + 1 >= ?3 THEN 0 ELSE fallos + 1 END,
      bloqueado_hasta = CASE WHEN fallos + 1 >= ?3 THEN ?2 ELSE bloqueado_hasta END`).bind(clave, fechaSql(Date.now() + 15 * MIN), maximo).run();
}
const limpiarIntentos = (env, correo) => env.BD.prepare("DELETE FROM intentos WHERE clave = ?1 OR substr(clave, 1, length(?1) + 1) = ?1 || ':'").bind(`correo:${correo}`).run();

// --- entrar, salir, cambiar contraseña ----------------------------------------
async function entrar(req, env, d) {
  const correo = V.correo(d.correo);
  const cuenta = `correo:${correo}`;
  const desdeIp = `${cuenta}:${req.headers.get('CF-Connecting-IP') || 'sin-ip'}`;
  await revisarBloqueo(env, desdeIp);
  await revisarBloqueo(env, cuenta);
  const u = await env.BD.prepare('SELECT id, correo, clave FROM usuarios WHERE correo = ?').bind(correo).first();
  // Se calcula el hash aunque el correo no exista, para no revelar qué correos tienen cuenta por el tiempo de respuesta.
  const ok = await revisarClave(String(d.clave ?? '').slice(0, 200), u?.clave || CLAVE_FALSA);
  if (!u || !ok) { await anotarFallo(env, desdeIp, 5); await anotarFallo(env, cuenta, 50); falla(401, 'Correo o contraseña incorrectos.'); }
  await limpiarIntentos(env, correo);
  const resp = json({ ok: true, correo: u.correo });
  resp.headers.append('Set-Cookie', await crearSesion(env, u.id));
  return resp;
}

async function salir(req, env, todo) {
  const s = await sesionDe(req, env);
  if (s) {
    if (todo) await env.BD.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(s.id).run();
    else await env.BD.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(s.tokenHash).run();
  }
  const resp = json({ ok: true });
  resp.headers.append('Set-Cookie', quitarCookie(env));
  return resp;
}

async function cambiarClave(req, env, d) {
  const s = await exigirSesion(req, env);
  const u = await env.BD.prepare('SELECT clave FROM usuarios WHERE id = ?').bind(s.id).first();
  if (!(await revisarClave(String(d.actual ?? '').slice(0, 200), u.clave))) falla(401, 'La contraseña actual no es correcta.');
  const nueva = V.claveNueva(d.nueva);
  if (nueva === String(d.actual)) falla(400, 'Elige una contraseña distinta a la actual.');
  await env.BD.batch([
    env.BD.prepare('UPDATE usuarios SET clave = ? WHERE id = ?').bind(await hashClave(nueva), s.id),
    // Cualquier otro dispositivo con sesión abierta tiene que volver a entrar.
    env.BD.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token_hash <> ?').bind(s.id, s.tokenHash),
  ]);
  return json({ ok: true });
}

// --- rutas /api/auth/* ----------------------------------------------------------
export async function rutasAuth(req, env, ruta, d) {
  const m = req.method;
  if (m === 'POST' && ruta === 'entrar') return entrar(req, env, d);
  if (m === 'POST' && ruta === 'salir') return salir(req, env, false);
  if (m === 'POST' && ruta === 'salir-todo') return salir(req, env, true);
  if (m === 'POST' && ruta === 'clave') return cambiarClave(req, env, d);
  if (m === 'GET' && ruta === 'sesion') {
    const s = await sesionDe(req, env);
    return json({ sesion: s ? { correo: s.correo } : null });
  }
  return falla(404, 'Ruta no encontrada.');
}
