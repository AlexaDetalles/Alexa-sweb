const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs');
(async()=>{const b=await chromium.launch();const salida=[];
 const paginas=[['Inicio (1ª visita, con loader)','/',true],['Inicio (sin loader)','/',false],['Catálogo','/catalogo.html',false],['Perfumes para él','/Catalogo/Perfumes/hombre.html',false],['Ficha de producto','/producto/PHP-01',false],['Regalos','/Detalles/index.html',false]];
 for(const [nombre,ruta,primera] of paginas){
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'});
  const p=await ctx.newPage();let bytes=0,reqs=0;const tipos={};
  p.on('response',async r=>{try{const l=Number(r.headers()['content-length']||0);bytes+=l;reqs++;const t=(r.headers()['content-type']||'').split(';')[0];tipos[t]=(tipos[t]||0)+l;}catch{}});
  if(!primera)await p.addInitScript(()=>sessionStorage.setItem('alexa_splash','1'));
  await p.addInitScript(()=>{window.__m={lcp:0,cls:0,fcp:0,long:0};
   new PerformanceObserver(l=>{for(const e of l.getEntries())window.__m.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
   new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__m.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
   new PerformanceObserver(l=>{for(const e of l.getEntries())if(e.name==='first-contentful-paint')window.__m.fcp=e.startTime;}).observe({type:'paint',buffered:true});
   new PerformanceObserver(l=>{for(const e of l.getEntries())window.__m.long+=Math.max(0,e.duration-50);}).observe({type:'longtask',buffered:true});});
  await p.goto('https://alexashop.cc'+ruta,{waitUntil:'load'});await p.waitForTimeout(primera?4200:2200);
  const m=await p.evaluate(()=>window.__m);const nav=await p.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {ttfb:Math.round(n.responseStart),dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd)}});
  const dom=await p.evaluate(()=>({nodos:document.getElementsByTagName('*').length,productos:document.querySelectorAll('.product-card').length,enlacesProducto:document.querySelectorAll('a[href^="/producto/"]').length}));
  salida.push({nombre,ruta,lcp:Math.round(m.lcp),cls:Number(m.cls.toFixed(3)),fcp:Math.round(m.fcp),tbt_aprox:Math.round(m.long),...nav,peticiones:reqs,kb:Math.round(bytes/1024),...dom,porTipo:Object.fromEntries(Object.entries(tipos).map(([k,v])=>[k,Math.round(v/1024)]))});
  if(ruta==='/'&&!primera){await p.screenshot({path:'screenshots/inicio-movil.png'});}
  if(ruta==='/catalogo.html'){await p.screenshot({path:'screenshots/catalogo-movil.png'});}
  await ctx.close();}
 // versión de escritorio de la portada
 const c2=await b.newContext({viewport:{width:1440,height:900}});const q=await c2.newPage();await q.addInitScript(()=>sessionStorage.setItem('alexa_splash','1'));await q.goto('https://alexashop.cc/',{waitUntil:'load'});await q.waitForTimeout(1200);await q.screenshot({path:'screenshots/inicio-escritorio.png'});
 // raw vs renderizado
 const raw=await (await fetch('https://alexashop.cc/catalogo.html')).text();
 salida.push({crudo_catalogo:{tarjetas_producto:(raw.match(/class="product-card"/g)||[]).length,esqueletos:(raw.match(/sk-card/g)||[]).length,enlaces_producto:(raw.match(/href="\/producto\//g)||[]).length}});
 fs.writeFileSync('rendimiento.json',JSON.stringify(salida,null,1));console.log(JSON.stringify(salida.map(s=>s.nombre?{n:s.nombre,lcp:s.lcp,cls:s.cls,fcp:s.fcp,tbt:s.tbt_aprox,ttfb:s.ttfb,load:s.load,req:s.peticiones,kb:s.kb,prod:s.productos,enl:s.enlacesProducto,nodos:s.nodos}:s)));
 await b.close();})().catch(e=>{console.error(e);process.exit(1)});
