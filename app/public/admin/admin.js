// Panel de administración de Alexa Detalles: productos, categorías, regalos personalizados y ajustes.
// Sin librerías. Todo lo que viene de la base de datos pasa por esc() antes de llegar al HTML.
import { dibujarInstagram, nombreArchivo } from '/admin/instagram.js';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = (n) => (n === null || n === undefined || n === '' ? '—' : new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(Number(n)));
const ico = (id) => `<svg class="ico" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const fold = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PERMISOS = { admin: ['catalogo', 'ajustes', 'usuarios', 'estadisticas'], catalogo: ['catalogo'], atencion: ['ajustes'], lectura: ['estadisticas'] };
const E = { yo: null, usuarios: [], invitaciones: [], roles: {}, cats: [], prods: [], papelera: [], ops: [], pasos: [], regaloCfg: [], ajustes: {}, vista: 'productos', texto: '', cat: '', filtro: 'todos', publico: 'mujer', foto: null, editando: null, opcion: null, categoria: null };

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
  for (const p of ['catalogo', 'ajustes', 'usuarios', 'estadisticas']) document.body.toggleAttribute(`data-p-${p}`, permisos.includes(p));
  document.body.dataset.rol = yo.rol;
  $('#quien').textContent = `${yo.nombre || yo.correo} · ${yo.rolNombre || ''}`;
  $$('#form-ajustes input, #form-ajustes button').forEach((x) => { x.disabled = !permisos.includes('ajustes'); });
}
async function mostrarPanel(yo) {
  $('#vista-entrar').hidden = true; $('#vista-panel').hidden = false;
  aplicarSesion(yo);
  await cargar();
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
}
const VISTAS = ['productos', 'categorias', 'regalos', 'estadisticas', 'ajustes'];
function ir(vista) {
  if (vista === 'usuarios') vista = 'ajustes'; // los usuarios viven dentro de Ajustes
  if (!VISTAS.includes(vista) || (vista === 'estadisticas' && !PERMISOS[E.yo?.rol]?.includes('estadisticas'))) vista = 'productos';
  E.vista = vista;
  history.replaceState(null, '', `#${vista}`);
  for (const s of VISTAS) $(`#sec-${s}`).hidden = s !== vista;
  $$('#pestanas button').forEach((b) => (b.dataset.ir === vista ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  pintar();
}
$('#pestanas').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ir]'); if (b) ir(b.dataset.ir); });
function pintar() {
  if (E.vista === 'productos') pintarProductos();
  else if (E.vista === 'categorias') pintarCategorias();
  else if (E.vista === 'regalos') pintarRegalos();
  else if (E.vista === 'estadisticas') pintarEstadisticas();
  else pintarAjustes();
}

// --- productos -------------------------------------------------------------------------
const miniatura = (p) => (p.imagen_url ? `<img src="${esc(p.imagen_url.startsWith('/fotos/') ? p.imagen_url.replace('-1200.', '-600.') : p.imagen_url)}" alt="" loading="lazy">` : ico('foto'));
const FILTROS = [['todos', 'Todos', () => true], ['visibles', 'Visibles', (p) => p.visible], ['ocultos', 'Ocultos', (p) => !p.visible], ['agotados', 'Sin existencias', (p) => !p.disponible], ['sinfoto', 'Sin foto', (p) => !p.imagen_url]];
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
      !p.disponible && '<span class="etiqueta mal">Sin existencias</span>',
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
  f.precio.disabled = f.cotizar.checked;
  $('#producto-borrar').hidden = !p; $('#producto-duplicar').hidden = !p;
  $('#foto-estado').textContent = '';
  mostrarError('#error-producto');
  pintarFoto();
  $('#dlg-producto').showModal();
}
fp().cotizar.addEventListener('change', (ev) => { fp().precio.disabled = ev.target.checked; if (ev.target.checked) fp().precio.value = ''; });
$('#foto-subir').addEventListener('click', () => $('#foto-archivo').click());
$('#foto-quitar').addEventListener('click', () => { E.foto = null; pintarFoto(); });

// Imagen para Instagram: usa lo que hay ahora en el formulario (foto, nombre, precio) y una talla opcional.
const datosInstagram = () => { const f = fp(); return { fotoUrl: E.foto, nombre: f.nombre.value, precio: f.precio.value, cotizar: f.cotizar.checked, talla: $('#ig-talla').value }; };
let igPintando = 0;
async function pintarInstagram() {
  const turno = ++igPintando; mostrarError('#error-instagram');
  try { await dibujarInstagram($('#ig-lienzo'), datosInstagram()); } catch (e) { if (turno === igPintando) mostrarError('#error-instagram', 'No pude dibujar la imagen. Intenta de nuevo.'); }
}
$('#producto-instagram').addEventListener('click', () => {
  if (!fp().nombre.value.trim()) return mostrarError('#error-producto', 'Escribe el nombre del producto para crear la imagen.');
  mostrarError('#error-producto');
  $('#ig-talla').value = ''; $('#ig-compartir').hidden = !(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }));
  $('#dlg-instagram').showModal(); pintarInstagram();
});
let igTemporizador; $('#ig-talla').addEventListener('input', () => { clearTimeout(igTemporizador); igTemporizador = setTimeout(pintarInstagram, 250); });
const igArchivo = () => new Promise((res) => $('#ig-lienzo').toBlob(res, 'image/png'));
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
  const cuerpo = { nombre: f.nombre.value, categoria_id: f.categoria_id.value, precio: f.precio.value, cotizar: f.cotizar.checked, descripcion: f.descripcion.value, visible: f.visible.checked, disponible: f.disponible.checked, imagen_url: E.foto };
  if (!cuerpo.nombre.trim()) return mostrarError('#error-producto', 'Escribe el nombre.');
  if (!cuerpo.categoria_id) return mostrarError('#error-producto', 'Elige una categoría.');
  if (!cuerpo.cotizar && cuerpo.precio.trim() === '') return mostrarError('#error-producto', 'Escribe el precio o marca «Por cotizar».');
  if (!E.editando && f.referencia.value.trim()) cuerpo.id = f.referencia.value.trim();
  b.disabled = true; mostrarError('#error-producto');
  try {
    if (E.editando) await api('PUT', `admin/productos/${encodeURIComponent(E.editando.id)}`, cuerpo);
    else await api('POST', 'admin/productos', cuerpo);
    $('#dlg-producto').close(); await cargar(); avisar(E.editando ? 'Cambios guardados.' : 'Producto creado.');
  } catch (e) { mostrarError('#error-producto', e.message); }
  b.disabled = false;
});
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
