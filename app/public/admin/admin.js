// Panel de administración de Alexa Detalles: productos, categorías, regalos personalizados y ajustes.
// Sin librerías. Todo lo que viene de la base de datos pasa por esc() antes de llegar al HTML.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = (n) => (n === null || n === undefined || n === '' ? '—' : new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(Number(n)));
const ico = (id) => `<svg class="ico" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const fold = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PERMISOS = { admin: ['catalogo', 'ajustes', 'usuarios'], catalogo: ['catalogo'], atencion: ['ajustes'], lectura: [] };
const E = { yo: null, usuarios: [], invitaciones: [], roles: {}, cats: [], prods: [], papelera: [], ops: [], ajustes: {}, vista: 'productos', texto: '', cat: '', filtro: 'todos', publico: 'mujer', foto: null, editando: null, opcion: null, categoria: null };

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
  for (const p of ['catalogo', 'ajustes', 'usuarios']) document.body.toggleAttribute(`data-p-${p}`, permisos.includes(p));
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
  Object.assign(E, { cats: d.categorias, prods: d.productos, papelera: d.papelera, ops: d.opciones, ajustes: d.ajustes });
  pintar();
}
const VISTAS = ['productos', 'categorias', 'regalos', 'ajustes'];
function ir(vista) {
  if (vista === 'usuarios') vista = 'ajustes'; // los usuarios viven dentro de Ajustes
  if (!VISTAS.includes(vista)) vista = 'productos';
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
const PASOS = [
  { k: 'base', t: 'Base', d: 'El empaque del regalo: caja de madera, de cartón…', uno: 'base' },
  { k: 'tamano', t: 'Tamaño', d: 'Cada tamaño pertenece a una base y define cuánto cabe.', padre: 'base', uno: 'tamaño' },
  { k: 'contenido', t: 'Contenido', d: 'Lo que lleva dentro. Cada contenido pertenece a un tamaño.', padre: 'tamano', uno: 'contenido' },
  { k: 'peluches', t: 'Peluches', d: 'Opcional. La clienta puede elegir hasta dos.', uno: 'peluche' },
  { k: 'globos', t: 'Globos', d: 'Opcional. Puede elegir los que quiera.', uno: 'globo' },
  { k: 'entrega', t: 'Entrega', d: 'Cómo lo recibe: retirar en tienda, delivery…', uno: 'forma de entrega' },
];
const opsDe = (paso, publico = E.publico) => E.ops.filter((o) => o.publico === publico && o.paso === paso);
const opPorId = (id, publico = E.publico) => E.ops.find((o) => o.publico === publico && o.id === id);
const etiquetaOp = (o) => (o.padre_id ? `${etiquetaOp(opPorId(o.padre_id, o.publico))} › ${o.nombre}` : o.nombre);
/** ¿Se vería en la tienda? Una base necesita un tamaño y un tamaño necesita contenido (activos), igual que en la tienda. */
function incompleta(o) {
  if (o.paso === 'tamano') return !opsDe('contenido', o.publico).some((c) => c.padre_id === o.id && c.activa);
  if (o.paso === 'base') return !opsDe('tamano', o.publico).some((t) => t.padre_id === o.id && t.activa && !incompleta(t));
  return false;
}
function filaOpcion(o, hermanos, i) {
  const aviso = o.activa && incompleta(o) ? `<span class="etiqueta aviso">No se muestra: ${o.paso === 'base' ? 'le falta un tamaño con contenido' : 'le falta contenido'}</span>` : '';
  return `<div class="opcion ${o.activa ? '' : 'apagada'}"><div class="opcion-texto"><div class="opcion-nombre">${esc(o.nombre)}</div><div class="opcion-meta">${o.precio ? `+ ${esc(dinero(o.precio))}` : 'Sin costo adicional'} ${!o.activa ? '<span class="etiqueta aviso">Oculta</span>' : ''} ${aviso}</div></div>
    <button type="button" class="icono" data-accion="visible" data-id="${esc(o.id)}" aria-pressed="${o.activa}" aria-label="${o.activa ? 'Ocultar' : 'Mostrar'} ${esc(o.nombre)}" title="${o.activa ? 'Visible: toca para ocultar' : 'Oculta: toca para mostrar'}">${ico(o.activa ? 'ojo' : 'ojo-no')}</button>
    <button type="button" class="icono" data-accion="subir" data-id="${esc(o.id)}" aria-label="Subir ${esc(o.nombre)}" ${i === 0 ? 'disabled' : ''}>${ico('arriba')}</button>
    <button type="button" class="icono" data-accion="bajar" data-id="${esc(o.id)}" aria-label="Bajar ${esc(o.nombre)}" ${i === hermanos.length - 1 ? 'disabled' : ''}>${ico('abajo')}</button>
    <button type="button" class="icono" data-accion="editar" data-id="${esc(o.id)}" aria-label="Editar ${esc(o.nombre)}">${ico('editar')}</button></div>`;
}
const botonAnadir = (paso, uno, padre = '', texto = '') => `<button type="button" class="boton suave chico" data-accion="nueva" data-paso="${paso}" data-padre="${esc(padre)}">${ico('mas')} ${esc(texto || `Añadir ${uno}`)}</button>`;
function pintarRegalos() {
  $$('#segmentos button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.publico === E.publico)));
  $('#pasos').innerHTML = PASOS.map((s, n) => {
    const lista = opsDe(s.k);
    let cuerpo;
    if (!s.padre) {
      cuerpo = lista.map((o, i) => filaOpcion(o, lista, i)).join('') || '<p class="vacio">Todavía no hay opciones en este paso.</p>';
    } else {
      const padres = opsDe(s.padre);
      cuerpo = padres.map((pa) => {
        const hijos = lista.filter((o) => o.padre_id === pa.id);
        return `<div class="grupo"><div class="grupo-cab"><span>${s.t === 'Tamaño' ? 'Tamaños de' : 'Contenido de'} <b>${esc(etiquetaOp(pa))}</b></span>${botonAnadir(s.k, s.uno, pa.id)}</div>${hijos.map((o, i) => filaOpcion(o, hijos, i)).join('') || `<p class="suave">Aún no tiene ${s.t === 'Tamaño' ? 'tamaños' : 'contenido'}.</p>`}</div>`;
      }).join('') || `<p class="vacio">Primero crea ${s.padre === 'base' ? 'una base' : 'un tamaño'}.</p>`;
    }
    return `<section class="paso"><div class="paso-cab"><div><h2><span class="paso-num">${n + 1}</span>${s.t}</h2><p class="suave">${s.d}</p></div>${s.padre ? '' : botonAnadir(s.k, s.uno)}</div>${cuerpo}</section>`;
  }).join('');
}
$('#segmentos').addEventListener('click', (ev) => { const b = ev.target.closest('[data-publico]'); if (b) { E.publico = b.dataset.publico; pintarRegalos(); } });
$('#pasos').addEventListener('click', (ev) => {
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

function abrirOpcion(o, paso = o?.paso, padre = '') {
  const s = PASOS.find((x) => x.k === paso);
  E.opcion = o ? { ...o } : { publico: E.publico, paso, nuevo: true };
  const f = $('#form-opcion'); f.reset();
  $('#dlg-opcion-t').textContent = `${o ? 'Editar' : 'Nueva'} ${s.uno} · ${E.publico === 'mujer' ? 'para ella' : 'para él'}`;
  f.nombre.value = o?.nombre ?? '';
  f.precio.value = o ? o.precio : '';
  f.activa.checked = o ? o.activa : true;
  $('#campo-padre').hidden = !s.padre;
  if (s.padre) {
    $('#campo-padre-t').textContent = s.padre === 'base' ? 'Pertenece a la base' : 'Pertenece al tamaño';
    f.padre_id.innerHTML = opsDe(s.padre).map((pa) => `<option value="${esc(pa.id)}" ${pa.id === (o?.padre_id ?? padre) ? 'selected' : ''}>${esc(etiquetaOp(pa))}</option>`).join('');
  }
  $('#ayuda-opcion').textContent = paso === 'base' ? 'Después de crear la base, añádele al menos un tamaño con contenido para que se muestre.' : paso === 'tamano' ? 'Añádele al menos un contenido para que se muestre.' : 'El precio se suma al total del regalo.';
  $('#opcion-borrar').hidden = !o;
  mostrarError('#error-opcion');
  $('#dlg-opcion').showModal();
}
$('#form-opcion').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, b = $('button[type=submit]', f), o = E.opcion, s = PASOS.find((x) => x.k === o.paso);
  if (!f.nombre.value.trim()) return mostrarError('#error-opcion', 'Escribe el nombre.');
  if (s.padre && !f.padre_id.value) return mostrarError('#error-opcion', s.padre === 'base' ? 'Primero crea una base.' : 'Primero crea un tamaño.');
  const cuerpo = { nombre: f.nombre.value, precio: f.precio.value.trim() === '' ? 0 : f.precio.value, activa: f.activa.checked };
  if (s.padre) cuerpo.padre_id = f.padre_id.value;
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
  const sub = o.paso === 'base' ? opsDe('tamano').filter((t) => t.padre_id === o.id) : [];
  const cont = o.paso === 'tamano' ? opsDe('contenido').filter((c) => c.padre_id === o.id) : sub.flatMap((t) => opsDe('contenido').filter((c) => c.padre_id === t.id));
  const extra = o.paso === 'base' ? ` También se borrarán sus ${sub.length} tamaño(s) y ${cont.length} contenido(s).` : o.paso === 'tamano' ? ` También se borrarán sus ${cont.length} contenido(s).` : '';
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
