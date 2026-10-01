// SVG-графики сайта. Модуль изоморфный: сборка рисует ими статичную версию страниц,
// а браузер перерисовывает графики под фактическую ширину блока (src/assets/js/site.mjs).
//
// Цвета задаются классами (m-accent, m-context, m-cool), а не значениями: светлая и тёмная
// палитры живут в CSS. Подсказки — в атрибуте data-tip (JSON) и выводятся через textContent.

import { esc, truncate } from '../lib/text.mjs';
import { dec, int, pct } from '../lib/format.mjs';

const CHAR = 0.56; // средняя ширина символа в долях кегля (Golos Text)
export const textWidth = (s, size) => String(s ?? '').length * size * CHAR;
const r1 = (v) => Math.round(v * 10) / 10;

export function tipAttr(tip) {
  if (!tip) return '';
  return ` data-tip="${esc(JSON.stringify(tip))}"`;
}

function svgOpen(w, h, label, cls) {
  return `<svg class="chart-svg ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">`;
}

// ---------- шкалы ----------------------------------------------------------------------

function niceStep(span, count) {
  const raw = span / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

export function linearScale(values, { min, max, ref, pad = 0.08, ticks = 5, zero = true } = {}) {
  const vals = values.filter((v) => v != null && Number.isFinite(v));
  if (ref != null) vals.push(ref);
  let lo = min ?? (zero ? Math.min(0, ...vals) : Math.min(...vals));
  let hi = max ?? Math.max(...vals);
  if (!Number.isFinite(lo)) lo = 0;
  if (!Number.isFinite(hi) || hi <= lo) hi = lo + 1;
  const span = hi - lo;
  if (max == null) hi += span * pad;
  if (min == null && !zero) lo -= span * pad;
  const step = niceStep(hi - lo, ticks);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e9) / 1e9);
  return { type: 'linear', lo, hi, ticks: out, map: (v, a, b) => a + ((v - lo) / (hi - lo)) * (b - a) };
}

export function logScale(values, { ref = 1, pad = 1.35 } = {}) {
  const vals = values.filter((v) => v != null && Number.isFinite(v) && v > 0);
  const lo0 = Math.min(ref, ...vals) / pad;
  const hi0 = Math.max(ref, ...vals) * pad;
  const loExp = Math.floor(Math.log2(lo0));
  const hiExp = Math.ceil(Math.log2(hi0));
  const lo = 2 ** loExp;
  const hi = 2 ** hiExp;
  const ticks = [];
  for (let e = loExp; e <= hiExp; e += 1) ticks.push(2 ** e);
  const L = Math.log2;
  return { type: 'log', lo, hi, ticks, map: (v, a, b) => a + ((L(Math.max(v, lo)) - L(lo)) / (L(hi) - L(lo))) * (b - a) };
}

export function tickText(lang, v, kind = 'auto') {
  if (kind === 'int') return int(lang, v);
  if (kind === 'change') {
    const d = Math.round((v - 1) * 100) / 100;
    return `${d > 0 ? '+' : d < 0 ? '−' : ''}${pct(lang, Math.abs(d), 0)}`;
  }
  if (kind === 'pct') return pct(lang, v, 0);
  if (v >= 100 || Number.isInteger(v)) return int(lang, v);
  if (v >= 1) return dec(lang, v, 1).replace(/[.,]0$/, '');
  // доли единицы (в том числе 1/8 = 0,125 на логарифмической шкале) — без округления, лишние нули убираем
  const s = dec(lang, v, 3);
  return s.replace(/([.,]\d*?)0+$/, '$1').replace(/[.,]$/, '');
}

// ---------- пузырьковая диаграмма (карта компетенций, портфель) ----------------------------

const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function circleHitsRect(c, r) {
  const nx = Math.max(r.x, Math.min(c.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(c.y, r.y + r.h));
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < (c.r + 1) ** 2;
}

// Номера точек для узкой версии графика: по убыванию размера. Те же номера выводит список
// под графиком (pages.mjs), поэтому порядок задаётся одной функцией.
export function bubbleNumbers(points) {
  const list = points.filter((p) => p.x != null && p.y != null && p.x > 0)
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0) || String(a.label).localeCompare(String(b.label)));
  return new Map(list.map((p, i) => [p.id, i + 1]));
}

// spec: { lang, label, x: {type, label, short, ref, refLabel, kind}, y: {...}, quadrants: {tl,tr,bl,br},
//         points: [{ id, label, x, y, size, href, tip }] }
// На узких экранах (меньше 600 px) подписи точек заменяются номерами, а названия — списком под графиком.
export function bubble(spec, width = 880) {
  const w = Math.max(300, Math.round(width));
  const compact = w < 600;
  const h = Math.round(compact ? Math.max(440, w * 1.32) : Math.min(Math.max(w * 0.56, 420), 600));
  const fs = compact ? 11.5 : 12.5;
  const m = { l: compact ? 36 : 48, r: compact ? 10 : 18, t: compact ? 34 : 36, b: compact ? 44 : 48 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const pts = spec.points.filter((p) => p.x != null && p.y != null && p.x > 0);
  const make = (axis, values) => (axis.type === 'log' ? logScale(values, { ref: axis.ref ?? 1, pad: 1.25 }) : linearScale(values, { ref: axis.ref, zero: axis.zero ?? true, pad: 0.12 }));
  const xs = make(spec.x, pts.map((p) => p.x));
  const ys = make(spec.y, pts.map((p) => p.y));
  const X = (v) => xs.map(v, m.l, m.l + pw);
  const Y = (v) => ys.map(v, m.t + ph, m.t);
  const maxSize = Math.max(1, ...pts.map((p) => p.size ?? 1));
  const rMax = compact ? 20 : 32;
  const R = (s) => Math.max(5, Math.sqrt((s ?? 1) / maxSize) * rMax);

  const out = [svgOpen(w, h, spec.label, 'chart-bubble')];
  // сетка и оси
  const xTicks = compact && xs.ticks.length > 7 ? xs.ticks.filter((_, i) => i % 2 === 0) : xs.ticks;
  out.push('<g class="grid">');
  for (const t of ys.ticks) out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${r1(Y(t))}" y2="${r1(Y(t))}"/>`);
  for (const t of xTicks) out.push(`<line x1="${r1(X(t))}" x2="${r1(X(t))}" y1="${m.t}" y2="${m.t + ph}"/>`);
  out.push('</g><g class="axis-text">');
  for (const t of ys.ticks) out.push(`<text x="${m.l - 6}" y="${r1(Y(t) + 4)}" text-anchor="end">${esc(tickText(spec.lang, t, spec.y.kind))}</text>`);
  for (const t of xTicks) out.push(`<text x="${r1(X(t))}" y="${m.t + ph + 16}" text-anchor="middle">${esc(tickText(spec.lang, t, spec.x.kind))}</text>`);
  out.push(`<text class="axis-title" x="${m.l + pw}" y="${h - 8}" text-anchor="end">${esc(compact ? spec.x.short ?? spec.x.label : spec.x.label)}</text>`);
  out.push(`<text class="axis-title" x="${m.l - (compact ? 30 : 40)}" y="${m.t - 16}" text-anchor="start">${esc(compact ? spec.y.short ?? spec.y.label : spec.y.label)}</text>`);
  out.push('</g>');
  // опорные линии «как в мире»
  out.push('<g class="ref">');
  if (spec.x.ref != null) out.push(`<line x1="${r1(X(spec.x.ref))}" x2="${r1(X(spec.x.ref))}" y1="${m.t}" y2="${m.t + ph}"/>`);
  if (spec.y.ref != null) out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${r1(Y(spec.y.ref))}" y2="${r1(Y(spec.y.ref))}"/>`);
  out.push('</g>');
  // подписи опорных линий и квадрантов — препятствия для подписей точек
  const boxes = [];
  const refFs = compact ? 10.5 : 11;
  const refText = [];
  if (spec.x.ref != null && spec.x.refLabel && !compact) {
    const tx = X(spec.x.ref) + 5;
    refText.push(`<text x="${r1(tx)}" y="${m.t + ph - 22}">${esc(spec.x.refLabel)}</text>`);
    boxes.push({ x: tx, y: m.t + ph - 22 - refFs, w: textWidth(spec.x.refLabel, refFs), h: refFs * 1.3 });
  }
  if (spec.y.ref != null && spec.y.refLabel && !compact) {
    const ty = Y(spec.y.ref) - 5;
    refText.push(`<text x="${m.l + pw - 6}" y="${r1(ty)}" text-anchor="end">${esc(spec.y.refLabel)}</text>`);
    const rw = textWidth(spec.y.refLabel, refFs);
    boxes.push({ x: m.l + pw - 6 - rw, y: ty - refFs, w: rw, h: refFs * 1.3 });
  }

  // подписи квадрантов
  if (spec.quadrants) {
    const q = { ...spec.quadrants };
    const qs = compact ? 9.5 : 10.5;
    out.push(`<g class="quad-text" font-size="${qs}">`);
    // заглавные с разрядкой шире обычного текста: ширину оцениваем с запасом
    const qw = (str) => textWidth(str ?? '', qs) * 1.22;
    // на узком графике пара подписей, которая не помещается в ширину, не выводится
    const fitsRow = (a, b) => !compact || qw(a) + qw(b) + 24 <= pw;
    if (!fitsRow(q.tl, q.tr)) { q.tl = null; q.tr = null; }
    if (!fitsRow(q.bl, q.br)) { q.bl = null; q.br = null; }
    if (q.tl) { out.push(`<text x="${m.l + 8}" y="${m.t + 14}">${esc(q.tl)}</text>`); boxes.push({ x: m.l + 8, y: m.t + 3, w: qw(q.tl), h: qs * 1.4 }); }
    if (q.tr) { out.push(`<text x="${m.l + pw - 8}" y="${m.t + 14}" text-anchor="end">${esc(q.tr)}</text>`); boxes.push({ x: m.l + pw - 8 - qw(q.tr), y: m.t + 3, w: qw(q.tr), h: qs * 1.4 }); }
    if (q.bl) { out.push(`<text x="${m.l + 8}" y="${m.t + ph - 8}">${esc(q.bl)}</text>`); boxes.push({ x: m.l + 8, y: m.t + ph - 8 - qs * 1.1, w: qw(q.bl), h: qs * 1.4 }); }
    if (q.br) { out.push(`<text x="${m.l + pw - 8}" y="${m.t + ph - 8}" text-anchor="end">${esc(q.br)}</text>`); boxes.push({ x: m.l + pw - 8 - qw(q.br), y: m.t + ph - 8 - qs * 1.1, w: qw(q.br), h: qs * 1.4 }); }
    out.push('</g>');
  }
  // точки: крупные снизу, мелкие сверху
  const placed = pts
    .map((p) => ({ ...p, cx: X(p.x), cy: Y(p.y), r: R(p.size) }))
    .sort((a, b) => b.r - a.r);
  out.push('<g class="points">');
  for (const p of placed) {
    const hit = Math.max(p.r + 4, 12);
    const open = p.href ? `<a class="pt" href="${esc(p.href)}"${tipAttr(p.tip)} aria-label="${esc(p.aria ?? p.label)}">` : `<g class="pt" tabindex="0"${tipAttr(p.tip)} aria-label="${esc(p.aria ?? p.label)}">`;
    out.push(open);
    out.push(`<circle class="hit" cx="${r1(p.cx)}" cy="${r1(p.cy)}" r="${r1(hit)}"/>`);
    out.push(`<circle class="dot ${p.tone === 'context' ? 'm-context' : 'm-accent'}" cx="${r1(p.cx)}" cy="${r1(p.cy)}" r="${r1(p.r)}"/>`);
    out.push(p.href ? '</a>' : '</g>');
  }
  out.push('</g>');
  // подписи: жадная раскладка без наложений — сначала рядом с кругом (8 направлений), затем дальше
  // с тонкой выноской; не поместившиеся подписи остаются в подсказке и таблице данных
  const bounds = { x: 2, y: m.t, w: w - 4, h: ph + 2 };
  const labels = [];
  const leaders = [];
  const ANGLES = [0, 180, 90, 270, 35, 145, 325, 215];
  const numbers = bubbleNumbers(spec.points);
  const inside = [];
  for (const p of [...placed].sort((a, b) => b.r - a.r)) {
    const text = compact ? String(numbers.get(p.id) ?? '') : p.label;
    const tw = textWidth(text, fs);
    const th = fs * 1.25;
    if (compact && p.r >= 9) {
      inside.push(`<text x="${r1(p.cx)}" y="${r1(p.cy + fs * 0.36)}" text-anchor="middle">${esc(text)}</text>`);
      continue;
    }
    let ok = null;
    for (const gap of [5, 20]) {
      for (const deg of ANGLES) {
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const ax = p.cx + (p.r + gap) * cos;
        const ay = p.cy - (p.r + gap) * sin;
        const a = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
        const bx = a === 'start' ? ax : a === 'end' ? ax - tw : ax - tw / 2;
        // по вертикали: справа и слева — по центру точки привязки, сверху — над ней, снизу — под ней
        const by = Math.abs(sin) < 0.2 ? ay - th / 2 : sin > 0 ? ay - th : ay;
        const box = { x: bx - 1, y: by, w: tw + 2, h: th };
        const fits = box.x >= bounds.x && box.x + box.w <= bounds.x + bounds.w && box.y >= bounds.y && box.y + box.h <= bounds.y + bounds.h
          && !boxes.some((b) => rectsOverlap(b, box))
          && !placed.some((o) => circleHitsRect({ x: o.cx, y: o.cy, r: o.r + (o === p ? 1 : 2) }, box));
        if (fits) {
          ok = { x: a === 'start' ? bx : a === 'end' ? bx + tw : bx + tw / 2, y: by + th * 0.78, a, box, gap, ex: p.cx + p.r * cos, ey: p.cy - p.r * sin, ax, ay };
          break;
        }
      }
      if (ok) break;
    }
    if (!ok) continue;
    boxes.push(ok.box);
    if (ok.gap > 5) leaders.push(`<line x1="${r1(ok.ex)}" y1="${r1(ok.ey)}" x2="${r1(ok.ax)}" y2="${r1(ok.ay)}"/>`);
    labels.push(`<text x="${r1(ok.x)}" y="${r1(ok.y)}" text-anchor="${ok.a}">${esc(text)}</text>`);
  }
  // подписи опорных линий — поверх точек, с подложкой цвета фона
  if (refText.length) out.push(`<g class="ref-text" font-size="${refFs}">${refText.join('')}</g>`);
  if (leaders.length) out.push(`<g class="leaders">${leaders.join('')}</g>`);
  out.push(`<g class="point-labels" font-size="${fs}">${labels.join('')}</g>`);
  if (inside.length) out.push(`<g class="point-nums" font-size="${fs}">${inside.join('')}</g>`);
  out.push('</svg>');
  return out.join('');
}

// ---------- линии (динамика, индекс к базовому году) ---------------------------------------

// spec: { lang, label, years: [..], series: [{ key, label, values, tone }], yLabel, base, kind }
export function lines(spec, width = 720) {
  const w = Math.max(300, Math.round(width));
  const compact = w < 560;
  const h = compact ? 250 : 300;
  const fs = 12;
  const endLabels = !compact;
  const labelW = endLabels ? Math.max(...spec.series.map((s) => textWidth(s.label, fs))) + 18 : 0;
  const m = { l: 46, r: endLabels ? labelW : 14, t: 30, b: 28 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const all = spec.series.flatMap((s) => s.values).filter((v) => v != null);
  const ys = linearScale(all, { ref: spec.base, zero: spec.zero ?? false, ticks: spec.ticks ?? 5 });
  const n = spec.years.length;
  const X = (i) => m.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const Y = (v) => ys.map(v, m.t + ph, m.t);
  const out = [svgOpen(w, h, spec.label, 'chart-lines')];
  out.push('<g class="grid">');
  for (const t of ys.ticks) out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${r1(Y(t))}" y2="${r1(Y(t))}"/>`);
  out.push('</g><g class="axis-text">');
  for (const t of ys.ticks) out.push(`<text x="${m.l - 6}" y="${r1(Y(t) + 4)}" text-anchor="end">${esc(tickText(spec.lang, t, spec.kind))}</text>`);
  const step = compact && n > 6 ? 2 : 1;
  spec.years.forEach((y, i) => {
    if (i % step === 0 || i === n - 1) out.push(`<text x="${r1(X(i))}" y="${h - 8}" text-anchor="middle">${esc(y)}</text>`);
  });
  if (spec.yLabel) out.push(`<text class="axis-title" x="${m.l - 40}" y="14">${esc(spec.yLabel)}</text>`);
  out.push('</g>');
  if (spec.base != null) {
    out.push(`<g class="ref"><line x1="${m.l}" x2="${m.l + pw}" y1="${r1(Y(spec.base))}" y2="${r1(Y(spec.base))}"/></g>`);
  }
  const order = [...spec.series].sort((a, b) => (a.tone === 'accent') - (b.tone === 'accent'));
  const ends = [];
  for (const s of order) {
    const pts = s.values.map((v, i) => (v == null ? null : [X(i), Y(v)]));
    let d = '';
    pts.forEach((p, i) => {
      if (!p) return;
      d += `${d && pts[i - 1] ? 'L' : 'M'}${r1(p[0])},${r1(p[1])}`;
    });
    const tone = s.tone === 'accent' ? 'm-accent' : s.tone === 'cool' ? 'm-cool' : 'm-context';
    out.push(`<path class="line ${tone}" d="${d}"/>`);
    const lastIndex = s.values.map((v, i) => (v == null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
    if (lastIndex >= 0) {
      const [lx, ly] = pts[lastIndex];
      out.push(`<circle class="end ${tone}" cx="${r1(lx)}" cy="${r1(ly)}" r="4"/>`);
      ends.push({ s, x: lx, y: ly, v: s.values[lastIndex] });
    }
  }
  if (endLabels) {
    // разводим подписи концов линий по вертикали, оставляя связь тонкой выноской
    ends.sort((a, b) => a.y - b.y);
    const gap = fs + 4;
    const ys2 = ends.map((e) => e.y);
    for (let i = 1; i < ys2.length; i += 1) if (ys2[i] - ys2[i - 1] < gap) ys2[i] = ys2[i - 1] + gap;
    const overflow = ys2.length ? ys2[ys2.length - 1] - (m.t + ph) : 0;
    if (overflow > 0) for (let i = 0; i < ys2.length; i += 1) ys2[i] -= overflow;
    out.push(`<g class="end-labels" font-size="${fs}">`);
    ends.forEach((e, i) => {
      const ty = ys2[i];
      if (Math.abs(ty - e.y) > 2) out.push(`<line class="leader" x1="${r1(e.x + 6)}" y1="${r1(e.y)}" x2="${r1(e.x + 12)}" y2="${r1(ty)}"/>`);
      out.push(`<text x="${r1(e.x + 14)}" y="${r1(ty + 4)}">${esc(e.s.label)}</text>`);
    });
    out.push('</g>');
  }
  // слой наведения: перекрестие по годам; значения для подсказки — в data-rows
  const rows = spec.years.map((y, i) => ({
    t: String(y),
    r: spec.series.map((s) => [s.label, s.format ? s.format[i] : s.values[i] == null ? '—' : int(spec.lang, s.values[i])]),
  }));
  const xsAttr = spec.years.map((_, i) => r1(X(i))).join(',');
  out.push(`<rect class="hover-layer" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" data-xs="${xsAttr}" data-rows="${esc(JSON.stringify(rows))}"/>`);
  out.push(`<line class="crosshair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" visibility="hidden"/>`);
  out.push('</svg>');
  return out.join('');
}

// ---------- столбцы по годам -----------------------------------------------------------

function roundedTop(x, y, bw, bh, radius = 4) {
  const r = Math.min(radius, bw / 2, bh);
  if (bh <= 0) return '';
  return `M${r1(x)},${r1(y + bh)}V${r1(y + r)}Q${r1(x)},${r1(y)} ${r1(x + r)},${r1(y)}H${r1(x + bw - r)}Q${r1(x + bw)},${r1(y)} ${r1(x + bw)},${r1(y + r)}V${r1(y + bh)}Z`;
}

// spec: { lang, label, items: [{ label, value, tip, tone }], yLabel, valueText: [..] }
export function columns(spec, width = 480) {
  const w = Math.max(260, Math.round(width));
  const compact = w < 420;
  const h = compact ? 190 : 220;
  const m = { l: 40, r: 8, t: 30, b: 26 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const n = spec.items.length;
  const ys = linearScale(spec.items.map((d) => d.value), { ticks: 4 });
  const Y = (v) => ys.map(v, m.t + ph, m.t);
  const band = pw / Math.max(1, n);
  const bw = Math.min(24, band * 0.64);
  const out = [svgOpen(w, h, spec.label, 'chart-columns')];
  out.push('<g class="grid">');
  for (const t of ys.ticks) out.push(`<line x1="${m.l}" x2="${m.l + pw}" y1="${r1(Y(t))}" y2="${r1(Y(t))}"/>`);
  out.push('</g><g class="axis-text">');
  for (const t of ys.ticks) out.push(`<text x="${m.l - 6}" y="${r1(Y(t) + 4)}" text-anchor="end">${esc(tickText(spec.lang, t, spec.kind ?? 'auto'))}</text>`);
  const every = band < 30 ? 2 : 1;
  spec.items.forEach((d, i) => {
    if (i % every === 0 || i === n - 1) out.push(`<text x="${r1(m.l + band * i + band / 2)}" y="${h - 8}" text-anchor="middle">${esc(d.label)}</text>`);
  });
  if (spec.yLabel) out.push(`<text class="axis-title" x="${m.l - 34}" y="14">${esc(spec.yLabel)}</text>`);
  out.push('</g><g class="bars">');
  const maxI = spec.items.reduce((best, d, i) => (d.value > (spec.items[best]?.value ?? -Infinity) ? i : best), 0);
  spec.items.forEach((d, i) => {
    const x = m.l + band * i + (band - bw) / 2;
    const y = Y(d.value ?? 0);
    const tone = d.tone === 'context' ? 'm-context' : d.tone === 'cool' ? 'm-cool' : 'm-accent';
    out.push(`<g class="bar" tabindex="0"${tipAttr(d.tip)} aria-label="${esc(`${d.label}: ${d.valueText ?? d.value}`)}">`);
    out.push(`<rect class="hit" x="${r1(m.l + band * i)}" y="${m.t}" width="${r1(band)}" height="${ph}"/>`);
    out.push(`<path class="${tone}" d="${roundedTop(x, y, bw, m.t + ph - y)}"/>`);
    if (i === n - 1 || i === maxI) {
      out.push(`<text class="value" x="${r1(x + bw / 2)}" y="${r1(y - 6)}" text-anchor="middle">${esc(d.valueText ?? int(spec.lang, d.value))}</text>`);
    }
    out.push('</g>');
  });
  out.push(`</g><line class="baseline" x1="${m.l}" x2="${m.l + pw}" y1="${m.t + ph}" y2="${m.t + ph}"/>`);
  out.push('</svg>');
  return out.join('');
}

// ---------- горизонтальные полосы ----------------------------------------------------------

function roundedRight(x, y, bw, bh, radius = 4) {
  if (bw <= 0) return '';
  const r = Math.min(radius, bh / 2, bw);
  return `M${r1(x)},${r1(y)}H${r1(x + bw - r)}Q${r1(x + bw)},${r1(y)} ${r1(x + bw)},${r1(y + r)}V${r1(y + bh - r)}Q${r1(x + bw)},${r1(y + bh)} ${r1(x + bw - r)},${r1(y + bh)}H${r1(x)}Z`;
}

// spec: { lang, label, items: [{ label, value, valueText, tone, href, tip }], max }
export function hbars(spec, width = 560) {
  const w = Math.max(280, Math.round(width));
  const compact = w < 480;
  const fs = 12.5;
  const rowH = 28;
  const barH = 14;
  const items = spec.items;
  const maxLabel = Math.max(...items.map((d) => textWidth(d.label, fs)), 40);
  const labelW = Math.min(maxLabel + 6, w * (compact ? 0.44 : 0.38));
  const valueW = Math.max(...items.map((d) => textWidth(d.valueText ?? int(spec.lang, d.value), fs)), 20) + 10;
  const x0 = labelW + 10;
  const bwMax = Math.max(40, w - x0 - valueW);
  const max = spec.max ?? Math.max(...items.map((d) => d.value ?? 0), 1);
  const h = items.length * rowH + 6;
  const out = [svgOpen(w, h, spec.label, 'chart-hbars')];
  out.push(`<line class="baseline" x1="${r1(x0)}" x2="${r1(x0)}" y1="2" y2="${h - 2}"/>`);
  items.forEach((d, i) => {
    const y = 4 + i * rowH;
    const bw = Math.max(d.value > 0 ? 2 : 0, ((d.value ?? 0) / max) * bwMax);
    const tone = d.tone === 'context' ? 'm-context' : d.tone === 'cool' ? 'm-cool' : 'm-accent';
    const maxChars = Math.floor(labelW / (fs * CHAR));
    const label = truncate(d.label, Math.max(8, maxChars));
    const open = d.href ? `<a class="bar" href="${esc(d.href)}"${tipAttr(d.tip)}>` : `<g class="bar" tabindex="0"${tipAttr(d.tip)}>`;
    out.push(open);
    out.push(`<rect class="hit" x="0" y="${y}" width="${w}" height="${rowH}"/>`);
    out.push(`<text class="row-label${d.tone === 'accent' && spec.highlightLabels ? ' strong' : ''}" x="${r1(labelW)}" y="${r1(y + rowH / 2 + 4)}" text-anchor="end" font-size="${fs}">${esc(label)}${label !== d.label ? `<title>${esc(d.label)}</title>` : ''}</text>`);
    out.push(`<path class="${tone}" d="${roundedRight(x0 + 1, y + (rowH - barH) / 2, bw, barH)}"/>`);
    out.push(`<text class="value" x="${r1(x0 + bw + 6)}" y="${r1(y + rowH / 2 + 4)}" font-size="${fs}">${esc(d.valueText ?? int(spec.lang, d.value))}</text>`);
    out.push(d.href ? '</a>' : '</g>');
  });
  out.push('</svg>');
  return out.join('');
}

// ---------- малые графики для таблиц и карточек ---------------------------------------------

// Индекс специализации в ячейке таблицы: логарифмическая шкала от 1/8 до 8, центр — 1 (как в мире).
export function divergingBar(value, { w = 72, h = 12 } = {}) {
  const c = w / 2;
  const out = [`<svg class="micro" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">`];
  out.push(`<line class="micro-axis" x1="${c}" x2="${c}" y1="0" y2="${h}"/>`);
  if (value != null && value > 0) {
    const e = Math.max(-3, Math.min(3, Math.log2(value)));
    const len = (Math.abs(e) / 3) * (c - 2);
    const x = e >= 0 ? c + 1 : c - 1 - len;
    out.push(`<rect class="${e >= 0 ? 'm-accent' : 'm-cool'}" x="${r1(x)}" y="2" width="${r1(Math.max(len, 1))}" height="${h - 4}" rx="2"/>`);
  }
  out.push('</svg>');
  return out.join('');
}

// Цитируемость в ячейке: полоса до значения (шкала 0–3), отметка — мировой уровень 1,0.
export function refBar(value, { w = 56, h = 12, max = 3, ref = 1 } = {}) {
  const out = [`<svg class="micro" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">`];
  out.push(`<rect class="micro-track" x="0" y="${h / 2 - 1}" width="${w}" height="2"/>`);
  if (value != null) {
    const len = (Math.min(value, max) / max) * w;
    out.push(`<rect class="${value >= ref ? 'm-accent' : 'm-cool'}" x="0" y="2" width="${r1(Math.max(len, 1))}" height="${h - 4}" rx="2"/>`);
  }
  const rx = (ref / max) * w;
  out.push(`<line class="micro-ref" x1="${r1(rx)}" x2="${r1(rx)}" y1="0" y2="${h}"/>`);
  out.push('</svg>');
  return out.join('');
}

// Спарклайн: ряд по годам, последняя точка — акцентом.
export function sparkline(values, { w = 112, h = 30 } = {}) {
  const vals = values.map((v) => v ?? 0);
  const max = Math.max(1, ...vals);
  const n = vals.length;
  const X = (i) => 2 + (i / Math.max(1, n - 1)) * (w - 6);
  const Y = (v) => h - 3 - (v / max) * (h - 7);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${r1(X(i))},${r1(Y(v))}`).join('');
  return `<svg class="micro spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path class="line m-context" d="${d}"/><circle class="end m-accent" cx="${r1(X(n - 1))}" cy="${r1(Y(vals[n - 1]))}" r="3"/></svg>`;
}

export const RENDERERS = { bubble, lines, columns, hbars };
