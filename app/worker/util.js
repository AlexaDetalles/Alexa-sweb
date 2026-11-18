// Utilidades del Worker: respuestas, cookies firmadas, hashes y fechas.

export class ErrorApi extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}
export const falla = (estado, mensaje) => { throw new ErrorApi(estado, mensaje); };

export function json(datos, estado = 200, extra = {}) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

// --- texto y bytes ------------------------------------------------------------
const cod = new TextEncoder();
export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const deHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
export const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const deB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export const azar = (n = 32) => crypto.getRandomValues(new Uint8Array(n));
export const sha256 = async (texto) => hex(await crypto.subtle.digest('SHA-256', cod.encode(texto)));

/** Compara dos textos sin revelar por el tiempo en qué carácter difieren. */
export function iguales(a, b) {
  const x = cod.encode(String(a)); const y = cod.encode(String(b));
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

// --- contraseñas: PBKDF2-SHA256 (100 000 iteraciones es el máximo del Worker) --
const ITERACIONES = 100000;
async function derivar(clave, sal, iteraciones) {
  const base = await crypto.subtle.importKey('raw', cod.encode(clave), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, base, 256));
}
export async function hashClave(clave) {
  const sal = azar(16);
  return `pbkdf2$${ITERACIONES}$${hex(sal)}$${await derivar(clave, sal, ITERACIONES)}`;
}
export async function revisarClave(clave, guardada) {
  const [tipo, it, sal, hash] = String(guardada).split('$');
  if (tipo !== 'pbkdf2' || !hash) return false;
  return iguales(await derivar(clave, deHex(sal), Number(it)), hash);
}
// Mismo trabajo cuando el correo no existe, para no revelar qué correos tienen cuenta.
export const CLAVE_FALSA = `pbkdf2$${ITERACIONES}$${'00'.repeat(16)}$${'00'.repeat(32)}`;

// --- cookies ------------------------------------------------------------------
export function leerCookie(req, nombre) {
  const m = (req.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
/** Cookie __Host-: solo HTTPS, sin dominio, para toda la web y fuera del alcance de JavaScript. */
export const cookie = (nombre, valor, segundos) => `${nombre}=${encodeURIComponent(valor)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${segundos}`;
export const borrarCookie = (nombre) => cookie(nombre, '', 0);

// --- fechas -------------------------------------------------------------------
// SQLite guarda 'AAAA-MM-DD HH:MM:SS' en UTC.
export const fechaSql = (ms = Date.now()) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
// Día en Honduras (UTC-6, sin horario de verano), para la actividad web.
export const diaHonduras = (ms = Date.now()) => new Date(ms - 6 * 3600 * 1000).toISOString().slice(0, 10);

/** Un producto se puede pedir si está marcado «Hay» y, cuando se lleva el control, le quedan unidades. */
export const hayExistencias = (p) => !!p.disponible && p.tipo_stock !== 'sin' && (p.cantidad === null || p.cantidad === undefined || p.cantidad > 0);

/** Tipos de stock: aparte = dropshipping; local1 = lo tienes y no tiene inversión (costo 0); local2 = comprado con inversión (lote); sin = sin stock. */
export const TIPOS_STOCK = { aparte: 'Stock aparte', local1: 'Stock local 1', local2: 'Stock local 2', sin: 'Sin stock' };
export const esLocal = (t) => t === 'local1' || t === 'local2';

/**
 * Qué se muestra en la tienda (alias p = productos): visible, con existencias y no privado.
 *  · Lo AGOTADO no se muestra: marcado «Agotado», «Sin stock» o con cantidad 0.
 *  · El Stock local 2 es privado mientras ajustes.mostrar_local2 = 0.
 * El panel sí ve todo.
 */
export const SQL_EN_TIENDA = "p.visible = 1 AND p.disponible = 1 AND p.tipo_stock <> 'sin' AND (p.cantidad IS NULL OR p.cantidad > 0) AND (p.tipo_stock <> 'local2' OR (SELECT mostrar_local2 FROM ajustes WHERE id = 1) = 1)";
