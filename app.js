const gateDecrypt=async env=>{const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey('raw',b64(localStorage.getItem('gate.key')||''),{name:'AES-GCM'},true,['decrypt']);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(env.iv)},key,b64(env.data)));};
/* Общие сценарии: меню, липкая шапка, просмотр изображений, каталог объектов, фильтры хроники.
   Пути к ресурсам строятся от адреса самого скрипта, поэтому сайт одинаково работает
   в корне домена и в подпапке (например, на GitHub Pages). */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const BASE = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const asset = (name) => BASE + '/assets/' + name;
const icon = (name) => { const img=document.createElement('img');img.className='icon';img.src=asset('icons/'+name+'.svg');img.alt='';return img; };

/* ---------- Меню на телефоне ---------- */
const menu = $('.menu-toggle');
function closeMenu(){menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','Открыть меню');document.body.classList.remove('menu-open');}
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');document.body.classList.toggle('menu-open',open);if(open)$('#main-nav a')?.focus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
$('#main-nav')?.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
const wide=matchMedia('(min-width: 651px)');const onWide=e=>{if(e.matches)closeMenu();};
if(wide.addEventListener)wide.addEventListener('change',onWide);else if(wide.addListener)wide.addListener(onWide);

/* ---------- Просмотр изображений ---------- */
const dialog = $('.lightbox');
let lastFocus;
const canDialog=!!(dialog&&typeof dialog.showModal==='function');
function showImage(src,alt,caption){if(!canDialog){window.open(src,'_blank','noopener');return;}lastFocus=document.activeElement;dialog.querySelector(':scope > img').src=src;dialog.querySelector(':scope > img').alt=alt;dialog.querySelector('p').textContent=caption;dialog.showModal();document.body.classList.add('modal-open');}
function closeImage(){dialog.close();}
dialog?.addEventListener('close',()=>{document.body.classList.remove('modal-open');lastFocus?.focus();});
$('.close-lightbox')?.addEventListener('click',closeImage);
dialog?.addEventListener('click',e=>{if(e.target===dialog)closeImage();});
$$('figure:not([data-no-zoom]) > img').forEach(img=>{const b=document.createElement('button');b.className='image-zoom';b.setAttribute('aria-label','Увеличить: '+img.alt);b.append(icon('expand'));img.parentElement.append(b);b.addEventListener('click',()=>showImage(img.src,img.alt,img.parentElement.querySelector('figcaption')?.textContent||''));});

/* ---------- Каталог объектов ---------- */
const loadData=()=>fetch(BASE+'/campus-data.enc.json').then(r=>{if(!r.ok)throw Error('data');return r.json();}).then(gateDecrypt).then(t=>JSON.parse(t));
if($('.explorer')){
 let objects=[];let active=new URLSearchParams(location.search).get('object')||'academic';let view=new URLSearchParams(location.search).get('view')==='plan'?'plan':'aerial';
 const updateURL=()=>{const url=new URL(location.href);url.searchParams.set('object',active);if(view==='plan')url.searchParams.set('view','plan');else url.searchParams.delete('view');history.pushState(null,'',url);};
 function selectObject(id,push=false){
  if(!objects.length){if(id)active=id;if(push)updateURL();return;}
  const o=objects.find(v=>v.id===id)||objects[0];active=o.id;
  const fields={'tag':'tag','title':'name','metric':'metric','label':'label','second':'second','second-label':'secondLabel','description':'description','status':'status'};
  Object.entries(fields).forEach(([target,key])=>{$('#object-'+target).textContent=o[key];});
  $('#mobile-object-name').textContent=o.name;
  const img=$('#object-image');img.srcset=asset(o.image+'-900.webp')+' 900w, '+asset(o.image+'.webp')+' '+o.imageWidth+'w';img.sizes='(max-width: 900px) 92vw, 32vw';img.src=asset(o.image+'.webp');img.alt='Архитектурная визуализация: '+o.name;
  $('#object-features').replaceChildren(...o.features.map(f=>{const li=document.createElement('li');li.textContent=f;return li;}));
  $('#object-link').href=o.link;$('#object-source').href=o.source;
  $$('[data-object]').forEach(b=>{const selected=b.dataset.object===active;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  if(push)updateURL();
 }
 function selectView(value,push=false){
  view=value==='plan'?'plan':'aerial';
  const img=$('#map-image');const mapName=view==='plan'?'masterplan-with-legend':'hero-aerial';img.srcset=asset(mapName+'-900.webp')+' 900w, '+asset(mapName+'.webp')+' 1900w';img.sizes='(max-width: 900px) 92vw, 60vw';img.src=asset(mapName+'.webp');
  img.alt=view==='plan'?'Схема размещения объектов с оригинальными номерами и экспликацией проектной презентации':'Архитектурная визуализация кампуса с обозначениями объектов';
  $('.map-canvas').classList.toggle('plan-view',view==='plan');$('.map-hotspots').hidden=view==='plan';
  $('.map-caption').textContent=view==='plan'?'Схема размещения объектов · Материалы проекта, август 2026 · Номера соответствуют экспликации на плане':'Архитектурная визуализация, август 2026 · Расположение меток ориентировочное';
  $$('.view-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  if(push)updateURL();
 }
 function restore(){const p=new URLSearchParams(location.search);selectObject(p.get('object'));selectView(p.get('view'));}
 $$('[data-object]').forEach(b=>b.addEventListener('click',()=>selectObject(b.dataset.object,true)));
 $$('[data-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view,true)));
 $('.expand-map').addEventListener('click',()=>showImage($('#map-image').src,$('#map-image').alt,$('.map-caption').textContent));
 window.addEventListener('popstate',restore);
 loadData().then(data=>{objects=data;restore();$$('[data-object]').forEach(b=>b.disabled=false);}).catch(()=>{$('.explorer-hint').textContent='Не удалось загрузить объекты. Обновите страницу.';$$('[data-object]').forEach(b=>b.disabled=true);});
}

/* ---------- Фильтры хроники ---------- */
$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 const filter=button.dataset.filter;let shown=0;
 $$('.tl-item[data-kind], .timeline-item[data-kind]').forEach(item=>{item.hidden=filter!=='all'&&item.dataset.kind!==filter;if(!item.hidden)shown++;});
 $$('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 $('.filter-status').textContent=filter==='all'?'Все этапы: '+shown:filter==='plan'?'Плановые этапы: '+shown:'Подтверждённые события: '+shown;
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
