/* Общий слой движения (16.09.2026), подключается на всех страницах.
   Без зависимостей. Всё отключается при prefers-reduced-motion,
   без JavaScript страницы остаются полностью читаемыми. */
import {T, LANG, formatNumber, plural} from './i18n.js';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
/* Облегчённый режим: телефоны и сенсорные экраны — без эффектов, привязанных к прокрутке. */
const lite = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const still = () => reduced.matches || lite || root.classList.contains('vi');
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const format = formatNumber;

/* ---------- Появление блоков ---------- */
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealer.unobserve(e.target); } });
}, { threshold: lite ? 0.01 : .12, rootMargin: lite ? '0px 0px 12% 0px' : '0px 0px -8% 0px' });

/* Снимки под «шторкой», которые ещё не открыты: их проверяет update() при прокрутке (см. ниже). */
let curtains = [];
function openCurtains() {
  const vh = innerHeight;
  curtains = curtains.filter((el) => {
    const r = el.getBoundingClientRect();
    /* Горизонталь не проверяем: карточки галереи за правым краем открываются вместе с рядом — лента
       листается своим событием прокрутки, и иначе они остались бы закрытыми. */
    if (r.height && r.top < vh * .92 && r.bottom > 0) {
      el.classList.add('seen');
      /* Плитка со снимком сама же и появляется (.reveal): наблюдатель её под шторкой не видит, включаем сразу. */
      if (el.classList.contains('reveal')) { el.classList.add('in'); revealer.unobserve(el); }
      return false;
    }
    return true;
  });
}

/* ---------- Микроанимации (12.11.2026): заголовки из-под маски, «шторка» на снимках, наклон плиток ----------
   Оформление — в ui.css под классом html.fx. Класс не ставится при «меньше движения» и в версии для
   слабовидящих; если её включают на ходу, класс снимается, и всё скрытое показывается сразу.
   Блок стоит до первого наблюдения за .reveal: к моменту появления блока его заголовок уже разбит на строки. */
if (!reduced.matches && !root.classList.contains('vi')) {
  root.classList.add('fx');
  /* Наблюдатель отключается сразу после снятия класса: classList.remove() записывает атрибут class заново
     даже тогда, когда снимать нечего, — без отключения наблюдатель будил бы сам себя бесконечно, и страница
     зависала при включении версии для слабовидящих (поймано проверкой). */
  const viWatch = new MutationObserver(() => {
    if (!root.classList.contains('vi')) return;
    viWatch.disconnect();
    root.classList.remove('fx');
  });
  viWatch.observe(root, { attributes: true, attributeFilter: ['class'] });

  /* Заголовки разделов: каждая строка (границы — <br>) получает маску и выезжает из-под неё. */
  $$('.section-head h2, .finale h2').forEach((h) => {
    const lines = [[]];
    [...h.childNodes].forEach((n) => { if (n.nodeName === 'BR') lines.push([]); else lines[lines.length - 1].push(n); });
    const out = [];
    lines.forEach((nodes, i) => {
      if (i) out.push(document.createElement('br'));
      if (!nodes.some((n) => n.textContent.trim())) { out.push(...nodes); return; }
      const mask = document.createElement('span'); mask.className = 'ln';
      const inner = document.createElement('span'); inner.className = 'ln-in'; inner.style.setProperty('--l', i);
      inner.append(...nodes); mask.append(inner); out.push(mask);
    });
    h.replaceChildren(...out);
  });

  /* Снимки: «шторка» открывается, когда снимок входит в экран. После раскрытия классы снимаются,
     иначе обрезка съедала бы тень и наклон плитки. Момент входа ловит не IntersectionObserver, а замер
     в update(): Chrome учитывает собственную обрезку элемента, и полностью закрытый шторкой снимок для
     наблюдателя «не виден» никогда (проверено — снимки так и оставались закрытыми). */
  $$('.tile-image, .card-media, .object-card-media, .feature-figure, .making-visual, .tour-frame, .location-map, .sports-main, .sports-aerial, .map-canvas').forEach((el) => {
    el.classList.add('curtain');
    el.addEventListener('transitionend', function opened(e) {
      if (e.target !== el || e.propertyName !== 'clip-path') return;
      el.classList.remove('curtain', 'seen'); el.removeEventListener('transitionend', opened);
    });
    curtains.push(el);
  });

  /* Плитки: наклон за курсором и тёплый блик. Только мышь и широкий экран. */
  if (!lite && matchMedia('(pointer: fine)').matches) {
    const EASE = 'cubic-bezier(.2,.7,.2,1)';
    $$('.tile, .story-card').forEach((card) => {
      let frame = 0, point = null;
      const tilt = () => {
        frame = 0;
        if (!point) return;
        const r = card.getBoundingClientRect();
        const x = clamp01((point.x - r.left) / r.width), y = clamp01((point.y - r.top) / r.height);
        card.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        card.style.transform = `perspective(1100px) rotateX(${((.5 - y) * 5).toFixed(2)}deg) rotateY(${((x - .5) * 6).toFixed(2)}deg) translateY(-5px)`;
      };
      card.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse' || root.classList.contains('vi')) return;
        card.style.transition = `transform .25s ${EASE}, box-shadow .6s ${EASE}`;
        card.classList.add('is-tilting');
      });
      card.addEventListener('pointermove', (e) => {
        if (!card.classList.contains('is-tilting')) return;
        point = { x: e.clientX, y: e.clientY };
        if (!frame) frame = requestAnimationFrame(tilt);
      });
      card.addEventListener('pointerleave', () => {
        if (!card.classList.contains('is-tilting')) return;
        point = null;
        card.style.transition = `transform .7s ${EASE}, box-shadow .7s ${EASE}`;
        card.style.transform = '';
        card.classList.remove('is-tilting');
      });
    });
  }
}
$$('.reveal').forEach((el) => revealer.observe(el));

/* ---------- Счётчики показателей: барабаны механического счётчика (12.11.2026) ----------
   Раньше число досчитывалось от нуля заменой текста. Цифры у Prata разной ширины, поэтому строка показателей
   на «Науке» во время счёта то умещалась в ряд, то переламывалась, и блок под ней прыгал. Теперь каждая цифра —
   окошко шириной в свою конечную цифру, внутри которого прокручивается лента 0–9: ширина числа не меняется
   ни на пиксель. Барабаны останавливаются слева направо. Разметка барабанов живёт только на время движения:
   по окончании в элементе снова обычный текст. Читалкам всё это время отдаётся готовое число. */
const DIGIT = /[0-9]/;
function roll(el, final) {
  const sr = document.createElement('span'); sr.className = 'odo-sr'; sr.textContent = final;
  const odo = document.createElement('span'); odo.className = 'odo'; odo.setAttribute('aria-hidden', 'true');
  let count = 0, last = null;
  for (const ch of final) {
    if (!DIGIT.test(ch)) { odo.append(ch); continue; }
    const slot = document.createElement('span'); slot.className = 'odo-slot';
    const keep = document.createElement('span'); keep.className = 'odo-keep'; keep.textContent = ch; /* держит ширину и базовую линию */
    const strip = document.createElement('span'); strip.className = 'odo-strip';
    const steps = 10 + Number(ch); /* полный оборот и ещё до нужной цифры */
    for (let i = 0; i <= steps; i++) { const digit = document.createElement('span'); digit.textContent = i % 10; strip.append(digit); }
    strip.style.setProperty('--steps', steps);
    strip.style.transitionDuration = (lite ? .9 : 1.15) + count * .16 + 's';
    slot.append(keep, strip); odo.append(slot); last = strip; count++;
  }
  if (!last) { el.textContent = final; return; }
  el.replaceChildren(sr, odo);
  /* Скрипт новее стилей (первые минуты после публикации, ui.css ещё из кэша): без правил .odo-* ленты
     вывалились бы на страницу строкой цифр. Тогда просто оставляем готовое число. */
  if (getComputedStyle(last).position !== 'absolute') { el.textContent = final; return; }
  /* Шаг ленты — высота строки в пикселях: единицу lh знают не все браузеры, а строка у показателей бывает разной. */
  odo.style.setProperty('--lh', last.parentElement.getBoundingClientRect().height + 'px');
  let finished = false;
  const done = () => { if (finished) return; finished = true; el.textContent = final; };
  last.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 1600 + count * 160); /* вкладка в фоне или версия для слабовидящих, включённая на ходу: события не будет */
  requestAnimationFrame(() => requestAnimationFrame(() => odo.classList.add('is-rolling')));
}
const settled = () => reduced.matches || root.classList.contains('vi');
const counters = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    counters.unobserve(e.target);
    const el = e.target, target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return; /* без числа в data-count оставляем текст из разметки */
    if (settled()) { el.textContent = format(target); return; }
    roll(el, format(target));
  });
}, { threshold: .5 });
$$('[data-count]').forEach((el) => counters.observe(el));

/* ---------- Манифест: слова подсвечиваются по мере прокрутки ---------- */
const manifestos = $$('[data-words]').map((el) => {
  /* В китайском слова не разделены пробелами: делим текст сегментатором (или по знакам) и склеиваем без пробелов. */
  const source = el.textContent.trim();
  const hanzi = LANG === 'zh';
  /* Делим только по обычным пробелам: слова, связанные при сборке неразрывным пробелом («к работающей»),
     остаются одним куском и загораются вместе — иначе связка терялась бы и предлог снова повисал в конце строки. */
  const text = !hanzi ? source.split(/[ \t\n\r]+/)
    : ('Segmenter' in Intl ? [...new Intl.Segmenter('zh', {granularity: 'word'}).segment(source)].map((s) => s.segment) : [...source]);
  el.replaceChildren(...text.flatMap((w, i) => {
    const span = document.createElement('span'); span.className = 'mw'; span.textContent = w;
    return i && !hanzi ? [document.createTextNode(' '), span] : [span];
  }));
  const words = $$('.mw', el);
  if (still()) words.forEach((w) => w.classList.add('lit'));
  return { el, words };
});

/* ---------- Величины, зависящие от прокрутки ---------- */
const hero = $('.hero');
const rails = $$('.tl, .flow-steps').map((el) => ({ el, items: [...el.children] }));
const finale = $('.finale');
const progress = $('.scroll-progress');
const sideIndex = $('.side-index');
/* Указатель разделов нарисован инверсией цвета: на ровном фоне это читается, а поверх фотографии
   по среднему серому даёт серое — цифры исчезают. Поэтому над снимками он прячется. */
const MEDIA_TAGS = /^(img|picture|video|canvas|svg)$/;
/* Списком классов такое не покрыть — снимок может оказаться под указателем в любом разделе.
   Поэтому смотрим, что лежит под каждой ссылкой: сам снимок или фон-картинка у любого предка.
   Горизонтальная галерея — отдельный случай: она одна тянет текст до самого края окна, и её
   подписи попадали прямо под цифры указателя (проверено на главной, «Жизни» и «Партнёрам»). */
function hidesIndex(el) {
  for (let n = el; n && n !== root; n = n.parentElement) {
    if (MEDIA_TAGS.test(n.tagName.toLowerCase())) return true;
    if (n.classList && n.classList.contains('gallery-track')) return true;
    if (getComputedStyle(n).backgroundImage.includes('url(')) return true;
  }
  return false;
}
let lastMediaY = -1e6, overMedia = false;
function indexOverMedia() {
  const links = sideIndex ? [...sideIndex.querySelectorAll('a')] : [];
  if (!links.length) return false;
  if (Math.abs(scrollY - lastMediaY) < 40) return overMedia; /* проверка не из дешёвых — не чаще чем раз в 40 px */
  lastMediaY = scrollY;
  overMedia = links.some((a) => {
    const r = a.getBoundingClientRect();
    return document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      .some((el) => !el.closest('.side-index') && hidesIndex(el));
  });
  return overMedia;
}
const cssScrollTimeline = CSS.supports('animation-timeline: scroll()');
let ticking = false;

function update() {
  ticking = false;
  const y = scrollY, vh = innerHeight;
  /* Затухание и параллакс героя рассчитаны на длинную страницу. На короткой (404) прокрутки не
     хватает, и заголовок навсегда остаётся приглушённым, поэтому там --sy не трогаем. */
  if (!still() && hero && root.scrollHeight > vh * 1.9) root.style.setProperty('--sy', Math.min(y, vh * 1.2).toFixed(1));
  if (curtains.length) openCurtains();
  if (sideIndex) sideIndex.classList.toggle('is-over-media', indexOverMedia());
  if (progress && !cssScrollTimeline) {
    const max = root.scrollHeight - vh;
    progress.style.setProperty('--sp', max > 0 ? clamp01(y / max).toFixed(4) : 0);
  }
  if (!still()) manifestos.forEach(({ el, words }) => {
    const r = el.getBoundingClientRect();
    /* Фраза догорает к моменту, когда блок оказывается в середине экрана: раньше при взгляде
       прямо на неё оставалась непрочитанной четверть слов. */
    const lit = Math.round(clamp01((vh * .85 - r.top) / (r.height * .75 + vh * .12)) * words.length);
    words.forEach((w, i) => w.classList.toggle('lit', i < lit));
  });
  rails.forEach(({ el, items }) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--tl', clamp01((vh * .6 - r.top) / r.height).toFixed(4));
    items.forEach((li) => li.classList.toggle('in', li.getBoundingClientRect().top < vh * .85));
  });
  if (finale && !still()) {
    const r = finale.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh) {
      const p = (vh - r.top) / (vh + r.height);
      finale.style.setProperty('--fy', ((p - .5) * 140).toFixed(1));
      finale.style.setProperty('--wx', (-p * 360).toFixed(1));
    }
  }
}
const requestUpdate = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
addEventListener('scroll', requestUpdate, { passive: true });
addEventListener('resize', requestUpdate);
update();

/* ---------- Закреплённые сцены: шаг в середине экрана переключает изображение ---------- */
$$('.tour').forEach((tour) => {
  const steps = $$('.tour-step', tour), figs = $$('.tour-fig', tour), bars = $$('.tour-progress span', tour);
  if (!steps.length) return;
  const activate = (i) => {
    steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
    figs.forEach((f, j) => f.classList.toggle('is-active', j === i));
    bars.forEach((b, j) => b.classList.toggle('is-active', j <= i));
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) activate(Number(e.target.dataset.step)); });
  }, { rootMargin: matchMedia('(max-width: 900px)').matches ? '-56% 0px -34% 0px' : '-45% 0px -45% 0px', threshold: 0 });
  steps.forEach((s) => observer.observe(s));
});

/* ---------- Раскрывающийся список с переключением изображений ---------- */
$$('.process-list').forEach((list) => {
  const items = $$('.process-item', list);
  const figs = $$('.making-fig', list.closest('.making-layout') || list.parentElement);
  const activate = (i) => {
    items.forEach((li, j) => {
      const on = j === i;
      li.classList.toggle('is-active', on);
      $('button', li).setAttribute('aria-expanded', String(on));
    });
    figs.forEach((f, j) => f.classList.toggle('is-active', j === i));
  };
  items.forEach((li, i) => {
    const button = $('button', li);
    button.addEventListener('click', () => activate(i));
    button.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') activate(i); });
  });
});

/* ---------- Прожектор за курсором на тёмных «листах» ---------- */
if (matchMedia('(pointer: fine)').matches) {
  $$('.sheet, .making').forEach((sheet) => sheet.addEventListener('pointermove', (e) => {
    const r = sheet.getBoundingClientRect();
    sheet.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    sheet.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));
}

/* ---------- Галереи: перетаскивание, стрелки, клавиатура, прогресс, параллакс ---------- */
$$('.gallery-track').forEach((track) => {
  const cards = $$('.card', track);
  const bar = track.parentElement.querySelector('.gallery-progress span');
  const buttons = $$('.gallery-btn', track.closest('section') || document);
  let dragging = false, moved = false, startX = 0, startLeft = 0;
  /* Указатель захватывается только после начала реального перетаскивания: захват при нажатии
     переадресовывал бы click на дорожку, и клики по карточкам и ссылкам внутри не срабатывали. */
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 4) { moved = true; track.classList.add('is-dragging'); try { track.setPointerCapture(e.pointerId); } catch { /* указатель уже отпущен */ } }
    if (moved) track.scrollLeft = startLeft - dx;
  });
  /* Нативное перетаскивание картинок и ссылок отменяло прокрутку галереи мышью. */
  track.addEventListener('dragstart', (e) => e.preventDefault());
  const release = () => { if (!dragging) return; dragging = false; track.classList.remove('is-dragging'); };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  addEventListener('pointerup', release);
  track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  const stepBy = (dir) => {
    const width = cards[0] ? cards[0].getBoundingClientRect().width + 18 : track.clientWidth * .8;
    track.scrollBy({ left: width * dir, behavior: reduced.matches ? 'auto' : 'smooth' });
  };
  buttons.forEach((b) => b.addEventListener('click', () => stepBy(Number(b.dataset.dir))));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); stepBy(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepBy(-1); }
  });
  const updateGallery = () => {
    const max = track.scrollWidth - track.clientWidth;
    const p = max > 0 ? track.scrollLeft / max : 0;
    if (bar) {
      const trackWidth = bar.parentElement.clientWidth;
      const width = Math.max(24, trackWidth * track.clientWidth / track.scrollWidth);
      bar.style.width = width + 'px';
      bar.style.transform = 'translateX(' + (p * (trackWidth - width)).toFixed(1) + 'px)';
    }
    if (!still()) cards.forEach((card) => {
      const img = $('.card-media img', card);
      if (!img) return;
      const r = card.getBoundingClientRect();
      img.style.setProperty('--px', (((r.left + r.width / 2 - innerWidth / 2) / innerWidth) * -7).toFixed(2) + '%');
    });
  };
  let galleryTick = false;
  track.addEventListener('scroll', () => { if (!galleryTick) { galleryTick = true; requestAnimationFrame(() => { galleryTick = false; updateGallery(); }); } }, { passive: true });
  addEventListener('resize', updateGallery);
  updateGallery();
});

/* ---------- Магнитные кнопки ---------- */
if (matchMedia('(pointer: fine)').matches && !reduced.matches) {
  $$('[data-magnetic]').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
      b.style.transform = 'translate(' + (x * 10).toFixed(1) + 'px,' + (y * 8).toFixed(1) + 'px)';
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

/* ---------- Боковой указатель разделов (главная) ---------- */
const indexLinks = $$('.side-index a');
if (indexLinks.length) {
  const sections = indexLinks.map((a) => document.getElementById(a.dataset.target)).filter(Boolean);
  const indexObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) indexLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.target === e.target.id));
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
  sections.forEach((s) => indexObserver.observe(s));
}

/* ---------- Каталог объектов: карточка выбирает объект и ведёт к описанию ---------- */
const detail = $('#object-detail');
if (detail) {
  const explorer = $('#explorer');
  $$('[data-object]').forEach((b) => b.addEventListener('click', () => {
    detail.classList.add('is-switching');
    setTimeout(() => detail.classList.remove('is-switching'), 320);
    if (b.classList.contains('object-card') && explorer) explorer.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  }));
}

/* ---------- Дни с начала строительства и отметка «сегодня» на дорожной карте ---------- */
const today = new Date(); today.setHours(0, 0, 0, 0);
$$('[data-days-since]').forEach((el) => {
  const start = new Date(el.dataset.daysSince + 'T00:00:00');
  const days = Math.max(0, Math.round((today - start) / 86400000));
  el.textContent = format(days);
  const label = el.parentElement.querySelector('[data-days-label]');
  if (label) label.textContent = plural(days, T.days);
  /* Число дней прокручивается теми же барабанами, когда блок оказывается на экране. */
  if (!settled()) new IntersectionObserver((entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    if (!settled()) roll(el, format(days));
  }, { threshold: .5 }).observe(el);
});
$$('[data-roadmap]').forEach((map) => {
  /* Шкала кусочно-линейная: год с событиями шире остальных. Границы годов приходят из сборки в data-scale
     в виде «дата:доля»; если их нет (страница из кэша прежней сборки), шкала равномерная от data-start до data-end. */
  const at = (iso) => new Date(iso + 'T00:00:00').getTime();
  let stops = (map.dataset.scale || '').split(/\s+/).filter(Boolean)
    .map((s) => { const i = s.lastIndexOf(':'); return [at(s.slice(0, i)), Number(s.slice(i + 1))]; })
    .filter(([t, f]) => Number.isFinite(t) && Number.isFinite(f));
  if (stops.length < 2) stops = [[at(map.dataset.start), 0], [at(map.dataset.end), 1]];
  const now = today.getTime();
  let p = now < stops[0][0] ? 0 : 1;
  for (let i = 1; i < stops.length; i++) {
    const [t0, f0] = stops[i - 1], [t1, f1] = stops[i];
    if (now >= t0 && now < t1) { p = f0 + (f1 - f0) * (now - t0) / (t1 - t0); break; }
  }
  p = clamp01(p);
  const marker = $('.roadmap-today', map);
  map.style.setProperty('--today', p.toFixed(4));
  if (marker) { marker.style.setProperty('--p', p.toFixed(4)); marker.hidden = false; }
  /* На узком экране шкала шире окна и листается вбок. Сразу показываем окрестности «сегодня»
     (иначе через год-другой отметка уедет за край) и затемняем те края, за которыми есть продолжение. */
  const scroller = map.closest('.roadmap-scroll');
  if (!scroller) return;
  const edges = () => {
    const max = scroller.scrollWidth - scroller.clientWidth;
    scroller.classList.toggle('can-left', scroller.scrollLeft > 4);
    scroller.classList.toggle('can-right', scroller.scrollLeft < max - 4);
  };
  const max = scroller.scrollWidth - scroller.clientWidth;
  if (max > 0 && marker) scroller.scrollLeft = Math.max(0, Math.min(max, marker.offsetLeft - scroller.clientWidth * .6));
  scroller.addEventListener('scroll', edges, { passive: true });
  addEventListener('resize', edges);
  edges();
});

/* ---------- Бегущая строка: кнопка паузы ----------
   Движение дольше пяти секунд человек должен уметь остановить сам (WCAG 2.2.2), а не только
   наведением мыши. Кнопку создаём здесь, потому что разметка страницы зашифрована в сборке.
   is-paused — остановлено кнопкой; is-running — продолжено кнопкой, и наведение мыши больше не тормозит строку. */
const TICKER_ICONS = {
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
};
$$('.ticker').forEach((ticker) => {
  const track = $('.ticker-track', ticker);
  if (!track) return;
  /* Фокусируемая кнопка внутри aria-hidden недоступна для вспомогательных технологий: скрываем от них только
     сам текст строки, а не всю капсулу. */
  if (ticker.getAttribute('aria-hidden') === 'true') { ticker.removeAttribute('aria-hidden'); track.setAttribute('aria-hidden', 'true'); }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ticker-toggle';
  const show = (paused) => {
    button.setAttribute('aria-label', paused ? T.tickerPlay : T.tickerPause);
    button.innerHTML = paused ? TICKER_ICONS.play : TICKER_ICONS.pause;
  };
  button.addEventListener('click', () => {
    const paused = !ticker.classList.contains('is-paused');
    ticker.classList.toggle('is-paused', paused);
    ticker.classList.toggle('is-running', !paused);
    show(paused);
  });
  show(false);
  ticker.append(button);
});

/* ---------- Переходы между страницами (13.11.2026): тёмная шторка и предзагрузка ----------
   Уход: по нажатию на внутреннюю ссылку снизу поднимается шторка цвета шапки (класс html.is-leaving), и только
   когда она почти закрыла экран, начинается переход — задержка 240 мс. Приход: страница, открытая таким
   переходом, появляется из-под шторки, уходящей вверх (класс html.is-entering ставит строчный скрипт в <head>
   по метке nav в sessionStorage — до первой отрисовки). В защищённой сборке между страницами на мгновение
   показывается экран расшифровки: он того же цвета, поэтому шов не виден.
   Предзагрузка: при наведении на внутреннюю ссылку браузер заранее скачивает её страницу (Speculation Rules,
   в Firefox — <link rel="prefetch">), и сам переход почти не ждёт сети.
   Не действует при «меньше движения» и в версии для слабовидящих. */
const SITE = new URL('.', import.meta.url).pathname; /* «/» или «/stankin-campus/» */
const sameSite = (a) => a.origin === location.origin && /^https?:$/.test(a.protocol) && a.pathname.startsWith(SITE)
  && !a.pathname.startsWith(SITE + 'assets/') && !a.target && !a.hasAttribute('download');
const samePage = (a) => a.pathname === location.pathname && a.search === location.search && !!a.hash;
if (root.classList.contains('is-entering')) setTimeout(() => root.classList.remove('is-entering'), 1500);
addEventListener('pageshow', (e) => { if (e.persisted) root.classList.remove('is-leaving', 'is-entering'); });
addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest ? e.target.closest('a[href]') : null;
  if (!a || !sameSite(a) || samePage(a) || settled() || root.classList.contains('is-leaving')) return;
  e.preventDefault();
  try { sessionStorage.setItem('nav', '1'); } catch { /* хранилище закрыто: страница откроется без шторки */ }
  root.classList.add('is-leaving');
  setTimeout(() => { location.assign(a.href); }, 240);
  /* Переход не состоялся (обрыв сети, отмена) — шторку убираем, страница снова доступна. */
  setTimeout(() => root.classList.remove('is-leaving'), 8000);
});
if (typeof HTMLScriptElement.supports === 'function' && HTMLScriptElement.supports('speculationrules')) {
  const rules = document.createElement('script');
  rules.type = 'speculationrules';
  rules.textContent = JSON.stringify({ prefetch: [{ eagerness: 'moderate', where: { and: [
    { href_matches: SITE + '*' }, { not: { href_matches: SITE + 'assets/*' } }, { not: { selector_matches: '[target], [download]' } },
  ] } }] });
  document.head.append(rules);
} else {
  const warmed = new Set();
  const warm = (e) => {
    const a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || !sameSite(a) || samePage(a) || warmed.has(a.href) || (navigator.connection || {}).saveData) return;
    warmed.add(a.href);
    const hint = document.createElement('link'); hint.rel = 'prefetch'; hint.href = a.href; document.head.append(hint);
  };
  addEventListener('pointerover', warm, { passive: true });
  addEventListener('touchstart', warm, { passive: true });
}

/* ---------- Видеопролёт первого экрана главной (21.09.2026) ----------
   Фотография остаётся основой страницы: ролик подставляется поверх неё только там, где ему есть
   место и где канал его вытянет. Проверено на iPhone в симуляторе: Safari не начинает
   воспроизведение, если битрейт файла выше скорости сети, — на слабом сигнале ролик просто
   никогда не стартует и человек видит фотографию, ничего не понимая. Поэтому скорость сначала
   измеряется, файл выбирается по ней, а если выбранный всё-таки не пошёл — берётся тот, что легче.
   Ролики играют один раз и замирают на последнем кадре; петля читалась бы стыком, а обратный
   ход погнал бы машины задом наперёд. Путь считается от адреса модуля: на GitHub Pages сайт лежит
   в подкаталоге, а protect.mjs правит базовый путь только в HTML и CSS.
   Диагностика на живом устройстве: открыть главную с ?videodebug — снизу появится строка решений. */
const vdebug = /[?&]videodebug(?:[=&]|$)/.test(location.search);
const vlog = (message) => {
  if (!vdebug) return;
  let box = document.getElementById('video-debug');
  if (!box) {
    box = document.createElement('p');
    box.id = 'video-debug';
    box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99;margin:0;padding:8px 10px;border-radius:10px;background:rgba(20,19,17,.92);color:#f3efe6;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap';
    document.body.append(box);
  }
  box.textContent += (box.textContent ? '\n' : '') + message;
};

const link = navigator.connection || {};
const thrifty = link.saveData === true || /(^|-)2g$/.test(link.effectiveType || '');
const wide = matchMedia('(min-width: 1024px) and (pointer: fine)').matches;
const upright = matchMedia('(max-width: 900px) and (orientation: portrait)').matches;
const dense = wide && innerWidth * (devicePixelRatio || 1) >= 2200;
/* Порог — скорость в байтах в секунду, при которой файл проигрывается без дозагрузки:
   его битрейт плюс полуторный запас. Битрейты: 2560 — 11,5 Мбит/с, 1920 — 6,8, лёгкий 1920 — 2,1,
   вертикальный — 5,9, лёгкий вертикальный — 1,3 Мбит/с. */
const TIERS = wide
  ? [{name: 'hero-flight-2560', need: 2300000, when: dense},
     {name: 'hero-flight', need: 1400000, when: true},
     {name: 'hero-flight-light', need: 420000, when: true}]
  : [{name: 'hero-flight-portrait', need: 1200000, when: true},
     {name: 'hero-flight-portrait-light', need: 260000, when: true}];
const tiers = TIERS.filter((t) => t.when);
const heroMedia = hero && document.body.dataset.page === 'home' && (wide || upright)
  && !reduced.matches && !root.classList.contains('vi') && !thrifty ? $('.hero-media', hero) : null;

if (!heroMedia) {
  vlog(`ролик не подключается: ${!hero || document.body.dataset.page !== 'home' ? 'не главная'
    : !(wide || upright) ? 'узкий экран в альбомной ориентации или сенсорный планшет в альбоме'
    : reduced.matches ? 'включено «меньше движения»'
    : root.classList.contains('vi') ? 'версия для слабовидящих' : 'экономия трафика'}`);
} else {
  const base = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
  const image = $('img', heroMedia);

  /* Скорость: сначала по тому, что страница уже скачала (фотография первого экрана — 0,5 МБ),
     и только если таких замеров нет — коротким пробным запросом к самому лёгкому файлу. */
  const fromTiming = () => {
    let best = 0;
    for (const e of performance.getEntriesByType('resource')) {
      /* На телефон едет вариант фотографии на 900 px (~0,12 МБ) — планка ниже, иначе замера не будет. */
      if (e.transferSize > 60000 && e.duration > 20) best = Math.max(best, e.transferSize / (e.duration / 1000));
    }
    return best;
  };
  const byProbe = async () => {
    const t0 = performance.now();
    try {
      const r = await fetch(`${base}/assets/${tiers[tiers.length - 1].name}.mp4`, {headers: {Range: 'bytes=0-196607'}, cache: 'no-store'});
      const bytes = (await r.arrayBuffer()).byteLength;
      return bytes / ((performance.now() - t0) / 1000);
    } catch { return 0; }
  };

  /* Наезд фотографии гасим не сбросом, а фиксацией текущего масштаба: анимация к этому моменту
     уже идёт, и простое снятие отбросило бы кадр обратно. */
  const freezeZoom = () => {
    const now = getComputedStyle(image).transform;
    if (now && now !== 'none') image.style.transform = now;
    heroMedia.classList.add('has-video');
  };

  const attach = (index) => {
    const tier = tiers[index];
    const video = document.createElement('video');
    /* Атрибутами, а не только свойствами: Safari принимает решение об автовоспроизведении
       по разметке элемента в момент загрузки источника. */
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('preload', 'auto');
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('tabindex', '-1');
    video.muted = true; video.defaultMuted = true; video.playsInline = true; video.disablePictureInPicture = true;
    video.src = `${base}/assets/${tier.name}.mp4`;
    heroMedia.append(video);
    vlog(`беру ${tier.name}.mp4`);

    const off = new AbortController();
    /* Открепившийся элемент продолжает получать события и, если его не заглушить, качает файл
       в пустоту: kill() снимает слушатели и обрывает закачку. */
    const kill = () => {
      off.abort();
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch { /* элемент уже разобран */ }
      video.remove();
    };
    /* Виден ли первый экран. Ролик, поставленный на паузу за его пределами, не должен оживать от
       первого же касания или от конца загрузки — иначе кадры считаются впустую. */
    let inView = true;
    const start = () => {
      if (!video.isConnected || !inView) return;
      const p = video.play();
      if (p && p.catch) p.catch((e) => vlog(`play(): ${e.name}`));
    };
    for (const e of ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough']) video.addEventListener(e, start, {signal: off.signal});
    /* Если автозапуск запрещён (энергосбережение, настройка Safari «никогда»), ролик стартует
       от первого касания, клика или возврата на вкладку. */
    const wake = () => { if (video.paused && !video.ended) start(); };
    for (const e of ['touchstart', 'click', 'pageshow', 'visibilitychange']) addEventListener(e, wake, {passive: true, signal: off.signal});
    const shown = () => {
      if (video.classList.contains('is-on')) return;
      clearTimeout(guard);
      freezeZoom();
      video.classList.add('is-on');
      vlog(`пошёл: ${tier.name}.mp4`);
    };
    video.addEventListener('playing', shown, {signal: off.signal});
    video.addEventListener('timeupdate', () => { if (video.currentTime > 0.1) shown(); }, {signal: off.signal});
    video.addEventListener('error', () => {
      vlog(`ошибка источника ${tier.name}.mp4`);
      clearTimeout(guard); kill(); next(index);
    }, {signal: off.signal});
    start();

    /* Не стартовал за 12 с — канал слабее, чем показал замер: берём файл легче, а если легче
       некуда, молча остаёмся на фотографии и обрываем закачку. */
    const guard = setTimeout(() => {
      if (video.classList.contains('is-on')) return;
      vlog(`${tier.name}.mp4 не стартовал за 12 с (ready=${video.readyState})`);
      kill(); next(index);
    }, 12000);

    /* За пределами первого экрана считать кадры незачем. */
    new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1].isIntersecting; /* последнее наблюдение — самое свежее */
      if (video.ended || !video.isConnected) return;
      if (inView) start(); else if (!video.paused) video.pause();
    }, {threshold: .02}).observe(hero);
  };

  const next = (index) => {
    if (index + 1 < tiers.length) attach(index + 1);
    else { heroMedia.classList.remove('has-video'); image.style.transform = ''; vlog('остаёмся на фотографии'); }
  };

  (async () => {
    /* Мелкий файл на медленном старте TCP занижает оценку, поэтому если замера не хватает
       на самый тяжёлый уместный файл — перепроверяем пробным чтением 192 КБ. */
    let speed = fromTiming();
    if (speed < tiers[0].need) speed = Math.max(speed, await byProbe());
    vlog(`сеть ≈ ${(speed / 1048576).toFixed(2)} МБ/с (${(speed * 8 / 1e6).toFixed(1)} Мбит/с)`);
    const index = tiers.findIndex((t) => speed >= t.need);
    if (index < 0) { vlog('канал не вытянет даже лёгкий файл — остаёмся на фотографии'); return; }
    attach(index);
  })();
}
