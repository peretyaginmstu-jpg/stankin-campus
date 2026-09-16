const gateDecrypt=async env=>{const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey('raw',b64(localStorage.getItem('gate.key')||''),{name:'AES-GCM'},true,['decrypt']);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(env.iv)},key,b64(env.data)));};
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const icon = (name) => { const img=document.createElement('img');img.className='icon';img.src='/stankin-campus/assets/icons/'+name+'.svg';img.alt='';return img; };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const menu = $('.menu-toggle');
function closeMenu(){menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','Открыть меню');document.body.classList.remove('menu-open');}
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');document.body.classList.toggle('menu-open',open);if(open)$('#main-nav a')?.focus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
$('#main-nav')?.addEventListener('click',e=>{if(e.target.closest('a'))closeMenu();});
matchMedia('(min-width: 651px)').addEventListener('change',e=>{if(e.matches)closeMenu();});

const dialog = $('.lightbox');
let lastFocus;
function showImage(src,alt,caption){lastFocus=document.activeElement;dialog.querySelector(':scope > img').src=src;dialog.querySelector(':scope > img').alt=alt;dialog.querySelector('p').textContent=caption;dialog.showModal();document.body.classList.add('modal-open');}
function closeImage(){dialog.close();}
dialog?.addEventListener('close',()=>{document.body.classList.remove('modal-open');lastFocus?.focus();});
$('.close-lightbox')?.addEventListener('click',closeImage);
dialog?.addEventListener('click',e=>{if(e.target===dialog)closeImage();});
$$('figure:not([data-no-zoom]) > img').forEach(img=>{const b=document.createElement('button');b.className='image-zoom';b.setAttribute('aria-label','Увеличить: '+img.alt);b.append(icon('expand'));img.parentElement.append(b);b.addEventListener('click',()=>showImage(img.src,img.alt,img.parentElement.querySelector('figcaption')?.textContent||''));});

function setupTabs(selector,onSelect){
 const tabs=$$(selector);
 const select=tab=>{tabs.forEach(b=>{const active=b===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});onSelect(tab);};
 tabs.forEach(tab=>{tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',e=>{const keys=['ArrowRight','ArrowLeft','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();let i=tabs.indexOf(tab);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;select(tabs[i]);tabs[i].focus();});});
}
const scenes={
 territory:{width:1900,height:1061,image:'hero-aerial',alt:'Общий вид территории нового кампуса',caption:'Общий вид. Архитектурная визуализация из материалов проекта.',description:'Учебный комплекс в окружении будущих общежитий, научно-производственных и городских объектов.',url:'/stankin-campus/campus/',link:'Объекты на территории'},
 building:{width:1900,height:622,image:'academic-building',alt:'Панорама фасада учебного комплекса',caption:'Учебный комплекс. Архитектурная визуализация, август 2026.',description:'По проекту семь корпусов объединит общий стилобат — основание, связывающее разные части учебного комплекса.',url:'/stankin-campus/campus/?object=academic',link:'Об учебном комплексе'},
 courtyard:{width:1280,height:682,image:'campus-courtyard',alt:'Внутренний двор между учебными корпусами',caption:'Внутренний двор. Архитектурная визуализация из материалов проекта.',description:'Дворы между корпусами входят в архитектурную концепцию: пешеходные связи, места для встреч и отдыха между занятиями.',url:'/stankin-campus/campus/?object=plaza',link:'Об общественных пространствах'}
};
let sceneRequest=0;
setupTabs('[data-scene]',tab=>{
 const s=scenes[tab.dataset.scene];const img=$('#journey-image');const request=++sceneRequest;
 $('#journey-panel').setAttribute('aria-labelledby',tab.id);
 img.classList.remove('scene-enter');img.width=s.width;img.height=s.height;img.style.aspectRatio=s.width+' / '+s.height;img.srcset='/stankin-campus/assets/'+s.image+'-900.webp 900w, /assets/'+s.image+'.webp '+s.width+'w';img.sizes='(max-width: 650px) calc(100vw - 44px), 92vw';img.src='/stankin-campus/assets/'+s.image+'.webp';img.alt=s.alt;
 img.decode().then(()=>{if(request===sceneRequest&&!reducedMotion.matches)img.classList.add('scene-enter');}).catch(()=>{});
 $('#journey-caption').textContent=s.caption;$('#journey-description').textContent=s.description;
 const link=$('#journey-link');link.href=s.url;link.replaceChildren(document.createTextNode(s.link+' '),icon('arrow-right'));
 $('.journey-figure .image-zoom')?.setAttribute('aria-label','Увеличить: '+s.alt);
});
const processCopy={design:['От изделия к документации','Реверсивный инжиниринг: исследование существующих решений и восстановление конструкторской информации.'],make:['От документации к детали','Точная механообработка, изготовление деталей, сборка узлов, электроники и готовых изделий.'],test:['От детали к проверке','Метрологический контроль геометрии и характеристик, проверка качества и испытания.']};
setupTabs('[data-process]',tab=>{const [title,copy]=processCopy[tab.dataset.process];$('#process-panel').setAttribute('aria-labelledby',tab.id);$('#process-title').textContent=title;$('#process-copy').textContent=copy;});

if($('.explorer')){
 let objects=[];let active=new URLSearchParams(location.search).get('object')||'academic';let view=new URLSearchParams(location.search).get('view')==='plan'?'plan':'aerial';
 const updateURL=()=>{const url=new URL(location.href);url.searchParams.set('object',active);if(view==='plan')url.searchParams.set('view','plan');else url.searchParams.delete('view');history.pushState(null,'',url);};
 function selectObject(id,push=false){
  if(!objects.length){if(id)active=id;if(push)updateURL();return;}
  const o=objects.find(v=>v.id===id)||objects[0];active=o.id;
  const fields={'tag':'tag','title':'name','metric':'metric','label':'label','second':'second','second-label':'secondLabel','description':'description','status':'status'};
  Object.entries(fields).forEach(([target,key])=>{$('#object-'+target).textContent=o[key];});
  $('#mobile-object-name').textContent=o.name;
  const img=$('#object-image');img.srcset='/stankin-campus/assets/'+o.image+'-900.webp 900w, /assets/'+o.image+'.webp '+o.imageWidth+'w';img.sizes='(max-width: 900px) 92vw, 32vw';img.src='/stankin-campus/assets/'+o.image+'.webp';img.alt='Архитектурная визуализация: '+o.name;
  $('#object-features').replaceChildren(...o.features.map(f=>{const li=document.createElement('li');li.textContent=f;return li;}));
  $('#object-link').href=o.link;$('#object-source').href=o.source;
  $$('[data-object]').forEach(b=>{const selected=b.dataset.object===active;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  if(push)updateURL();
 }
 function selectView(value,push=false){
  view=value==='plan'?'plan':'aerial';
  const img=$('#map-image');const mapName=view==='plan'?'masterplan-with-legend':'hero-aerial';img.srcset='/stankin-campus/assets/'+mapName+'-900.webp 900w, /assets/'+mapName+'.webp 1900w';img.sizes='(max-width: 900px) 92vw, 60vw';img.src='/stankin-campus/assets/'+mapName+'.webp';
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
 fetch('/stankin-campus/campus-data.enc.json').then(r=>{if(!r.ok)throw Error('data');return r.json();}).then(gateDecrypt).then(t=>JSON.parse(t)).then(data=>{objects=data;restore();$$('[data-object]').forEach(b=>b.disabled=false);}).catch(()=>{$('.explorer-hint').textContent='Не удалось загрузить объекты. Обновите страницу.';$$('[data-object]').forEach(b=>b.disabled=true);});
}

$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 const filter=button.dataset.filter;let shown=0;
 $$('.tl-item[data-kind], .timeline-item[data-kind]').forEach(item=>{item.hidden=filter!=='all'&&item.dataset.kind!==filter;if(!item.hidden)shown++;});
 $$('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 $('.filter-status').textContent=filter==='all'?'Все этапы: '+shown:filter==='plan'?'Плановые этапы: '+shown:'Подтверждённые события: '+shown;
}));

/* Шапка: липкая, прячется при прокрутке вниз и возвращается при прокрутке вверх. */
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
