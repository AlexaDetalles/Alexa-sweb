import {PREPARED_GIFTS} from './gifts.mjs';
import {GROUPS,completeOptions,money,escapeHTML as e,fold,parseProducts,parseOptions,sanitizeCart,cartLines,cartTotal,cartSummary,cartMessage,STEPS,giftOptions,sanitizeDraft,giftLines,giftTotal,giftReady,giftMessage} from './core.mjs';

const $ = (s,root=document) => root.querySelector(s);
const $$ = (s,root=document) => [...root.querySelectorAll(s)];
const ARROW = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>';
let storageWorks=true,products=[],options=[],draft={},sources,visibleCount=24;
// Datos que llegan del panel de administración (/api). Si la API no responde, se usan las copias CSV de siempre.
let advisors=[{nombre:'asesora 1',whatsapp:'50497320939'},{nombre:'asesora 2',whatsapp:'50499226664'}],groupNames={...GROUPS},categoryTree=null,fromApi=false;
const body=document.body, audience=body.dataset.audience,step=body.dataset.step;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{storageWorks=false;toast('Tu navegador no permite guardar. Mantén abierta esta página.');}}
let cart=sanitizeCart(read('alexa_bag_v2',{}));
const draftKey=`alexa_gift_v2_${audience}`;
let toastTimer;
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3500);}
function prepareImages(root=document){$$('img',root).forEach(img=>img.addEventListener('error',()=>{if(!img.src.endsWith('/no-photo.svg'))img.src='/assets/images/no-photo.svg';},{once:true}));}
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
 const detail=event.target.closest('[data-product]');if(detail)openProduct(detail.dataset.product);
 const pick=event.target.closest('[data-pick]');if(pick)selectGift(pick.dataset.pick);
 const retry=event.target.closest('[data-retry]');if(retry)refreshData();
});
$('#menu-toggle')?.addEventListener('click',()=>{
 const open=$('#menu-toggle').getAttribute('aria-expanded')!=='true';$('#menu-toggle').setAttribute('aria-expanded',String(open));$('#site-nav').classList.toggle('open',open);
});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){$('#site-nav')?.classList.remove('open');$('#menu-toggle')?.setAttribute('aria-expanded','false');}});

function persistCart(){save('alexa_bag_v2',cart);updateBagCount();if($('#bag-dialog').open)renderBag();renderProductButtons();}
function updateBagCount(){const count=Object.values(cart).reduce((a,b)=>a+b,0);$$('[data-bag-count]').forEach(el=>el.textContent=count);}
function changeQty(id,delta){
 const active=document.activeElement,restoreQty=active?.dataset.qty;
 const p=products.find(p=>p.id===id);if(!p || (!p.available&&delta>0))return;
 const next=(cart[id]||0)+delta;if(next>99){toast('Máximo 99 unidades por artículo.');return;}
 if(next<=0)delete cart[id];else cart[id]=next;
 persistCart();
 if(restoreQty)$$('#bag-dialog [data-qty]').find(b=>b.dataset.id===id&&b.dataset.qty===restoreQty)?.focus({preventScroll:true});
 if(delta>0)toast(`${p.name} · añadido a tu bolsa`);
}
function renderProductButtons(){
 $$('[data-add]').forEach(b=>{const p=products.find(x=>x.id===b.dataset.add);if(!p)return;b.innerHTML=p.available?`${cart[p.id]?`Añadir otro · ${cart[p.id]} en bolsa`:(p.quote?'Elegir propuesta':'Añadir a la bolsa')} ${ARROW}`:'No disponible';b.disabled=!p.available;});
}
function renderBag(){
 const list=$('#bag-content');
 if(!products.length){list.innerHTML='<div class="bag-empty"><h3>Preparando tu bolsa…</h3><p>Estamos cargando el catálogo. Puedes cerrar esta ventana y volver en un momento.</p></div>';return;}
 if(!Object.keys(cart).length){list.innerHTML='<div class="bag-empty"><h3>Hay un detalle esperándote.</h3><p>Añade tus favoritos del catálogo y los reuniremos aquí.</p><a class="btn" href="/catalogo.html">Explorar catálogo '+ARROW+'</a></div>';return;}
 const hasInvalid=Object.keys(cart).some(id=>!products.some(p=>p.id===id&&p.available));
 const lines=Object.entries(cart).map(([id,qty])=>{
  const p=products.find(x=>x.id===id);
  return `<article class="bag-item"><img src="${e(p?.img||'/assets/images/no-photo.svg')}" alt="" width="70" height="85"><div><h3>${e(p?.name||'Artículo fuera del catálogo')}</h3><p>${p?(p.quote?'Por encargo · por cotizar':money(p.cents*qty)):e(id)}${p&&!p.available?' · No disponible':''}</p><div class="quantity-row"><button type="button" data-qty="-1" data-id="${e(id)}" aria-label="Quitar una unidad de ${e(p?.name||id)}">−</button><span>${qty}</span><button type="button" data-qty="1" data-id="${e(id)}" aria-label="Añadir una unidad de ${e(p?.name||id)}" ${!p?.available?'disabled':''}>+</button><button type="button" class="remove" data-remove="${e(id)}">Quitar</button></div></div></article>`;
 }).join('');
 list.innerHTML=lines+`<div class="bag-total"><span>Subtotal estimado</span><strong>${cartSummary(cart,products)}</strong></div><p class="fine-print">El envío se cotiza por separado. Confirmamos precio y disponibilidad al atenderte por WhatsApp.</p>${hasInvalid?'<p class="state-warning" role="status">Quita los artículos no disponibles para continuar.</p>':''}<div class="field bag-note"><label for="order-note">Talla, color o alguna indicación (opcional)</label><textarea id="order-note" maxlength="300" rows="2" placeholder="Cuéntanos qué necesitas confirmar…">${e(typeof read('alexa_order_note','')==='string'?read('alexa_order_note',''):'')}</textarea></div><div class="advisor-actions">${advisors.map((a,i)=>`<a id="bag-wa-${i}" class="btn${i?' secondary':''}" target="_blank" rel="noopener noreferrer">Consultar con ${e(a.nombre)} ${ARROW}</a>`).join('')}</div><p class="fine-print"><a href="/condiciones.html">Compra, entregas y reclamos</a> · <a href="/privacidad.html">Uso de tus datos</a></p><p class="fine-print" style="margin-top:15px">Se abrirá WhatsApp con tu selección. El pedido se confirma al conversar con la tienda.</p>`;
 function updateLinks(){
  const note=$('#order-note').value;save('alexa_order_note',note);
  const msg=!hasInvalid&&cartMessage(cart,products,note);
  advisors.map((a,i)=>['bag-wa-'+i,a.whatsapp]).forEach(([id,phone])=>{const a=$('#'+id);if(msg){a.href=`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;a.removeAttribute('aria-disabled');}else{a.removeAttribute('href');a.setAttribute('aria-disabled','true');}});
 }
 $('#order-note').addEventListener('input',updateLinks);updateLinks();prepareImages(list);
}

function openProduct(id){
 const p=products.find(p=>p.id===id);if(!p)return;
 $('#product-content').innerHTML=`<div class="product-detail"><img src="${e(p.img)}" alt="${e(p.name)}"><div class="product-detail-copy"><p class="product-group">${e(groupNames[p.group]||'')}</p><h2 id="product-title">${e(p.name)}</h2><p>${e(p.description||'Te ayudamos a confirmar presentación, medidas y detalles de este artículo por WhatsApp.')}</p><p class="price">${p.quote?'Cotizar por WhatsApp':money(p.cents)}</p><p class="fine-print">Referencia ${e(p.id)} · ${p.quote?'Propuesta por encargo · imagen ilustrativa':p.available?'Disponible para consultar':'Actualmente no disponible'}</p><button type="button" class="btn" data-add="${e(p.id)}" ${!p.available?'disabled':''}>Añadir a la bolsa ${ARROW}</button><p class="fine-print" style="margin-top:20px">Precio sujeto a confirmación. Consulta tallas, colores y presentación antes de confirmar tu pedido.</p></div></div>`;
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
  grid.innerHTML=`<div class="empty-state"><h2>${filteredByText?'No encontramos ese favorito.':'Esta colección se está preparando.'}</h2><p>${filteredByText?'Prueba otro nombre o cambia los filtros para seguir explorando.':'Podemos ayudarte a elegir por WhatsApp. Mientras tanto, descubre nuestros perfumes y accesorios o crea tu propio regalo.'}</p>${filteredByText?'<button type="button" class="btn secondary" id="clear-search">Limpiar búsqueda</button>':'<a class="btn" href="/redes.html">Consultar disponibilidad '+ARROW+'</a> <a class="text-link" href="/Detalles/indexforhm.html">Crear un regalo '+ARROW+'</a>'}</div>`;
  $('#clear-search')?.addEventListener('click',()=>{$('#product-search').value='';$('#category-filter').value=body.dataset.groups||'';renderCatalog();$('#product-search').focus();});
 }else grid.innerHTML=filtered.slice(0,visibleCount).map(p=>`<article class="product-card"><button class="product-image" type="button" data-product="${e(p.id)}" aria-label="Ver detalles de ${e(p.name)}"><img src="${e(p.thumb||p.img)}" alt="${e(p.name)}" width="400" height="480" loading="lazy" decoding="async">${p.quote?'<span class="availability">Por encargo · imagen ilustrativa</span>':!p.available?'<span class="availability">No disponible</span>':''}</button><p class="product-group">${e(groupNames[p.group]||'')}</p><h2><button class="product-name-button" type="button" data-product="${e(p.id)}">${e(p.name)}</button></h2><p class="price">${p.quote?'Cotizar por WhatsApp':money(p.cents)}</p><button type="button" class="btn" data-add="${e(p.id)}" ${!p.available?'disabled':''}>Añadir a la bolsa ${ARROW}</button></article>`).join('');
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

function saveDraft(){save(draftKey,draft);}
function requiredStep(){if(!draft.base)return 'base';if(!draft.size)return 'size';if(!draft.content.length)return 'content';return null;}
const stepFiles={base:'personalizar.html',size:'personalizar2.html',content:'personalizar3.html',plush:'personalizar4.html',balloons:'personalizar5.html',delivery:'personalizarfinal.html',summary:'resumen.html'};
function giftURL(s){return `/Detalles/${audience}/${stepFiles[s]}`;}
function selectGift(id){
 const valid=giftOptions(options,draft,step);if(!valid.some(p=>p.id===id))return;
 if(['content','plush','balloons'].includes(step)){
  const values=draft[step];if(values.includes(id))draft[step]=values.filter(x=>x!==id);else if(step==='plush'&&values.length>=2){toast('Puedes elegir hasta dos peluches.');return;}else draft[step]=[...values,id];
 }else{
  if(draft[step]===id)return;
  draft[step]=id;
  // Changing a parent invalidates dependent options, never their price alone.
  if(step==='base'){draft.size=null;draft.content=[];}if(step==='size')draft.content=[];
 }
 draft=sanitizeDraft(draft,options);saveDraft();renderGift();
 $$('[data-pick]').find(b=>b.dataset.pick===id)?.focus({preventScroll:true});
}
function giftSide(){
 return `<h2>Tu regalo, a tu gusto.</h2>${giftLines(draft,options).map(l=>`<div class="gift-summary-row"><span>${e(l.product.name)}</span><strong>${money(l.product.cents)}</strong></div>`).join('')||'<p class="fine-print">Cada elección aparecerá aquí.</p>'}<div class="bag-total"><span>Total estimado</span><strong>${money(giftTotal(draft,options))}</strong></div><p class="fine-print">Confirmamos disponibilidad, precio y fecha de entrega por WhatsApp antes de preparar tu regalo.</p><p class="builder-notice">Tus elecciones se guardan en este navegador.${!storageWorks?' El almacenamiento está bloqueado.':''}</p>`;
}
function renderGift(){
 if(!audience||!options.length)return;
 const main=$('#gift-step-content'),side=$('#gift-side');side.innerHTML=giftSide();
 const needed=requiredStep(),currentIndex=STEPS.indexOf(step);
 if(needed&&((step==='summary')||STEPS.indexOf(needed)<currentIndex)){
  main.innerHTML=`<div class="empty-state"><h2>Completemos tu regalo.</h2><p>Necesitamos que elijas ${needed==='base'?'la base':needed==='size'?'el tamaño':'el contenido'} antes de continuar. Tu selección válida sigue guardada.</p><a class="btn" href="${giftURL(needed)}">Continuar mi regalo ${ARROW}</a></div>`;return;
 }
 if(step==='summary'){renderGiftSummary(main);return;}
 const titles={base:'Empieza por la base.',size:'Un tamaño a su medida.',content:'Lo que lleva dentro.',plush:'Un abrazo extra.',balloons:'Un toque para celebrar.',delivery:'Las últimas palabras.'};
 const desc={base:'Elige el empaque que mejor va con tu idea.',size:'Estos tamaños son compatibles con la base que elegiste.',content:'Selecciona uno o varios contenidos para tu arreglo.',plush:'Opcional: elige hasta dos peluches, o continúa sin añadir.',balloons:'Opcional: elige los globos que quieras, o continúa sin añadir.',delivery:'Elige cómo recibirlo y escribe una dedicatoria si lo deseas.'};
 const opts=giftOptions(options,draft,step),selected=Array.isArray(draft[step])?draft[step]:[draft[step]];
 const steps=STEPS.map((s,i)=>`<li class="${s===step?'current':''}"><a href="${giftURL(s)}" ${s===step?'aria-current="step"':''}>${i+1}. ${['Base','Tamaño','Contenido','Peluches','Globos','Entrega'][i]}</a></li>`).join('');
 let optsHTML=opts.map(p=>`<button type="button" class="option text-option" data-pick="${e(p.id)}" aria-pressed="${selected.includes(p.id)}"><span class="option-check" aria-hidden="true">${selected.includes(p.id)?'✓':'+'}</span><span class="option-body"><span class="option-reference">${e(p.category)} · ${e(p.id)}</span><span class="option-name">${e(p.name)}</span><span class="option-price">${p.cents?'+ '+money(p.cents):'Sin costo adicional'}</span></span></button>`).join('');
 if(!opts.length)optsHTML=`<div class="empty-state"><h2>No hay opciones para esta selección.</h2><p>El inventario no tiene opciones compatibles en este momento. Puedes elegir otro tamaño o consultar con la tienda.</p><a class="btn secondary" href="${giftURL(step==='size'?'base':'size')}">Cambiar selección</a> <a class="text-link" href="/redes.html">Contactar ${ARROW}</a></div>`;
 const hasSelection=['plush','balloons'].includes(step)||Boolean(Array.isArray(draft[step])?draft[step].length:draft[step]);
 main.innerHTML=`<ol class="gift-progress" aria-label="Pasos de personalización">${steps}</ol><div class="gift-step-heading"><div><h2>${titles[step]}</h2><p>${desc[step]}</p></div></div><div class="gift-options">${optsHTML}</div>${step==='delivery'?`<div class="field gift-message"><label for="gift-message">Dedicatoria (opcional)</label><textarea id="gift-message" maxlength="250" placeholder="Escribe algo que le saque una sonrisa…" data-clarity-mask="true">${e(draft.message)}</textarea><p class="message-count"><span id="message-count">${draft.message.length}</span> / 250 caracteres</p></div>`:''}<p class="builder-notice">Elige por nombre y descripción. Confirmamos los acabados y la presentación contigo por WhatsApp.</p><nav class="gift-navigation" aria-label="Navegación de personalización"><a class="text-link" href="${step==='base'?'/Detalles/indexforhm.html':giftURL(STEPS[currentIndex-1])}">Volver</a><button type="button" class="btn" id="gift-next" ${!hasSelection||(!opts.length&&!['plush','balloons'].includes(step))?'disabled':''}>${step==='delivery'?'Revisar mi regalo':(['plush','balloons'].includes(step)&&!selected.length?'Continuar sin añadir':'Continuar')} ${ARROW}</button></nav>`;
 $('#gift-message')?.addEventListener('input',event=>{draft.message=event.target.value.slice(0,250);$('#message-count').textContent=draft.message.length;saveDraft();});
 $('#gift-next').addEventListener('click',()=>{saveDraft();if(!storageWorks){toast('Activa el almacenamiento del navegador para continuar entre pasos.');return;}location.href=giftURL(currentIndex===5?'summary':STEPS[currentIndex+1]);});
 prepareImages(main);
}
function renderGiftSummary(main){
 if(!giftReady(draft,options)){
  main.innerHTML=`<div class="empty-state"><h2>Falta elegir la entrega.</h2><p>Elige el método para mostrarte el total completo.</p><a class="btn" href="${giftURL('delivery')}">Elegir entrega ${ARROW}</a></div>`;return;
 }
 main.innerHTML=`<div class="gift-step-heading"><div><h2>Listo para hacerlo especial.</h2><p>Revisa cada detalle antes de hablar con la tienda.</p></div></div><div class="summary-list">${giftLines(draft,options).map(l=>`<div class="summary-line"><div><small>${e(l.product.category)} · ${e(l.product.id)}</small><h3>${e(l.product.name)}</h3><a class="text-link" href="${giftURL(l.step)}">Editar</a></div><span>${money(l.product.cents)}</span></div>`).join('')}</div><p class="fine-print">Dedicatoria</p><div class="dedication" data-clarity-mask="true">${e(draft.message||'Sin dedicatoria')}</div><div class="bag-total"><span>Total estimado</span><strong>${money(giftTotal(draft,options))}</strong></div><p class="fine-print">Confirmamos la fecha, disponibilidad y precio final antes de preparar el regalo.</p><p class="fine-print"><a href="/condiciones.html">Compra, entregas y reclamos</a> · <a href="/privacidad.html">Uso de tus datos</a></p><div class="summary-actions">${advisors.map((a,i)=>`<a class="btn${i?' secondary':''}" href="https://wa.me/${e(a.whatsapp)}?text=${encodeURIComponent(giftMessage(draft,options,audience))}" target="_blank" rel="noopener noreferrer">Pedir con ${e(a.nombre)} ${ARROW}</a>`).join('')}</div><p class="fine-print" style="margin-top:20px">WhatsApp se abrirá con el resumen. Todavía no se ha enviado ni confirmado ningún pedido.</p><div style="margin-top:25px"><button type="button" class="text-link" id="new-gift" style="background:none;border-top:0;border-left:0;border-right:0;color:var(--wine)">Crear otro regalo</button></div>`;
 $('#new-gift').addEventListener('click',()=>{if(confirm('¿Crear otro regalo? Se reemplazará esta personalización guardada.')){draft=sanitizeDraft({},options);saveDraft();location.href=giftURL('base');}});
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
async function fetchJSON(url){const c=new AbortController(),timer=setTimeout(()=>c.abort(),7000);try{const r=await fetch(url,{signal:c.signal,cache:'no-cache'});if(!r.ok)throw new Error('API');return await r.json();}finally{clearTimeout(timer);}}
// Catálogo y regalos desde el panel. Devuelve false si la API no está disponible (entonces se usan los CSV).
async function loadFromApi(){
 try{
  const [cat,gift]=await Promise.all([fetchJSON('/api/catalogo'),...(audience?[fetchJSON(`/api/regalos/${audience}`)]:[])]);
  if(!Array.isArray(cat?.productos)||!Array.isArray(cat?.categorias)||(audience&&!Array.isArray(gift?.opciones)))return false;
  fromApi=true;categoryTree=cat.categorias;groupNames=Object.fromEntries(cat.categorias.map(c=>[c.id,c.nombre]));
  const adv=(cat.asesoras||[]).filter(a=>/^\d{10,15}$/.test(a.whatsapp)).map(a=>({nombre:String(a.nombre).slice(0,40),whatsapp:a.whatsapp}));
  if(adv.length)advisors=adv;
  buildCategorySelect();
  acceptCatalog(cat.productos.filter(p=>p.id&&p.name&&(p.quote||Number.isInteger(p.cents))));
  if(audience){options=completeOptions(gift.opciones);draft=sanitizeDraft(read(draftKey,{}),options);renderGift();}
  updateDataStatus('Catálogo al día · precio y disponibilidad se confirman por WhatsApp.');
  return true;
 }catch{fromApi=false;return false;}
}
async function refreshData(){
 if(fromApi){await loadFromApi();return;}
 if(!sources)return;
 updateDataStatus('Comprobando inventario…');
 const results=await Promise.allSettled([fetchText(sources.urls.catalog),...(audience?[fetchText(sources.urls[audience])]:[])]);
 const catalog=results[0];
 if(catalog.status==='fulfilled'){
  const p=parseProducts(catalog.value);
  if(p.length){acceptCatalog(p);updateDataStatus('Inventario actualizado · precio y disponibilidad se confirman por WhatsApp.');}
  else updateDataStatus('No pudimos validar la actualización. Mostramos la última copia del catálogo; confirma disponibilidad.');
 }else updateDataStatus('Mostramos la última copia del catálogo. Confirma precios y disponibilidad por WhatsApp.');
 if(audience&&(results[1]?.status!=='fulfilled'||!parseOptions(results[1].value).length))updateDataStatus('Personalización con copia guardada · confirma opciones, precios y disponibilidad por WhatsApp.');
 if(audience&&results[1]?.status==='fulfilled'){
  const o=parseOptions(results[1].value);if(o.length&&JSON.stringify(o)!==JSON.stringify(options)){options=o;draft=sanitizeDraft(draft,options);saveDraft();renderGift();}
 }
}
async function init(){
 prepareImages();updateBagCount();
 if(await loadFromApi())return;
 try{
  const [catalog,config,...gift]=await Promise.all([fetchText('/assets/data/catalog.csv'),fetch('/assets/data/sources.json').then(r=>{if(!r.ok)throw new Error('config');return r.json();}),...(audience?[fetchText(`/assets/data/${audience}.csv`)]:[])]);
  sources=config;acceptCatalog(parseProducts(catalog));
  if(audience){options=parseOptions(gift[0]);draft=sanitizeDraft(read(draftKey,{}),options);renderGift();}
  updateDataStatus('Catálogo de referencia · confirmamos precio y disponibilidad por WhatsApp.');
  refreshData();
 }catch{
  updateDataStatus('No se pudo cargar el catálogo. Intenta de nuevo o contacta con la tienda.');
  const grid=$('#product-grid')||$('#gift-step-content');if(grid)grid.innerHTML='<div class="empty-state"><h2>No pudimos cargar esta colección.</h2><p>Tu selección guardada sigue en este navegador. Puedes recargar o pedir ayuda por WhatsApp.</p><button type="button" class="btn" id="reload-page">Volver a intentar</button> <a class="text-link" href="/redes.html">Contactar con Alexa</a></div>';
  $('#reload-page')?.addEventListener('click',()=>location.reload());
 }
}
window.addEventListener('storage',ev=>{if(ev.key===null||ev.key==='alexa_bag_v2'){cart=sanitizeCart(read('alexa_bag_v2',{}));updateBagCount();renderProductButtons();if($('#bag-dialog').open)renderBag();}if(audience&&(ev.key===null||ev.key===draftKey)&&options.length){draft=sanitizeDraft(read(draftKey,{}),options);renderGift();}});
init();
