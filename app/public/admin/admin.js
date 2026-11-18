// Panel de administración de Alexa Detalles: productos, categorías, regalos personalizados y ajustes.
// Sin librerías. Todo lo que viene de la base de datos pasa por esc() antes de llegar al HTML.
import { dibujarInstagram, nombreArchivo, crearImagen, esColor, PALETAS } from '/admin/instagram.js';
import { crearZip, nombreSeguro } from '/admin/zip.js';
import { armarDescripcion, aISO } from '/admin/social.js';
import { estimarEnLote } from '/admin/lotes.js';
import { cuotaSugerida, resumenCredito, enlaceRecordatorio } from '/admin/creditos.js';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = (n) => (n === null || n === undefined || n === '' ? '—' : new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(Number(n)));
const ico = (id) => `<svg class="ico" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const fold = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PERMISOS = { admin: ['catalogo', 'ajustes', 'usuarios', 'estadisticas', 'finanzas'], catalogo: ['catalogo'], atencion: ['ajustes'], lectura: ['estadisticas'] };
const E = { invFiltro: 'todos', invTexto: '', invCat: '', yo: null, usuarios: [], invitaciones: [], roles: {}, cats: [], prods: [], papelera: [], ops: [], pasos: [], regaloCfg: [], ajustes: {}, vista: 'productos', texto: '', cat: '', filtro: 'todos', publico: 'mujer', foto: null, editando: null, opcion: null, categoria: null };

// --- avisos, confirmación y llamadas a la API ------------------------------------------
function avisar(texto, mal = false) {
  const d = document.createElement('div');
  d.textContent = texto;
  if (mal) d.className = 'mal';
  $('#avisos').append(d);
  setTimeout(() => d.remove(), mal ? 6000 : 3000);
}

function confirmar(titulo, texto, boton = 'Sí, continuar') {
  const dlg = $('#dlg-confirmar');
  $('#dlg-confirmar-t').textContent = titulo;
  $('#confirmar-texto').textContent = texto;
  $('#confirmar-si').textContent = boton;
  dlg.returnValue = 'no';
  dlg.showModal();
  return new Promise((res) => dlg.addEventListener('close', () => res(dlg.returnValue === 'si'), { once: true }));
}

async function api(metodo, ruta, cuerpo) {
  const init = { method: metodo, headers: {}, credentials: 'same-origin' };
  if (cuerpo instanceof FormData) init.body = cuerpo;
  else if (cuerpo !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(cuerpo); }
  let r;
  try { r = await fetch(`/api/${ruta}`, init); } catch { throw new Error('No hay conexión. Revisa tu internet e intenta de nuevo.'); }
  const datos = await r.json().catch(() => ({}));
  if (r.status === 401 && ruta.startsWith('admin/')) { mostrarEntrar('Tu sesión terminó. Vuelve a entrar.'); throw new Error(datos.error || 'Tu sesión terminó.'); }
  if (!r.ok) throw new Error(datos.error || 'Algo salió mal. Intenta de nuevo.');
  return datos;
}

/** Corre una acción del panel: muestra el error en un aviso y recarga los datos si salió bien. */
async function hacer(fn, ok) {
  try { const r = await fn(); await cargar(); if (ok) avisar(ok); return r ?? true; } catch (e) { avisar(e.message, true); return false; }
}
function mostrarError(id, texto) { const el = $(id); el.textContent = texto || ''; el.hidden = !texto; }

// --- categorías: ayudas de árbol ------------------------------------------------------
const catPorId = (id) => E.cats.find((c) => c.id === id);
const raices = () => E.cats.filter((c) => !c.padre_id);
const hijas = (id) => E.cats.filter((c) => c.padre_id === id);
const nombreCat = (id) => { const c = catPorId(id); return c ? (c.padre_id ? `${catPorId(c.padre_id)?.nombre ?? ''} › ${c.nombre}` : c.nombre) : 'Sin categoría'; };
const dentroDe = (id, raiz) => id === raiz || catPorId(id)?.padre_id === raiz;
const catVisible = (id) => { const c = catPorId(id); return !!c && c.activa && (!c.padre_id || !!catPorId(c.padre_id)?.activa); };
function opcionesCat(elegida, { todas = true, vacia = '' } = {}) {
  const fila = (c, nivel) => `<option value="${esc(c.id)}" ${c.id === elegida ? 'selected' : ''}>${nivel ? '   · ' : ''}${esc(c.nombre)}${c.activa ? '' : ' (oculta)'}</option>`;
  return (vacia ? `<option value="">${esc(vacia)}</option>` : '') + raices().map((r) => fila(r, 0) + (todas ? hijas(r.id).map((h) => fila(h, 1)).join('') : '')).join('');
}

/** Pone `nuevo` (orden nuevo de un subconjunto) en los mismos huecos que ocupaba ese subconjunto dentro de `todos`. */
function permutar(todos, nuevo) {
  const set = new Set(nuevo); let k = 0;
  return todos.map((x) => (set.has(x) ? nuevo[k++] : x));
}
function intercambiar(ids, id, dir) {
  const i = ids.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const nuevo = [...ids]; [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
  return nuevo;
}

// --- entrar, crear la cuenta principal, recuperar y aceptar invitaciones -----------------
const MODOS = ['entrar', 'configurar', 'codigo', 'olvide', 'restablecer', 'invitacion'];
let enlaceToken = null; // token del enlace de correo; vive solo en memoria (se quita de la dirección al leerlo)
function mostrarEntrar(mensaje, modo = 'entrar') {
  $('#vista-panel').hidden = true; $('#vista-entrar').hidden = false;
  mostrarModo(modo);
  mostrarError('#error-entrar', mensaje);
}
function mostrarModo(modo) {
  MODOS.forEach((m) => { $(`#form-${m}`).hidden = m !== modo; });
  $$('#vista-entrar .error').forEach((e) => { if (modo !== 'entrar') e.hidden = true; });
  const f = $(`#form-${modo}`);
  (f.querySelector('input:not([hidden])') || f).focus();
}
document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-modo]'); if (b) mostrarModo(b.dataset.modo); });

function aplicarSesion(yo) {
  E.yo = yo;
  const permisos = PERMISOS[yo.rol] || [];
  for (const p of ['catalogo', 'ajustes', 'usuarios', 'estadisticas', 'finanzas']) document.body.toggleAttribute(`data-p-${p}`, permisos.includes(p));
  document.body.dataset.rol = yo.rol;
  $('#quien').textContent = `${yo.nombre || yo.correo} · ${yo.rolNombre || ''}`;
  $$('#form-ajustes input, #form-ajustes button').forEach((x) => { x.disabled = !permisos.includes('ajustes'); });
}
async function mostrarPanel(yo) {
  $('#vista-entrar').hidden = true; $('#vista-panel').hidden = false;
  aplicarSesion(yo);
  await cargar();
  cargarAlertas();
  mostrarAvisoHuella();
  ir(location.hash.slice(1) || 'productos');
}
const iniciarSesion = async (datos) => { let huellas = 0; try { huellas = (await api('GET', 'auth/sesion')).sesion?.huellas ?? 0; } catch { /* sin dato */ } return mostrarPanel({ correo: datos.correo, nombre: datos.nombre, rol: datos.rol, rolNombre: datos.rolNombre, huellas }); };
const enviar = (formId, errorId, fn) => $(formId).addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, b = $('button[type=submit]', f);
  b.disabled = true; mostrarError(errorId);
  try { await fn(f); } catch (e) { mostrarError(errorId, e.message); }
  b.disabled = false;
});
const igual = (f, a = 'clave', b = 'repite') => { if (f[a].value !== f[b].value) throw new Error('Las contraseñas no coinciden.'); };

enviar('#form-entrar', '#error-entrar', async (f) => {
  await iniciarSesion(await api('POST', 'auth/entrar', { correo: f.correo.value, clave: f.clave.value }));
  f.clave.value = '';
});
enviar('#form-configurar', '#error-configurar', async (f) => {
  igual(f);
  const r = await api('POST', 'auth/configurar', { correo: f.correo.value, nombre: f.nombre.value, clave: f.clave.value });
  $('#codigo-texto').textContent = `Te enviamos un código de 6 dígitos a ${f.correo.value.trim()}. Vence en 10 minutos.`;
  $('#form-codigo').dataset.correo = f.correo.value.trim().toLowerCase();
  mostrarModo('codigo');
  if (r.codigo_dev) $('#form-codigo').codigo.value = r.codigo_dev; // solo en pruebas locales
});
enviar('#form-codigo', '#error-codigo', async (f) => {
  await iniciarSesion(await api('POST', 'auth/confirmar', { correo: f.dataset.correo, codigo: f.codigo.value }));
  f.codigo.value = '';
  $('#form-configurar').reset();
});
enviar('#form-olvide', '#error-olvide', async (f) => {
  await api('POST', 'auth/recuperar', { correo: f.correo.value });
  $('#ok-olvide').hidden = false;
});
enviar('#form-restablecer', '#error-restablecer', async (f) => {
  igual(f, 'nueva', 'repite');
  await api('POST', 'auth/restablecer', { token: enlaceToken, nueva: f.nueva.value });
  enlaceToken = null; f.reset();
  mostrarEntrar('', 'entrar'); avisar('Contraseña cambiada. Ya puedes entrar.');
});
enviar('#form-invitacion', '#error-invitacion', async (f) => {
  igual(f);
  await iniciarSesion(await api('POST', 'auth/invitacion-aceptar', { token: enlaceToken, nombre: f.nombre.value, clave: f.clave.value }));
  enlaceToken = null; f.reset();
});

async function salir(todo) {
  try { await api('POST', todo ? 'auth/salir-todo' : 'auth/salir'); } catch { /* si ya no había sesión, da igual */ }
  E.yo = null; mostrarEntrar();
}
$('#salir').addEventListener('click', () => salir(false));
$('#salir-todo').addEventListener('click', async () => { if (await confirmar('Cerrar todas las sesiones', 'Tendrás que volver a entrar en este y en cualquier otro dispositivo.')) salir(true); });

// --- datos y navegación ---------------------------------------------------------------
async function cargar() {
  const d = await api('GET', 'admin/datos');
  Object.assign(E, { cats: d.categorias, prods: d.productos, papelera: d.papelera, ops: d.opciones, pasos: d.pasos, regaloCfg: d.regalo_config, ajustes: d.ajustes });
  pintar();
  cargarContador();
}
const VISTAS = ['productos', 'inventario', 'categorias', 'lotes', 'finanzas', 'redes', 'regalos', 'estadisticas', 'ajustes'];
function ir(vista) {
  if (vista === 'usuarios') vista = 'ajustes'; // los usuarios viven dentro de Ajustes
  if (!VISTAS.includes(vista) || (vista === 'estadisticas' && !PERMISOS[E.yo?.rol]?.includes('estadisticas')) || (['inventario', 'redes'].includes(vista) && !PERMISOS[E.yo?.rol]?.includes('catalogo')) || (['finanzas', 'lotes'].includes(vista) && !PERMISOS[E.yo?.rol]?.includes('finanzas'))) vista = 'productos';
  E.vista = vista;
  history.replaceState(null, '', `#${vista}`);
  for (const s of VISTAS) $(`#sec-${s}`).hidden = s !== vista;
  $$('#pestanas button').forEach((b) => (b.dataset.ir === vista ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  pintar();
}
$('#pestanas').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ir]'); if (b) ir(b.dataset.ir); });
function pintar() {
  if (E.vista === 'productos') pintarProductos();
  else if (E.vista === 'inventario') pintarInventario();
  else if (E.vista === 'lotes') cargarLotes();
  else if (E.vista === 'finanzas') cargarFinanzas();
  else if (E.vista === 'redes') cargarRedes();
  else if (E.vista === 'categorias') pintarCategorias();
  else if (E.vista === 'regalos') pintarRegalos();
  else if (E.vista === 'estadisticas') pintarEstadisticas();
  else pintarAjustes();
}

// --- productos -------------------------------------------------------------------------
const miniatura = (p) => (p.imagen_url ? `<img src="${esc(p.imagen_url.startsWith('/fotos/') ? p.imagen_url.replace('-1200.', '-600.') : p.imagen_url)}" alt="" loading="lazy">` : ico('foto'));
/** Un producto se vende si está en «Hay» y, cuando se cuenta, le queda alguna unidad. */
const hay = (p) => p.disponible && p.tipo_stock !== 'sin' && (p.cantidad === null || p.cantidad === undefined || p.cantidad > 0);
const POCAS = 5;
const FILTROS = [['todos', 'Todos', () => true], ['visibles', 'Visibles', (p) => p.visible], ['ocultos', 'Ocultos', (p) => !p.visible], ['agotados', 'Sin existencias', (p) => !hay(p)], ['sinfoto', 'Sin foto', (p) => !p.imagen_url]];
function productosFiltrados() {
  if (E.filtro === 'papelera') return E.papelera;
  const t = fold(E.texto.trim()), f = FILTROS.find((x) => x[0] === E.filtro)?.[2] ?? (() => true);
  return E.prods.filter((p) => f(p) && (!E.cat || dentroDe(p.categoria_id, E.cat)) && (!t || fold(`${p.nombre} ${p.id}`).includes(t)));
}
function pintarProductos() {
  const lista = productosFiltrados(), enPapelera = E.filtro === 'papelera';
  $('#conteo').textContent = `${E.prods.length} en la tienda · ${E.prods.filter((p) => !p.visible).length} ocultos`;
  $('#chips').innerHTML = FILTROS.map(([k, t, f]) => `<button type="button" class="chip" data-filtro="${k}" aria-pressed="${E.filtro === k}">${t}<b>${E.prods.filter(f).length}</b></button>`).join('')
    + `<button type="button" class="chip" data-filtro="papelera" aria-pressed="${enPapelera}">Papelera<b>${E.papelera.length}</b></button>`;
  $('#filtro-categoria').innerHTML = opcionesCat(E.cat, { vacia: 'Todas las categorías' });
  $('#nota-papelera').hidden = !enPapelera;
  const ordenable = !enPapelera && !E.texto.trim() && E.filtro === 'todos';
  $('#lista-productos').innerHTML = lista.map((p, i) => {
    const etiquetas = [
      !p.visible && '<span class="etiqueta aviso">Oculto</span>',
      !hay(p) && `<span class="etiqueta mal">Agotado${p.visible ? ' · no se ve en la tienda' : ''}</span>`,
      p.cantidad !== null && p.cantidad > 0 && p.cantidad <= POCAS && '<span class="etiqueta aviso">Quedan ' + p.cantidad + '</span>',
      (p.tipo_stock === 'local1' || p.tipo_stock === 'local2') && `<span class="etiqueta ok">${TIPOS_STOCK[p.tipo_stock]}</span>`,
      p.tipo_stock === 'local2' && E.local2Publico === false && '<span class="etiqueta aviso">🔒 Privado</span>',
      p.cotizar && '<span class="etiqueta">Por cotizar</span>',
      p.visible && !enPapelera && !catVisible(p.categoria_id) && '<span class="etiqueta aviso">Su categoría está oculta</span>',
    ].filter(Boolean).join('');
    const meta = `<span>${esc(p.id)}</span><span>${esc(nombreCat(p.categoria_id))}</span><span class="precio">${p.cotizar ? 'Por cotizar' : esc(dinero(p.precio))}</span>${etiquetas}`;
    const acciones = enPapelera
      ? `<button type="button" class="boton suave chico" data-accion="restaurar" data-id="${esc(p.id)}">Restaurar</button><button type="button" class="boton suave peligro chico" data-accion="eliminar" data-id="${esc(p.id)}">Eliminar para siempre</button>`
      : `<button type="button" class="icono" data-accion="visible" data-id="${esc(p.id)}" aria-pressed="${p.visible}" aria-label="${p.visible ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}: ${esc(p.nombre)}" title="${p.visible ? 'Visible: toca para ocultar' : 'Oculto: toca para mostrar'}">${ico(p.visible ? 'ojo' : 'ojo-no')}</button>
         <button type="button" class="boton suave chico" data-accion="existencias" data-id="${esc(p.id)}" aria-pressed="${p.disponible}">${p.disponible ? 'Hay' : 'Agotado'}</button>
         ${ordenable ? `<button type="button" class="icono" data-accion="subir" data-id="${esc(p.id)}" aria-label="Subir ${esc(p.nombre)}" ${i === 0 ? 'disabled' : ''}>${ico('arriba')}</button><button type="button" class="icono" data-accion="bajar" data-id="${esc(p.id)}" aria-label="Bajar ${esc(p.nombre)}" ${i === lista.length - 1 ? 'disabled' : ''}>${ico('abajo')}</button>` : ''}
         <button type="button" class="icono" data-accion="editar" data-id="${esc(p.id)}" aria-label="Editar ${esc(p.nombre)}">${ico('editar')}</button>`;
    return `<li class="fila ${p.visible && !enPapelera ? '' : 'apagada'}"><span class="mini">${miniatura(p)}</span><div class="fila-texto"><div class="fila-nombre">${esc(p.nombre)}</div><div class="fila-meta">${meta}</div></div><div class="fila-acciones">${acciones}</div></li>`;
  }).join('');
  $('#sin-productos').hidden = lista.length > 0;
}
$('#buscar').addEventListener('input', (ev) => { E.texto = ev.target.value; pintarProductos(); });
$('#filtro-categoria').addEventListener('change', (ev) => { E.cat = ev.target.value; pintarProductos(); });
$('#chips').addEventListener('click', (ev) => { const b = ev.target.closest('[data-filtro]'); if (b) { E.filtro = b.dataset.filtro; pintarProductos(); } });
$('#nuevo-producto').addEventListener('click', () => abrirProducto(null));

$('#lista-productos').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-accion]');
  if (!b) return;
  const id = b.dataset.id, p = E.prods.find((x) => x.id === id) || E.papelera.find((x) => x.id === id);
  switch (b.dataset.accion) {
    case 'editar': return abrirProducto(p);
    case 'visible': return void hacer(() => api('PUT', `admin/productos/${encodeURIComponent(id)}`, { visible: !p.visible }));
    case 'existencias': return void hacer(() => api('PUT', `admin/productos/${encodeURIComponent(id)}`, { disponible: !p.disponible }));
    case 'subir': case 'bajar': {
      const nuevo = intercambiar(productosFiltrados().map((x) => x.id), id, b.dataset.accion === 'subir' ? -1 : 1);
      if (nuevo) return void hacer(() => api('POST', 'admin/orden', { tabla: 'productos', ids: permutar(E.prods.map((x) => x.id), nuevo) }));
      return;
    }
    case 'restaurar': return void hacer(() => api('POST', `admin/productos/${encodeURIComponent(id)}/restaurar`), `«${p.nombre}» volvió a tus productos.`);
    case 'eliminar':
      if (await confirmar('Eliminar para siempre', `«${p.nombre}» y su foto se borrarán y no se pueden recuperar.`, 'Eliminar para siempre')) await hacer(() => api('DELETE', `admin/productos/${encodeURIComponent(id)}?definitivo=1`), 'Eliminado.');
  }
});

// --- inventario: cantidades en existencia -------------------------------------------------
const INV_FILTROS = [['todos', 'Todos', () => true], ['control', 'Con cantidad', (p) => p.cantidad !== null], ['sin', 'Sin control', (p) => p.cantidad === null], ['pocas', 'Quedan pocas', (p) => p.cantidad !== null && p.cantidad > 0 && p.cantidad <= POCAS], ['cero', 'Agotados (0)', (p) => p.cantidad === 0]];
function inventarioFiltrado() {
  const t = fold(E.invTexto.trim()), f = INV_FILTROS.find((x) => x[0] === E.invFiltro)?.[2] ?? (() => true);
  return E.prods.filter((p) => f(p) && (!E.invCat || dentroDe(p.categoria_id, E.invCat)) && (!t || fold(`${p.nombre} ${p.id}`).includes(t)));
}
function pintarInventario() {
  const lista = inventarioFiltrado(), controlados = E.prods.filter((p) => p.cantidad !== null);
  $('#inv-resumen').textContent = `${controlados.length} de ${E.prods.length} con cantidad · ${controlados.reduce((s, p) => s + p.cantidad, 0).toLocaleString('es-HN')} unidades en total`;
  $('#inv-chips').innerHTML = INV_FILTROS.map(([k, t, f]) => `<button type="button" class="chip" data-invfiltro="${k}" aria-pressed="${E.invFiltro === k}">${t}<b>${E.prods.filter(f).length}</b></button>`).join('');
  $('#inv-categoria').innerHTML = opcionesCat(E.invCat, { vacia: 'Todas las categorías' });
  $('#lista-inventario').innerHTML = lista.map((p) => {
    const etiqueta = p.cantidad === null ? '<span class="etiqueta">Sin control</span>'
      : p.cantidad === 0 ? '<span class="etiqueta mal">Agotado</span>'
      : p.cantidad <= POCAS ? '<span class="etiqueta aviso">Quedan pocas</span>' : '';
    const controles = p.cantidad === null
      ? `<button type="button" class="boton suave chico" data-inv="controlar" data-id="${esc(p.id)}">Contar unidades</button>`
      : `<button type="button" class="icono" data-inv="menos" data-id="${esc(p.id)}" aria-label="Quitar una unidad: ${esc(p.nombre)}" ${p.cantidad === 0 ? 'disabled' : ''}>−</button><input class="inv-input" type="number" inputmode="numeric" min="0" max="100000" step="1" value="${p.cantidad}" data-inv-input data-id="${esc(p.id)}" aria-label="Cantidad de ${esc(p.nombre)}"><button type="button" class="icono" data-inv="mas" data-id="${esc(p.id)}" aria-label="Agregar una unidad: ${esc(p.nombre)}">+</button><button type="button" class="boton suave chico" data-inv="dejar" data-id="${esc(p.id)}" title="Dejar de contar las unidades de este producto">Sin control</button>`;
    const tipo = `<span class="etiqueta ${p.tipo_stock === 'local1' || p.tipo_stock === 'local2' ? 'ok' : p.tipo_stock === 'sin' ? 'mal' : ''}">${TIPOS_STOCK[p.tipo_stock] ?? ''}</span>`;
    const dinerito = (p.tipo_stock === 'sin' ? '' : `<button type="button" class="boton suave chico" data-inv="vender" data-id="${esc(p.id)}">Vendí</button>`) + (p.tipo_stock === 'local2' && !p.lote_id ? `<button type="button" class="boton suave chico" data-inv="comprar" data-id="${esc(p.id)}">Compré</button>` : '');
    return `<li class="fila ${p.visible ? '' : 'apagada'}"><span class="mini">${miniatura(p)}</span><div class="fila-texto"><div class="fila-nombre">${esc(p.nombre)}</div><div class="fila-meta"><span>${esc(p.id)}</span><span>${esc(nombreCat(p.categoria_id))}</span>${tipo}${etiqueta}${p.visible ? '' : '<span class="etiqueta aviso">Oculto</span>'}</div></div><div class="fila-acciones inv-cant">${controles}${dinerito}</div></li>`;
  }).join('');
  $('#inv-vacio').hidden = lista.length > 0;
}
$('#inv-buscar').addEventListener('input', (ev) => { E.invTexto = ev.target.value; pintarInventario(); });
$('#inv-categoria').addEventListener('change', (ev) => { E.invCat = ev.target.value; pintarInventario(); });
$('#inv-chips').addEventListener('click', (ev) => { const b = ev.target.closest('[data-invfiltro]'); if (b) { E.invFiltro = b.dataset.invfiltro; pintarInventario(); } });
/** Guarda la cantidad de un producto sin recargar toda la lista (así no se pierde el lugar ni el foco). */
async function fijarCantidad(id, valor, foco) {
  const p = E.prods.find((x) => x.id === id); if (!p) return;
  try {
    await api('PUT', `admin/productos/${encodeURIComponent(id)}`, { cantidad: valor });
    p.cantidad = valor;
  } catch (e) { avisar(e.message, true); }
  pintarInventario();
  if (foco) $(`#lista-inventario [${foco}][data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
$('#lista-inventario').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-inv]'); if (!b) return;
  const p = E.prods.find((x) => x.id === b.dataset.id); if (!p) return;
  switch (b.dataset.inv) {
    case 'menos': return void fijarCantidad(p.id, Math.max(0, p.cantidad - 1), 'data-inv="menos"');
    case 'mas': return void fijarCantidad(p.id, Math.min(100000, p.cantidad + 1), 'data-inv="mas"');
    case 'vender': return abrirMov(p, 'venta');
    case 'comprar': return abrirMov(p, 'compra');
    case 'controlar': return void fijarCantidad(p.id, 0, 'data-inv-input');
    case 'dejar': return void fijarCantidad(p.id, null);
  }
});
$('#lista-inventario').addEventListener('change', (ev) => {
  const i = ev.target.closest('[data-inv-input]'); if (!i) return;
  const n = Number(i.value);
  if (i.value.trim() === '' || !Number.isInteger(n) || n < 0 || n > 100000) { avisar('Escribe un número entero de 0 en adelante.', true); return pintarInventario(); }
  fijarCantidad(i.dataset.id, n, 'data-inv-input');
});

// --- compras y ventas (alimentan Finanzas y la hoja de Google) -----------------------------
const fechaHN = (sql) => { const t = Date.parse(`${String(sql).replace(' ', 'T')}Z`); return Number.isNaN(t) ? esc(sql) : new Date(t).toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa', dateStyle: 'short', timeStyle: 'short' }); };
const diaCorto = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : '—');
const fm = () => $('#form-mov');
const puedeFinanzas = () => !!PERMISOS[E.yo?.rol]?.includes('finanzas');
function abrirMov(p, tipo) {
  E.mov = { p, tipo }; E.cuotaManual = false;
  const f = fm(); f.reset();
  $('#dlg-mov-t').textContent = tipo === 'venta' ? 'Vendí' : 'Compré stock';
  $('#mov-precio-t').textContent = tipo === 'venta' ? 'Precio de venta al contado por unidad (L)' : 'Costo por unidad (L)';
  const tope = tipo === 'venta' && (p.tipo_stock === 'local1' || p.tipo_stock === 'local2') && p.cantidad !== null ? ` · quedan ${p.cantidad}` : '';
  $('#mov-producto').textContent = `${p.nombre} (${p.id}) · ${TIPOS_STOCK[p.tipo_stock]}${tope}`;
  f.cantidad.value = 1;
  f.precio.value = (tipo === 'venta' ? p.precio : p.costo) ?? '';
  f.cuotas.value = 2; f.intervalo.value = 15;
  $('#mov-venta-extra').hidden = tipo !== 'venta'; $('#mov-credito').hidden = true;
  mostrarError('#error-mov'); totalMov();
  $('#dlg-mov').showModal();
}
/** Con crédito, el pago de cada cuota se sugiere con el recargo (la dueña puede cambiarlo: cualquier valor que deje el total por encima del contado). */
function datosCredito() {
  const f = fm(), contado = (Number(String(f.precio.value).replace(/,/g, '')) || 0) * (Number(f.cantidad.value) || 0);
  return { contado, cuotas: Number(f.cuotas.value), cuota: Number(String(f.cuota.value).replace(/,/g, '')), abono: Number(String(f.abono.value).replace(/,/g, '')) || 0 };
}
function totalMov() {
  const f = fm(), n = Number(f.cantidad.value), x = Number(String(f.precio.value).replace(/,/g, ''));
  const { p, tipo } = E.mov ?? {};
  const credito = tipo === 'venta' && f.pago.value === 'credito';
  $('#mov-credito').hidden = !credito;
  if (credito) {
    const d = datosCredito();
    if (!E.cuotaManual) { const s = cuotaSugerida(d.contado, d.cuotas, E.creditoPct ?? 20); f.cuota.value = s ?? ''; d.cuota = s ?? NaN; }
    const r = resumenCredito(d), info = $('#mov-credito-info');
    info.classList.toggle('mal', r.listo && !r.ok);
    info.textContent = !r.listo ? 'Elige el número de pagos y el monto de cada uno.'
      : !r.ok ? `El crédito no puede ser igual o mejor que el contado (${dinero(d.contado)}): ${d.cuotas} pagos de ${dinero(d.cuota)} son ${dinero(r.total)}.`
      : `Contado ${dinero(d.contado)} → crédito ${d.cuotas} × ${dinero(d.cuota)} = ${dinero(r.total)} (+${r.recargoPct} %). ${d.abono > 0 ? `Después del abono debe ${dinero(r.saldo)}.` : `Debe ${dinero(r.total)}.`}`;
  }
  if (!p || !(n >= 1) || !Number.isFinite(x) || f.precio.value.trim() === '') { $('#mov-total').textContent = ''; return; }
  const gastos = (Number(String(f.g_bus.value).replace(/,/g, '')) || 0) + (Number(String(f.g_otro.value).replace(/,/g, '')) || 0);
  const ganancia = tipo === 'venta' && p.costo !== null && p.costo !== undefined ? ` · ganancia ${dinero(n * (x - p.costo) - gastos)}${gastos ? ' (ya sin gastos)' : ''}` : '';
  $('#mov-total').textContent = credito ? '' : `Total ${dinero(n * x)}${ganancia}`;
}
fm().addEventListener('input', (ev) => { if (ev.target.name === 'cuota') E.cuotaManual = true; if (['cuotas', 'precio', 'cantidad'].includes(ev.target.name)) E.cuotaManual = false; totalMov(); });
fm().addEventListener('change', (ev) => { if (ev.target.name === 'pago') { E.cuotaManual = false; totalMov(); } });
fm().addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const { p, tipo } = E.mov, f = fm(), b = $('#mov-guardar');
  if (!/^\d{1,6}$/.test(f.cantidad.value.trim()) || Number(f.cantidad.value) < 1) return mostrarError('#error-mov', 'La cantidad debe ser un número entero de 1 en adelante.');
  if (f.precio.value.trim() === '') return mostrarError('#error-mov', tipo === 'venta' ? 'Escribe a cuánto vendiste cada unidad.' : 'Escribe cuánto te costó cada unidad.');
  const cuerpo = { tipo, producto_id: p.id, cantidad: Number(f.cantidad.value), [tipo === 'venta' ? 'precio' : 'costo']: f.precio.value.trim(), nota: f.nota.value };
  if (tipo === 'venta' && puedeFinanzas()) {
    const gastos = [];
    if (f.g_bus.value.trim()) gastos.push({ categoria: 'bus', monto: f.g_bus.value.trim() });
    if (f.g_otro.value.trim()) gastos.push({ categoria: 'otro', concepto: f.g_concepto.value.trim(), monto: f.g_otro.value.trim() });
    if (gastos.length) cuerpo.gastos = gastos;
    if (f.pago.value === 'credito') {
      const d = datosCredito(), r = resumenCredito(d);
      if (!f.cliente.value.trim()) return mostrarError('#error-mov', 'Escribe el nombre de quién se lleva la deuda.');
      if (!r.listo) return mostrarError('#error-mov', 'Elige el número de pagos y el monto de cada uno.');
      if (!r.ok) return mostrarError('#error-mov', `El crédito no puede ser igual o mejor que el contado (${dinero(d.contado)}).`);
      if (!r.abonoValido) return mostrarError('#error-mov', 'El abono no puede ser mayor que el total del crédito.');
      cuerpo.credito = { cliente: f.cliente.value.trim(), telefono: f.telefono.value.trim(), cuotas: d.cuotas, cuota: f.cuota.value.trim(), abono: f.abono.value.trim(), intervalo_dias: Number(f.intervalo.value) || 15 };
    }
  }
  b.disabled = true; mostrarError('#error-mov');
  try {
    const r = await api('POST', 'admin/movimientos', cuerpo);
    $('#dlg-mov').close(); await cargar(); cargarAlertas();
    avisar(tipo === 'compra' ? 'Compra registrada: ya cuenta como inversión.' : cuerpo.credito ? `Venta a crédito registrada: ${cuerpo.credito.cliente} debe ${dinero(r.total - (Number(String(cuerpo.credito.abono).replace(/,/g, '')) || 0))}.` : 'Venta registrada.');
  } catch (e) { mostrarError('#error-mov', e.message); }
  b.disabled = false;
});

// --- contador del stock local: lo que se va sumando mientras cargas productos ---------------------
const pctTxt = (n) => (n === null || n === undefined ? '' : `${n.toLocaleString('es-HN')} %`);
function htmlContador(c) {
  if (!c || (c.inversion <= 0 && c.valor_total <= 0)) return '';
  const cubre = c.falta_cubrir <= 0;
  return `
    <div class="contador-cab"><b>Stock local cargado: ${dinero(c.valor_total)}</b> <span class="suave">a tus precios · local 1 ${dinero(c.local1.valor + 0)} · local 2 ${dinero(c.local2.valor)}${c.vendido > 0 ? ` · ya vendido ${dinero(c.vendido)}` : ''}</span></div>
    ${c.inversion > 0 ? `
    <progress class="barra-pago" max="100" value="${c.progreso_inversion ?? 0}" aria-label="Cargado frente a la inversión"></progress>
    <p class="contador-linea">${cubre ? `✅ Ya cubres la inversión de ${dinero(c.inversion)} (sobran ${dinero(c.valor_total - c.inversion)} a tus precios).` : `Inversión ${dinero(c.inversion)}: <b>faltan ${dinero(c.falta_cubrir)}</b> en productos para cubrirla.`}</p>
    <p class="contador-linea">Si vendes todo a estos precios: <b class="${c.ganancia_si_vendes_todo < 0 ? 'neg' : 'pos'}">${c.ganancia_si_vendes_todo < 0 ? 'pierdes ' : 'ganas '}${dinero(Math.abs(c.ganancia_si_vendes_todo))}</b>${c.margen_si_vendes_todo !== null ? ` (${pctTxt(c.margen_si_vendes_todo)})` : ''}.
      ${c.falta_meta === null ? '' : c.falta_meta > 0 ? `Meta ${dinero(c.meta)}: faltan ${dinero(c.falta_meta)}${c.subida_pct ? ` — o sube tus precios ~${pctTxt(c.subida_pct)}` : ''}.` : `Meta ${dinero(c.meta)} alcanzada 🎯`}</p>
    <p class="contador-linea suave">Recuperado vendiendo: ${dinero(c.vendido)} de ${dinero(c.inversion)}${c.falta_recuperar > 0 ? ` · faltan ${dinero(c.falta_recuperar)} por vender para recuperar la inversión` : ' · ¡inversión recuperada!'}</p>` : ''}`;
}
async function cargarContador() {
  if (!puedeFinanzas()) return;
  try {
    const c = await api('GET', 'admin/finanzas/contador'), caja = $('#contador'), h = htmlContador(c);
    caja.hidden = !h; caja.innerHTML = h;
    E.local2Publico = c.local2_publico;
    const barra = $('#privacidad'); barra.hidden = false;
    barra.classList.toggle('publico', c.local2_publico);
    $('#privacidad-texto').textContent = c.local2_publico ? '🌐 El Stock local 2 se está mostrando en la tienda.' : '🔒 Stock local 2 PRIVADO: no sale en la tienda, ni en el catálogo, ni en Google. Solo lo ves tú aquí.';
    $('#privacidad-boton').textContent = c.local2_publico ? 'Hacerlo privado' : 'Publicar en la tienda';
  } catch { /* sin contador */ }
}

// --- imágenes para redes de muchos productos a la vez --------------------------------------------
const MS = { ocupado: false, cancelar: false };
const msPintarPaletas = selectorPaletas('#ms-paletas', '#ms-color', () => msPaleta, (v) => { msPaleta = v; guardarPaleta(v); }, () => {});
const msProductos = () => { const t = $('#ms-tipo').value; return E.prods.filter((p) => (t === 'todos' || p.tipo_stock === t) && p.imagen_url); };
function msCuenta() {
  const t = $('#ms-tipo').value, todos = E.prods.filter((p) => t === 'todos' || p.tipo_stock === t), con = todos.filter((p) => p.imagen_url).length, formatos = ($('#ms-post').checked ? 1 : 0) + ($('#ms-historia').checked ? 1 : 0);
  $('#ms-cuenta').textContent = `${con} producto${con === 1 ? '' : 's'} con foto${todos.length - con ? ` (${todos.length - con} sin foto se saltan: súbeles su foto)` : ''} · ${con * formatos} imagen${con * formatos === 1 ? '' : 'es'}.`;
}
$('#abrir-masivo').addEventListener('click', () => {
  msPaleta = paletaGuardada(); msPintarPaletas(); mostrarError('#error-masivo'); $('#ms-estado').textContent = ''; $('#ms-progreso').hidden = true;
  const ahora = new Date(Date.now() + 3600000); ahora.setMinutes(0, 0, 0); $('#ms-inicio').value = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  $('#ms-compartir').hidden = !(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.jpg', { type: 'image/jpeg' })] }));
  api('GET', 'admin/publicaciones').then(({ conexion: c }) => { $('#ms-meta-estado').textContent = c.instagram || c.facebook ? '' : 'Meta todavía no está conectado (pestaña Redes). Mientras tanto puedes descargar el .zip y subirlas a mano.'; $('#ms-programar').disabled = !(c.instagram || c.facebook); $('#ms-red-ig').disabled = !c.instagram; $('#ms-red-fb').disabled = !c.facebook; if (!c.instagram) $('#ms-red-ig').checked = false; if (!c.facebook) $('#ms-red-fb').checked = false; }).catch(() => { $('#ms-programar').disabled = true; });
  msCuenta(); $('#dlg-masivo').showModal();
});
['#ms-tipo', '#ms-post', '#ms-historia'].forEach((i) => $(i).addEventListener('change', msCuenta));
/** Crea todas las imágenes (una por producto y formato) con la paleta elegida. Devuelve [{ p, formato, blob }]. */
async function msGenerar() {
  const formatos = [$('#ms-post').checked && 'post', $('#ms-historia').checked && 'historia'].filter(Boolean), lista = msProductos();
  if (!formatos.length) throw new Error('Elige Publicación, Historia o las dos.');
  if (!lista.length) throw new Error('No hay productos con foto de ese tipo.');
  const salida = [], total = lista.length * formatos.length;
  MS.cancelar = false; $('#ms-progreso').hidden = false; $('#ms-progreso').max = total;
  for (const p of lista) for (const formato of formatos) {
    if (MS.cancelar) throw new Error('Cancelado.');
    $('#ms-progreso').value = salida.length; $('#ms-estado').textContent = `Creando ${salida.length + 1} de ${total}: ${p.nombre}…`;
    const blob = await crearImagen({ fotoUrl: p.imagen_url, nombre: p.nombre, precio: p.precio, cotizar: p.cotizar, talla: p.talla, paleta: msPaleta, formato }, { calidad: 0.88 });
    if (!blob) throw new Error(`No pude crear la imagen de «${p.nombre}».`);
    salida.push({ p, formato, blob });
    await new Promise((r) => setTimeout(r)); // deja respirar a la pantalla
  }
  $('#ms-progreso').value = total;
  return salida;
}
const msNombre = (i, dosFormatos) => `${i.p.id}-${nombreSeguro(i.p.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'producto')}${dosFormatos ? `-${i.formato}` : ''}.jpg`;
async function msOcupado(fn) {
  if (MS.ocupado) return; MS.ocupado = true; mostrarError('#error-masivo');
  const botones = ['#ms-descargar', '#ms-programar', '#ms-compartir'].map((x) => $(x)); botones.forEach((b) => { b.disabled = true; });
  try { await fn(); } catch (e) { if (e.message !== 'Cancelado.') mostrarError('#error-masivo', e.message); $('#ms-estado').textContent = ''; }
  botones.forEach((b) => { b.disabled = false; }); $('#ms-programar').disabled = $('#ms-meta-estado').textContent !== ''; MS.ocupado = false;
}
$('#ms-cerrar').addEventListener('click', () => { MS.cancelar = true; });
$('#ms-descargar').addEventListener('click', () => msOcupado(async () => {
  const imagenes = await msGenerar();
  $('#ms-estado').textContent = 'Juntando todo en un .zip…';
  const zip = await crearZip(imagenes.map((i) => ({ nombre: msNombre(i, $('#ms-post').checked && $('#ms-historia').checked), datos: i.blob })));
  const pal = esColor(msPaleta) ? `color-${msPaleta.slice(1)}` : msPaleta, a = document.createElement('a');
  a.href = URL.createObjectURL(zip); a.download = `imagenes-${$('#ms-tipo').value}-${pal}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  $('#ms-estado').textContent = `Listo: ${imagenes.length} imágenes en un .zip (${(zip.size / 1048576).toFixed(1)} MB).`;
}));
$('#ms-compartir').addEventListener('click', () => msOcupado(async () => {
  const imagenes = (await msGenerar()).slice(0, 20); // las apps de mensajes aceptan pocas a la vez
  await navigator.share({ files: imagenes.map((i) => new File([i.blob], msNombre(i, true), { type: 'image/jpeg' })) }).catch(() => {});
  $('#ms-estado').textContent = imagenes.length < msProductos().length ? 'Compartí las primeras 20: para el resto usa el .zip.' : '';
}));
$('#ms-programar').addEventListener('click', () => msOcupado(async () => {
  const redes = [$('#ms-red-ig').checked && 'ig', $('#ms-red-fb').checked && 'fb'].filter(Boolean), cada = Number(String($('#ms-cada').value).replace(',', '.')), inicio = new Date($('#ms-inicio').value);
  if (!redes.length) throw new Error('Elige Instagram, Facebook o las dos.');
  if (Number.isNaN(inicio.getTime())) throw new Error('Elige cuándo empieza.');
  if (!(cada >= 0.25 && cada <= 168)) throw new Error('«Una cada» debe ser entre 0.25 y 168 horas.');
  const lista = msProductos(), n = lista.length;
  if (!n) throw new Error('No hay productos con foto de ese tipo.');
  const fin = new Date(inicio.getTime() + (n - 1) * cada * 3600000);
  if (!(await confirmar('Programar publicaciones', `Se programan ${n} publicaciones en ${redes.map((x) => ({ ig: 'Instagram', fb: 'Facebook' }[x])).join(' y ')}, una cada ${cada} h: desde ${inicio.toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })} hasta ${fin.toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })}${$('#ms-historia').checked ? ' (cada una con su historia 10 minutos después)' : ''}.`, 'Programar'))) throw new Error('Cancelado.');
  const imagenes = await msGenerar(); let hechas = 0;
  $('#ms-progreso').max = imagenes.length; $('#ms-progreso').value = 0;
  for (const i of imagenes) {
    if (MS.cancelar) throw new Error('Cancelado.');
    const idx = lista.indexOf(i.p), cuando = new Date(inicio.getTime() + idx * cada * 3600000 + (i.formato === 'historia' ? 600000 : 0));
    const cat = catPorId(i.p.categoria_id), form = new FormData();
    form.set('imagen', i.blob, 'lamina.jpg'); form.set('redes', redes.join(',')); form.set('formato', i.formato); form.set('producto_id', i.p.id); form.set('programada_en', cuando.toISOString());
    form.set('descripcion', i.formato === 'historia' ? '' : armarDescripcion({ nombre: i.p.nombre, precio: i.p.precio, cotizar: i.p.cotizar, categoriaId: i.p.categoria_id, categoriaNombre: cat?.nombre }));
    $('#ms-estado').textContent = `Programando ${hechas + 1} de ${imagenes.length}: ${i.p.nombre}…`;
    await api('POST', 'admin/publicaciones', form);
    $('#ms-progreso').value = ++hechas;
  }
  $('#ms-estado').textContent = `Listo: ${hechas} publicaciones programadas. Las ves en la pestaña Redes y salen solas a su hora.`;
  avisar(`${hechas} publicaciones programadas.`);
}));

// --- avisos de cobro: banner del panel ---------------------------------------------------------
async function cargarAlertas() {
  if (!puedeFinanzas()) return;
  try {
    const a = await api('GET', 'admin/creditos/alertas');
    E.creditoPct = a.credito_pct; E.cobros = a;
    const b = $('#banner-cobros'); b.hidden = !a.vencidos;
    if (a.vencidos) $('#banner-cobros-texto').textContent = `💰 Tienes ${a.vencidos} cobro${a.vencidos === 1 ? '' : 's'} pendiente${a.vencidos === 1 ? '' : 's'} (${dinero(a.monto_vencido)}). Recuérdales el pago.`;
  } catch { /* sin aviso */ }
}
$('#banner-cobros-ver').addEventListener('click', () => ir('finanzas'));
$('#privacidad-boton').addEventListener('click', async () => {
  const publicar = !E.local2Publico;
  if (publicar && !(await confirmar('Publicar el Stock local 2', 'Todos los productos de Stock local 2 que estén «Visibles» saldrán en la tienda y en Google. ¿Seguro que terminó el inventario privado?', 'Publicar'))) return;
  try { await api('PUT', 'admin/finanzas/config', { mostrar_local2: publicar }); await cargar(); avisar(publicar ? 'Stock local 2 publicado en la tienda.' : 'Stock local 2 privado: ya no se ve en la tienda.'); } catch (e) { avisar(e.message, true); }
});

// --- lotes de inversión (solo administradora) ---------------------------------------------
const pct = (n) => (n === null || n === undefined ? '—' : `${n.toLocaleString('es-HN')} %`);
async function cargarLotes() {
  const cont = $('#lotes-contenido');
  let r;
  try { r = await api('GET', 'admin/lotes'); } catch (e) { cont.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
  if (E.vista !== 'lotes') return;
  E.lotes = r.lotes;
  cont.innerHTML = r.lotes.map((l) => `
    <article class="lote" data-lote="${l.id}">
      <header class="lote-cab"><div><h2>${esc(l.nombre)}</h2><span class="etiqueta ${l.completo ? 'ok' : 'aviso'}">${l.completo ? 'Lote completo' : 'Cargando productos'}</span></div>
        <div class="fila-acciones"><button type="button" class="boton suave chico" data-lote-editar="${l.id}">Editar</button><button type="button" class="boton suave peligro chico" data-lote-borrar="${l.id}">Borrar</button></div></header>
      <div class="fin-tarjetas">
        <div class="fin-tarjeta"><span>Invertido</span><b>${dinero(l.inversion)}</b><small>por todo el lote</small></div>
        <div class="fin-tarjeta"><span>Meta de ventas</span><b>${dinero(l.meta)}</b><small>${pct(l.margen_meta)} de ganancia</small></div>
        <div class="fin-tarjeta"><span>Ventas estimadas</span><b>${dinero(l.ventas_estimadas)}</b><small>con tus precios · ${l.unidades} unidades</small></div>
        <div class="fin-tarjeta ${l.ganancia_estimada < 0 ? 'neg' : 'pos'}"><span>Ganancia estimada</span><b>${dinero(l.ganancia_estimada)}</b><small>${pct(l.margen_estimado)} sobre lo invertido</small></div>
        <div class="fin-tarjeta"><span>Falta para cubrir la inversión</span><b>${dinero(l.falta_cubrir)}</b><small>${l.falta_cubrir > 0 ? 'en productos, a tus precios' : '¡ya la cubres!'}</small></div>
        <div class="fin-tarjeta"><span>Falta para la meta</span><b>${dinero(l.falta_para_meta)}</b><small>${l.falta_para_meta > 0 ? `o sube tus precios ~${l.subida_pct} %` : 'meta alcanzada'}</small></div>
        <div class="fin-tarjeta"><span>Vendido de verdad</span><b>${dinero(l.vendido.ingresos)}</b><small>ganancia real ${dinero(l.vendido.ganancia)} · ${l.vendido.unidades} unid.</small></div>
      </div>
      ${!l.completo && l.filas.length ? '<p class="nota">Todavía estás cargando este lote: las ventas estimadas suben conforme agregas productos. Cuando termines, edita el lote y marca «Ya cargué todo el lote».</p>' : ''}
      ${l.filas.length ? `<div class="tabla-caja"><table class="tabla"><thead><tr><th>Producto</th><th>Unid.</th><th>Etiqueta</th><th>Costo</th><th>Tu precio</th><th>Sugerido</th><th>Gana/u.</th></tr></thead><tbody>${l.filas.map((f) => `<tr><th scope="row">${esc(f.nombre)}<small class="suave"> ${esc(f.id)}</small></th><td>${f.unidades}</td><td>${f.referencia === null ? '—' : dinero(f.referencia)}</td><td>${dinero(f.costo)}</td><td><input class="inv-input lote-precio" inputmode="decimal" value="${f.precio ?? ''}" data-lote-precio="${esc(f.id)}" aria-label="Precio de ${esc(f.nombre)}"></td><td>${f.sugerido === null ? '—' : `<button type="button" class="boton suave chico" data-lote-usar="${esc(f.id)}" data-valor="${f.sugerido}" ${f.precio === f.sugerido ? 'disabled' : ''}>${dinero(f.sugerido)}</button>`}</td><td><b>${f.precio === null ? '—' : dinero(f.precio - f.costo)}</b></td></tr>`).join('')}</tbody></table></div>
        <p class="fila-acciones lote-pie"><button type="button" class="boton suave" data-lote-sugeridos="${l.id}">Poner el precio sugerido a todos</button></p>`
      : '<p class="vacio">Este lote todavía no tiene productos. Al crear o editar un producto de «Stock local», elige este lote y escribe su precio de etiqueta.</p>'}
    </article>`).join('') || '<p class="vacio">Aún no hay lotes. Crea uno con la inversión que hiciste (por ejemplo L 45,000) y luego agrega los productos.</p>';
}
const fl = () => $('#form-lote');
function abrirLote(l) {
  E.loteEditando = l ?? null;
  const f = fl(); f.reset();
  $('#dlg-lote-t').textContent = l ? 'Editar lote' : 'Nuevo lote';
  f.nombre.value = l?.nombre ?? ''; f.inversion.value = l?.inversion ?? ''; f.meta.value = l?.meta ?? ''; f.completo.checked = !!l?.completo;
  mostrarError('#error-lote'); margenLote(); $('#dlg-lote').showModal();
}
function margenLote() {
  const i = Number(fl().inversion.value.replace(/,/g, '')), m = fl().meta.value.trim() === '' ? i * 1.8 : Number(fl().meta.value.replace(/,/g, ''));
  $('#lote-margen').textContent = i > 0 && Number.isFinite(m) ? `Ganancia objetivo: ${dinero(m - i)} (${Math.round(((m - i) / i) * 1000) / 10} %)${fl().meta.value.trim() === '' ? ' · con +80 %' : ''}.` : '';
}
fl().addEventListener('input', margenLote);
$('#nuevo-lote').addEventListener('click', () => abrirLote(null));
fl().addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = fl(), cuerpo = { nombre: f.nombre.value, inversion: f.inversion.value.trim(), completo: f.completo.checked };
  if (f.meta.value.trim() !== '') cuerpo.meta = f.meta.value.trim(); else if (E.loteEditando) cuerpo.meta = Math.round(Number(f.inversion.value.replace(/,/g, '')) * 1.8);
  if (!cuerpo.nombre.trim()) return mostrarError('#error-lote', 'Escribe un nombre.');
  if (cuerpo.inversion === '') return mostrarError('#error-lote', 'Escribe cuánto invertiste.');
  mostrarError('#error-lote');
  try {
    if (E.loteEditando) await api('PUT', `admin/lotes/${E.loteEditando.id}`, cuerpo); else await api('POST', 'admin/lotes', cuerpo);
    $('#dlg-lote').close(); await cargar(); avisar('Lote guardado.');
  } catch (e) { mostrarError('#error-lote', e.message); }
});
$('#lotes-contenido').addEventListener('click', async (ev) => {
  const g = (a) => ev.target.closest(`[${a}]`)?.getAttribute(a);
  try {
    if (g('data-lote-editar')) return abrirLote(E.lotes.find((l) => String(l.id) === g('data-lote-editar')));
    if (g('data-lote-borrar')) { if (await confirmar('Borrar lote', 'Los productos se quedan, sin lote y con el último costo calculado. La inversión de este lote deja de contar en Finanzas.', 'Borrar lote')) { await api('DELETE', `admin/lotes/${g('data-lote-borrar')}`); await cargar(); } return; }
    if (g('data-lote-sugeridos')) { if (await confirmar('Precio sugerido a todos', 'Se cambia el precio de todos los productos del lote al sugerido. Los precios que pusiste a mano se reemplazan.', 'Aplicar')) { const r = await api('POST', `admin/lotes/${g('data-lote-sugeridos')}/precios`, { modo: 'todos' }); await cargar(); avisar(`Precio sugerido puesto a ${r.cambiados} productos.`); } return; }
    if (g('data-lote-usar')) { const b = ev.target.closest('[data-lote-usar]'); await api('PUT', `admin/productos/${encodeURIComponent(b.dataset.loteUsar)}`, { precio: b.dataset.valor }); await cargar(); }
  } catch (e) { avisar(e.message, true); }
});
$('#lotes-contenido').addEventListener('change', async (ev) => {
  const i = ev.target.closest('[data-lote-precio]'); if (!i) return;
  try { await api('PUT', `admin/productos/${encodeURIComponent(i.dataset.lotePrecio)}`, { precio: i.value.trim() }); await cargar(); } catch (e) { avisar(e.message, true); await cargarLotes(); }
});

// --- finanzas (solo administradora) --------------------------------------------------------
const TABLA_FIN = (titulo, filas) => `<h2 class="fin-t">${esc(titulo)}</h2><div class="tabla-caja"><table class="tabla"><thead><tr><th></th><th>Invertido</th><th>Vendido</th><th>Costo vendido</th><th>Ganancia</th><th>Gastos</th><th>Neta</th><th>Unid.</th></tr></thead><tbody>${filas.map((r) => `<tr><th scope="row">${esc(r[0])}</th><td>${dinero(r[1].invertido)}</td><td>${dinero(r[1].ingresos)}</td><td>${dinero(r[1].costo_vendido)}</td><td><b>${dinero(r[1].ganancia)}</b></td><td>${r[1].neta === undefined ? '' : dinero(r[1].gastos)}</td><td>${r[1].neta === undefined ? '' : `<b>${dinero(r[1].neta)}</b>`}</td><td>${r[1].unidades_vendidas}</td></tr>`).join('') || '<tr><td colspan="8" class="suave">Todavía no hay ventas.</td></tr>'}</tbody></table></div>`;
const FILA_CREDITO = (c) => {
  const pct = Math.min(100, Math.round((c.abonado / c.total) * 100));
  const wa = enlaceRecordatorio(c, dinero);
  const estado = c.estado === 'pagado' ? '<span class="etiqueta ok">Pagado</span>' : c.vencido ? `<span class="etiqueta mal">${c.dias === 0 ? 'Vence hoy' : `Vencido hace ${-c.dias} día${c.dias === -1 ? '' : 's'}`} · ${dinero(c.monto_vencido)}</span>` : `<span class="etiqueta ok">Al día</span>`;
  return `<li class="fila sin-foto-miniatura"><div class="fila-texto"><div class="fila-nombre">${esc(c.cliente)} · ${esc(c.producto_nombre)}${c.cantidad > 1 ? ` ×${c.cantidad}` : ''}</div>
    <div class="fila-meta">${estado}<span>${c.pagadas}/${c.cuotas} pagos de ${dinero(c.cuota_monto)}</span>${c.proximo_vencimiento ? `<span>próximo ${diaCorto(c.proximo_vencimiento)}</span>` : ''}<span class="precio">Debe ${dinero(c.saldo)}</span><span>de ${dinero(c.total)} (contado ${dinero(c.precio_contado)})</span></div>
    <progress class="barra-pago" max="100" value="${pct}" aria-label="Pagado ${pct} %"></progress>
    <details><summary class="suave">Abonos (${c.abonos.filter((a) => !a.anulado).length})</summary><ul class="abonos-lista">${c.abonos.map((a) => `<li class="${a.anulado ? 'anulado' : ''}"><span>${fechaHN(a.fecha)} · ${dinero(a.monto)}${a.nota ? ` · ${esc(a.nota)}` : ''}</span>${a.anulado ? '' : `<button type="button" class="boton suave peligro chico" data-abono-anular="${a.id}">Anular</button>`}</li>`).join('') || '<li class="suave">Sin abonos todavía.</li>'}</ul></details></div>
    <div class="fila-acciones">${c.estado === 'activo' ? `<button type="button" class="boton chico" data-abonar="${c.id}">Abonar</button>` : ''}${wa && c.estado === 'activo' ? `<a class="boton suave chico" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ''}<button type="button" class="boton suave peligro chico" data-credito-anular="${c.id}">Anular</button></div></li>`;
};
async function cargarFinanzas() {
  const cont = $('#fin-contenido');
  let r;
  try { r = await api('GET', 'admin/finanzas'); } catch (e) { cont.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
  if (E.vista !== 'finanzas') return;
  const t = r.total; E.cobrosLista = r.creditos;
  const enlaces = await api('GET', 'admin/finanzas/enlaces').catch(() => ({ configurado: false, enlaces: {} }));
  if (E.vista !== 'finanzas') return;
  const hoja = r.hoja_url ? `<a class="boton" href="${esc(r.hoja_url)}" target="_blank" rel="noopener noreferrer">Abrir la hoja de Google</a>` : '<p class="suave">La hoja de Google todavía no está conectada.</p>';
  cont.innerHTML = `
    <div class="fin-tarjetas">
      <div class="fin-tarjeta"><span>Invertido</span><b>${dinero(t.invertido)}</b><small>en stock local comprado</small></div>
      <div class="fin-tarjeta"><span>Vendido</span><b>${dinero(t.ingresos)}</b><small>${t.unidades_vendidas} unidades</small></div>
      <div class="fin-tarjeta ${t.ganancia < 0 ? 'neg' : 'pos'}"><span>Ganancia</span><b>${dinero(t.ganancia)}</b><small>vendido − lo que costó</small></div>
      <div class="fin-tarjeta"><span>Gastos</span><b>${dinero(t.gastos)}</b><small>bus, envío, empaque…</small></div>
      <div class="fin-tarjeta ${t.neta < 0 ? 'neg' : 'pos'}"><span>Ganancia neta</span><b>${dinero(t.neta)}</b><small>ganancia − gastos</small></div>
      <div class="fin-tarjeta ${r.cobros.vencidos ? 'neg' : ''}"><span>Por cobrar</span><b>${dinero(r.cobros.por_cobrar)}</b><small>${r.cobros.activos} deuda${r.cobros.activos === 1 ? '' : 's'}${r.cobros.vencidos ? ` · ${r.cobros.vencidos} vencida${r.cobros.vencidos === 1 ? '' : 's'}` : ''}</small></div>
      <div class="fin-tarjeta"><span>Capital en stock local</span><b>${dinero(r.capital_en_stock)}</b><small>${r.unidades_en_stock} unidades${r.retorno_local !== null ? ` · retorno ${r.retorno_local} %` : ''}</small></div>
    </div>
    ${r.contador && (r.contador.inversion > 0 || r.contador.valor_total > 0) ? `<h2 class="fin-t">Inventario y proyección</h2><div class="contador">${htmlContador(r.contador)}</div>` : ''}
    ${r.sin_costo.length ? `<p class="nota">Hay productos sin costo (${r.sin_costo.map((x) => `${x.n} de ${esc(TIPOS_STOCK[x.tipo_stock])}`).join(', ')}). Sin costo no se puede calcular la ganancia: ponlo al editar el producto.</p>` : ''}
    <h2 class="fin-t">Por cobrar (deudas)</h2>
    <p class="suave">Ventas a crédito. Recargo sugerido: <input class="inv-input" id="credito-pct" inputmode="decimal" value="${r.credito_pct}" aria-label="Recargo del crédito en porcentaje"> % sobre el precio de contado. El crédito siempre tiene que costar más que el contado.</p>
    <ul class="lista" id="fin-creditos">${r.creditos.map((c) => FILA_CREDITO(c)).join('') || '<li class="vacio">No hay deudas pendientes. Para vender a crédito: Inventario → Vendí → «A crédito».</li>'}</ul>
    ${TABLA_FIN('Por periodo', [['Últimos 7 días', r.semana], ['Últimos 30 días', r.mes], ['Todo el tiempo', r.total]])}
    ${TABLA_FIN('Por tipo de stock', r.por_tipo.map((x) => [x.nombre, x]))}
    ${TABLA_FIN('Por categoría', r.por_categoria.map((x) => [x.categoria, x]))}
    <h2 class="fin-t">Gastos <button type="button" class="boton chico" id="nuevo-gasto">+ Agregar gasto</button></h2>
    <p class="suave">${r.gastos_por_categoria.map((g) => `${esc(g.nombre)} ${dinero(g.monto)}`).join(' · ') || 'Todavía no hay gastos. Los de cada venta (bus, envío…) se anotan al registrar «Vendí».'}</p>
    <ul class="lista">${r.gastos_recientes.map((g) => `<li class="fila sin-foto-miniatura ${g.anulado ? 'apagada' : ''}"><div class="fila-texto"><div class="fila-nombre">${esc(g.concepto)}</div><div class="fila-meta"><span>${fechaHN(g.fecha)}</span><span class="etiqueta">${esc(g.nombre_categoria)}</span><span class="precio">${dinero(g.monto)}</span>${g.movimiento_id ? '<span>de una venta</span>' : ''}${g.anulado ? '<span class="etiqueta mal">Anulado</span>' : ''}</div></div>${g.anulado || g.movimiento_id ? '' : `<div class="fila-acciones"><button type="button" class="boton suave peligro chico" data-gasto-anular="${g.id}">Anular</button></div>`}</li>`).join('')}</ul>
    <h2 class="fin-t">Movimientos recientes</h2>
    <ul class="lista" id="fin-recientes">${r.recientes.map((m) => `<li class="fila sin-foto-miniatura ${m.anulado ? 'apagada' : ''}"><div class="fila-texto"><div class="fila-nombre">${m.tipo === 'venta' ? 'Venta' : 'Compra'} · ${esc(m.producto_nombre)}</div><div class="fila-meta"><span>${fechaHN(m.fecha)}</span><span>${m.cantidad} × ${dinero(m.tipo === 'venta' ? m.precio_unit : m.costo_unit)}</span><span class="precio">${dinero(m.total)}</span><span class="etiqueta">${esc(TIPOS_STOCK[m.tipo_stock])}</span>${m.anulado ? '<span class="etiqueta mal">Anulado</span>' : ''}${m.nota ? `<span>${esc(m.nota)}</span>` : ''}</div></div>${m.anulado ? '' : `<div class="fila-acciones"><button type="button" class="boton suave peligro chico" data-anular="${m.id}">Anular</button></div>`}</li>`).join('') || '<li class="vacio">Aún no hay movimientos. Registra una venta o una compra desde la pestaña Inventario.</li>'}</ul>
    <h2 class="fin-t">Hoja de Google</h2>
    <p class="suave">Se actualiza sola con estos mismos datos (Productos, Movimientos y Resumen).</p>
    <div class="fin-hoja">${hoja}</div>
    <details class="fin-enlaces"><summary>Enlaces secretos de las hojas (para recrearla o conectar el script)</summary>
      ${enlaces.configurado ? Object.entries(enlaces.enlaces).map(([k, u]) => `<p><b>${esc(k)}</b><br><code>=IMPORTDATA("${esc(u)}")</code></p>`).join('') : '<p class="suave">Falta el secreto FINANZAS_TOKEN en el Worker.</p>'}
      <p class="suave">No los compartas: quien tenga estos enlaces ve tus costos y ganancias.</p>
    </details>`;
}
const fa = () => $('#form-abono'), fg = () => $('#form-gasto');
function abrirAbono(c) {
  E.abonando = c; fa().reset();
  $('#dlg-abono-t').textContent = `Abono de ${c.cliente}`;
  $('#abono-detalle').textContent = `${c.producto_nombre} · debe ${dinero(c.saldo)} de ${dinero(c.total)}${c.vencido ? ` · ya debería haber pagado ${dinero(c.monto_vencido)}` : ''}`;
  fa().monto.value = Math.min(c.saldo, c.monto_vencido > 0 ? c.monto_vencido : c.cuota_monto);
  mostrarError('#error-abono'); $('#dlg-abono').showModal();
}
fa().addEventListener('submit', async (ev) => {
  ev.preventDefault(); const c = E.abonando, b = $('#abono-guardar'); b.disabled = true; mostrarError('#error-abono');
  try {
    const r = await api('POST', `admin/creditos/${c.id}/abonos`, { monto: fa().monto.value.trim(), nota: fa().nota.value });
    $('#dlg-abono').close(); await cargar(); cargarAlertas();
    avisar(r.pagado ? `🎉 ¡${c.cliente} terminó de pagar! Ya no debe nada.` : `Abono registrado. ${c.cliente} debe ${dinero(r.saldo)}.`);
  } catch (e) { mostrarError('#error-abono', e.message); }
  b.disabled = false;
});
fg().addEventListener('submit', async (ev) => {
  ev.preventDefault(); const f = fg(), b = $('#gasto-guardar'); b.disabled = true; mostrarError('#error-gasto');
  try { await api('POST', 'admin/gastos', { concepto: f.concepto.value, categoria: f.categoria.value, monto: f.monto.value.trim() }); $('#dlg-gasto').close(); await cargar(); avisar('Gasto agregado.'); }
  catch (e) { mostrarError('#error-gasto', e.message); }
  b.disabled = false;
});
$('#fin-contenido').addEventListener('change', async (ev) => {
  if (ev.target.id !== 'credito-pct') return;
  try { await api('PUT', 'admin/finanzas/config', { credito_pct: ev.target.value.trim() }); E.creditoPct = Number(ev.target.value); avisar('Recargo guardado.'); } catch (e) { avisar(e.message, true); await cargar(); }
});
$('#fin-contenido').addEventListener('click', async (ev) => {
  const g = (a) => ev.target.closest(`[${a}]`)?.getAttribute(a);
  try {
    if (ev.target.closest('#nuevo-gasto')) { fg().reset(); mostrarError('#error-gasto'); return void $('#dlg-gasto').showModal(); }
    if (g('data-abonar')) return abrirAbono(E.cobrosLista.find((c) => String(c.id) === g('data-abonar')));
    if (g('data-abono-anular')) { if (await confirmar('Anular abono', 'El abono deja de contar y la deuda vuelve a subir.', 'Anular abono')) { await api('DELETE', `admin/abonos/${g('data-abono-anular')}`); await cargar(); cargarAlertas(); } return; }
    if (g('data-credito-anular')) { if (await confirmar('Anular deuda', 'Se anula la venta a crédito y el producto vuelve a tu inventario. Solo se puede si no tiene abonos.', 'Anular deuda')) { await api('DELETE', `admin/creditos/${g('data-credito-anular')}`); await cargar(); cargarAlertas(); } return; }
    if (g('data-gasto-anular')) { if (await confirmar('Anular gasto', 'Deja de restarse de la ganancia.', 'Anular gasto')) { await api('DELETE', `admin/gastos/${g('data-gasto-anular')}`); await cargar(); } return; }
  } catch (e) { avisar(e.message, true); }
  const b = ev.target.closest('[data-anular]'); if (!b) return;
  if (!(await confirmar('Anular movimiento', 'Se marca como anulado y las unidades vuelven a su lugar. No cuenta en los totales.', 'Anular'))) return;
  try { await api('DELETE', `admin/movimientos/${b.dataset.anular}`); await cargar(); avisar('Movimiento anulado.'); } catch (e) { avisar(e.message, true); }
});

// --- redes sociales ------------------------------------------------------------------------
const ESTADOS_PUB = { pendiente: ['Programada', 'aviso'], publicada: ['Publicada', 'ok'], error: ['Con error', 'mal'], cancelada: ['Cancelada', ''] };
const NOMBRES_RED = { ig: 'Instagram', fb: 'Facebook' };
async function cargarRedes() {
  const cont = $('#redes-contenido');
  let r;
  try { r = await api('GET', 'admin/publicaciones'); } catch (e) { cont.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
  if (E.vista !== 'redes') return;
  const c = r.conexion, conectado = c.instagram || c.facebook;
  cont.innerHTML = `
    <div class="fin-tarjetas">
      <div class="fin-tarjeta ${c.instagram ? 'pos' : 'neg'}"><span>Instagram</span><b>${c.instagram ? 'Conectado' : 'Sin conectar'}</b></div>
      <div class="fin-tarjeta ${c.facebook ? 'pos' : 'neg'}"><span>Facebook</span><b>${c.facebook ? 'Conectado' : 'Sin conectar'}</b></div>
    </div>
    ${conectado ? '' : `<p class="nota">Para publicar hay que conectar Meta una sola vez. Se guardan 3 claves secretas en el Worker: <code>META_TOKEN</code>, <code>META_PAGE_ID</code> y <code>META_IG_ID</code> (con <code>npx wrangler secret put NOMBRE</code>). La guía paso a paso está en <code>app/LEEME.md</code>, sección «Publicar en Instagram y Facebook».</p>`}
    <h2 class="fin-t">Últimas publicaciones</h2>
    <ul class="lista">${r.publicaciones.map((p) => {
      const [txt, cls] = ESTADOS_PUB[p.estado] ?? [p.estado, ''];
      const errores = Object.entries(p.resultado).filter(([, v]) => !v.ok).map(([k, v]) => `${NOMBRES_RED[k]}: ${esc(v.error)}`).join(' · ');
      const acciones = ['pendiente', 'error'].includes(p.estado) ? `<button type="button" class="boton suave chico" data-reintentar="${p.id}">${p.estado === 'pendiente' ? 'Publicar ya' : 'Reintentar'}</button><button type="button" class="boton suave peligro chico" data-cancelar="${p.id}">Cancelar</button>` : '';
      return `<li class="fila sin-foto-miniatura"><div class="fila-texto"><div class="fila-nombre">${esc(p.descripcion.split('\n')[0])}</div><div class="fila-meta"><span class="etiqueta ${cls}">${txt}</span><span>${p.redes.map((x) => NOMBRES_RED[x]).join(' + ')}</span><span>${p.estado === 'pendiente' ? 'para ' : ''}${fechaHN(p.programada_en)}</span>${errores ? `<span class="etiqueta mal">${errores}</span>` : ''}</div></div><div class="fila-acciones">${acciones}</div></li>`;
    }).join('') || '<li class="vacio">Todavía no has publicado nada desde el panel.</li>'}</ul>`;
}
$('#redes-contenido').addEventListener('click', async (ev) => {
  const re = ev.target.closest('[data-reintentar]'), ca = ev.target.closest('[data-cancelar]');
  try {
    if (re) { re.disabled = true; const r = await api('POST', `admin/publicaciones/${re.dataset.reintentar}/reintentar`); avisar(r.estado === 'publicada' ? 'Publicada.' : 'No se pudo publicar: mira el detalle.', r.estado !== 'publicada'); await cargarRedes(); }
    else if (ca && await confirmar('Cancelar publicación', 'No se publicará.', 'Cancelar publicación')) { await api('DELETE', `admin/publicaciones/${ca.dataset.cancelar}`); await cargarRedes(); }
  } catch (e) { avisar(e.message, true); }
});

// Editor de producto y foto
const fp = () => $('#form-producto');
function pintarFoto() {
  $('#foto-vista').innerHTML = E.foto ? `<img src="${esc(E.foto.startsWith('/fotos/') ? E.foto.replace('-1200.', '-600.') : E.foto)}" alt="Foto del producto">` : ico('foto');
  $('#foto-quitar').hidden = !E.foto;
  $('#foto-subir-t').textContent = E.foto ? 'Cambiar foto' : 'Subir foto';
}
function abrirProducto(p, categoria = E.cat) {
  E.editando = p;
  E.foto = p?.imagen_url || null;
  const f = fp(); f.reset();
  $('#dlg-producto-t').textContent = p ? 'Editar producto' : 'Nuevo producto';
  f.categoria_id.innerHTML = opcionesCat(p?.categoria_id || categoria, { vacia: p || categoria ? '' : 'Elige una categoría…' });
  f.nombre.value = p?.nombre ?? '';
  f.precio.value = p && p.precio !== null ? p.precio : '';
  f.referencia.value = p?.id ?? ''; f.referencia.disabled = !!p;
  f.cotizar.checked = !!p?.cotizar;
  f.descripcion.value = p?.descripcion ?? '';
  f.visible.checked = p ? p.visible : true;
  f.disponible.checked = p ? p.disponible : true;
  f.cantidad.value = p?.cantidad ?? '';
  f.tipo_stock.value = p?.tipo_stock ?? 'aparte'; f.costo.value = p?.costo ?? '';
  f.etiqueta.value = p?.referencia ?? ''; f.talla.value = p?.talla ?? '';
  prepararLote(p);
  pintarMargen();
  f.precio.disabled = f.cotizar.checked;
  $('#producto-borrar').hidden = !p; $('#producto-duplicar').hidden = !p; $('#producto-otro').hidden = !!p;
  $('#foto-estado').textContent = '';
  mostrarError('#error-producto');
  pintarFoto();
  $('#dlg-producto').showModal();
}
const TIPOS_STOCK = { aparte: 'Stock aparte', local1: 'Stock local 1', local2: 'Stock local 2', sin: 'Sin stock' };
/** Lote, precio de etiqueta y precio sugerido en el editor del producto (solo administradora, solo stock local). */
async function prepararLote(p) {
  const f = fp(), puede = PERMISOS[E.yo?.rol]?.includes('finanzas');
  E.lotesEditor = [];
  $('#bloque-lote').hidden = true; $('#sugerido-info').hidden = true;
  if (!puede) return;
  try { E.lotesEditor = (await api('GET', 'admin/lotes')).lotes; } catch { return; }
  const abierto = E.lotesEditor.filter((l) => !l.completo || l.id === p?.lote_id);
  f.lote_id.innerHTML = '<option value="">Sin lote</option>' + E.lotesEditor.map((l) => `<option value="${l.id}">${esc(l.nombre)} · ${esc(dinero(l.inversion))}</option>`).join('');
  f.lote_id.value = p?.lote_id ?? (!p && abierto.length ? abierto[0].id : '');
  actualizarLote();
}
function actualizarLote() {
  const f = fp(), tipo = f.tipo_stock.value, lote2 = tipo === 'local2', lote = (E.lotesEditor || []).find((l) => String(l.id) === f.lote_id.value);
  // Stock local 1 no tuvo inversión: su costo es 0 y no se toca.
  if (tipo === 'local1') { f.costo.value = 0; }
  f.costo.disabled = tipo === 'local1';
  if (!PERMISOS[E.yo?.rol]?.includes('finanzas')) return;
  $('#bloque-lote').hidden = !lote2 || !(E.lotesEditor || []).length;
  const enLote = lote2 && !!lote;
  f.costo.disabled = tipo === 'local1' || enLote; f.costo.placeholder = enLote ? 'Se calcula del lote' : tipo === 'local1' ? 'Sin inversión (0)' : '0.00';
  const otros = enLote ? lote.filas.filter((x) => x.id !== E.editando?.id) : [];
  const conEtiqueta = f.etiqueta.value.trim() !== '';
  // El precio de etiqueta es opcional: si no lo pones, el costo se reparte según el precio que le pones al producto.
  const est = enLote ? estimarEnLote(lote, otros, { referencia: conEtiqueta ? f.etiqueta.value : f.precio.value, unidades: f.cantidad.value || E.editando?.lote_cantidad || 1 }) : null;
  $('#sugerido-info').hidden = !est || !conEtiqueta; E.estCosto = est?.costo ?? null; pintarMargen();
  if (est && conEtiqueta) { E.sugerido = est.sugerido; $('#sugerido-texto').textContent = `Precio sugerido ${dinero(est.sugerido)} (costo estimado ${dinero(est.costo)}${lote.completo ? '' : '; se afina cuando termines de cargar el lote'}).`; }
}
$('#usar-sugerido').addEventListener('click', () => { fp().precio.value = E.sugerido; fp().cotizar.checked = false; fp().precio.disabled = false; pintarMargen(); });
['lote_id', 'tipo_stock'].forEach((n) => fp()[n].addEventListener('change', actualizarLote));
['etiqueta', 'cantidad', 'precio'].forEach((n) => fp()[n].addEventListener('input', actualizarLote));
function pintarMargen() {
  const f = fp(), precio = Number(f.precio.value.replace(/,/g, '')), delLote = f.costo.disabled && E.estCosto != null;
  const costo = delLote ? E.estCosto : Number(f.costo.value.replace(/,/g, ''));
  const ok = !f.cotizar.checked && f.precio.value.trim() !== '' && (delLote || f.costo.value.trim() !== '') && Number.isFinite(precio) && Number.isFinite(costo);
  $('#margen-info').textContent = ok ? `Ganas ${dinero(precio - costo)} por unidad${precio > 0 ? ` (${Math.round(((precio - costo) / precio) * 100)} % del precio)` : ''}.` : '';
}
['precio', 'costo', 'cotizar'].forEach((n) => fp()[n].addEventListener('input', pintarMargen));
fp().cotizar.addEventListener('change', (ev) => { fp().precio.disabled = ev.target.checked; if (ev.target.checked) fp().precio.value = ''; });
$('#foto-subir').addEventListener('click', () => $('#foto-archivo').click());
$('#foto-quitar').addEventListener('click', () => { E.foto = null; pintarFoto(); });

// Imagen para Instagram: usa lo que hay ahora en el formulario (foto, nombre, precio) y una talla opcional.
const paletaGuardada = () => { try { const v = localStorage.getItem('alexa_ig_paleta'); return PALETAS.some((p) => p.id === v) || esColor(v) ? v : 'rojo'; } catch { return 'rojo'; } };
let igPaleta = paletaGuardada(), msPaleta = igPaleta;
const guardarPaleta = (v) => { try { localStorage.setItem('alexa_ig_paleta', v); } catch { /* da igual */ } };
const datosInstagram = () => { const f = fp(); return { fotoUrl: E.foto, nombre: f.nombre.value, precio: f.precio.value, cotizar: f.cotizar.checked, talla: $('#ig-talla').value, paleta: igPaleta, formato: $('#ig-formato').value }; };
/** Selector de paletas + color libre (el que la dueña elija). leer/escribir: dónde se guarda la elegida; alCambiar: qué volver a dibujar. */
function selectorPaletas(contenedor, entradaColor, leer, escribir, alCambiar) {
  const pintar = () => {
    const actual = leer();
    $(contenedor).innerHTML = PALETAS.map((p) => `<button type="button" class="ig-paleta" role="radio" data-paleta="${p.id}" aria-checked="${p.id === actual}" title="${esc(p.nombre)}"><span class="ig-muestra"></span><small>${esc(p.nombre)}</small></button>`).join('');
    // el color se pone desde JS: la política de seguridad del panel no permite style="" escrito en el HTML
    $$(`${contenedor} .ig-paleta`).forEach((b, i) => { b.querySelector('.ig-muestra').style.background = `linear-gradient(135deg, ${PALETAS[i].fondo.join(', ')})`; });
    if (esColor(actual)) $(entradaColor).value = actual;
    $(entradaColor).closest('.ig-color').style.fontWeight = esColor(actual) ? '700' : '400';
  };
  $(contenedor).addEventListener('click', (ev) => { const b = ev.target.closest('[data-paleta]'); if (!b) return; escribir(b.dataset.paleta); pintar(); alCambiar(); });
  $(entradaColor).addEventListener('input', () => { escribir($(entradaColor).value); pintar(); alCambiar(); });
  return pintar;
}
const pintarPaletas = selectorPaletas('#ig-paletas', '#ig-color', () => igPaleta, (v) => { igPaleta = v; guardarPaleta(v); }, () => pintarInstagram());
let igPintando = 0;
async function pintarInstagram() {
  const turno = ++igPintando; mostrarError('#error-instagram');
  const historia = $('#ig-formato').value === 'historia';
  $('#ig-lienzo').classList.toggle('historia', historia);
  $('#ig-descripcion').disabled = historia; $('#ig-descripcion').placeholder = historia ? 'Las historias no llevan texto.' : '';
  try { await dibujarInstagram($('#ig-lienzo'), datosInstagram()); } catch (e) { if (turno === igPintando) mostrarError('#error-instagram', 'No pude dibujar la imagen. Intenta de nuevo.'); }
}
$('#ig-formato').addEventListener('change', pintarInstagram);
$('#producto-instagram').addEventListener('click', () => {
  if (!fp().nombre.value.trim()) return mostrarError('#error-producto', 'Escribe el nombre del producto para crear la imagen.');
  mostrarError('#error-producto');
  $('#ig-talla').value = fp().talla.value.trim(); $('#ig-formato').value = 'post'; $('#ig-compartir').hidden = !(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }));
  const f = fp(), cat = catPorId(f.categoria_id.value);
  $('#ig-descripcion').value = armarDescripcion({ nombre: f.nombre.value, precio: f.precio.value, cotizar: f.cotizar.checked, categoriaId: f.categoria_id.value, categoriaNombre: cat?.nombre });
  $('#ig-cuando').value = 'ahora'; $('#ig-fecha-campo').hidden = true; $('#ig-fecha').value = '';
  $('#ig-meta-estado').textContent = ''; $('#ig-publicar').disabled = false;
  api('GET', 'admin/publicaciones').then(({ conexion: c }) => {
    $('#ig-red-ig').disabled = !c.instagram; $('#ig-red-fb').disabled = !c.facebook;
    if (!c.instagram) $('#ig-red-ig').checked = false; if (!c.facebook) $('#ig-red-fb').checked = false;
    $('#ig-meta-estado').textContent = c.instagram || c.facebook ? '' : 'Meta todavía no está conectado (pestaña Redes). Mientras tanto puedes descargar la imagen y subirla a mano.';
    $('#ig-publicar').disabled = !(c.instagram || c.facebook);
  }).catch(() => { $('#ig-publicar').disabled = true; });
  pintarPaletas(); $('#dlg-instagram').showModal(); pintarInstagram();
});
let igTemporizador; $('#ig-talla').addEventListener('input', () => { clearTimeout(igTemporizador); igTemporizador = setTimeout(pintarInstagram, 250); });
const igArchivo = () => new Promise((res) => $('#ig-lienzo').toBlob(res, 'image/png'));
$('#ig-cuando').addEventListener('change', (ev) => { $('#ig-fecha-campo').hidden = ev.target.value !== 'programar'; });
$('#ig-publicar').addEventListener('click', async () => {
  const redes = [$('#ig-red-ig').checked && 'ig', $('#ig-red-fb').checked && 'fb'].filter(Boolean);
  const formato = $('#ig-formato').value, historia = formato === 'historia';
  const descripcion = $('#ig-descripcion').value.trim(), programar = $('#ig-cuando').value === 'programar';
  if (!redes.length) return mostrarError('#error-instagram', 'Elige Instagram, Facebook o las dos.');
  if (!descripcion && !historia) return mostrarError('#error-instagram', 'Escribe la descripción.');
  if (programar && !aISO($('#ig-fecha').value)) return mostrarError('#error-instagram', 'Elige la fecha y la hora.');
  mostrarError('#error-instagram');
  const b = $('#ig-publicar'); b.disabled = true; b.textContent = programar ? 'Programando…' : 'Publicando…';
  try {
    // Instagram solo acepta JPEG: la lámina se guarda en JPEG y se sube a la tienda para que Meta la descargue.
    const jpeg = await new Promise((res) => $('#ig-lienzo').toBlob(res, 'image/jpeg', 0.92));
    if (!jpeg) throw new Error('No pude crear la imagen.');
    const form = new FormData(); form.set('imagen', jpeg, 'lamina.jpg'); form.set('descripcion', historia ? '' : descripcion); form.set('redes', redes.join(',')); form.set('formato', formato);
    if (programar) form.set('programada_en', aISO($('#ig-fecha').value));
    if (fp().referencia.value.trim()) form.set('producto_id', fp().referencia.value.trim());
    const r = await api('POST', 'admin/publicaciones', form);
    if (r.estado === 'publicada') { $('#dlg-instagram').close(); avisar(`Publicado en ${redes.map((x) => ({ ig: 'Instagram', fb: 'Facebook' }[x])).join(' y ')}.`); }
    else if (r.estado === 'pendiente') { $('#dlg-instagram').close(); avisar('Programada. Se publica sola a esa hora (revisa la pestaña Redes).'); }
    else mostrarError('#error-instagram', Object.entries(r.resultado || {}).filter(([, v]) => !v.ok).map(([k, v]) => `${{ ig: 'Instagram', fb: 'Facebook' }[k]}: ${v.error}`).join(' · ') || 'No se pudo publicar.');
  } catch (e) { mostrarError('#error-instagram', e.message); }
  b.disabled = false; b.textContent = 'Publicar';
});
$('#ig-descargar').addEventListener('click', async () => {
  const blob = await igArchivo(); if (!blob) return mostrarError('#error-instagram', 'No pude crear la imagen.');
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombreArchivo(fp().nombre.value, fp().referencia.value); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('#ig-compartir').addEventListener('click', async () => {
  const blob = await igArchivo(); if (!blob) return;
  try { await navigator.share({ files: [new File([blob], nombreArchivo(fp().nombre.value, fp().referencia.value), { type: 'image/png' })] }); } catch { /* la persona canceló */ }
});

/** Reduce la foto en el propio teléfono: 1200 px (ficha) y 600 px (catálogo), en WebP o, si el navegador no lo sabe crear, JPEG. */
async function prepararFoto(archivo) {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una imagen (JPG, PNG o WebP).');
  if (archivo.size > 30 * 1024 * 1024) throw new Error('Esa foto es demasiado grande. Elige una de menos de 30 MB.');
  let bmp;
  try { bmp = await createImageBitmap(archivo); } catch { throw new Error('No pude leer esa imagen. Prueba con una foto JPG, PNG o WebP.'); }
  const hacerBlob = (max, tipo, calidad) => new Promise((res) => {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (tipo === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); } // JPEG no tiene transparencia
    ctx.drawImage(bmp, 0, 0, w, h);
    c.toBlob(res, tipo, calidad);
  });
  let tipo = 'image/webp', grande = await hacerBlob(1200, tipo, 0.85);
  if (!grande || grande.type !== 'image/webp') { tipo = 'image/jpeg'; grande = await hacerBlob(1200, tipo, 0.88); }
  if (grande && grande.size > 1.9 * 1024 * 1024) grande = await hacerBlob(1000, tipo, 0.72);
  const chica = await hacerBlob(600, tipo, 0.82);
  if (!grande || !chica || grande.size > 2 * 1024 * 1024) throw new Error('No pude reducir esa foto. Prueba con otra.');
  return { grande, chica };
}
$('#foto-archivo').addEventListener('change', async (ev) => {
  const archivo = ev.target.files[0]; ev.target.value = '';
  if (!archivo) return;
  const estado = $('#foto-estado'), boton = $('#foto-subir');
  boton.disabled = true; estado.textContent = 'Preparando la foto…'; mostrarError('#error-producto');
  try {
    const { grande, chica } = await prepararFoto(archivo);
    estado.textContent = 'Subiendo…';
    const form = new FormData(); form.set('1200', grande, 'g'); form.set('600', chica, 'c');
    E.foto = (await api('POST', 'admin/fotos', form)).url;
    pintarFoto(); estado.textContent = 'Foto lista. Recuerda guardar el producto.';
  } catch (e) { estado.textContent = ''; mostrarError('#error-producto', e.message); }
  boton.disabled = false;
});

fp().addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = fp(), b = $('#producto-guardar');
  const cuerpo = { nombre: f.nombre.value, categoria_id: f.categoria_id.value, precio: f.precio.value, cotizar: f.cotizar.checked, descripcion: f.descripcion.value, visible: f.visible.checked, disponible: f.disponible.checked, imagen_url: E.foto, cantidad: f.cantidad.value.trim(), tipo_stock: f.tipo_stock.value, costo: f.costo.value.trim(), talla: f.talla.value.trim() };
  if (PERMISOS[E.yo?.rol]?.includes('finanzas')) { cuerpo.lote_id = f.tipo_stock.value === 'local2' && f.lote_id.value ? Number(f.lote_id.value) : null; cuerpo.referencia = f.etiqueta.value.trim(); if (cuerpo.lote_id || cuerpo.tipo_stock === 'local1') delete cuerpo.costo; }
  if (cuerpo.costo !== undefined && cuerpo.costo !== '' && !(Number(cuerpo.costo.replace(/,/g, '')) >= 0)) return mostrarError('#error-producto', 'El costo debe ser un número (o déjalo vacío).');
  if (cuerpo.cantidad !== '' && !/^\d{1,6}$/.test(cuerpo.cantidad)) return mostrarError('#error-producto', 'La cantidad debe ser un número entero (o déjala vacía).');
  if (!cuerpo.nombre.trim()) return mostrarError('#error-producto', 'Escribe el nombre.');
  if (!cuerpo.categoria_id) return mostrarError('#error-producto', 'Elige una categoría.');
  if (!cuerpo.cotizar && cuerpo.precio.trim() === '') return mostrarError('#error-producto', 'Escribe el precio o marca «Por cotizar».');
  if (!E.editando && f.referencia.value.trim()) cuerpo.id = f.referencia.value.trim();
  b.disabled = true; mostrarError('#error-producto');
  try {
    if (E.editando) await api('PUT', `admin/productos/${encodeURIComponent(E.editando.id)}`, cuerpo);
    else await api('POST', 'admin/productos', cuerpo);
    const otro = E.agregarOtro && !E.editando, conservar = { cat: f.categoria_id.value, tipo: f.tipo_stock.value, lote: f.lote_id?.value ?? '' };
    $('#dlg-producto').close(); await cargar(); avisar(E.editando ? 'Cambios guardados.' : otro ? `Producto guardado. Sigue con el siguiente.` : 'Producto creado.');
    if (otro) { // carga rápida: se abre uno nuevo con la misma categoría, tipo de stock y lote
      abrirProducto(null, conservar.cat);
      fp().tipo_stock.value = conservar.tipo; if (conservar.lote) fp().lote_id.value = conservar.lote; actualizarLote();
      fp().nombre.focus();
    }
  } catch (e) { mostrarError('#error-producto', e.message); }
  E.agregarOtro = false;
  b.disabled = false;
});
$('#producto-otro').addEventListener('click', () => { E.agregarOtro = true; fp().requestSubmit(); });
$('#producto-borrar').addEventListener('click', async () => {
  const p = E.editando;
  if (!(await confirmar('Mandar a la papelera', `«${p.nombre}» dejará de verse en la tienda. Podrás restaurarlo durante 30 días.`, 'Mandar a la papelera'))) return;
  if (await hacer(() => api('DELETE', `admin/productos/${encodeURIComponent(p.id)}`), 'Mandado a la papelera.')) $('#dlg-producto').close();
});
$('#producto-duplicar').addEventListener('click', async () => {
  try {
    const { id } = await api('POST', `admin/productos/${encodeURIComponent(E.editando.id)}/duplicar`);
    $('#dlg-producto').close(); await cargar(); avisar('Copia creada (oculta hasta que la publiques).');
    abrirProducto(E.prods.find((x) => x.id === id));
  } catch (e) { mostrarError('#error-producto', e.message); }
});

// --- categorías -------------------------------------------------------------------------
function pintarCategorias() {
  const conteo = (id) => E.prods.filter((p) => p.categoria_id === id).length + E.papelera.filter((p) => p.categoria_id === id).length;
  const fila = (c, hija, i, hermanas) => `<li class="fila cat ${hija ? 'hija' : ''} ${c.activa ? '' : 'apagada'}">
    <div class="fila-texto"><div class="fila-nombre">${esc(c.nombre)}</div><div class="fila-meta"><span>${conteo(c.id)} producto${conteo(c.id) === 1 ? '' : 's'}</span>${hija ? '' : `<span>${hijas(c.id).length} subcategoría${hijas(c.id).length === 1 ? '' : 's'}</span>`}${c.activa ? '' : '<span class="etiqueta aviso">Oculta</span>'}</div></div>
    <div class="fila-acciones">
      ${hija ? '' : `<button type="button" class="boton suave chico" data-accion="subcategoria" data-id="${esc(c.id)}">${ico('mas')} Subcategoría</button>`}
      <button type="button" class="icono" data-accion="visible" data-id="${esc(c.id)}" aria-pressed="${c.activa}" aria-label="${c.activa ? 'Ocultar' : 'Mostrar'} ${esc(c.nombre)}" title="${c.activa ? 'Visible: toca para ocultar' : 'Oculta: toca para mostrar'}">${ico(c.activa ? 'ojo' : 'ojo-no')}</button>
      <button type="button" class="icono" data-accion="subir" data-id="${esc(c.id)}" aria-label="Subir ${esc(c.nombre)}" ${i === 0 ? 'disabled' : ''}>${ico('arriba')}</button>
      <button type="button" class="icono" data-accion="bajar" data-id="${esc(c.id)}" aria-label="Bajar ${esc(c.nombre)}" ${i === hermanas.length - 1 ? 'disabled' : ''}>${ico('abajo')}</button>
      <button type="button" class="icono" data-accion="editar" data-id="${esc(c.id)}" aria-label="Editar ${esc(c.nombre)}">${ico('editar')}</button>
      <button type="button" class="icono peligro" data-accion="borrar" data-id="${esc(c.id)}" aria-label="Borrar ${esc(c.nombre)}">${ico('borrar')}</button>
    </div></li>`;
  const rs = raices();
  $('#lista-categorias').innerHTML = rs.map((r, i) => fila(r, false, i, rs) + hijas(r.id).map((h, j, hs) => fila(h, true, j, hs)).join('')).join('')
    || '<li class="vacio">Todavía no hay categorías.</li>';
}
$('#nueva-categoria').addEventListener('click', () => abrirCategoria(null));
$('#lista-categorias').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-accion]');
  if (!b) return;
  const id = b.dataset.id, c = catPorId(id);
  switch (b.dataset.accion) {
    case 'editar': return abrirCategoria(c);
    case 'subcategoria': return abrirCategoria(null, id);
    case 'visible': return void hacer(() => api('PUT', `admin/categorias/${id}`, { activa: !c.activa }));
    case 'subir': case 'bajar': {
      const nuevo = intercambiar((c.padre_id ? hijas(c.padre_id) : raices()).map((x) => x.id), id, b.dataset.accion === 'subir' ? -1 : 1);
      if (nuevo) return void hacer(() => api('POST', 'admin/orden', { tabla: 'categorias', ids: permutar(E.cats.map((x) => x.id), nuevo) }));
      return;
    }
    case 'borrar':
      if (await confirmar('Borrar categoría', `Se borrará «${c.nombre}». Solo se puede si no tiene productos ni subcategorías.`, 'Borrar')) await hacer(() => api('DELETE', `admin/categorias/${id}`), 'Categoría borrada.');
  }
});
function abrirCategoria(c, padre = '') {
  E.categoria = c;
  const f = $('#form-categoria'); f.reset();
  $('#dlg-categoria-t').textContent = c ? 'Editar categoría' : padre ? 'Nueva subcategoría' : 'Nueva categoría';
  f.nombre.value = c?.nombre ?? '';
  const sinHijas = !c || hijas(c.id).length === 0; // una categoría con subcategorías no puede ir dentro de otra
  f.padre_id.innerHTML = `<option value="">Ninguna (categoría principal)</option>` + raices().filter((r) => !c || r.id !== c.id).map((r) => `<option value="${esc(r.id)}" ${r.id === (c?.padre_id ?? padre) ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('');
  f.padre_id.disabled = !sinHijas;
  f.activa.checked = c ? c.activa : true;
  mostrarError('#error-categoria');
  $('#dlg-categoria').showModal();
}
$('#form-categoria').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, b = $('button[type=submit]', f);
  if (!f.nombre.value.trim()) return mostrarError('#error-categoria', 'Escribe el nombre.');
  const cuerpo = { nombre: f.nombre.value, activa: f.activa.checked };
  if (!f.padre_id.disabled) cuerpo.padre_id = f.padre_id.value || null;
  b.disabled = true; mostrarError('#error-categoria');
  try {
    if (E.categoria) await api('PUT', `admin/categorias/${E.categoria.id}`, cuerpo); else await api('POST', 'admin/categorias', cuerpo);
    $('#dlg-categoria').close(); await cargar(); avisar('Categoría guardada.');
  } catch (e) { mostrarError('#error-categoria', e.message); }
  b.disabled = false;
});

// --- regalos personalizados ---------------------------------------------------------------
const pasosDe = (publico = E.publico) => E.pasos.filter((p) => p.publico === publico).sort((x, y) => x.orden - y.orden);
const pasoPorId = (id, publico = E.publico) => E.pasos.find((p) => p.publico === publico && p.id === id);
const opsDe = (paso, publico = E.publico) => E.ops.filter((o) => o.publico === publico && o.paso === paso).sort((x, y) => x.orden - y.orden);
const opPorId = (id, publico = E.publico) => E.ops.find((o) => o.publico === publico && o.id === id);
const etiquetaOp = (o) => (o.padre_id && opPorId(o.padre_id, o.publico) ? `${etiquetaOp(opPorId(o.padre_id, o.publico))} › ${o.nombre}` : o.nombre);
const mini600 = (url) => (url?.startsWith('/fotos/') ? url.replace('-1200.', '-600.') : url);
/** ¿Se vería en la tienda? Cada paso obligatorio que depende de su paso necesita al menos una opción visible y completa. */
function incompleta(o) {
  return pasosDe(o.publico).some((p) => p.activo && p.depende_de === o.paso && p.minimo >= 1
    && !opsDe(p.id, o.publico).some((c) => c.padre_id === o.id && c.activa && !incompleta(c)));
}
function resumenPaso(p) {
  const partes = [p.tipo === 'multiple' ? `Varias (${p.minimo === 0 ? 'opcional' : `mín. ${p.minimo}`}, máx. ${p.maximo})` : (p.minimo ? 'Una opción, obligatoria' : 'Una opción, opcional')];
  if (p.depende_de) partes.push(`depende de ${pasoPorId(p.depende_de)?.nombre ?? '…'}`);
  return partes.join(' · ');
}
function filaOpcion(o, hermanos, i) {
  const aviso = o.activa && incompleta(o) ? '<span class="etiqueta aviso">No se muestra: le falta una opción dependiente</span>' : '';
  const foto = o.imagen_url ? `<img class="opcion-foto" src="${esc(mini600(o.imagen_url))}" alt="" loading="lazy">` : `<span class="opcion-foto sin">${ico('foto')}</span>`;
  return `<div class="opcion ${o.activa ? '' : 'apagada'}">${foto}<div class="opcion-texto"><div class="opcion-nombre">${esc(o.nombre)} ${o.etiqueta ? `<span class="etiqueta">${esc(o.etiqueta)}</span>` : ''}</div><div class="opcion-meta">${o.precio ? `+ ${esc(dinero(o.precio))}` : 'Sin costo adicional'}${o.descripcion ? ` · ${esc(o.descripcion)}` : ''} ${!o.activa ? '<span class="etiqueta aviso">Oculta</span>' : ''} ${aviso}</div></div>
    <button type="button" class="icono" data-accion="visible" data-id="${esc(o.id)}" aria-pressed="${o.activa}" aria-label="${o.activa ? 'Ocultar' : 'Mostrar'} ${esc(o.nombre)}" title="${o.activa ? 'Visible: toca para ocultar' : 'Oculta: toca para mostrar'}">${ico(o.activa ? 'ojo' : 'ojo-no')}</button>
    <button type="button" class="icono" data-accion="subir" data-id="${esc(o.id)}" aria-label="Subir ${esc(o.nombre)}" ${i === 0 ? 'disabled' : ''}>${ico('arriba')}</button>
    <button type="button" class="icono" data-accion="bajar" data-id="${esc(o.id)}" aria-label="Bajar ${esc(o.nombre)}" ${i === hermanos.length - 1 ? 'disabled' : ''}>${ico('abajo')}</button>
    <button type="button" class="icono" data-accion="editar" data-id="${esc(o.id)}" aria-label="Editar ${esc(o.nombre)}">${ico('editar')}</button></div>`;
}
const botonAnadir = (paso, padre = '', texto = 'Añadir opción') => `<button type="button" class="boton suave chico" data-accion="nueva" data-paso="${esc(paso)}" data-padre="${esc(padre)}">${ico('mas')} ${esc(texto)}</button>`;
function pintarTextosRegalo() {
  const c = E.regaloCfg.find((x) => x.publico === E.publico) || {}, f = $('#form-regalo');
  f.activo.checked = c.activo !== false; f.titulo.value = c.titulo ?? ''; f.intro.value = c.intro ?? ''; f.nota_final.value = c.nota_final ?? '';
  f.dedicatoria_activa.checked = c.dedicatoria_activa !== false; f.dedicatoria_titulo.value = c.dedicatoria_titulo ?? ''; f.dedicatoria_ayuda.value = c.dedicatoria_ayuda ?? ''; f.dedicatoria_max.value = c.dedicatoria_max ?? 250;
  $('#ver-regalo').href = `/regalos/personalizar/${E.publico === 'mujer' ? 'ella' : 'el'}`;
}
function pintarRegalos() {
  $$('#segmentos button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.publico === E.publico)));
  if (!$('#regalo-textos').open || !$('#form-regalo').contains(document.activeElement)) pintarTextosRegalo();
  const pasos = pasosDe();
  $('#pasos').innerHTML = pasos.map((s, n) => {
    const lista = opsDe(s.id);
    const padre = s.depende_de ? pasoPorId(s.depende_de) : null;
    let cuerpo;
    if (!padre) {
      cuerpo = lista.map((o, i) => filaOpcion(o, lista, i)).join('') || '<p class="vacio">Todavía no hay opciones en este paso.</p>';
    } else {
      const padres = opsDe(padre.id);
      cuerpo = padres.map((pa) => {
        const hijos = lista.filter((o) => o.padre_id === pa.id);
        return `<div class="grupo"><div class="grupo-cab"><span>${esc(s.nombre)} de <b>${esc(etiquetaOp(pa))}</b></span>${botonAnadir(s.id, pa.id)}</div>${hijos.map((o, i) => filaOpcion(o, hijos, i)).join('') || '<p class="suave">Aún no tiene opciones.</p>'}</div>`;
      }).join('') || `<p class="vacio">Primero crea opciones en «${esc(padre.nombre)}».</p>`;
    }
    const sinOpciones = s.activo && !lista.some((o) => o.activa && !incompleta(o) && (!padre || opPorId(o.padre_id)?.activa)) ? '<span class="etiqueta aviso">No se muestra: sin opciones visibles</span>' : '';
    return `<section class="paso ${s.activo ? '' : 'apagada'}"><div class="paso-cab"><div><h2><span class="paso-num">${n + 1}</span>${esc(s.nombre)} ${!s.activo ? '<span class="etiqueta aviso">Oculto</span>' : ''} ${sinOpciones}</h2><p class="suave">${esc(s.titulo)} · ${esc(resumenPaso(s))}</p></div>
      <div class="paso-botones">
       <button type="button" class="icono" data-paso-accion="visible" data-paso="${esc(s.id)}" aria-pressed="${s.activo}" aria-label="${s.activo ? 'Ocultar' : 'Mostrar'} el paso ${esc(s.nombre)}" title="${s.activo ? 'Visible' : 'Oculto'}">${ico(s.activo ? 'ojo' : 'ojo-no')}</button>
       <button type="button" class="icono" data-paso-accion="subir" data-paso="${esc(s.id)}" aria-label="Subir el paso ${esc(s.nombre)}" ${n === 0 ? 'disabled' : ''}>${ico('arriba')}</button>
       <button type="button" class="icono" data-paso-accion="bajar" data-paso="${esc(s.id)}" aria-label="Bajar el paso ${esc(s.nombre)}" ${n === pasos.length - 1 ? 'disabled' : ''}>${ico('abajo')}</button>
       <button type="button" class="icono" data-paso-accion="editar" data-paso="${esc(s.id)}" aria-label="Editar el paso ${esc(s.nombre)}">${ico('editar')}</button>
       ${padre ? '' : botonAnadir(s.id)}</div></div>${cuerpo}</section>`;
  }).join('') || '<p class="vacio">Todavía no hay pasos. Añade el primero.</p>';
}
$('#segmentos').addEventListener('click', (ev) => { const b = ev.target.closest('[data-publico]'); if (b) { E.publico = b.dataset.publico; pintarTextosRegalo(); pintarRegalos(); } });
$('#form-regalo').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  mostrarError('#error-regalo');
  const max = Number(f.dedicatoria_max.value);
  if (!Number.isInteger(max) || max < 20 || max > 600) return mostrarError('#error-regalo', 'El largo del mensaje debe ser un número entre 20 y 600.');
  try {
    await api('PUT', `admin/regalo-config/${E.publico}`, { activo: f.activo.checked, titulo: f.titulo.value, intro: f.intro.value, nota_final: f.nota_final.value, dedicatoria_activa: f.dedicatoria_activa.checked, dedicatoria_titulo: f.dedicatoria_titulo.value, dedicatoria_ayuda: f.dedicatoria_ayuda.value, dedicatoria_max: max });
    await cargar(); avisar('Textos guardados.');
  } catch (e) { mostrarError('#error-regalo', e.message); }
});
$('#pasos').addEventListener('click', (ev) => {
  const pa = ev.target.closest('[data-paso-accion]');
  if (pa) {
    const p = pasoPorId(pa.dataset.paso), url = `admin/pasos/${E.publico}/${encodeURIComponent(p.id)}`;
    if (pa.dataset.pasoAccion === 'editar') return abrirPaso(p);
    if (pa.dataset.pasoAccion === 'visible') return void hacer(() => api('PUT', url, { activo: !p.activo }));
    const nuevo = intercambiar(pasosDe().map((x) => x.id), p.id, pa.dataset.pasoAccion === 'subir' ? -1 : 1);
    if (nuevo) void hacer(() => api('POST', 'admin/orden', { tabla: 'pasos', publico: E.publico, ids: nuevo }));
    return;
  }
  const b = ev.target.closest('[data-accion]');
  if (!b) return;
  if (b.dataset.accion === 'nueva') return abrirOpcion(null, b.dataset.paso, b.dataset.padre);
  const o = opPorId(b.dataset.id);
  if (b.dataset.accion === 'editar') return abrirOpcion(o);
  const url = `admin/opciones/${o.publico}/${encodeURIComponent(o.id)}`;
  if (b.dataset.accion === 'visible') return void hacer(() => api('PUT', url, { activa: !o.activa }));
  const grupo = opsDe(o.paso).filter((x) => x.padre_id === o.padre_id).map((x) => x.id);
  const nuevo = intercambiar(grupo, o.id, b.dataset.accion === 'subir' ? -1 : 1);
  if (nuevo) void hacer(() => api('POST', 'admin/orden', { tabla: 'opciones', publico: o.publico, ids: permutar(opsDe(o.paso).map((x) => x.id), nuevo) }));
});

// --- editor de paso ---
const fpaso = () => $('#form-paso');
function ajustarFormPaso() {
  const f = fpaso(), multiple = f.tipo.value === 'multiple';
  $('#campos-multiple').hidden = !multiple; $('#campo-obligatorio').hidden = multiple;
}
fpaso().tipo.addEventListener('change', ajustarFormPaso);
function abrirPaso(p) {
  E.paso = p ? { ...p } : { publico: E.publico, nuevo: true };
  const f = fpaso(); f.reset();
  $('#dlg-paso-t').textContent = `${p ? 'Editar' : 'Nuevo'} paso · ${E.publico === 'mujer' ? 'para ella' : 'para él'}`;
  f.nombre.value = p?.nombre ?? ''; f.titulo.value = p?.titulo ?? ''; f.descripcion.value = p?.descripcion ?? '';
  f.tipo.value = p?.tipo ?? 'unico';
  f.minimo.value = p ? p.minimo : 1; f.maximo.value = p ? p.maximo : 1;
  f.obligatorio.checked = p ? p.minimo >= 1 : true;
  f.activo.checked = p ? p.activo : true;
  const otros = pasosDe().filter((x) => x.id !== p?.id);
  f.depende_de.innerHTML = '<option value="">Ninguno (independiente)</option>' + otros.map((x) => `<option value="${esc(x.id)}" ${x.id === p?.depende_de ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('');
  const bloqueado = !!p && opsDe(p.id).length > 0;
  f.depende_de.disabled = bloqueado;
  $('#ayuda-depende').textContent = bloqueado ? 'Este paso ya tiene opciones: para cambiar de qué depende, bórralas primero.' : 'Si dependen de otro paso, cada opción se asigna a una opción de ese paso (ej. los tamaños de cada base).';
  $('#paso-borrar').hidden = !p;
  ajustarFormPaso(); mostrarError('#error-paso');
  $('#dlg-paso').showModal();
}
$('#paso-nuevo').addEventListener('click', () => abrirPaso(null));
fpaso().addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, p = E.paso, multiple = f.tipo.value === 'multiple';
  if (!f.nombre.value.trim() || !f.titulo.value.trim()) return mostrarError('#error-paso', 'Escribe el nombre y el título.');
  const cuerpo = { nombre: f.nombre.value, titulo: f.titulo.value, descripcion: f.descripcion.value, tipo: f.tipo.value, activo: f.activo.checked,
    minimo: multiple ? Number(f.minimo.value) : (f.obligatorio.checked ? 1 : 0), maximo: multiple ? Number(f.maximo.value) : 1 };
  if (multiple && (!Number.isInteger(cuerpo.minimo) || !Number.isInteger(cuerpo.maximo) || cuerpo.maximo < 1)) return mostrarError('#error-paso', 'Mínimo y máximo deben ser números (el máximo, al menos 1).');
  if (!f.depende_de.disabled) cuerpo.depende_de = f.depende_de.value || null;
  mostrarError('#error-paso');
  try {
    if (p.nuevo) await api('POST', 'admin/pasos', { ...cuerpo, publico: p.publico });
    else await api('PUT', `admin/pasos/${p.publico}/${encodeURIComponent(p.id)}`, cuerpo);
    $('#dlg-paso').close(); await cargar(); avisar('Paso guardado.');
  } catch (e) { mostrarError('#error-paso', e.message); }
});
$('#paso-borrar').addEventListener('click', async () => {
  const p = E.paso, n = opsDe(p.id).length;
  if (!(await confirmar('Borrar paso', `Se borrará el paso «${p.nombre}»${n ? ` y sus ${n} opción(es)` : ''}. Si solo quieres que no se vea, mejor ocúltalo.`, 'Borrar'))) return;
  if (await hacer(() => api('DELETE', `admin/pasos/${p.publico}/${encodeURIComponent(p.id)}`), 'Paso borrado.')) $('#dlg-paso').close();
});

// --- editor de opción ---
function pintarFotoOp() {
  $('#opfoto-vista').innerHTML = E.fotoOp ? `<img src="${esc(mini600(E.fotoOp))}" alt="Foto de la opción">` : ico('foto');
  $('#opfoto-quitar').hidden = !E.fotoOp;
  $('#opfoto-subir-t').textContent = E.fotoOp ? 'Cambiar foto' : 'Subir foto';
}
$('#opfoto-subir').addEventListener('click', () => $('#opfoto-archivo').click());
$('#opfoto-quitar').addEventListener('click', () => { E.fotoOp = null; pintarFotoOp(); });
$('#opfoto-archivo').addEventListener('change', async (ev) => {
  const archivo = ev.target.files[0]; ev.target.value = '';
  if (!archivo) return;
  const estado = $('#opfoto-estado'), boton = $('#opfoto-subir');
  boton.disabled = true; estado.textContent = 'Preparando la foto…'; mostrarError('#error-opcion');
  try {
    const { grande, chica } = await prepararFoto(archivo);
    estado.textContent = 'Subiendo…';
    const form = new FormData(); form.set('1200', grande, 'g'); form.set('600', chica, 'c');
    E.fotoOp = (await api('POST', 'admin/fotos', form)).url;
    pintarFotoOp(); estado.textContent = 'Foto lista. Recuerda guardar la opción.';
  } catch (e) { estado.textContent = ''; mostrarError('#error-opcion', e.message); }
  boton.disabled = false;
});
function abrirOpcion(o, paso = o?.paso, padre = '') {
  const s = pasoPorId(paso), anterior = s?.depende_de ? pasoPorId(s.depende_de) : null;
  E.opcion = o ? { ...o } : { publico: E.publico, paso, nuevo: true };
  E.fotoOp = o?.imagen_url || null;
  const f = $('#form-opcion'); f.reset();
  $('#dlg-opcion-t').textContent = `${o ? 'Editar' : 'Nueva'} opción de ${s.nombre} · ${E.publico === 'mujer' ? 'para ella' : 'para él'}`;
  f.nombre.value = o?.nombre ?? ''; f.descripcion.value = o?.descripcion ?? ''; f.etiqueta.value = o?.etiqueta ?? '';
  f.precio.value = o ? o.precio : '';
  f.activa.checked = o ? o.activa : true;
  $('#campo-padre').hidden = !anterior;
  if (anterior) {
    $('#campo-padre-t').textContent = `Pertenece a (${anterior.nombre})`;
    f.padre_id.innerHTML = opsDe(anterior.id).map((pa) => `<option value="${esc(pa.id)}" ${pa.id === (o?.padre_id ?? padre) ? 'selected' : ''}>${esc(etiquetaOp(pa))}</option>`).join('');
  }
  $('#ayuda-opcion').textContent = anterior ? 'Esta opción solo aparece cuando la clienta elige la opción a la que pertenece. El precio se suma al total.' : 'El precio se suma al total del regalo. La foto se ve en la tarjeta de la tienda y en la vista previa.';
  $('#opcion-borrar').hidden = !o; $('#opfoto-estado').textContent = '';
  mostrarError('#error-opcion'); pintarFotoOp();
  $('#dlg-opcion').showModal();
}
$('#form-opcion').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, b = $('button[type=submit]', f), o = E.opcion, s = pasoPorId(o.paso);
  if (!f.nombre.value.trim()) return mostrarError('#error-opcion', 'Escribe el nombre.');
  if (s.depende_de && !f.padre_id.value) return mostrarError('#error-opcion', `Primero crea una opción en «${pasoPorId(s.depende_de)?.nombre}».`);
  const cuerpo = { nombre: f.nombre.value, descripcion: f.descripcion.value, etiqueta: f.etiqueta.value, precio: f.precio.value.trim() === '' ? 0 : f.precio.value, activa: f.activa.checked, imagen_url: E.fotoOp };
  if (s.depende_de) cuerpo.padre_id = f.padre_id.value;
  b.disabled = true; mostrarError('#error-opcion');
  try {
    if (o.nuevo) await api('POST', 'admin/opciones', { ...cuerpo, publico: o.publico, paso: o.paso });
    else await api('PUT', `admin/opciones/${o.publico}/${encodeURIComponent(o.id)}`, cuerpo);
    $('#dlg-opcion').close(); await cargar(); avisar('Guardado.');
  } catch (e) { mostrarError('#error-opcion', e.message); }
  b.disabled = false;
});
$('#opcion-borrar').addEventListener('click', async () => {
  const o = E.opcion;
  const arbol = (id) => E.ops.filter((x) => x.publico === o.publico && x.padre_id === id).flatMap((x) => [x, ...arbol(x.id)]);
  const n = arbol(o.id).length;
  const extra = n ? ` También se borrarán las ${n} opción(es) que dependen de ella.` : '';
  if (!(await confirmar('Borrar opción', `Se borrará «${o.nombre}».${extra} Si solo quieres que no se vea, mejor ocúltala.`, 'Borrar'))) return;
  if (await hacer(() => api('DELETE', `admin/opciones/${o.publico}/${encodeURIComponent(o.id)}`), 'Borrado.')) $('#dlg-opcion').close();
});

// --- ajustes -------------------------------------------------------------------------------
function pintarAjustes() {
  if (PERMISOS[E.yo?.rol]?.includes('usuarios')) pintarUsuarios();
  pintarHuellas();
  const f = $('#form-ajustes');
  for (const k of ['asesora1_nombre', 'asesora1_whatsapp', 'asesora2_nombre', 'asesora2_whatsapp']) if (document.activeElement !== f[k]) f[k].value = E.ajustes[k] ?? '';
}
$('#form-ajustes').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, b = $('button[type=submit]', f);
  b.disabled = true; mostrarError('#error-ajustes');
  try {
    await api('PUT', 'admin/ajustes', Object.fromEntries(['asesora1_nombre', 'asesora1_whatsapp', 'asesora2_nombre', 'asesora2_whatsapp'].map((k) => [k, f[k].value])));
    await cargar(); avisar('Ajustes guardados.');
  } catch (e) { mostrarError('#error-ajustes', e.message); }
  b.disabled = false;
});
$('#form-clave').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, b = $('button[type=submit]', f);
  if (f.nueva.value !== f.repite.value) return mostrarError('#error-clave', 'Las contraseñas nuevas no coinciden.');
  b.disabled = true; mostrarError('#error-clave');
  try { await api('POST', 'auth/clave', { actual: f.actual.value, nueva: f.nueva.value }); f.reset(); avisar('Contraseña cambiada.'); } catch (e) { mostrarError('#error-clave', e.message); }
  b.disabled = false;
});

// --- diálogos y arranque ----------------------------------------------------------------
document.addEventListener('click', (ev) => { if (ev.target.closest('[data-cerrar]')) ev.target.closest('dialog').close(); });
$$('dialog').forEach((d) => d.addEventListener('click', (ev) => { if (ev.target === d && d.id !== 'dlg-producto') d.close(); }));
window.addEventListener('hashchange', () => { if (!$('#vista-panel').hidden && !/^#(restablecer|invitacion)=/.test(location.hash)) ir(location.hash.slice(1)); });

// --- estadísticas -----------------------------------------------------------------------------
const NOMBRES_RUTA = { '/': 'Inicio', '/catalogo': 'Catálogo', '/contacto': 'Contacto', '/perfumes': 'Perfumes', '/accesorios': 'Accesorios', '/regalos': 'Regalos', '/regalos/personalizar': 'Personalizar regalo', '/regalos/prearmados': 'Regalos prearmados', '/condiciones': 'Compra y atención', '/privacidad': 'Privacidad', '/terminos': 'Términos' };
const nombreRuta = (r) => NOMBRES_RUTA[r] || (r.startsWith('/producto/') ? `Ficha: ${decodeURIComponent(r.slice(10))}` : r.replace(/^\//, '').replace(/\//g, ' › '));
const num = (n) => Number(n || 0).toLocaleString('es-HN');
function grafica(serie) {
  const W = 640, H = 180, p = { l: 30, r: 8, t: 12, b: 24 }, max = Math.max(4, ...serie.map((d) => d.visitantes)), ancho = (W - p.l - p.r) / serie.length;
  const y = (v) => p.t + (H - p.t - p.b) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];
  return `<svg viewBox="0 0 ${W} ${H}" class="svg-grafica" aria-hidden="true">${ticks.map((t) => `<line x1="${p.l}" x2="${W - p.r}" y1="${y(t)}" y2="${y(t)}" class="eje"/><text x="${p.l - 6}" y="${y(t) + 4}" text-anchor="end" class="eje-t">${t}</text>`).join('')}
    ${serie.map((d, i) => { const x = p.l + i * ancho + ancho * 0.18, h = Math.max(d.visitantes ? 2 : 0, (H - p.t - p.b) * (d.visitantes / max)); return `<rect x="${x.toFixed(1)}" y="${(H - p.b - h).toFixed(1)}" width="${(ancho * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="3" class="barra"><title>${esc(d.dia)}: ${d.visitantes} visitantes, ${d.vistas} páginas vistas</title></rect>${i % 2 === 0 || serie.length < 8 ? `<text x="${(x + ancho * 0.32).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="eje-t">${esc(d.dia.slice(8))}</text>` : ''}`; }).join('')}</svg>`;
}
async function pintarEstadisticas() {
  let a;
  try { a = await api('GET', 'admin/actividad'); } catch (e) { return avisar(e.message, true); }
  const c = a.consentimiento;
  $('#kpis').innerHTML = [
    [num(a.visitantes.hoy), 'visitantes hoy', `${num(a.vistas.hoy)} páginas vistas`],
    [num(a.visitantes.semana), 'visitantes en 7 días', `${num(a.vistas.semana)} páginas vistas`],
    [num(a.visitantes.mes), 'visitantes en 30 días', `${num(a.vistas.mes)} páginas vistas`],
    [num(a.whatsapp), 'clics a WhatsApp', `${num(a.agregados)} veces se agregó algo a la bolsa`],
    [c.porcentaje === null ? '—' : `${c.porcentaje}%`, 'acepta la medición', `${num(c.acepta)} aceptan · ${num(c.rechaza)} solo lo necesario`],
  ].map(([n, t, d]) => `<div class="kpi"><b>${esc(n)}</b><span>${esc(t)}</span><small>${esc(d)}</small></div>`).join('');
  $('#grafica').innerHTML = grafica(a.serie);
  $('#top-productos').innerHTML = a.productos.map((p) => `<li><span>${esc(p.nombre)}</span><b>${num(p.vistas)}</b></li>`).join('') || '<li class="vacio">Aún no hay datos.</li>';
  $('#top-paginas').innerHTML = a.paginas.map((p) => `<li><span>${esc(nombreRuta(p.ruta))}</span><b>${num(p.vistas)}</b></li>`).join('') || '<li class="vacio">Aún no hay datos.</li>';
  $('#nota-stats').textContent = 'Los «visitantes» son personas distintas por día (quien vuelve otro día cuenta otra vez, porque el código que los identifica cambia a diario). Quien elige «Solo lo necesario» o tiene activada la señal «no rastrear» no aparece aquí.';
}
$('#recargar-stats').addEventListener('click', pintarEstadisticas);

// --- huella o Face ID ------------------------------------------------------------------------------
// Solo se activa estando dentro con contraseña. Usa la API nativa del navegador (WebAuthn); si no existe, no se ofrece.
const soportaHuella = () => !!(window.PublicKeyCredential && PublicKeyCredential.parseCreationOptionsFromJSON && PublicKeyCredential.parseRequestOptionsFromJSON && window.isSecureContext);
const nombreDispositivo = () => { const u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Teléfono Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Computadora Windows' : 'Mi dispositivo'; };
const mensajeHuella = (e) => (e.name === 'NotAllowedError' ? 'Se canceló. Inténtalo de nuevo.' : e.name === 'InvalidStateError' ? 'Este dispositivo ya está activado.' : e.name === 'NotSupportedError' || e.name === 'SecurityError' ? 'Este dispositivo o navegador no permite usar la huella aquí.' : e.message);

async function activarHuella() {
  const opciones = await api('POST', 'auth/huella/opciones-registro');
  let cred;
  try { cred = await navigator.credentials.create({ publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(opciones) }); } catch (e) { throw new Error(mensajeHuella(e)); }
  await api('POST', 'auth/huella/registrar', { respuesta: cred.toJSON(), nombre: nombreDispositivo() });
}
async function entrarConHuella() {
  const { retoId, ...opciones } = await api('POST', 'auth/huella/opciones-entrar');
  let cred;
  try { cred = await navigator.credentials.get({ publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(opciones) }); } catch (e) { throw new Error(mensajeHuella(e)); }
  await iniciarSesion(await api('POST', 'auth/huella/entrar', { retoId, respuesta: cred.toJSON() }));
}
async function pintarHuellas() {
  $('#tarjeta-huella').hidden = !soportaHuella();
  if (!soportaHuella()) return;
  try {
    const { huellas } = await api('GET', 'auth/huellas');
    E.yo.huellas = huellas.length;
    $('#lista-huellas').innerHTML = huellas.map((h) => `<li class="fila huella"><div class="fila-texto"><div class="fila-nombre">${esc(h.nombre || 'Dispositivo')}</div><div class="fila-meta"><span>Activada el ${esc(String(h.creado).slice(0, 10))}</span>${h.usado ? `<span>Último uso ${esc(String(h.usado).slice(0, 10))}</span>` : ''}</div></div>
      <div class="fila-acciones"><button type="button" class="boton suave peligro chico" data-quitar-huella="${esc(h.id)}">Quitar</button></div></li>`).join('');
  } catch { /* si falla, la tarjeta queda vacía */ }
}
$('#activar-huella').addEventListener('click', async () => {
  const b = $('#activar-huella'); b.disabled = true; mostrarError('#error-huella');
  try { await activarHuella(); avisar('Listo: la próxima vez puedes entrar con tu huella o Face ID.'); await pintarHuellas(); } catch (e) { mostrarError('#error-huella', e.message); }
  b.disabled = false;
});
$('#lista-huellas').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-quitar-huella]');
  if (!b || !(await confirmar('Quitar huella', 'Ese dispositivo tendrá que entrar con la contraseña.', 'Quitar'))) return;
  try { await api('DELETE', `auth/huellas/${encodeURIComponent(b.dataset.quitarHuella)}`); avisar('Quitada.'); } catch (e) { avisar(e.message, true); }
  pintarHuellas();
});
$('#entrar-huella').hidden = !soportaHuella();
$('#entrar-huella').addEventListener('click', async () => {
  const b = $('#entrar-huella'); b.disabled = true; mostrarError('#error-entrar');
  try { await entrarConHuella(); } catch (e) { mostrarError('#error-entrar', e.message); }
  b.disabled = false;
});
// Aviso al entrar con contraseña: ofrece activar la huella una vez por persona y dispositivo.
const claveAviso = () => `huella-luego:${E.yo?.correo}`;
function mostrarAvisoHuella() {
  let luego = false; try { luego = localStorage.getItem(claveAviso()) === '1'; } catch { /* sin almacenamiento */ }
  $('#banner-huella').hidden = !(soportaHuella() && E.yo && E.yo.huellas === 0 && !luego);
}
$('#banner-activar').addEventListener('click', async () => {
  try { await activarHuella(); E.yo.huellas = 1; avisar('Listo: la próxima vez puedes entrar con tu huella o Face ID.'); } catch (e) { avisar(e.message, true); }
  mostrarAvisoHuella();
});
$('#banner-luego').addEventListener('click', () => { try { localStorage.setItem(claveAviso(), '1'); } catch { /* da igual */ } $('#banner-huella').hidden = true; });

// --- usuarios y rangos (solo administradoras) ----------------------------------------------
const AYUDA_ROL = {
  admin: 'Todo: productos, categorías, regalos, ajustes y usuarios.',
  catalogo: 'Agregar y editar productos, categorías y regalos personalizados. No ve ajustes ni usuarios.',
  atencion: 'Cambiar el WhatsApp de las asesoras. No toca el catálogo ni los usuarios.',
  lectura: 'Solo ver el catálogo y los regalos. No puede cambiar nada.',
};
async function pintarUsuarios() {
  try {
    const d = await api('GET', 'admin/usuarios');
    Object.assign(E, { usuarios: d.usuarios, invitaciones: d.invitaciones, roles: d.roles });
  } catch (e) { return avisar(e.message, true); }
  $('#rangos').innerHTML = `<h2>Rangos</h2><ul class="rangos-lista">${Object.entries(E.roles).map(([k, n]) => `<li><b>${esc(n)}</b><span class="suave">${esc(AYUDA_ROL[k] || '')}</span></li>`).join('')}</ul>`;
  const opcionesRol = (sel) => Object.entries(E.roles).map(([k, n]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
  $('#lista-usuarios').innerHTML = E.usuarios.map((u) => {
    const yoMismo = u.correo === E.yo.correo, ini = (u.nombre || u.correo).trim()[0]?.toUpperCase() || '?';
    return `<li class="fila usuario ${u.activo ? '' : 'apagada'}"><span class="avatar" aria-hidden="true">${esc(ini)}</span>
      <div class="fila-texto"><div class="fila-nombre">${esc(u.nombre || u.correo)} ${yoMismo ? '<span class="etiqueta ok">Tú</span>' : ''}${u.activo ? '' : '<span class="etiqueta aviso">Desactivada</span>'}</div><div class="fila-meta"><span>${esc(u.correo)}</span></div></div>
      <div class="fila-acciones">
        <select data-rol-de="${esc(u.id)}" aria-label="Rango de ${esc(u.nombre || u.correo)}" ${yoMismo ? 'disabled' : ''}>${opcionesRol(u.rol)}</select>
        ${yoMismo ? '' : `<button type="button" class="boton suave chico" data-accion="activar" data-id="${esc(u.id)}">${u.activo ? 'Desactivar' : 'Activar'}</button><button type="button" class="icono peligro" data-accion="borrar" data-id="${esc(u.id)}" aria-label="Borrar a ${esc(u.nombre || u.correo)}">${ico('borrar')}</button>`}
      </div></li>`;
  }).join('');
  $('#t-invitaciones').hidden = !E.invitaciones.length;
  $('#lista-invitaciones').innerHTML = E.invitaciones.map((i) => `<li class="fila usuario apagada"><span class="avatar" aria-hidden="true">${esc((i.nombre || i.correo)[0]?.toUpperCase() || '?')}</span>
    <div class="fila-texto"><div class="fila-nombre">${esc(i.nombre || i.correo)}</div><div class="fila-meta"><span>${esc(i.correo)}</span><span class="etiqueta">${esc(E.roles[i.rol] || i.rol)}</span><span>Pendiente</span></div></div>
    <div class="fila-acciones"><button type="button" class="boton suave peligro chico" data-accion="cancelar" data-id="${esc(i.id)}">Cancelar</button></div></li>`).join('');
}
$('#lista-usuarios').addEventListener('change', async (ev) => {
  const sel = ev.target.closest('[data-rol-de]');
  if (!sel) return;
  try { await api('PUT', `admin/usuarios/${sel.dataset.rolDe}`, { rol: sel.value }); avisar('Rango cambiado.'); } catch (e) { avisar(e.message, true); }
  pintarUsuarios();
});
$('#sec-usuarios').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-accion]');
  if (!b) return;
  const u = E.usuarios.find((x) => x.id === b.dataset.id);
  try {
    if (b.dataset.accion === 'activar') { await api('PUT', `admin/usuarios/${u.id}`, { activo: !u.activo }); avisar(u.activo ? 'Desactivada: ya no puede entrar.' : 'Activada.'); }
    else if (b.dataset.accion === 'borrar') { if (!(await confirmar('Borrar usuaria', `«${u.nombre || u.correo}» ya no podrá entrar al panel.`, 'Borrar'))) return; await api('DELETE', `admin/usuarios/${u.id}`); avisar('Borrada.'); }
    else if (b.dataset.accion === 'cancelar') { await api('DELETE', `admin/invitaciones/${b.dataset.id}`); avisar('Cancelado.'); }
  } catch (e) { avisar(e.message, true); }
  pintarUsuarios();
});
$('#invitar').addEventListener('click', () => {
  const f = $('#form-invitar'); f.reset();
  f.rol.innerHTML = Object.entries(E.roles).map(([k, n]) => `<option value="${k}" ${k === 'catalogo' ? 'selected' : ''}>${esc(n)}</option>`).join('');
  $('#ayuda-rol').textContent = AYUDA_ROL[f.rol.value];
  mostrarError('#error-invitar');
  $('#dlg-invitar').showModal();
});
$('#form-invitar').rol.addEventListener('change', (ev) => { $('#ayuda-rol').textContent = AYUDA_ROL[ev.target.value] || ''; });
$('#form-invitar').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, b = $('button[type=submit]', f);
  if (!f.nombre.value.trim() || !f.correo.value.trim()) return mostrarError('#error-invitar', 'Escribe el nombre y el correo.');
  b.disabled = true; mostrarError('#error-invitar');
  try { await api('POST', 'admin/usuarios', { nombre: f.nombre.value, correo: f.correo.value, rol: f.rol.value }); $('#dlg-invitar').close(); avisar('Listo: le enviamos el correo.'); pintarUsuarios(); } catch (e) { mostrarError('#error-invitar', e.message); }
  b.disabled = false;
});

// Enlaces de correo: #restablecer=… y #invitacion=… (el token se guarda en memoria y se quita de la dirección).
async function procesarEnlace() {
  const m = location.hash.match(/^#(restablecer|invitacion)=([\w-]+)$/);
  if (!m) return false;
  enlaceToken = m[2];
  history.replaceState(null, '', location.pathname);
  $('#vista-panel').hidden = true; $('#vista-entrar').hidden = false;
  if (m[1] === 'restablecer') { mostrarModo('restablecer'); return true; }
  try {
    const i = await api('POST', 'auth/invitacion-ver', { token: enlaceToken });
    $('#invitacion-texto').textContent = `Entrarás como ${i.rolNombre}. Tu correo es ${i.correo}.`;
    $('#form-invitacion').usuario.value = i.correo; $('#form-invitacion').nombre.value = i.nombre || '';
    mostrarModo('invitacion');
  } catch (e) { mostrarEntrar(e.message); }
  return true;
}
window.addEventListener('hashchange', procesarEnlace);

(async () => {
  if (await procesarEnlace()) return;
  try {
    const r = await api('GET', 'auth/sesion');
    if (r.sesion) await mostrarPanel(r.sesion);
    else mostrarEntrar('', r.configurar ? 'configurar' : 'entrar');
  } catch { mostrarEntrar(); }
})();

// Panel instalable (PWA): registra el service worker mínimo y ofrece el botón «Instalar» cuando el navegador lo permite.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => {});
let instalador = null;
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); instalador = ev; $('#instalar').hidden = false; });
window.addEventListener('appinstalled', () => { instalador = null; $('#instalar').hidden = true; avisar('App instalada.'); });
$('#instalar').addEventListener('click', async () => { if (!instalador) return; instalador.prompt(); await instalador.userChoice.catch(() => {}); instalador = null; $('#instalar').hidden = true; });
