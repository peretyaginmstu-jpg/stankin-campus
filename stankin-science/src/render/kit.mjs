// Общие детали страниц: контекст языка, адреса, форматирование, повторяющиеся блоки.

import { STRINGS, listJoin } from '../../content/i18n.mjs';
import { esc, truncate } from '../lib/text.mjs';
import * as F from '../lib/format.mjs';
import { tipAttr, bubbleNumbers } from '../charts/charts.mjs';

export { esc };

// Адрес страницы относительно корня сайта: '' (главная), 'competencies/', 'competencies/machining/'.
export function langPrefix(lang) {
  return lang === 'ru' ? '' : `${lang}/`;
}

// Относительная ссылка со страницы `fromDir` (каталог от корня сайта) на `target` (путь от корня).
export function rel(fromDir, target) {
  const depth = fromDir.split('/').filter(Boolean).length;
  const out = '../'.repeat(depth) + target;
  return out || './';
}

export function makeContext({ lang, model, competencies, taxonomyRu, route, pageDir, site, institution }) {
  const t = STRINGS[lang];
  const prefix = langPrefix(lang);
  const compById = new Map(competencies.map((c) => [c.id, c]));
  const ctx = {
    lang,
    t,
    model,
    site,
    institution,
    route,
    pageDir,
    prefix,
    // ссылка на страницу того же языка: page('competencies/')
    page: (path) => rel(pageDir, prefix + path),
    // ссылка на общий ресурс: asset('assets/css/site.css')
    asset: (path) => rel(pageDir, path),
    int: (v) => F.int(lang, v),
    dec: (v, d) => F.dec(lang, v, d),
    pct: (v, d) => F.pct(lang, v, d),
    share: (v) => F.share(lang, v),
    change: (v) => F.change(lang, v),
    compact: (v) => F.compact(lang, v),
    date: (v) => F.date(lang, v),
    country: (code) => F.country(lang, code),
    plural: (n, forms) => F.plural(lang, n, forms),
    list: (items) => listJoin(lang, items),
    comp: (id) => compById.get(id),
    compName: (id) => compById.get(id)?.name[lang] ?? id,
    compShort: (id) => compById.get(id)?.short[lang] ?? id,
    subfieldName: (id, fallback) => (lang === 'ru' ? taxonomyRu.SUBFIELDS?.[id]?.ru : taxonomyRu.SUBFIELDS?.[id]?.en) ?? model.taxonomyNames?.subfields?.[id] ?? fallback ?? String(id),
    fieldName: (id, fallback) => (lang === 'ru' ? taxonomyRu.FIELDS?.[id]?.ru : taxonomyRu.FIELDS?.[id]?.en) ?? model.taxonomyNames?.fields?.[id] ?? fallback ?? String(id),
    worksWord: (n) => (lang === 'ru' ? F.plural('ru', n, ['публикация', 'публикации', 'публикаций']) : n === 1 ? 'publication' : 'publications'),
  };
  ctx.worksN = (n) => `${ctx.int(n)} ${ctx.worksWord(n)}`;
  return ctx;
}

// ---------- блоки ------------------------------------------------------------------------

export function kpis(items) {
  return `<dl class="kpis">${items.map((k) => `<div class="kpi"><dt>${esc(k.label)}</dt><dd class="kpi-value">${esc(k.value)}</dd>${k.note ? `<dd class="kpi-note">${esc(k.note)}</dd>` : ''}</div>`).join('')}</dl>`;
}

// Фигура с графиком: SVG собран при сборке; спецификация лежит рядом, браузер перерисует график
// под ширину блока. Таблица данных — в раскрывающемся блоке, без JavaScript.
export function figure(ctx, { id, type, spec, svg, title, note, table, wide = false, legend = '', after = '' }) {
  return `<figure class="chart${wide ? ' chart-wide' : ''}" data-chart="${esc(type)}" id="${esc(id)}">
  ${title ? `<figcaption class="chart-head"><span class="chart-title">${esc(title)}</span>${note ? `<span class="chart-note">${esc(note)}</span>` : ''}</figcaption>` : ''}
  ${legend}
  <div class="chart-body">${svg}</div>
  ${after}
  <script type="application/json" class="chart-spec">${jsonForScript(spec)}</script>
  ${table ? `<details class="chart-table"><summary>${esc(ctx.t.ui.table)}</summary>${table}</details>` : ''}
</figure>`;
}

// JSON внутри <script>: экранируем «<», чтобы строка из данных не закрыла тег.
export function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

// Легенда для графиков с несколькими рядами: короткий штрих цвета ряда + подпись чернилами.
// Список названий к узкой версии пузырьковой диаграммы: номер на графике — название со ссылкой.
export function bubbleKey(spec) {
  const nums = bubbleNumbers(spec.points);
  const items = spec.points.filter((p) => nums.has(p.id)).sort((a, b) => nums.get(a.id) - nums.get(b.id));
  return `<ol class="bubble-key">${items.map((p) => `<li><span class="key-num" aria-hidden="true">${nums.get(p.id)}</span>${p.href ? `<a href="${esc(p.href)}">${esc(p.label)}</a>` : esc(p.label)}</li>`).join('')}</ol>`;
}

export function legend(items) {
  return `<ul class="legend">${items.map((i) => `<li><span class="key key-${esc(i.kind ?? 'line')} ${esc(i.tone)}" aria-hidden="true"></span>${esc(i.label)}</li>`).join('')}</ul>`;
}

// Таблица. columns: [{ key, label, num, sort, cls }]; rows: [{ cells: { key: { html, v } } }]
export function table(columns, rows, { sortable = false, caption = '', cls = '' } = {}) {
  const head = columns.map((c) => {
    const label = esc(c.label);
    const inner = sortable && c.sort !== false
      ? `<button type="button" class="sort" data-key="${esc(c.key)}">${label}<span class="sort-mark" aria-hidden="true"></span></button>`
      : label;
    return `<th scope="col"${c.num ? ' class="num"' : ''}${c.title ? ` title="${esc(c.title)}"` : ''}>${inner}</th>`;
  }).join('');
  const body = rows.map((r) => `<tr${r.cls ? ` class="${esc(r.cls)}"` : ''}>${columns.map((c, i) => {
    const cell = r.cells[c.key] ?? { html: '' };
    const tag = i === 0 && !c.num ? 'th scope="row"' : 'td';
    const close = i === 0 && !c.num ? 'th' : 'td';
    const v = cell.v == null ? '' : ` data-v="${esc(cell.v)}"`;
    return `<${tag}${c.num ? ' class="num"' : ''}${v}>${cell.html ?? ''}</${close}>`;
  }).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table class="data${sortable ? ' sortable' : ''}${cls ? ` ${cls}` : ''}">${caption ? `<caption>${esc(caption)}</caption>` : ''}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export const cell = (html, v) => ({ html, v });
export const text = (s, v) => ({ html: esc(s), v: v ?? s });

// Публикация в списке: название (ссылка на DOI или OpenAlex), авторы, источник, год, цитирования.
export function workItem(ctx, w, { source } = {}) {
  const href = w.doi ? `https://doi.org/${w.doi}` : `https://openalex.org/${w.id}`;
  const authors = (w.a ?? []).join(', ') + ((w.na ?? 0) > (w.a?.length ?? 0) ? ` ${ctx.t.ui.authorsEtAl}` : '');
  const meta = [authors, source, w.y].filter(Boolean).map(esc).join(' · ');
  const facts = [ctx.t.ui.cited(ctx.int(w.c))];
  if (w.fw != null) facts.push(`FWCI ${ctx.dec(w.fw)}`);
  const lang = w.lang === 'en' || w.lang === 'ru' ? ` lang="${w.lang}"` : '';
  return `<li class="work"><a class="work-title" href="${esc(href)}" rel="noopener"${lang}>${esc(truncate(w.t, 220))}</a><span class="work-meta">${meta}</span><span class="work-facts">${esc(facts.join(' · '))}</span></li>`;
}

export function rankText(ctx, r) {
  if (!r) return '—';
  return r.exact ? ctx.t.ui.rank(r.rank) : ctx.t.ui.rankOutside(r.listed);
}

export function quadrantTag(ctx, q) {
  if (!q) return '';
  return `<span class="tag tag-${esc(q)}">${esc(ctx.t.quadrant[q])}</span>`;
}

export function tip(title, rows) {
  return { t: title, r: rows };
}

export { tipAttr, truncate };
