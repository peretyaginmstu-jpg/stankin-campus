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
$$('.reveal').forEach((el) => revealer.observe(el));

/* ---------- Счётчики показателей ---------- */
const counters = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    counters.unobserve(e.target);
    const el = e.target, target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return; /* без числа в data-count оставляем текст из разметки */
    if (reduced.matches) { el.textContent = format(target); return; }
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
  /* В китайском слова не разделены пробелами: делим текст сегментатором (или по знакам) и склеиваем без пробелов. */
  const source = el.textContent.trim();
  const hanzi = LANG === 'zh';
  const text = !hanzi ? source.split(/\s+/)
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
const today = new Date(); today.setHours(0, 0, 0, 0);
$$('[data-days-since]').forEach((el) => {
  const start = new Date(el.dataset.daysSince + 'T00:00:00');
  const days = Math.max(0, Math.round((today - start) / 86400000));
  el.textContent = format(days);
  const label = el.parentElement.querySelector('[data-days-label]');
  if (label) label.textContent = plural(days, T.days);
});
$$('[data-roadmap]').forEach((map) => {
  const start = new Date(map.dataset.start + 'T00:00:00'), end = new Date(map.dataset.end + 'T00:00:00');
  const p = clamp01((today - start) / (end - start));
  const marker = $('.roadmap-today', map);
  map.style.setProperty('--today', p.toFixed(4));
  if (marker) { marker.style.setProperty('--p', p.toFixed(4)); marker.hidden = false; }
});

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
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch {}
      video.remove();
    };
    const start = () => {
      if (!video.isConnected) return;
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
    new IntersectionObserver(([e]) => {
      if (video.ended || !video.isConnected) return;
      if (e.isIntersecting) start(); else if (!video.paused) video.pause();
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
