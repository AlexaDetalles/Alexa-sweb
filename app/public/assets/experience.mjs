import {PREPARED_GIFTS} from './gifts.mjs';

const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const root=document.documentElement;
const header=document.querySelector('.site-header');
const stack=document.querySelector('.photo-stack');
let frame=0,switchTimer;
const watched=new WeakSet();
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
 if(entry.isIntersecting){entry.target.classList.add('in-view');observer.unobserve(entry.target);}
}),{threshold:.08,rootMargin:'0px 0px 30px 0px'});

function watch(scope){
 if(!(scope instanceof Element)&&scope!==document)return;
 const selector='.department-row,.custom-print,.how-step,.product-card,.collection,.option,.contact-link';
 const nodes=[...(scope.matches?.(selector)?[scope]:[]),...scope.querySelectorAll(selector)];
 nodes.forEach((el,i)=>{
  if(watched.has(el))return;watched.add(el);
  el.setAttribute('data-reveal','');el.style.setProperty('--reveal-delay',`${Math.min(i%3,2)*55}ms`);
  if(!reduce.matches)observer.observe(el);else el.classList.add('in-view');
 });
}
function motionPreference(){root.classList.toggle('motion-on',!reduce.matches);if(reduce.matches){document.querySelectorAll('[data-reveal]').forEach(el=>el.classList.add('in-view'));stack?.style.setProperty('--drift','0px');}}
motionPreference();watch(document);
reduce.addEventListener('change',motionPreference);
new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(watch))).observe(document.querySelector('main'),{childList:true,subtree:true});

function onScroll(){
 frame=0;header?.classList.toggle('is-scrolled',scrollY>25);
 if(stack&&!reduce.matches&&innerWidth>700)stack.style.setProperty('--drift',`${Math.min(scrollY*.065,44)}px`);
}
addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(onScroll);},{passive:true});
onScroll();

document.querySelectorAll('[data-hero-choice]').forEach(button=>button.addEventListener('click',()=>{
 if(button.getAttribute('aria-pressed')==='true')return;
 document.querySelectorAll('[data-hero-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 const group=button.dataset.heroChoice;
 const chosen=PREPARED_GIFTS.filter(p=>p.group===group);
 clearTimeout(switchTimer);stack.classList.add('switching');
 function swap(){
  stack.querySelectorAll('.paper-photo').forEach((a,i)=>{
   const p=chosen[i];if(!p)return;
   const img=a.querySelector('img');img.src=p.img;img.alt=p.name+', propuesta de regalo';
   a.querySelector('[data-print-name]').textContent=p.name;
   const page=group==='PAG'?'pick-and-go.html':'pick-and-go-hombre.html';
   a.href='/Detalles/'+page+'?q='+encodeURIComponent(p.name);
   a.setAttribute('aria-label','Ver propuesta '+p.name);
  });stack.classList.remove('switching');
 }
 if(reduce.matches)swap();else switchTimer=setTimeout(swap,150);
}));

if(stack&&matchMedia('(hover:hover) and (pointer:fine)').matches){
 stack.addEventListener('pointermove',ev=>{
  if(reduce.matches)return;
  const rect=stack.getBoundingClientRect(),x=(ev.clientX-rect.left)/rect.width-.5,y=(ev.clientY-rect.top)/rect.height-.5;
  stack.style.setProperty('--rx',`${-y*5}deg`);stack.style.setProperty('--ry',`${x*6}deg`);
 });
 stack.addEventListener('pointerleave',()=>{stack.style.setProperty('--rx','0deg');stack.style.setProperty('--ry','0deg');});
}

const count=document.querySelector('[data-bag-count]');
if(count)new MutationObserver(()=>{
 if(reduce.matches)return;
 document.querySelector('.bag-button')?.animate([{transform:'translateY(0)'},{transform:'translateY(-4px)'},{transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
}).observe(count,{childList:true,characterData:true,subtree:true});

const pauseTicker=document.querySelector('#pause-ticker');
pauseTicker?.addEventListener('click',()=>{
 const paused=pauseTicker.getAttribute('aria-pressed')!=='true';
 pauseTicker.setAttribute('aria-pressed',String(paused));
 document.querySelector('.type-track').style.animationPlayState=paused?'paused':'running';
 pauseTicker.textContent=paused?'Reanudar cinta':'Pausar cinta';
});
