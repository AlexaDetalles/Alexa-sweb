import {PREPARED_GIFTS} from './gifts.mjs';
import {iniciarConsentimiento,medir} from './consent.mjs';
import {GROUPS,money,escapeHTML as e,fold,parseProducts,sanitizeCart,cartLines,cartTotal,cartSummary,cartMessage} from './core.mjs';

const $ = (s,root=document) => root.querySelector(s);
const $$ = (s,root=document) => [...root.querySelectorAll(s)];
const ARROW = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
let storageWorks=true,products=[],visibleCount=24;
// Datos que llegan del panel de administración (/api). Si la API no responde, se usan las copias CSV de siempre.
let advisors=[{nombre:'asesora 1',whatsapp:'50497320939'},{nombre:'asesora 2',whatsapp:'50499226664'}],groupNames={...GROUPS},categoryTree=null,fromApi=false;
const body=document.body;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{storageWorks=false;toast('Tu navegador no permite guardar. Mantén abierta esta página.');}}
let cart=sanitizeCart(read('alexa_bag_v2',{}));
let toastTimer;
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);}
function prepareImages(root=document){
 $$('img',root).forEach(img=>{
  img.addEventListener('error',()=>{if(!img.src.endsWith('/no-photo.svg'))img.src='/assets/images/no-photo.svg';},{once:true});
  // Mientras llega la foto se ve un destello (skeleton) en su marco.
  const box=img.closest('.product-image,.bag-item,.related-card');
  if(box&&!img.complete){const wrap=img.parentElement;wrap.classList.add('cargando');const quitar=()=>wrap.classList.remove('cargando');img.addEventListener('load',quitar,{once:true});img.addEventListener('error',quitar,{once:true});}
 });
}
function openDialog(dialog){if(dialog.open)return;dialog.showModal();body.classList.add('modal-open');}
function closeDialog(dialog){dialog.close();if(!$$('dialog[open]').length)body.classList.remove('modal-open');}
$$('dialog').forEach(d=>{
 d.addEventListener('close',()=>{if(!$$('dialog[open]').length)body.classList.remove('modal-open');});
 d.addEventListener('click',ev=>{if(ev.target===d){const r=d.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)closeDialog(d);}});
});
document.addEventListener('click',event=>{
 const close=event.target.closest('[data-close]');if(close)closeDialog(close.closest('dialog'));
 const bag=event.target.closest('[data-open-bag]');if(bag){renderBag();openDialog($('#bag-dialog'));}
 const add=event.target.closest('[data-add]');if(add){changeQty(add.dataset.add,1);}
 const qty=event.target.closest('[data-qty]');if(qty)changeQty(qty.dataset.id,Number(qty.dataset.qty));
 const remove=event.target.closest('[data-remove]');if(remove){delete cart[remove.dataset.remove];persistCart();$('#bag-dialog [data-remove]')?.focus({preventScroll:true});if(!Object.keys(cart).length)$('#bag-dialog [data-close]')?.focus();}
 const wa=event.target.closest('a[href^="https://wa.me/"]');if(wa)medir({evento:'whatsapp'});
 const detail=event.target.closest('[data-product]');if(detail){event.preventDefault();openProduct(detail.dataset.product);}
 const retry=event.target.closest('[data-retry]');if(retry)refreshData();
});
$('#menu-toggle')?.addEventListener('click',()=>{
 const open=$('#menu-toggle').getAttribute('aria-expanded')!=='true';$('#menu-toggle').setAttribute('aria-expanded',String(open));$('#site-nav').classList.toggle('open',open);
});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){$('#site-nav')?.classList.remove('open');$('#menu-toggle')?.setAttribute('aria-expanded','false');}});

function persistCart(){save('alexa_bag_v2',cart);updateBagCount();if($('#bag-dialog').open)renderBag();renderProductButtons();}
function updateBagCount(){
 const count=Object.values(cart).reduce((a,b)=>a+b,0);
 $$('[data-bag-count]').forEach(el=>{const changed=el.textContent!==String(count);el.textContent=count;if(changed&&!matchMedia('(prefers-reduced-motion: reduce)').matches){el.classList.add('bump');setTimeout(()=>el.classList.remove('bump'),220);}});
 updateBagBar(count);
}
// Barra flotante con el total (sobre todo para el celular): solo cuando hay algo en la bolsa y no estás armando un regalo.
let bagBar;
function updateBagBar(count){
 if(body.dataset.publico||!$('#bag-dialog'))return;
 if(!bagBar){bagBar=document.createElement('button');bagBar.type='button';bagBar.className='bag-bar';bagBar.setAttribute('data-open-bag','');bagBar.setAttribute('aria-label','Ver tu bolsa');bagBar.innerHTML='<span><b></b><small></small></span><span class="go">Ver bolsa '+ARROW+'</span>';document.body.append(bagBar);}
 bagBar.classList.toggle('visible',count>0);
 if(count>0){$('b',bagBar).textContent=`${count} ${count===1?'artículo':'artículos'} en tu bolsa`;$('small',bagBar).textContent=products.length?cartSummary(cart,products):'Ver tu selección';}
}
function changeQty(id,delta){
 const active=document.activeElement,restoreQty=active?.closest('#bag-dialog')?active.dataset.qty:null;
 const p=products.find(p=>p.id===id);if(!p || (!p.available&&delta>0))return;
 const before=cart[id]||0,next=before+delta;if(next>99){toast('Máximo 99 unidades por artículo.');return;}
 if(next<=0)delete cart[id];else cart[id]=next;
 persistCart();
 if(restoreQty)$$('#bag-dialog [data-qty]').find(b=>b.dataset.id===id&&b.dataset.qty===restoreQty)?.focus({preventScroll:true});
 if(!before&&delta>0){toast(`${p.name} · añadido a tu bolsa`);medir({evento:'agregar'});}
}
const ICON={trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7m-7 0 1 12h8l1-12"/></svg>',minus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>'};
const minusLabel=n=>n===1?'Quitar de la bolsa':'Quitar una unidad';
function slotHTML(p){
 const n=cart[p.id]||0;
 if(!p.available)return '<button type="button" class="btn" disabled>No disponible</button>';
 if(!n)return `<button type="button" class="btn" data-add="${e(p.id)}">${p.quote?'Elegir propuesta':'<span>Añadir<span class="solo-grande"> a la bolsa</span></span>'} ${ARROW}</button>`;
 return `<div class="stepper" role="group" aria-label="Cantidad de ${e(p.name)} en tu bolsa"><button type="button" data-qty="-1" data-id="${e(p.id)}" aria-label="${minusLabel(n)}">${n===1?ICON.trash:ICON.minus}</button><output aria-live="polite">${n}<small>en bolsa</small></output><button type="button" data-qty="1" data-id="${e(p.id)}" aria-label="Añadir una unidad" ${n>=99?'disabled':''}>${ICON.plus}</button></div>`;
}
function renderProductButtons(){
 const active=document.activeElement;
 $$('.add-slot').forEach(slot=>{
  const p=products.find(x=>x.id===slot.dataset.slot);if(!p)return;
  const n=cart[p.id]||0,stepper=slot.querySelector('.stepper');
  // Mientras siga habiendo unidades, se actualiza el selector sin recrearlo (así no pierde el foco ni parpadea).
  if(stepper&&n>0&&p.available){
   const out=stepper.querySelector('output'),minus=stepper.querySelector('[data-qty="-1"]'),plus=stepper.querySelector('[data-qty="1"]');
   out.firstChild.textContent=n;minus.innerHTML=n===1?ICON.trash:ICON.minus;minus.setAttribute('aria-label',minusLabel(n));plus.disabled=n>=99;return;
  }
  const state=`${n}|${p.available}|${p.quote}`;if(slot.dataset.state===state)return;
  const hadFocus=slot.contains(active);
  slot.dataset.state=state;slot.innerHTML=slotHTML(p);
  if(hadFocus)(slot.querySelector('[data-qty="1"]')||slot.querySelector('[data-add]'))?.focus({preventScroll:true});
 });
}
function renderBag(){
 const list=$('#bag-content');
 if(!products.length){list.innerHTML='<p class="sr">Preparando tu bolsa…</p>'+'<div class="sk-bag" aria-hidden="true"><div class="sk sk-thumb"></div><div><div class="sk sk-line w90"></div><div class="sk sk-line w40"></div><div class="sk sk-btn"></div></div></div>'.repeat(2);return;}
 if(!Object.keys(cart).length){list.innerHTML='<div class="bag-empty"><h3>Hay un detalle esperándote.</h3><p>Añade tus favoritos del catálogo y los reuniremos aquí.</p><a class="btn" href="/catalogo">Explorar catálogo '+ARROW+'</a></div>';return;}
 const hasInvalid=Object.keys(cart).some(id=>!products.some(p=>p.id===id&&p.available));
 const lines=Object.entries(cart).map(([id,qty])=>{
  const p=products.find(x=>x.id===id);
  return `<article class="bag-item"><img src="${e(p?.img||'/assets/images/no-photo.svg')}" alt="" width="70" height="85"><div><h3>${e(p?.name||'Artículo fuera del catálogo')}</h3><p>${p?(p.quote?'Por encargo · por cotizar':money(p.cents*qty)):e(id)}${p&&!p.available?' · No disponible':''}</p><div class="quantity-row"><button type="button" data-qty="-1" data-id="${e(id)}" aria-label="Quitar una unidad de ${e(p?.name||id)}">−</button><span>${qty}</span><button type="button" data-qty="1" data-id="${e(id)}" aria-label="Añadir una unidad de ${e(p?.name||id)}" ${!p?.available?'disabled':''}>+</button><button type="button" class="remove" data-remove="${e(id)}">Quitar</button></div></div></article>`;
 }).join('');
 list.innerHTML=lines+`<div class="bag-total"><span>Subtotal estimado</span><strong>${cartSummary(cart,products)}</strong></div><p class="fine-print">El envío se cotiza por separado. Confirmamos precio y disponibilidad al atenderte por WhatsApp.</p>${hasInvalid?'<p class="state-warning" role="status">Quita los artículos no disponibles para continuar.</p>':''}<div class="field bag-note"><label for="order-note">Talla, color o alguna indicación (opcional)</label><textarea id="order-note" maxlength="300" rows="2" placeholder="Cuéntanos qué necesitas confirmar…">${e(typeof read('alexa_order_note','')==='string'?read('alexa_order_note',''):'')}</textarea></div><div class="advisor-actions">${advisors.map((a,i)=>`<a id="bag-wa-${i}" class="btn${i?' secondary':''}" target="_blank" rel="noopener noreferrer">Consultar con ${e(a.nombre)} ${ARROW}</a>`).join('')}</div><p class="fine-print"><a href="/condiciones">Compra, entregas y reclamos</a> · <a href="/privacidad">Uso de tus datos</a></p><p class="fine-print" style="margin-top:15px">Se abrirá WhatsApp con tu selección. El pedido se confirma al conversar con la tienda.</p>`;
 function updateLinks(){
  const note=$('#order-note').value;save('alexa_order_note',note);
  const msg=!hasInvalid&&cartMessage(cart,products,note);
  advisors.map((a,i)=>['bag-wa-'+i,a.whatsapp]).forEach(([id,phone])=>{const a=$('#'+id);if(msg){a.href=`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;a.removeAttribute('aria-disabled');}else{a.removeAttribute('href');a.setAttribute('aria-disabled','true');}});
 }
 $('#order-note').addEventListener('input',updateLinks);updateLinks();prepareImages(list);
}

function openProduct(id){
 const p=products.find(p=>p.id===id);if(!p)return;
 medir({producto:id});
 $('#product-content').innerHTML=`<div class="product-detail"><img src="${e(p.img)}" alt="${e(p.name)}"><div class="product-detail-copy"><p class="product-group">${e(groupNames[p.group]||'')}</p><h2 id="product-title">${e(p.name)}</h2><p>${e(p.description||'Te ayudamos a confirmar presentación, medidas y detalles de este artículo por WhatsApp.')}</p><p class="price">${p.quote?'Cotizar por WhatsApp':money(p.cents)}</p><p class="fine-print">Referencia ${e(p.id)} · ${p.quote?'Propuesta por encargo · imagen ilustrativa':p.available?'Disponible para consultar':'Actualmente no disponible'}</p><div class="add-slot" data-slot="${e(p.id)}"></div><p class="fine-print" style="margin-top:20px">Precio sujeto a confirmación. Consulta tallas, colores y presentación antes de confirmar tu pedido. <a href="/producto/${encodeURIComponent(p.id)}">Ver ficha completa</a></p></div></div>`;
 prepareImages($('#product-content'));openDialog($('#product-dialog'));renderProductButtons();
}

function selectedGroups(){const raw=$('#category-filter')?.value;return raw?raw.split(','):body.dataset.groups?.split(',').filter(Boolean)||[];}
function renderCatalog(){
 const grid=$('#product-grid');if(!grid)return;
 const groups=selectedGroups(),q=fold($('#product-search').value.trim()),sort=$('#sort-products').value;
 let filtered=products.filter(p=>(!groups.length||groups.includes(p.group))&&fold(`${p.name} ${p.description} ${p.id}`).includes(q));
 if(sort==='price-up'||sort==='price-down')filtered.sort((a,b)=>Number(Boolean(a.quote))-Number(Boolean(b.quote))||(sort==='price-up'?a.cents-b.cents:b.cents-a.cents));else if(sort==='name')filtered.sort((a,b)=>a.name.localeCompare(b.name,'es'));else filtered.sort((a,b)=>Number(b.available)-Number(a.available));
 $('#result-count').textContent=`${filtered.length} ${filtered.length===1?'artículo':'artículos'}`;
 if(!filtered.length){
  const filteredByText=Boolean(q);
  grid.innerHTML=`<div class="empty-state"><h2>${filteredByText?'No encontramos ese favorito.':'Esta colección se está preparando.'}</h2><p>${filteredByText?'Prueba otro nombre o cambia los filtros para seguir explorando.':'Podemos ayudarte a elegir por WhatsApp. Mientras tanto, descubre nuestros perfumes y accesorios o crea tu propio regalo.'}</p>${filteredByText?'<button type="button" class="btn secondary" id="clear-search">Limpiar búsqueda</button>':'<a class="btn" href="/contacto">Consultar disponibilidad '+ARROW+'</a> <a class="text-link" href="/regalos/personalizar">Crear un regalo '+ARROW+'</a>'}</div>`;
  $('#clear-search')?.addEventListener('click',()=>{$('#product-search').value='';$('#category-filter').value=body.dataset.groups||'';renderCatalog();$('#product-search').focus();});
 }else grid.innerHTML=filtered.slice(0,visibleCount).map(p=>`<article class="product-card"><button class="product-image" type="button" data-product="${e(p.id)}" aria-label="Ver detalles de ${e(p.name)}"><img src="${e(p.thumb||p.img)}" alt="${e(p.name)}" width="400" height="480" loading="lazy" decoding="async">${p.quote?'<span class="availability">Por encargo · imagen ilustrativa</span>':!p.available?'<span class="availability">No disponible</span>':''}</button><p class="product-group">${e(groupNames[p.group]||'')}</p><h2><a class="product-name-button" href="/producto/${encodeURIComponent(p.id)}" data-product="${e(p.id)}">${e(p.name)}</a></h2><p class="price">${p.quote?'Cotizar por WhatsApp':money(p.cents)}</p><div class="add-slot" data-slot="${e(p.id)}"></div></article>`).join('');
 $('#load-more').hidden=filtered.length<=visibleCount;prepareImages(grid);renderProductButtons();
}
if($('#product-grid')){
 const query=new URLSearchParams(location.search);
 $('#product-search').value=(query.get('q')||'').slice(0,100);
 const cat=query.get('categoria');if(cat&&$$('#category-filter option').some(o=>o.value===cat))$('#category-filter').value=cat;
 function filterChanged(){visibleCount=24;renderCatalog();const u=new URL(location.href);const q=$('#product-search').value.trim(),c=$('#category-filter').value;q?u.searchParams.set('q',q):u.searchParams.delete('q');c&&c!==body.dataset.groups?u.searchParams.set('categoria',c):u.searchParams.delete('categoria');history.replaceState(null,'',u);}
 $('#product-search').addEventListener('input',filterChanged);$('#category-filter').addEventListener('change',filterChanged);$('#sort-products').addEventListener('change',filterChanged);
 $('#load-more').addEventListener('click',()=>{visibleCount+=24;renderCatalog();});
}

$('#clear-saved-data')?.addEventListener('click',()=>{
 if(!confirm('¿Borrar la bolsa, las notas y ambos regalos guardados en este navegador? No se borrarán mensajes de WhatsApp.'))return;
 try{for(const key of Object.keys(localStorage).filter(k=>k.startsWith('alexa_')))localStorage.removeItem(key);cart={};updateBagCount();renderProductButtons();$('#privacy-feedback').textContent='Tu bolsa, notas y regalos se han borrado de este navegador.';}catch{$('#privacy-feedback').textContent='No se pudo borrar. Elimina los datos del sitio desde los ajustes de tu navegador.';}
});

function updateDataStatus(text){$$('[data-status-text]').forEach(el=>el.textContent=text);}
async function fetchText(url){const c=new AbortController(),timer=setTimeout(()=>c.abort(),7000);try{const r=await fetch(url,{signal:c.signal,cache:'no-cache'});if(!r.ok)throw new Error('No disponible');return await r.text();}finally{clearTimeout(timer);}}
function acceptCatalog(data){
 products=fromApi?data:[...data,...PREPARED_GIFTS.filter(p=>!data.some(item=>item.id===p.id))];
 // Merge the old category bags once; do not migrate ambiguous gift subtotals.
 if(!read('alexa_bag_migrated',false)){
  try{for(const key of Object.keys(localStorage).filter(k=>/^alexa_(cart_|pag_.*cart$)/.test(k))){const old=read(key,{});if(!old||typeof old!=='object')continue;for(const [id,val] of Object.entries(old)){const qty=Number(typeof val==='object'?val?.qty:val);if(products.some(p=>p.id===id)&&Number.isInteger(qty)&&qty>0)cart[id]=Math.min(99,(cart[id]||0)+qty);}}save('alexa_bag_migrated',true);save('alexa_bag_v2',cart);}catch{}
 }
 updateBagCount();renderCatalog();renderProductButtons();if($('#bag-dialog').open)renderBag();
}
function buildCategorySelect(){
 const sel=$('#category-filter');if(!sel||!categoryTree)return;
 const roots=categoryTree.filter(c=>!c.padre_id),kids=id=>categoryTree.filter(c=>c.padre_id===id);
 const opt=(v,t,sub)=>`<option value="${e(v)}">${sub?'\u00a0\u00a0':''}${e(t)}</option>`;
 sel.innerHTML=opt('','Todas las colecciones')+roots.map(r=>{const k=kids(r.id);return (k.length?opt([r.id,...k.map(x=>x.id)].join(','),r.nombre):opt(r.id,r.nombre))+k.map(x=>opt(x.id,x.nombre,true)).join('');}).join('');
 const cat=new URLSearchParams(location.search).get('categoria');if(cat&&$$('#category-filter option').some(o=>o.value===cat))sel.value=cat;
}
// Datos estructurados para buscadores: los productos con precio fijo aparecen como lista de productos.
function injectProductsLD(list){
 if(!$('#product-grid'))return;
 const items=list.filter(p=>p.available&&!p.quote&&Number.isInteger(p.cents)).slice(0,60).map((p,i)=>({'@type':'ListItem',position:i+1,item:{'@type':'Product',name:p.name,sku:p.id,description:p.description||undefined,image:new URL(p.img,location.origin).href,offers:{'@type':'Offer',priceCurrency:'HNL',price:(p.cents/100).toFixed(2),availability:'https://schema.org/InStock',url:location.origin+'/catalogo'}}}));
 if(!items.length)return;
 let el=$('#ld-productos');if(!el){el=document.createElement('script');el.type='application/ld+json';el.id='ld-productos';document.head.append(el);}
 el.textContent=JSON.stringify({'@context':'https://schema.org','@type':'ItemList',itemListElement:items}).replace(/</g,'\\u003c');
}
async function fetchJSON(url){const c=new AbortController(),timer=setTimeout(()=>c.abort(),7000);try{const r=await fetch(url,{signal:c.signal,cache:'no-cache'});if(!r.ok)throw new Error('API');return await r.json();}finally{clearTimeout(timer);}}
// Catálogo y regalos desde el panel. Devuelve false si la API no está disponible (entonces se usan los CSV).
async function loadFromApi(){
 try{
  const cat=await fetchJSON('/api/catalogo');
  if(!Array.isArray(cat?.productos)||!Array.isArray(cat?.categorias))return false;
  fromApi=true;categoryTree=cat.categorias;groupNames=Object.fromEntries(cat.categorias.map(c=>[c.id,c.nombre]));
  const adv=(cat.asesoras||[]).filter(a=>/^\d{10,15}$/.test(a.whatsapp)).map(a=>({nombre:String(a.nombre).slice(0,40),whatsapp:a.whatsapp}));
  if(adv.length)advisors=adv;
  buildCategorySelect();
  injectProductsLD(cat.productos);
  acceptCatalog(cat.productos.filter(p=>p.id&&p.name&&(p.quote||Number.isInteger(p.cents))));
  updateDataStatus('Catálogo al día · precio y disponibilidad se confirman por WhatsApp.');
  return true;
 }catch{fromApi=false;return false;}
}
async function refreshData(){
 updateDataStatus('Comprobando inventario…');
 if(!(await loadFromApi()))updateDataStatus('Mostramos la última copia del catálogo. Confirma precios y disponibilidad por WhatsApp.');
}
async function init(){
 $$('.bag-button').forEach(b=>{const s=b.querySelector(':scope > span');if(s)s.innerHTML='<span class="bag-label">Bolsa</span> <span data-bag-count>0</span>';});
 prepareImages();updateBagCount();
 if(await loadFromApi())return;
 try{
  const catalog=await fetchText('/assets/data/catalog.csv');
  acceptCatalog(parseProducts(catalog));
  updateDataStatus('Catálogo de referencia · confirmamos precio y disponibilidad por WhatsApp.');
  refreshData();
 }catch{
  updateDataStatus('No se pudo cargar el catálogo. Intenta de nuevo o contacta con la tienda.');
  const grid=$('#product-grid');if(grid)grid.innerHTML='<div class="empty-state"><h2>No pudimos cargar esta colección.</h2><p>Tu selección guardada sigue en este navegador. Puedes recargar o pedir ayuda por WhatsApp.</p><button type="button" class="btn" id="reload-page">Volver a intentar</button> <a class="text-link" href="/contacto">Contactar con Alexa</a></div>';
  $('#reload-page')?.addEventListener('click',()=>location.reload());
 }
}
window.addEventListener('storage',ev=>{if(ev.key===null||ev.key==='alexa_bag_v2'){cart=sanitizeCart(read('alexa_bag_v2',{}));updateBagCount();renderProductButtons();if($('#bag-dialog').open)renderBag();}});
init();
// Medición (solo si la persona aceptó en la píldora) y píldora de consentimiento.
{const slot=document.querySelector('.add-slot[data-slot]');const enFicha=location.pathname.startsWith('/producto/')&&slot;medir(enFicha?{ruta:location.pathname,producto:slot.dataset.slot}:{ruta:location.pathname});iniciarConsentimiento();}
