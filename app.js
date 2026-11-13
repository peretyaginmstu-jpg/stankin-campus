const gateDecrypt=async env=>{const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey('raw',b64(localStorage.getItem('gate.key')||''),{name:'AES-GCM'},true,['decrypt']);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(env.iv)},key,b64(env.data)));};
/* Общие сценарии: меню, липкая шапка, просмотр изображений, каталог объектов, фильтры хроники.
   Пути к ресурсам строятся от адреса самого скрипта, поэтому сайт одинаково работает
   в корне домена и в подпапке (например, на GitHub Pages). */
import {T, LANG} from './i18n.js';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const BASE = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const asset = (name) => BASE + '/assets/' + name;
const icon = (name) => { const img=document.createElement('img');img.className='icon';img.src=asset('icons/'+name+'.svg');img.alt='';return img; };

/* ---------- Меню на телефоне ---------- */
const menu = $('.menu-toggle');
function closeMenu(){menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label',T.menuOpen);document.body.classList.remove('menu-open');}
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?T.menuClose:T.menuOpen);document.body.classList.toggle('menu-open',open);if(open)$('#main-nav a')?.focus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
$('#main-nav')?.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
const wide=matchMedia('(min-width: 961px)');const onWide=e=>{if(e.matches)closeMenu();};
if(wide.addEventListener)wide.addEventListener('change',onWide);else if(wide.addListener)wide.addListener(onWide);

/* ---------- Просмотр изображений ----------
   (13.11.2026) Снимок «перелетает» в просмотр из своего места на странице и так же возвращается обратно
   (View Transitions API; где его нет, окно мягко проявляется — см. .lightbox в ui.css). В просмотре снимок
   можно приближать: колесо, щипок двумя пальцами, двойное нажатие, кнопки и клавиши + / − / 0; приближенный
   снимок двигается перетаскиванием и стрелками. Генплан с легендой на телефоне иначе было не прочитать.
   Сцену (.lightbox-stage) вокруг снимка создаёт скрипт: разметка страниц при этом не меняется. */
const dialog = $('.lightbox');
let lastFocus, flyFrom=null;
const canDialog=!!(dialog&&typeof dialog.showModal==='function');
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('vi');
const canFly=()=>typeof document.startViewTransition==='function'&&!calm();
const picture=dialog?.querySelector('img:not(.icon)');
const stage=document.createElement('div');
const zoom={s:1,x:0,y:0};
let ratioHint=1.5;
if(picture){stage.className='lightbox-stage';picture.replaceWith(stage);stage.append(picture);}
/* Размер снимка считается здесь, а не через object-fit: рамка элемента должна совпадать с самой картинкой,
   иначе при перелёте и приближении пришлось бы учитывать пустые поля по бокам. */
function fit(){
 if(!picture)return;
 const ratio=picture.naturalWidth&&picture.naturalHeight?picture.naturalWidth/picture.naturalHeight:ratioHint;
 const styled=getComputedStyle(stage).overflow==='hidden'; /* стили новее скрипта не всегда: без них сцена не задаёт высоту */
 const W=stage.clientWidth||innerWidth*.9,H=styled&&stage.clientHeight?stage.clientHeight:innerHeight*.72;
 const w=Math.min(W,H*ratio);
 picture.style.width=w.toFixed(1)+'px';picture.style.height=(w/ratio).toFixed(1)+'px';
 limit();paint();
}
const maxZoom=()=>Math.max(2.5,Math.min(5,picture.offsetWidth?picture.naturalWidth/picture.offsetWidth*1.5:2.5));
function limit(){
 const mx=Math.max(0,(picture.offsetWidth*zoom.s-stage.clientWidth)/2),my=Math.max(0,(picture.offsetHeight*zoom.s-stage.clientHeight)/2);
 zoom.x=Math.max(-mx,Math.min(mx,zoom.x));zoom.y=Math.max(-my,Math.min(my,zoom.y));
}
function paint(){
 picture.style.transform=zoom.s>1.001?'translate('+zoom.x.toFixed(1)+'px,'+zoom.y.toFixed(1)+'px) scale('+zoom.s.toFixed(3)+')':'';
 stage.classList.toggle('is-zoomed',zoom.s>1.001);
}
/* Приближение вокруг точки (cx, cy — от центра сцены): точка под курсором или пальцами остаётся на месте. */
function zoomAt(factor,cx=0,cy=0){
 const s=Math.max(1,Math.min(maxZoom(),zoom.s*factor)),k=s/zoom.s;
 zoom.x=cx-(cx-zoom.x)*k;zoom.y=cy-(cy-zoom.y)*k;zoom.s=s;
 if(s<=1.001){zoom.x=0;zoom.y=0;}
 limit();paint();
}
function resetZoom(){zoom.s=1;zoom.x=0;zoom.y=0;if(picture)paint();}
const fromCenter=(x,y)=>{const r=stage.getBoundingClientRect();return [x-r.left-r.width/2,y-r.top-r.height/2];};
function showImage(src,alt,caption,origin){
 if(!canDialog||!picture){window.open(src,'_blank','noopener');return;}
 lastFocus=document.activeElement;
 const thumb=origin?(origin.matches('img')?origin:origin.querySelector('img:not(.icon)')):null;
 /* Сначала показываем уже загруженный вариант снимка — перелёт не ждёт сети; полный размер подменяется следом. */
 const first=thumb&&thumb.currentSrc?thumb.currentSrc:src;
 if(thumb&&thumb.naturalWidth)ratioHint=thumb.naturalWidth/thumb.naturalHeight;
 const open=()=>{
  resetZoom();picture.src=first;picture.alt=alt;dialog.querySelector('p').textContent=caption;
  dialog.showModal();document.body.classList.add('modal-open');fit();
  if(first!==src){const full=new Image();full.onload=()=>{if(dialog.open&&picture.getAttribute('src')===first)picture.src=src;};full.src=src;}
 };
 flyFrom=origin&&canFly()?origin:null;
 /* is-flying выключает собственное проявление окна, пока его показывает перелёт; класс держится до закрытия,
    иначе проявление запустилось бы сразу после перелёта. */
 dialog.classList.toggle('is-flying',!!flyFrom);
 if(!flyFrom){open();return;}
 const from=flyFrom;
 from.style.viewTransitionName='zoomed';
 const fly=document.startViewTransition(()=>{from.style.viewTransitionName='';open();picture.style.viewTransitionName='zoomed';});
 fly.finished.finally(()=>{picture.style.viewTransitionName='';});
}
function closeImage(){
 if(!dialog.open)return;
 const back=flyFrom&&flyFrom.isConnected&&canFly()?flyFrom:null;
 resetZoom();
 if(!back){dialog.close();return;}
 picture.style.viewTransitionName='zoomed';
 const fly=document.startViewTransition(()=>{picture.style.viewTransitionName='';dialog.close();back.style.viewTransitionName='zoomed';});
 fly.finished.finally(()=>{back.style.viewTransitionName='';});
}
dialog?.addEventListener('close',()=>{document.body.classList.remove('modal-open');lastFocus?.focus();});
dialog?.addEventListener('cancel',e=>{e.preventDefault();closeImage();}); /* Esc: закрываем тем же перелётом */
$('.close-lightbox')?.addEventListener('click',closeImage);
dialog?.addEventListener('click',e=>{if(e.target===dialog)closeImage();});
if(dialog&&picture){
 picture.addEventListener('load',fit);
 addEventListener('resize',()=>{if(dialog.open)fit();});
 picture.draggable=false;
 /* Кнопки приближения: подписи приходят из i18n.js; если словарь в кэше старее скрипта, кнопок просто не будет. */
 if(T.zoomIn&&T.zoomOut){
  const bar=document.createElement('div');bar.className='lightbox-zoom';
  const SVG={out:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',in:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>'};
  [['out',T.zoomOut,1/1.6],['in',T.zoomIn,1.6]].forEach(([kind,label,factor])=>{
   const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.innerHTML=SVG[kind];
   b.addEventListener('click',()=>zoomAt(factor));bar.append(b);
  });
  dialog.insertBefore(bar,stage);
 }
 stage.addEventListener('wheel',e=>{e.preventDefault();const [cx,cy]=fromCenter(e.clientX,e.clientY);zoomAt(Math.exp(-e.deltaY*(e.ctrlKey?.012:.0022)),cx,cy);},{passive:false});
 stage.addEventListener('dblclick',e=>{const [cx,cy]=fromCenter(e.clientX,e.clientY);if(zoom.s>1.001)resetZoom();else zoomAt(2.4,cx,cy);});
 /* Перетаскивание и щипок. Один указатель двигает приближенный снимок, два — меняют масштаб вокруг своей середины. */
 const points=new Map();let grab=null,pinch=null,moved=false,lastTap=0,lastTapAt=null;
 const pair=()=>{const [a,b]=[...points.values()];return {d:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};};
 stage.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  try{stage.setPointerCapture(e.pointerId);}catch{/* указатель уже отпущен */}
  points.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;
  if(points.size===1)grab={x:e.clientX,y:e.clientY,zx:zoom.x,zy:zoom.y};
  if(points.size===2){pinch=pair();grab=null;}
  stage.classList.add('is-moving');
 });
 stage.addEventListener('pointermove',e=>{
  if(!points.has(e.pointerId))return;
  points.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(points.size===2&&pinch){
   const now=pair(),[cx,cy]=fromCenter(now.x,now.y);
   zoom.x+=now.x-pinch.x;zoom.y+=now.y-pinch.y;zoomAt(now.d/(pinch.d||1),cx,cy);pinch=now;moved=true;
  }else if(points.size===1&&grab){
   const dx=e.clientX-grab.x,dy=e.clientY-grab.y;
   if(Math.abs(dx)+Math.abs(dy)>4)moved=true;
   if(zoom.s>1.001){zoom.x=grab.zx+dx;zoom.y=grab.zy+dy;limit();paint();}
  }
 });
 const release=e=>{
  if(!points.has(e.pointerId))return;
  points.delete(e.pointerId);pinch=null;
  if(points.size===1){const [p]=[...points.values()];grab={x:p.x,y:p.y,zx:zoom.x,zy:zoom.y};}
  if(points.size)return;
  grab=null;stage.classList.remove('is-moving');
  /* Двойное касание: у сенсорных экранов dblclick приходит не везде, считаем сами. */
  if(e.type==='pointerup'&&e.pointerType!=='mouse'&&!moved){
   const now=performance.now(),near=lastTapAt&&Math.hypot(e.clientX-lastTapAt.x,e.clientY-lastTapAt.y)<32;
   if(now-lastTap<320&&near){const [cx,cy]=fromCenter(e.clientX,e.clientY);if(zoom.s>1.001)resetZoom();else zoomAt(2.4,cx,cy);lastTap=0;}
   else{lastTap=now;lastTapAt={x:e.clientX,y:e.clientY};}
  }
 };
 stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);
 dialog.addEventListener('keydown',e=>{
  if(e.key==='+'||e.key==='='){zoomAt(1.6);e.preventDefault();}
  else if(e.key==='-'||e.key==='_'){zoomAt(1/1.6);e.preventDefault();}
  else if(e.key==='0'){resetZoom();e.preventDefault();}
  else if(zoom.s>1.001&&e.key.startsWith('Arrow')){
   const step=80;zoom.x+=e.key==='ArrowLeft'?step:e.key==='ArrowRight'?-step:0;zoom.y+=e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0;
   limit();paint();e.preventDefault();
  }
 });
}
$$('figure:not([data-no-zoom]) > img').forEach(img=>{const b=document.createElement('button');b.className='image-zoom';b.setAttribute('aria-label',T.zoom+img.alt);b.append(icon('expand'));img.parentElement.append(b);b.addEventListener('click',()=>showImage(img.src,img.alt,img.parentElement.querySelector('figcaption')?.textContent||'',img.parentElement));});

/* ---------- Каталог объектов ---------- */
/* У каждой языковой версии свой файл данных: campus-data.json, campus-data.en.json, campus-data.zh.json. */
const DATA_FILE='/campus-data'+(LANG==='ru'?'':'.'+LANG);
/* no-cache: браузер перепроверяет файл на сервере (ETag → 304), а не берёт устаревшую копию после новой публикации. */
const loadData=()=>fetch(BASE+DATA_FILE+'.enc.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('data');return r.json();}).then(gateDecrypt).then(t=>JSON.parse(t));
if($('.explorer')){
 let objects=[];let active=new URLSearchParams(location.search).get('object')||'academic';let view=new URLSearchParams(location.search).get('view')==='plan'?'plan':'aerial';
 /* Камера (13.11.2026): при выборе объекта общий вид плавно наезжает на его метку. Сдвиг и масштаб уходят
    в переменные --cam-* на .map-canvas; ими в interior.css двигаются снимок и слой меток, а сами метки
    на столько же уменьшаются и остаются прежнего размера. Сдвиг ограничен так, чтобы снимок не отрывался
    от рамки. Повторное нажатие на выбранную метку, кнопка «Весь кампус» и переход к плану возвращают общий вид. */
 const canvas=$('.map-canvas');const CAMERA=1.45;
 function focusMap(id){
  if(!canvas)return;
  const spot=id&&view==='aerial'&&!document.documentElement.classList.contains('vi')?$('.hotspot[data-object="'+id+'"]'):null;
  const x=spot?parseFloat(spot.style.getPropertyValue('--x')):NaN,y=spot?parseFloat(spot.style.getPropertyValue('--y')):NaN;
  if(!spot||!Number.isFinite(x)||!Number.isFinite(y)){['--cam-s','--cam-x','--cam-y'].forEach(n=>canvas.style.removeProperty(n));canvas.classList.remove('is-zoomed');return;}
  const hold=v=>Math.max(100*(1-CAMERA),Math.min(0,50-CAMERA*v));
  canvas.style.setProperty('--cam-s',CAMERA);canvas.style.setProperty('--cam-x',hold(x).toFixed(2));canvas.style.setProperty('--cam-y',hold(y).toFixed(2));
  canvas.classList.add('is-zoomed');
 }
 if(canvas&&T.mapReset){const reset=document.createElement('button');reset.type='button';reset.className='map-reset';reset.textContent=T.mapReset;reset.addEventListener('click',()=>focusMap(null));canvas.append(reset);}
 const updateURL=()=>{const url=new URL(location.href);url.searchParams.set('object',active);if(view==='plan')url.searchParams.set('view','plan');else url.searchParams.delete('view');if(url.href!==location.href)history.pushState(null,'',url);};
 function selectObject(id,push=false){
  if(!objects.length){if(id)active=id;if(push)updateURL();return;}
  const o=objects.find(v=>v.id===id)||objects[0];active=o.id;
  const fields={'tag':'tag','title':'name','metric':'metric','label':'label','second':'second','second-label':'secondLabel','description':'description','status':'status'};
  Object.entries(fields).forEach(([target,key])=>{$('#object-'+target).textContent=o[key];});
  $('#mobile-object-name').textContent=o.name;
  const img=$('#object-image');img.srcset=asset(o.image+'-900.webp')+' 900w, '+asset(o.image+'.webp')+' '+o.imageWidth+'w';img.sizes='(max-width: 900px) 92vw, 32vw';img.src=asset(o.image+'.webp');img.alt=T.objectAlt+o.name;
  $('#object-features').replaceChildren(...o.features.map(f=>{const li=document.createElement('li');li.textContent=f;return li;}));
  $('#object-link').href=BASE+o.link;
  /* Ссылка на источник приходит из данных: подставляем только http(s) (в том числе относительные адреса),
     чтобы не пропустить javascript:, data: и подобное. Разбор через URL, а не регулярка: браузер сам решает, что за протокол. */
  const source=$('#object-source');let safe=false;
  if(typeof o.source==='string'&&o.source.trim())try{safe=/^https?:$/.test(new URL(o.source,location.href).protocol);}catch{/* не адрес — оставляем без ссылки */}
  if(safe)source.href=o.source;else source.removeAttribute('href');
  $$('[data-object]').forEach(b=>{const selected=b.dataset.object===active;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  if(push)updateURL();
 }
 function selectView(value,push=false){
  view=value==='plan'?'plan':'aerial';
  const img=$('#map-image');const mapName=view==='plan'?'masterplan-with-legend':'hero-aerial';img.srcset=asset(mapName+'-900.webp')+' 900w, '+asset(mapName+'.webp')+' 1900w';img.sizes='(max-width: 900px) 92vw, 60vw';img.src=asset(mapName+'.webp');
  img.alt=view==='plan'?T.mapAltPlan:T.mapAltAerial;
  $('.map-canvas').classList.toggle('plan-view',view==='plan');$('.map-hotspots').hidden=view==='plan';
  $('.map-caption').textContent=view==='plan'?T.mapCaptionPlan:T.mapCaptionAerial;
  $$('.view-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  if(view==='plan')focusMap(null);
  if(push)updateURL();
 }
 /* Камера наезжает при восстановлении из адреса, только если объект назван в нём явно: без параметра — общий вид. */
 function restore(){const p=new URLSearchParams(location.search);selectObject(p.get('object'));selectView(p.get('view'));focusMap(p.get('object')?active:null);}
 $$('[data-object]').forEach(b=>b.addEventListener('click',()=>{
  const again=b.classList.contains('hotspot')&&b.dataset.object===active&&canvas?.classList.contains('is-zoomed');
  selectObject(b.dataset.object,true);focusMap(again?null:b.dataset.object);
 }));
 $$('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view,true)));
 $('.expand-map')?.addEventListener('click',()=>showImage($('#map-image').src,$('#map-image').alt,$('.map-caption').textContent,canvas));
 window.addEventListener('popstate',restore);
 /* Ошибка загрузки/расшифровки и ошибка отрисовки — разные вещи: во втором случае «Не удалось загрузить» было бы ложью. */
 const showLoadError=err=>{console.error(err);const hint=$('.explorer-hint');if(hint)hint.textContent=T.loadError;$$('[data-object]').forEach(b=>b.disabled=true);};
 loadData().then(data=>{objects=data;$$('[data-object]').forEach(b=>b.disabled=false);try{restore();}catch(err){console.error(err);}},showLoadError);
}

/* ---------- Фильтры хроники ---------- */
$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 const filter=button.dataset.filter;let shown=0;
 $$('.tl-item[data-kind], .timeline-item[data-kind]').forEach(item=>{item.hidden=filter!=='all'&&item.dataset.kind!==filter;if(!item.hidden)shown++;});
 $$('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 const status=$('.filter-status');if(status)status.textContent=(filter==='all'?T.filterAll:filter==='plan'?T.filterPlan:T.filterEvent)+shown;
}));

/* ---------- Шапка: липкая, прячется при прокрутке вниз и возвращается при прокрутке вверх ---------- */
const header=$('.header');
if(header){
 let lastY=scrollY,ticking=false;
 const update=()=>{ticking=false;const y=scrollY;header.classList.toggle('is-scrolled',y>24);
  if(y>140&&y>lastY+6&&!document.body.classList.contains('menu-open'))header.classList.add('is-hidden');
  else if(y<lastY-6||y<=140)header.classList.remove('is-hidden');
  lastY=y;};
 addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(update);}},{passive:true});
 update();
}
