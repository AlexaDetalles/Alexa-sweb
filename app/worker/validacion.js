// Reglas de los datos que llegan del panel. Repiten las de la base (migraciones/) con mensajes claros.
import { falla } from './util.js';

export const PUBLICOS = ['mujer', 'hombre'];

const RE_FOTO = /^\/fotos\/productos\/[0-9a-f-]{36}-1200\.(webp|jpg)$/;
const RE_FOTO_LOCAL = /^\/assets\/images\/[A-Za-z0-9._-]+\.(webp|png|svg)$/;
export const RE_ID_PRODUCTO = /^[A-Za-z0-9._-]{1,80}$/;
const RE_ID_CATEGORIA = /^[A-Z0-9]{1,14}$/;

function texto(v, max, campo, min = 0) {
  const t = String(v ?? '').trim();
  if (t.length < min) falla(400, `${campo}: es obligatorio.`);
  if (t.length > max) falla(400, `${campo}: máximo ${max} caracteres.`);
  return t;
}
function numero(v, campo, { min = 0, max = 1000000, nulo = false } = {}) {
  if (nulo && (v === null || v === '' || v === undefined)) return null;
  const n = Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < min || n > max) falla(400, `${campo}: escribe un número válido.`);
  return Math.round(n * 100) / 100;
}
const entero = (v, campo, max = 100000) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) falla(400, `${campo}: número entero no válido.`);
  return n;
};
const booleano = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);
const fotoONula = (v) => {
  if (v === null || v === '' || v === undefined) return null;
  const s = String(v);
  if (!RE_FOTO.test(s) && !RE_FOTO_LOCAL.test(s)) falla(400, 'Foto: dirección no válida. Sube la foto desde el panel.');
  return s;
};

/** Solo los campos presentes: sirve para crear (todos) y para cambiar uno solo (visible, agotado, orden…). */
export function producto(d, crear = false) {
  const r = {};
  if (crear && d.id) {
    r.id = String(d.id).trim();
    if (!RE_ID_PRODUCTO.test(r.id) || ['__proto__', 'constructor', 'prototype'].includes(r.id)) falla(400, 'Referencia: solo letras, números, punto, guion y guion bajo (máximo 80).');
  }
  if (crear || 'nombre' in d) r.nombre = texto(d.nombre, 120, 'Nombre', 1);
  if (crear || 'categoria_id' in d) {
    r.categoria_id = String(d.categoria_id ?? '');
    if (!RE_ID_CATEGORIA.test(r.categoria_id)) falla(400, 'Elige una categoría.');
  }
  if ('descripcion' in d) r.descripcion = texto(d.descripcion, 1200, 'Descripción');
  if ('cotizar' in d) r.cotizar = booleano(d.cotizar);
  if (crear || 'precio' in d || 'cotizar' in d) {
    const cotiza = 'cotizar' in d ? r.cotizar : 0;
    r.precio = cotiza ? null : numero(d.precio, 'Precio');
  }
  if ('imagen_url' in d) r.imagen_url = fotoONula(d.imagen_url);
  if ('disponible' in d) r.disponible = booleano(d.disponible);
  if ('visible' in d) r.visible = booleano(d.visible);
  if ('lote_id' in d) r.lote_id = d.lote_id === null || d.lote_id === '' ? null : entero(d.lote_id, 'Lote', 1000000000);
  if ('referencia' in d) r.referencia = numero(d.referencia, 'Precio de referencia', { nulo: true });
  if ('lote_cantidad' in d) {
    r.lote_cantidad = d.lote_cantidad === null || d.lote_cantidad === '' ? null : entero(d.lote_cantidad, 'Unidades del lote');
    if (r.lote_cantidad === 0) falla(400, 'Unidades del lote: mínimo 1.');
  }
  if ('costo' in d) r.costo = numero(d.costo, 'Costo', { nulo: true });
  if ('tipo_stock' in d) {
    if (!['aparte', 'local', 'sin'].includes(d.tipo_stock)) falla(400, 'Tipo de stock: elige stock aparte, stock local o sin stock.');
    r.tipo_stock = d.tipo_stock;
  }
  if ('cantidad' in d) r.cantidad = d.cantidad === null || d.cantidad === '' ? null : entero(d.cantidad, 'Cantidad');
  if ('orden' in d) r.orden = entero(d.orden, 'Orden');
  return r;
}

export function categoria(d, crear = false) {
  const r = {};
  if (crear || 'nombre' in d) r.nombre = texto(d.nombre, 60, 'Nombre', 1);
  if ('padre_id' in d) {
    r.padre_id = d.padre_id ? String(d.padre_id) : null;
    if (r.padre_id && !RE_ID_CATEGORIA.test(r.padre_id)) falla(400, 'Categoría principal: no válida.');
  }
  if ('activa' in d) r.activa = booleano(d.activa);
  if ('orden' in d) r.orden = entero(d.orden, 'Orden', 10000);
  return r;
}

export const RE_PASO = /^[a-z0-9-]{1,30}$/;
const idPaso = (v, campo) => { const s = String(v ?? ''); if (!RE_PASO.test(s)) falla(400, `${campo}: no válido.`); return s; };

/** `publico` y `paso` solo se eligen al crear; después una opción no cambia de paso ni de público. */
export function opcion(d, crear = false) {
  const r = {};
  if (crear) {
    if (!PUBLICOS.includes(d.publico)) falla(400, 'Elige si el regalo es para ella o para él.');
    r.publico = d.publico; r.paso = idPaso(d.paso, 'Paso');
  }
  if (crear || 'nombre' in d) r.nombre = texto(d.nombre, 80, 'Nombre', 1);
  if ('descripcion' in d) r.descripcion = texto(d.descripcion, 200, 'Descripción');
  if ('etiqueta' in d) r.etiqueta = texto(d.etiqueta, 20, 'Etiqueta');
  if (crear || 'precio' in d) r.precio = numero(d.precio ?? 0, 'Precio');
  if ('padre_id' in d) r.padre_id = d.padre_id ? String(d.padre_id) : null;
  if ('imagen_url' in d) r.imagen_url = fotoONula(d.imagen_url);
  if ('activa' in d) r.activa = booleano(d.activa);
  if ('orden' in d) r.orden = entero(d.orden, 'Orden', 10000);
  return r;
}

/** Un paso del regalo. Las reglas cruzadas (mínimo ≤ máximo, único = 1) se revisan en datos.js con los valores finales. */
export function paso(d, crear = false) {
  const r = {};
  if (crear) {
    if (!PUBLICOS.includes(d.publico)) falla(400, 'Elige si el regalo es para ella o para él.');
    r.publico = d.publico;
  }
  if (crear || 'nombre' in d) r.nombre = texto(d.nombre, 24, 'Nombre', 1);
  if (crear || 'titulo' in d) r.titulo = texto(d.titulo, 70, 'Título', 1);
  if ('descripcion' in d) r.descripcion = texto(d.descripcion, 240, 'Descripción');
  if ('tipo' in d) { if (!['unico', 'multiple'].includes(d.tipo)) falla(400, 'Tipo de paso no válido.'); r.tipo = d.tipo; }
  if ('minimo' in d) r.minimo = entero(d.minimo, 'Mínimo', 20);
  if ('maximo' in d) { r.maximo = entero(d.maximo, 'Máximo', 50); if (r.maximo < 1) falla(400, 'Máximo: al menos 1.'); }
  if ('depende_de' in d) r.depende_de = d.depende_de ? idPaso(d.depende_de, 'Depende de') : null;
  if ('activo' in d) r.activo = booleano(d.activo);
  if ('orden' in d) r.orden = entero(d.orden, 'Orden', 10000);
  return r;
}

/** Textos y dedicatoria del regalo de cada público. */
export function configRegalo(d) {
  const r = {};
  if ('titulo' in d) r.titulo = texto(d.titulo, 80, 'Título');
  if ('intro' in d) r.intro = texto(d.intro, 240, 'Introducción');
  if ('dedicatoria_activa' in d) r.dedicatoria_activa = booleano(d.dedicatoria_activa);
  if ('dedicatoria_titulo' in d) r.dedicatoria_titulo = texto(d.dedicatoria_titulo, 70, 'Título de la dedicatoria');
  if ('dedicatoria_ayuda' in d) r.dedicatoria_ayuda = texto(d.dedicatoria_ayuda, 240, 'Ayuda de la dedicatoria');
  if ('dedicatoria_max' in d) { r.dedicatoria_max = entero(d.dedicatoria_max, 'Largo de la dedicatoria', 600); if (r.dedicatoria_max < 20) falla(400, 'Largo de la dedicatoria: mínimo 20.'); }
  if ('nota_final' in d) r.nota_final = texto(d.nota_final, 240, 'Nota final');
  if ('activo' in d) r.activo = booleano(d.activo);
  return r;
}

export function ajustes(d) {
  const r = {};
  for (const n of ['1', '2']) {
    if (`asesora${n}_nombre` in d) r[`asesora${n}_nombre`] = texto(d[`asesora${n}_nombre`], 40, `Nombre de la asesora ${n}`, 1);
    if (`asesora${n}_whatsapp` in d) {
      const num = String(d[`asesora${n}_whatsapp`] || '').replace(/\D/g, '');
      if (num && (num.length < 10 || num.length > 15)) falla(400, `WhatsApp de la asesora ${n}: escribe el número con código de país, por ejemplo 504 9999 8888.`);
      r[`asesora${n}_whatsapp`] = num;
    }
  }
  return r;
}

const CLAVES_COMUNES = new Set(['123456789012', 'contrasena123', 'contraseña123', 'password1234', 'qwertyuiop12', 'alexashop1234', 'alexadetalles', 'administrador', 'administradora']);
export const claveNueva = (v) => {
  const t = String(v ?? '');
  if (t.length < 12) falla(400, 'La contraseña debe tener al menos 12 caracteres.');
  if (t.length > 200) falla(400, 'La contraseña es demasiado larga.');
  if (CLAVES_COMUNES.has(t.toLowerCase()) || /^(.)\1+$/.test(t)) falla(400, 'Esa contraseña es muy común. Elige otra, más difícil de adivinar.');
  return t;
};
export const ROLES = ['admin', 'catalogo', 'atencion', 'lectura'];
export const rol = (v) => (ROLES.includes(v) ? v : falla(400, 'Elige un rango.'));
export const nombrePersona = (v, obligatorio) => texto(v, 60, 'Nombre', obligatorio ? 1 : 0);
export const correo = (v) => {
  const t = String(v ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) || t.length > 120) falla(400, 'Escribe un correo válido.');
  return t;
};
