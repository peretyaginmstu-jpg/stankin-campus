// Поведение страниц: меню, перерисовка графиков под ширину блока, подсказки, сортировка таблиц.
// Без JavaScript сайт остаётся рабочим: графики нарисованы при сборке, данные есть в таблицах.

import { RENDERERS } from './charts/charts.mjs';

const lang = document.documentElement.lang || 'ru';

// ---------- меню на узких экранах ----------
const toggle = document.querySelector('.menu-toggle');
if (toggle) {
  const label = toggle.querySelector('.visually-hidden');
  const set = (open) => {
    document.documentElement.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? toggle.dataset.closeLabel : toggle.dataset.openLabel;
  };
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      set(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => e.matches && set(false));
}

// ---------- подсказки ----------
function tooltipFor(body) {
  let tip = body.querySelector(':scope > .tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.setAttribute('role', 'status');
    tip.hidden = true;
    body.append(tip);
  }
  return tip;
}

function fillTooltip(tip, data) {
  tip.replaceChildren();
  if (data.t) {
    const title = document.createElement('div');
    title.className = 'tooltip-title';
    title.textContent = data.t;
    tip.append(title);
  }
  for (const [value, label] of data.r ?? []) {
    const row = document.createElement('div');
    row.className = 'tooltip-row';
    const strong = document.createElement('strong');
    strong.textContent = value;
    const span = document.createElement('span');
    span.textContent = label;
    row.append(strong, span);
    tip.append(row);
  }
}

function placeTooltip(body, tip, clientX, clientY) {
  const box = body.getBoundingClientRect();
  tip.hidden = false;
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  let x = clientX - box.left + 14;
  let y = clientY - box.top - th - 12;
  if (x + tw > box.width) x = Math.max(0, clientX - box.left - tw - 14);
  if (y < 0) y = clientY - box.top + 16;
  tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  tip.style.left = '0';
  tip.style.top = '0';
}

function hideTooltip(body) {
  const tip = body.querySelector(':scope > .tooltip');
  if (tip) tip.hidden = true;
  body.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
  const cross = body.querySelector('.crosshair');
  if (cross) cross.setAttribute('visibility', 'hidden');
}

function parseTip(el) {
  try {
    return JSON.parse(el.getAttribute('data-tip'));
  } catch {
    return null;
  }
}

function bindTooltips(body) {
  const show = (el, x, y) => {
    const data = parseTip(el);
    if (!data) return;
    body.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    el.classList.add('is-active');
    const tip = tooltipFor(body);
    fillTooltip(tip, data);
    placeTooltip(body, tip, x, y);
  };
  body.addEventListener('pointermove', (e) => {
    const layer = e.target.closest('.hover-layer');
    if (layer) {
      crosshair(body, layer, e.clientX, e.clientY);
      return;
    }
    const el = e.target.closest('[data-tip]');
    if (el && body.contains(el)) show(el, e.clientX, e.clientY);
    else hideTooltip(body);
  });
  body.addEventListener('pointerleave', () => hideTooltip(body));
  body.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    show(el, r.left + r.width / 2, r.top + r.height / 2);
  });
  body.addEventListener('focusout', () => hideTooltip(body));
}

function crosshair(body, layer, clientX, clientY) {
  const svg = layer.ownerSVGElement;
  const xs = layer.dataset.xs.split(',').map(Number);
  let rows;
  try {
    rows = JSON.parse(layer.dataset.rows);
  } catch {
    return;
  }
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const loc = pt.matrixTransform(ctm.inverse());
  let best = 0;
  for (let i = 1; i < xs.length; i += 1) if (Math.abs(xs[i] - loc.x) < Math.abs(xs[best] - loc.x)) best = i;
  const cross = svg.querySelector('.crosshair');
  if (cross) {
    cross.setAttribute('x1', xs[best]);
    cross.setAttribute('x2', xs[best]);
    cross.setAttribute('visibility', 'visible');
  }
  const tip = tooltipFor(body);
  fillTooltip(tip, rows[best]);
  placeTooltip(body, tip, clientX, clientY);
}

// ---------- графики: перерисовка под ширину ----------
for (const fig of document.querySelectorAll('figure.chart[data-chart]')) {
  const body = fig.querySelector('.chart-body');
  const specEl = fig.querySelector('.chart-spec');
  const render = RENDERERS[fig.dataset.chart];
  if (!body || !specEl || !render) continue;
  let spec;
  try {
    spec = JSON.parse(specEl.textContent);
  } catch {
    continue;
  }
  let lastWidth = 0;
  const draw = () => {
    const width = Math.round(body.clientWidth);
    if (!width || Math.abs(width - lastWidth) < 4) return;
    lastWidth = width;
    // узкая версия пузырьковой диаграммы нумерует точки — показываем список названий под ней
    if (fig.dataset.chart === 'bubble') fig.classList.toggle('is-compact', width < 600);
    const svg = body.querySelector('svg.chart-svg');
    const html = render(spec, width);
    const holder = document.createElement('div');
    holder.innerHTML = html; // разметка собрана модулем графиков, все подписи экранированы
    const fresh = holder.firstElementChild;
    if (svg && fresh) svg.replaceWith(fresh);
    hideTooltip(body);
  };
  bindTooltips(body);
  if ('ResizeObserver' in window) {
    let frame = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    }).observe(body);
  } else {
    draw();
  }
}

// ---------- сортировка таблиц ----------
const collator = new Intl.Collator(lang, { numeric: true, sensitivity: 'base' });
for (const table of document.querySelectorAll('table.sortable')) {
  const heads = [...table.tHead.rows[0].cells];
  heads.forEach((th, index) => {
    const btn = th.querySelector('button.sort');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const numeric = th.classList.contains('num');
      const current = th.getAttribute('aria-sort');
      const dir = current ? (current === 'descending' ? 'ascending' : 'descending') : numeric ? 'descending' : 'ascending';
      heads.forEach((h) => h.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', dir);
      const body = table.tBodies[0];
      const rows = [...body.rows];
      const key = (row) => {
        const c = row.cells[index];
        const raw = c?.dataset.v ?? c?.textContent ?? '';
        if (numeric) {
          const n = parseFloat(raw);
          return Number.isFinite(n) ? n : null;
        }
        return raw;
      };
      rows.sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        if (ka == null || ka === '') return 1;
        if (kb == null || kb === '') return -1;
        const cmp = numeric ? ka - kb : collator.compare(ka, kb);
        return dir === 'ascending' ? cmp : -cmp;
      });
      body.append(...rows);
    });
  });
}
