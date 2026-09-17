/* Общий слой движения (16.09.2026), подключается на всех страницах.
   Без зависимостей. Всё отключается при prefers-reduced-motion,
   без JavaScript страницы остаются полностью читаемыми. */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
/* Облегчённый режим: телефоны и сенсорные экраны — без эффектов, привязанных к прокрутке. */
const lite = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const still = () => reduced.matches || lite || root.classList.contains('vi');
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const format = (n) => n.toLocaleString('ru-RU');

/* ---------- Появление блоков ---------- */
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealer.unobserve(e.target); } });
}, { threshold: lite ? 0.01 : .12, rootMargin: lite ? '0px 0px 12% 0px' : '0px 0px -8% 0px' });
$$('.reveal').forEach((el) => revealer.observe(el));

/* ---------- Счётчики показателей ---------- */
const counters = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    counters.unobserve(e.target);
    const el = e.target, target = Number(el.dataset.count);
    if (reduced.matches || !Number.isFinite(target)) { el.textContent = format(target); return; }
    const start = performance.now(), duration = lite ? 1000 : 1500;
    const tick = (now) => {
      const p = clamp01((now - start) / duration), eased = 1 - Math.pow(1 - p, 4);
      el.textContent = format(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}, { threshold: .5 });
$$('[data-count]').forEach((el) => counters.observe(el));

/* ---------- Манифест: слова подсвечиваются по мере прокрутки ---------- */
const manifestos = $$('[data-words]').map((el) => {
  const text = el.textContent.trim().split(/\s+/);
  el.replaceChildren(...text.flatMap((w, i) => {
    const span = document.createElement('span'); span.className = 'mw'; span.textContent = w;
    return i ? [document.createTextNode(' '), span] : [span];
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
const cssScrollTimeline = CSS.supports('animation-timeline: scroll()');
let ticking = false;

function update() {
  ticking = false;
  const y = scrollY, vh = innerHeight;
  if (!still() && hero) root.style.setProperty('--sy', Math.min(y, vh * 1.2).toFixed(1));
  if (progress && !cssScrollTimeline) {
    const max = root.scrollHeight - vh;
    progress.style.setProperty('--sp', max > 0 ? clamp01(y / max).toFixed(4) : 0);
  }
  if (!still()) manifestos.forEach(({ el, words }) => {
    const r = el.getBoundingClientRect();
    const lit = Math.round(clamp01((vh * .8 - r.top) / (r.height + vh * .25)) * words.length);
    words.forEach((w, i) => w.classList.toggle('lit', i < lit));
  });
  rails.forEach(({ el, items }) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--tl', clamp01((vh * .6 - r.top) / r.height).toFixed(4));
    items.forEach((li) => li.classList.toggle('in', li.getBoundingClientRect().top < vh * .62));
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
    if (!moved && Math.abs(dx) > 4) { moved = true; track.classList.add('is-dragging'); try { track.setPointerCapture(e.pointerId); } catch (_) {} }
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
const plural = (n, forms) => { const m10 = n % 10, m100 = n % 100; return forms[(m10 === 1 && m100 !== 11) ? 0 : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? 1 : 2]; };
const today = new Date(); today.setHours(0, 0, 0, 0);
$$('[data-days-since]').forEach((el) => {
  const start = new Date(el.dataset.daysSince + 'T00:00:00');
  const days = Math.max(0, Math.round((today - start) / 86400000));
  el.textContent = format(days);
  const label = el.parentElement.querySelector('[data-days-label]');
  if (label) label.textContent = plural(days, ['день с начала строительства', 'дня с начала строительства', 'дней с начала строительства']);
});
$$('[data-roadmap]').forEach((map) => {
  const start = new Date(map.dataset.start + 'T00:00:00'), end = new Date(map.dataset.end + 'T00:00:00');
  const p = clamp01((today - start) / (end - start));
  const marker = $('.roadmap-today', map);
  map.style.setProperty('--today', p.toFixed(4));
  if (marker) { marker.style.setProperty('--p', p.toFixed(4)); marker.hidden = false; }
});
