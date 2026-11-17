// Cuentas del panel: entrar con correo y contraseña, alta de la primera administradora con código por correo,
// recuperación de contraseña, invitaciones con rango y administración de usuarios.
// Sesiones en D1 con solo el hash del token; cookie __Host- (HTTPS, sin JavaScript, SameSite=Strict); bloqueo de 15 min tras 5 fallos.
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { falla, json, sha256, azar, b64url, deB64url, iguales, hashClave, revisarClave, CLAVE_FALSA, leerCookie, cookie, fechaSql } from './util.js';
import { enviarCorreo, sitio } from './correo.js';
import * as V from './validacion.js';

export const ROLES = {
  admin: 'Administradora',
  catalogo: 'Encargada de Catálogo',
  atencion: 'Encargada de Atención',
  lectura: 'Supervisora (solo lectura)',
};
// Qué puede hacer cada rango. Lo aplica el servidor en cada llamada; el panel solo esconde lo que no corresponde.
const PERMISOS = { admin: ['catalogo', 'ajustes', 'usuarios', 'estadisticas', 'finanzas'], catalogo: ['catalogo'], atencion: ['ajustes'], lectura: ['estadisticas'] };
export const puede = (s, permiso) => PERMISOS[s.rol]?.includes(permiso);
export function exigirPermiso(s, permiso) {
  if (!puede(s, permiso)) falla(403, 'Tu rango no permite hacer este cambio.');
}

const SESION = '__Host-sesion';
const DURACION = 12 * 3600;          // la sesión dura 12 horas como máximo
const INACTIVIDAD = 60 * 60 * 1000;  // y se cierra tras 1 hora sin uso
const MIN = 60 * 1000;

// En http://localhost el prefijo __Host- y Secure no funcionan: solo en pruebas locales (DEV=1) se usa una cookie simple.
const nombreCookie = (env) => (env.DEV === '1' ? 'sesion' : SESION);
const crearCookie = (env, token, seg) => (env.DEV === '1' ? `sesion=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seg}` : cookie(SESION, token, seg));
const conCookie = (resp, c) => { resp.headers.append('Set-Cookie', c); return resp; };

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
  const s = await env.BD.prepare('SELECT s.usuario_id, s.expira, s.ultimo, u.correo, u.nombre, u.rol FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ? AND u.activo = 1').bind(hash).first();
  if (!s) return null;
  const ahora = Date.now();
  const ultimo = Date.parse(`${s.ultimo}Z`);
  if (Date.parse(`${s.expira}Z`) < ahora || ahora - ultimo > INACTIVIDAD) {
    await env.BD.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(hash).run();
    return null;
  }
  // La actividad se anota como mucho una vez por minuto, para no escribir en cada clic.
  if (ahora - ultimo > MIN) await env.BD.prepare('UPDATE sesiones SET ultimo = ? WHERE token_hash = ?').bind(fechaSql(ahora), hash).run();
  return { id: s.usuario_id, correo: s.correo, nombre: s.nombre, rol: s.rol, tokenHash: hash };
}
export async function exigirSesion(req, env) {
  return (await sesionDe(req, env)) || falla(401, 'Tu sesión terminó. Vuelve a entrar.');
}
const publico = (s) => ({ correo: s.correo, nombre: s.nombre, rol: s.rol, rolNombre: ROLES[s.rol] });

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
const ip = (req) => req.headers.get('CF-Connecting-IP') || 'sin-ip';
const caduco = (c) => Date.parse(`${c.expira}Z`) < Date.now();
const enSegundoPlano = (ctx, promesa) => { const p = promesa.catch((e) => console.error('correo', e.message)); ctx?.waitUntil ? ctx.waitUntil(p) : p; };

// --- entrar, salir, cambiar contraseña ----------------------------------------
async function entrar(req, env, d) {
  const correo = V.correo(d.correo);
  const cuenta = `correo:${correo}`;
  const desdeIp = `${cuenta}:${ip(req)}`;
  await revisarBloqueo(env, desdeIp);
  await revisarBloqueo(env, cuenta);
  const u = await env.BD.prepare('SELECT id, correo, nombre, rol, clave, activo FROM usuarios WHERE correo = ?').bind(correo).first();
  // Se calcula el hash aunque el correo no exista, para no revelar qué correos tienen cuenta por el tiempo de respuesta.
  const ok = await revisarClave(String(d.clave ?? '').slice(0, 200), u?.clave || CLAVE_FALSA);
  if (!u || !u.activo || !ok) { await anotarFallo(env, desdeIp, 5); await anotarFallo(env, cuenta, 50); falla(401, 'Correo o contraseña incorrectos.'); }
  await limpiarIntentos(env, correo);
  return conCookie(json({ ok: true, ...publico(u) }), await crearSesion(env, u.id));
}

async function salir(req, env, todo) {
  const s = await sesionDe(req, env);
  if (s) {
    if (todo) await env.BD.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(s.id).run();
    else await env.BD.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(s.tokenHash).run();
  }
  return conCookie(json({ ok: true }), crearCookie(env, '', 0));
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

async function estado(req, env) {
  const s = await sesionDe(req, env);
  if (s) {
    const { n } = await env.BD.prepare('SELECT count(*) AS n FROM passkeys WHERE usuario_id = ?').bind(s.id).first();
    return json({ sesion: { ...publico(s), huellas: n } });
  }
  // Sin ninguna cuenta todavía: el panel ofrece crear la de la administradora principal.
  const { n } = await env.BD.prepare('SELECT count(*) AS n FROM usuarios').first();
  return json({ sesion: null, configurar: n === 0 });
}

// --- primera administradora: correo + contraseña + código de 6 dígitos por correo ----------
async function configurar(req, env, d) {
  if ((await env.BD.prepare('SELECT count(*) AS n FROM usuarios').first()).n > 0) falla(403, 'Este panel ya tiene una administradora. Entra con tu correo y contraseña.');
  const correo = V.correo(d.correo);
  // Si se configuró ADMIN_EMAIL, solo ese correo puede crear la cuenta principal: así nadie más puede adelantarse a la dueña.
  if (env.ADMIN_EMAIL && correo !== env.ADMIN_EMAIL.trim().toLowerCase()) falla(403, 'Ese correo no está autorizado para crear la cuenta principal.');
  const clave = V.claveNueva(d.clave);
  const nombre = V.nombrePersona(d.nombre, false);
  const limite = `configurar:${ip(req)}`;
  await revisarBloqueo(env, limite);
  await anotarFallo(env, limite, 8); // cada pedido cuenta: 8 seguidos esperan 15 minutos
  const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  await env.BD.prepare(`INSERT INTO codigos (id, tipo, correo, nombre, rol, clave, secreto_hash, expira, intentos) VALUES (?1, 'registro', ?2, ?3, 'admin', ?4, ?5, ?6, 0)
    ON CONFLICT (id) DO UPDATE SET nombre = ?3, clave = ?4, secreto_hash = ?5, expira = ?6, intentos = 0`)
    .bind(`registro:${correo}`, correo, nombre, await hashClave(clave), await sha256(`${correo}:${codigo}`), fechaSql(Date.now() + 10 * MIN)).run();
  await enviarCorreo(env, {
    para: correo, asunto: `${codigo} es tu código para crear el panel de ${env.NOMBRE}`,
    texto: `Tu código es ${codigo}. Vence en 10 minutos.\n\nSi no fuiste tú, ignora este correo: sin el código no se crea ninguna cuenta.`,
  });
  return json({ ok: true, ...(env.DEV === '1' ? { codigo_dev: codigo } : {}) });
}

async function confirmar(req, env, d) {
  const correo = V.correo(d.correo);
  const r = await env.BD.prepare("SELECT * FROM codigos WHERE id = ? AND tipo = 'registro'").bind(`registro:${correo}`).first();
  if (!r || caduco(r)) falla(401, 'El código venció. Vuelve a empezar para recibir otro.');
  if (r.intentos >= 5) falla(429, 'Demasiados intentos con este código. Vuelve a empezar para recibir otro.');
  if (!iguales(await sha256(`${correo}:${String(d.codigo ?? '').trim()}`), r.secreto_hash)) {
    await env.BD.prepare('UPDATE codigos SET intentos = intentos + 1 WHERE id = ?').bind(r.id).run();
    falla(401, 'Código incorrecto. Revisa el último correo que te llegó.');
  }
  const id = crypto.randomUUID();
  // «Solo si todavía no hay ninguna cuenta»: si dos personas confirman a la vez, solo una gana.
  const crear = await env.BD.prepare("INSERT INTO usuarios (id, correo, clave, nombre, rol) SELECT ?1, ?2, ?3, ?4, 'admin' WHERE NOT EXISTS (SELECT 1 FROM usuarios)").bind(id, correo, r.clave, r.nombre).run();
  if (!crear.meta.changes) falla(403, 'Este panel ya tiene una administradora.');
  await env.BD.prepare('DELETE FROM codigos WHERE id = ?').bind(r.id).run();
  return conCookie(json({ ok: true, ...publico({ correo, nombre: r.nombre, rol: 'admin' }) }), await crearSesion(env, id));
}

// --- olvidé mi contraseña ---------------------------------------------------------
async function recuperar(req, env, d, ctx) {
  const correo = V.correo(d.correo);
  const limite = `recuperar:${correo}`, porIp = `recuperar-ip:${ip(req)}`;
  await revisarBloqueo(env, limite); await revisarBloqueo(env, porIp);
  await anotarFallo(env, limite); await anotarFallo(env, porIp, 10); // cada pedido cuenta
  const u = await env.BD.prepare('SELECT id, correo FROM usuarios WHERE correo = ? AND activo = 1').bind(correo).first();
  let extra = {};
  if (u) {
    const token = b64url(azar(32));
    await env.BD.batch([
      env.BD.prepare("DELETE FROM codigos WHERE usuario_id = ? AND tipo = 'recuperar'").bind(u.id),
      env.BD.prepare("INSERT INTO codigos (id, tipo, correo, usuario_id, expira) VALUES (?, 'recuperar', ?, ?, ?)").bind(await sha256(token), u.correo, u.id, fechaSql(Date.now() + 30 * MIN)),
    ]);
    const enlace = `${sitio(env)}/admin/#restablecer=${token}`;
    // En segundo plano, para que la respuesta tarde igual exista o no la cuenta (no revela qué correos tienen cuenta).
    enSegundoPlano(ctx, enviarCorreo(env, {
      para: u.correo, asunto: `Restablecer la contraseña del panel de ${env.NOMBRE}`,
      texto: `Para elegir una contraseña nueva, abre este enlace (vence en 30 minutos y sirve una sola vez):\n${enlace}\n\nSi no lo pediste, ignora este correo: tu contraseña no cambia.`,
    }));
    if (env.DEV === '1') extra = { enlace_dev: enlace };
  }
  return json({ ok: true, ...extra }); // misma respuesta exista o no la cuenta
}

async function restablecer(req, env, d, ctx) {
  const c = await env.BD.prepare("SELECT id, usuario_id, correo, expira FROM codigos WHERE id = ? AND tipo = 'recuperar'").bind(await sha256(String(d.token ?? ''))).first();
  if (!c || caduco(c)) falla(400, 'El enlace venció o ya se usó. Pide uno nuevo.');
  const nueva = V.claveNueva(d.nueva);
  await env.BD.batch([
    env.BD.prepare('UPDATE usuarios SET clave = ? WHERE id = ?').bind(await hashClave(nueva), c.usuario_id),
    env.BD.prepare('DELETE FROM codigos WHERE id = ?').bind(c.id),
    env.BD.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(c.usuario_id),
    env.BD.prepare("DELETE FROM intentos WHERE clave = ?1 OR substr(clave, 1, length(?1) + 1) = ?1 || ':'").bind(`correo:${c.correo}`),
  ]);
  // Aviso al terminar (no solo al pedirlo): si no fue ella, se entera.
  enSegundoPlano(ctx, enviarCorreo(env, {
    para: c.correo, asunto: `Tu contraseña del panel de ${env.NOMBRE} cambió`,
    texto: 'Se acaba de cambiar la contraseña de tu cuenta del panel y se cerraron tus sesiones abiertas.\n\nSi no fuiste tú, pide otro restablecimiento desde la pantalla de entrada y avisa a la administradora.',
  }));
  return json({ ok: true });
}

// --- invitaciones: la administradora invita, la persona elige su propia contraseña ----------
async function verInvitacion(req, env, d) {
  const c = await env.BD.prepare("SELECT correo, nombre, rol, expira FROM codigos WHERE id = ? AND tipo = 'invitacion'").bind(await sha256(String(d.token ?? ''))).first();
  if (!c || caduco(c)) falla(400, 'La invitación venció o ya se usó. Pídele a la administradora que te invite otra vez.');
  return json({ correo: c.correo, nombre: c.nombre, rolNombre: ROLES[c.rol] });
}
async function aceptarInvitacion(req, env, d) {
  const hash = await sha256(String(d.token ?? ''));
  const c = await env.BD.prepare("SELECT id, correo, nombre, rol, expira FROM codigos WHERE id = ? AND tipo = 'invitacion'").bind(hash).first();
  if (!c || caduco(c)) falla(400, 'La invitación venció o ya se usó. Pídele a la administradora que te invite otra vez.');
  const clave = V.claveNueva(d.clave);
  const nombre = V.nombrePersona(d.nombre || c.nombre, true);
  const id = crypto.randomUUID();
  try {
    await env.BD.batch([
      env.BD.prepare('INSERT INTO usuarios (id, correo, clave, nombre, rol) VALUES (?, ?, ?, ?, ?)').bind(id, c.correo, await hashClave(clave), nombre, c.rol),
      env.BD.prepare('DELETE FROM codigos WHERE id = ?').bind(c.id),
    ]);
  } catch (e) { if (/UNIQUE/i.test(String(e?.message))) falla(409, 'Ese correo ya tiene cuenta. Entra con tu contraseña.'); throw e; }
  return conCookie(json({ ok: true, ...publico({ correo: c.correo, nombre, rol: c.rol }) }), await crearSesion(env, id));
}

// --- /api/admin/usuarios (solo administradoras) -----------------------------------------------
export async function rutasUsuarios(req, env, partes, d, s, ctx) {
  exigirPermiso(s, 'usuarios');
  const m = req.method;
  const [recurso, id] = partes;
  if (recurso === 'usuarios') {
    if (m === 'GET') {
      const [us, inv] = await env.BD.batch([
        env.BD.prepare('SELECT id, correo, nombre, rol, activo, creado FROM usuarios ORDER BY creado'),
        env.BD.prepare("SELECT id, correo, nombre, rol, expira FROM codigos WHERE tipo = 'invitacion' ORDER BY expira"),
      ]);
      return json({ roles: ROLES, usuarios: us.results.map((u) => ({ ...u, activo: !!u.activo })), invitaciones: inv.results.filter((i) => !caduco(i)) });
    }
    if (m === 'POST' && !id) {
      const correo = V.correo(d.correo), nombre = V.nombrePersona(d.nombre, true), rol = V.rol(d.rol);
      if (await env.BD.prepare('SELECT 1 FROM usuarios WHERE correo = ?').bind(correo).first()) falla(409, 'Ese correo ya tiene cuenta.');
      const token = b64url(azar(32));
      await env.BD.batch([
        env.BD.prepare("DELETE FROM codigos WHERE tipo = 'invitacion' AND correo = ?").bind(correo),
        env.BD.prepare("INSERT INTO codigos (id, tipo, correo, nombre, rol, expira) VALUES (?, 'invitacion', ?, ?, ?, ?)").bind(await sha256(token), correo, nombre, rol, fechaSql(Date.now() + 48 * 3600 * 1000)),
      ]);
      const enlace = `${sitio(env)}/admin/#invitacion=${token}`;
      await enviarCorreo(env, {
        para: correo, asunto: `Te invitaron al panel de ${env.NOMBRE}`,
        texto: `${s.nombre || 'La administradora'} te invitó al panel de ${env.NOMBRE} como ${ROLES[rol]}.\n\nAbre este enlace para elegir tu contraseña (vence en 48 horas y sirve una sola vez):\n${enlace}\n\nSi no esperabas esta invitación, ignora este correo.`,
      });
      return json({ ok: true, ...(env.DEV === '1' ? { enlace_dev: enlace } : {}) }, 201);
    }
    if (m === 'PUT' && id) {
      const o = await env.BD.prepare('SELECT id, rol, activo FROM usuarios WHERE id = ?').bind(id).first();
      if (!o) falla(404, 'La persona ya no existe.');
      const cambios = {};
      if ('rol' in d) cambios.rol = V.rol(d.rol);
      if ('activo' in d) cambios.activo = d.activo ? 1 : 0;
      if ('nombre' in d) cambios.nombre = V.nombrePersona(d.nombre, true);
      if (id === s.id && ('rol' in cambios || 'activo' in cambios)) falla(400, 'No puedes cambiar tu propio rango ni desactivarte.');
      const dejaDeSerAdmin = o.rol === 'admin' && o.activo && (cambios.rol && cambios.rol !== 'admin' || cambios.activo === 0);
      if (dejaDeSerAdmin && (await env.BD.prepare("SELECT count(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1").first()).n <= 1) falla(400, 'Debe quedar al menos una administradora activa.');
      const ks = Object.keys(cambios);
      if (ks.length) await env.BD.prepare(`UPDATE usuarios SET ${ks.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...ks.map((k) => cambios[k]), id).run();
      // Si cambió su rango o se desactivó, sus sesiones abiertas se cierran para que el cambio valga ya.
      if ('rol' in cambios || cambios.activo === 0) await env.BD.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(id).run();
      return json({ ok: true });
    }
    if (m === 'DELETE' && id) {
      if (id === s.id) falla(400, 'No puedes borrar tu propia cuenta.');
      const o = await env.BD.prepare('SELECT rol, activo FROM usuarios WHERE id = ?').bind(id).first();
      if (!o) falla(404, 'La persona ya no existe.');
      if (o.rol === 'admin' && o.activo && (await env.BD.prepare("SELECT count(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1").first()).n <= 1) falla(400, 'Debe quedar al menos una administradora activa.');
      await env.BD.prepare('DELETE FROM usuarios WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }
  if (recurso === 'invitaciones' && m === 'DELETE' && id) {
    await env.BD.prepare("DELETE FROM codigos WHERE id = ? AND tipo = 'invitacion'").bind(id).run();
    return json({ ok: true });
  }
  void ctx;
  return falla(404, 'Ruta no encontrada.');
}

// --- huella o Face ID (passkeys) -----------------------------------------------------------------
// Solo se activa estando ya dentro (con contraseña). Después, el botón «Entrar con huella o Face ID» evita escribirla.
// La passkey queda atada al dominio desde el que se creó (alexashop.cc): no sirve en otro dominio.
const donde = (req) => { const u = new URL(req.url); return { rpID: u.hostname, origen: u.origin }; };
const MAX_HUELLAS = 10;

async function opcionesRegistro(req, env) {
  const s = await exigirSesion(req, env);
  const { results } = await env.BD.prepare('SELECT id, transportes FROM passkeys WHERE usuario_id = ?').bind(s.id).all();
  if (results.length >= MAX_HUELLAS) falla(400, 'Ya tienes muchos dispositivos activados. Quita alguno primero.');
  const o = await generateRegistrationOptions({
    rpName: `Panel ${env.NOMBRE}`, rpID: donde(req).rpID, userName: s.correo, userDisplayName: s.nombre || s.correo,
    userID: new TextEncoder().encode(s.id), attestationType: 'none',
    // La passkey vive en el teléfono o la computadora y siempre pide huella, rostro o PIN del dispositivo.
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: results.map((p) => ({ id: p.id, transports: JSON.parse(p.transportes) })),
  });
  await env.BD.prepare("INSERT INTO retos (id, tipo, reto, usuario_id, expira) VALUES (?1, 'registro', ?2, ?3, ?4) ON CONFLICT (id) DO UPDATE SET reto = ?2, expira = ?4")
    .bind(`registro:${s.id}`, o.challenge, s.id, fechaSql(Date.now() + 5 * MIN)).run();
  return json(o);
}

async function registrarHuella(req, env, d) {
  const s = await exigirSesion(req, env);
  const reto = await env.BD.prepare("SELECT reto, expira FROM retos WHERE id = ? AND tipo = 'registro'").bind(`registro:${s.id}`).first();
  await env.BD.prepare('DELETE FROM retos WHERE id = ?').bind(`registro:${s.id}`).run(); // un reto sirve una sola vez
  if (!reto || caduco(reto)) falla(400, 'Pasó mucho tiempo. Toca «Activar» otra vez.');
  const { rpID, origen } = donde(req);
  let v;
  try {
    v = await verifyRegistrationResponse({ response: d.respuesta, expectedChallenge: reto.reto, expectedOrigin: origen, expectedRPID: rpID, requireUserVerification: true });
  } catch (e) { console.error('passkey registro', e.message); falla(400, 'No pudimos activar la huella. Intenta de nuevo.'); }
  if (!v.verified) falla(400, 'No pudimos activar la huella. Intenta de nuevo.');
  const c = v.registrationInfo.credential;
  await env.BD.prepare('INSERT INTO passkeys (id, usuario_id, clave_publica, contador, transportes, nombre) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(c.id, s.id, b64url(c.publicKey), c.counter, JSON.stringify(c.transports || []), String(d.nombre || 'Mi dispositivo').slice(0, 60)).run();
  return json({ ok: true });
}

async function opcionesEntrar(req, env) {
  const o = await generateAuthenticationOptions({ rpID: donde(req).rpID, userVerification: 'required' });
  const retoId = b64url(azar(16));
  await env.BD.prepare("INSERT INTO retos (id, tipo, reto, expira) VALUES (?, 'entrada', ?, ?)").bind(retoId, o.challenge, fechaSql(Date.now() + 5 * MIN)).run();
  return json({ ...o, retoId });
}

async function entrarConHuella(req, env, d) {
  const reto = await env.BD.prepare("SELECT reto, expira FROM retos WHERE id = ? AND tipo = 'entrada'").bind(String(d.retoId ?? '')).first();
  await env.BD.prepare('DELETE FROM retos WHERE id = ?').bind(String(d.retoId ?? '')).run();
  if (!reto || caduco(reto)) falla(400, 'Pasó mucho tiempo. Toca el botón otra vez.');
  const p = await env.BD.prepare('SELECT p.*, u.activo, u.correo, u.nombre AS unombre, u.rol FROM passkeys p JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = ?').bind(String(d.respuesta?.id ?? '')).first();
  if (!p || !p.activo) falla(401, 'Esta huella no está activada en el panel. Entra con tu correo y contraseña.');
  const { rpID, origen } = donde(req);
  let v;
  try {
    v = await verifyAuthenticationResponse({
      response: d.respuesta, expectedChallenge: reto.reto, expectedOrigin: origen, expectedRPID: rpID, requireUserVerification: true,
      credential: { id: p.id, publicKey: deB64url(p.clave_publica), counter: p.contador, transports: JSON.parse(p.transportes) },
    });
  } catch (e) { console.error('passkey entrada', e.message); falla(401, 'No pudimos comprobar la huella. Entra con tu contraseña.'); }
  if (!v.verified) falla(401, 'No pudimos comprobar la huella. Entra con tu contraseña.');
  await env.BD.prepare('UPDATE passkeys SET contador = ?, usado = ? WHERE id = ?').bind(v.authenticationInfo.newCounter, fechaSql(), p.id).run();
  return conCookie(json({ ok: true, ...publico({ correo: p.correo, nombre: p.unombre, rol: p.rol }) }), await crearSesion(env, p.usuario_id));
}

async function listarHuellas(req, env) {
  const s = await exigirSesion(req, env);
  const { results } = await env.BD.prepare('SELECT id, nombre, creado, usado FROM passkeys WHERE usuario_id = ? ORDER BY creado').bind(s.id).all();
  return json({ huellas: results });
}
async function quitarHuella(req, env, id) {
  const s = await exigirSesion(req, env);
  await env.BD.prepare('DELETE FROM passkeys WHERE id = ? AND usuario_id = ?').bind(id, s.id).run();
  return json({ ok: true });
}

// --- rutas /api/auth/* ----------------------------------------------------------
export async function rutasAuth(req, env, ruta, d, ctx) {
  const m = req.method;
  if (m === 'GET' && ruta === 'sesion') return estado(req, env);
  if (m === 'GET' && ruta === 'huellas') return listarHuellas(req, env);
  if (m === 'DELETE' && ruta.startsWith('huellas/')) return quitarHuella(req, env, decodeURIComponent(ruta.slice(8)));
  if (m !== 'POST') return falla(404, 'Ruta no encontrada.');
  switch (ruta) {
    case 'entrar': return entrar(req, env, d);
    case 'salir': return salir(req, env, false);
    case 'salir-todo': return salir(req, env, true);
    case 'clave': return cambiarClave(req, env, d);
    case 'configurar': return configurar(req, env, d);
    case 'confirmar': return confirmar(req, env, d);
    case 'recuperar': return recuperar(req, env, d, ctx);
    case 'restablecer': return restablecer(req, env, d, ctx);
    case 'huella/opciones-registro': return opcionesRegistro(req, env);
    case 'huella/registrar': return registrarHuella(req, env, d);
    case 'huella/opciones-entrar': return opcionesEntrar(req, env);
    case 'huella/entrar': return entrarConHuella(req, env, d);
    case 'invitacion-ver': return verInvitacion(req, env, d);
    case 'invitacion-aceptar': return aceptarInvitacion(req, env, d);
    default: return falla(404, 'Ruta no encontrada.');
  }
}
