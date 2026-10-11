// Раздел «Что развивать» и его следы на других страницах: плашка вывода у компетенции и сводка на главной.
// Данные — model.strategy (src/lib/strategy.mjs).

import { bubble, meter } from '../charts/charts.mjs';
import { esc, figure, legend, bubbleKey, table, cell, text, workItem, tip } from './kit.mjs';
import { hero, section, dataNote } from './pages.mjs';

const TONE = { bet: 'accent', 'develop-quality': 'cool', 'develop-scale': 'cool', maintain: 'context', review: 'context' };
const COMPONENTS = ['position', 'impact', 'market', 'momentum'];

export function verdictTag(ctx, v) {
  return `<span class="tag verdict verdict-${esc(v)}">${esc(ctx.t.decisions.verdict[v])}</span>`;
}

function priorityTag(ctx, r) {
  if (!r.priority?.length) return '';
  return `<span class="tag tag-priority" title="${esc(priorityNames(ctx, r.priority))}">${esc(ctx.t.decisions.priorityTag)}</span>`;
}

function priorityNames(ctx, ids) {
  const byId = new Map((ctx.model.strategy?.priorities ?? []).map((p) => [p.id, p]));
  return ctx.list(ids.map((id) => byId.get(id)?.short?.[ctx.lang] ?? byId.get(id)?.name?.[ctx.lang] ?? id));
}

// Доводы вердикта — короткие фразы из чисел.
export function reasonLines(ctx, r) {
  const d = ctx.t.decisions;
  return r.reasons.map((x) => {
    if (x.k === 'spec') return d.reasonSpec(x.ai >= 1, ctx.dec(x.ai));
    if (x.k === 'impact') return d.reasonImpact(ctx.dec(x.fwci), ctx.pct(x.top10));
    if (x.k === 'market') return d.reasonMarket(x.gw >= x.gt * ctx.model.strategy.config.marketGrowing, ctx.change(x.gw), ctx.change(x.gt));
    if (x.k === 'momentum') return d.reasonMomentum(x.go > x.gw, ctx.change(x.go), ctx.change(x.gw));
    if (x.k === 'priority') return d.reasonPriority(priorityNames(ctx, x.ids));
    return '';
  }).filter(Boolean);
}

function componentList(ctx, r) {
  const d = ctx.t.decisions;
  return `<dl class="meters">${COMPONENTS.map((k) => `<div><dt>${esc(d.components[k])}</dt><dd>${meter(r.components[k])}<span>${esc(r.components[k] == null ? '—' : ctx.dec(r.components[k], 2))}</span></dd></div>`).join('')}</dl>`;
}

function scoreBadge(ctx, score) {
  return `<span class="score" title="${esc(ctx.t.decisions.score)}"><strong>${esc(score == null ? '—' : String(score))}</strong><span>/100</span></span>`;
}

const rateById = (ctx) => new Map((ctx.model.strategy?.competencies ?? []).map((r) => [r.id, r]));

function decisionCard(ctx, r) {
  const d = ctx.t.decisions;
  return `<article class="dcard">
    <div class="dcard-top">${verdictTag(ctx, r.verdict)}${priorityTag(ctx, r)}${scoreBadge(ctx, r.score)}</div>
    <h3 class="dcard-title"><a href="${esc(ctx.page(`competencies/${r.id}/`))}">${esc(ctx.compName(r.id))}</a></h3>
    <ul class="reasons">${reasonLines(ctx, r).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    ${r.unstable ? `<p class="unstable">${esc(d.unstable)}</p>` : ''}
  </article>`;
}

function openCard(ctx, o, i) {
  const d = ctx.t.decisions;
  const { period } = ctx.model.meta;
  return `<article class="dcard dcard-open">
    <div class="dcard-top"><span class="open-num">${esc(String(i + 1))}</span>${o.priority.length ? `<span class="tag tag-priority" title="${esc(priorityNames(ctx, o.priority))}">${esc(d.priorityTag)}</span>` : ''}${scoreBadge(ctx, o.score)}</div>
    <h3 class="dcard-title"><a href="#${esc(`open-${o.id}`)}" lang="en">${esc(o.name)}</a></h3>
    <ul class="reasons">
      <li>${esc(d.openWorld(ctx.int(o.worldP2), ctx.change(o.growth), period.p2))}</li>
      ${o.competency ? `<li>${esc(d.openComp(ctx.compShort(o.competency), o.competencyVerdict ? d.verdict[o.competencyVerdict] : '—'))}</li>` : ''}
    </ul>
    <p class="foundation">${esc(d.foundation)} ${meter(o.foundation.total)}<span>${esc(ctx.dec(o.foundation.total, 2))}</span></p>
  </article>`;
}

function column(ctx, key, cards, empty) {
  const d = ctx.t.decisions;
  return `<div class="dcol dcol-${key}">
    <div class="dcol-head"><h3>${esc(d.columns[key])}</h3><p>${esc(d.columnsLead[key])}</p></div>
    ${cards.length ? cards.join('') : `<p class="muted">${esc(empty)}</p>`}
  </div>`;
}

// Матрица решений: рост мирового потока × сила позиции (√(AI·FWCI)), цвет — вывод.
function matrixSpec(ctx) {
  const d = ctx.t.decisions;
  const { period } = ctx.model.meta;
  const st = ctx.model.strategy;
  const rows = new Map(ctx.model.competencies.map((c) => [c.id, c]));
  const points = st.competencies
    .map((r) => ({ r, c: rows.get(r.id) }))
    .filter(({ c }) => c.growthWorld != null && c.ai > 0 && c.fwci > 0)
    .map(({ r, c }) => {
      const strength = Math.sqrt(c.ai * c.fwci);
      return {
        id: r.id,
        label: ctx.compShort(r.id),
        aria: `${ctx.compName(r.id)}: ${d.verdict[r.verdict]}, ${d.score} ${r.score}`,
        x: c.growthWorld,
        y: strength,
        size: c.n,
        tone: TONE[r.verdict],
        href: ctx.page(`competencies/${r.id}/`),
        tip: tip(ctx.compName(r.id), [
          [d.verdict[r.verdict], ''],
          [String(r.score), d.score],
          [ctx.change(c.growthWorld), ctx.t.metric.growthWorld],
          [ctx.dec(strength), d.strength],
        ]),
      };
    });
  return {
    lang: ctx.lang,
    label: d.matrixAria,
    x: { type: 'linear', ref: st.worldGrowth * st.config.marketGrowing, label: d.matrixX(period.p1, period.p2), short: d.matrixXShort, zero: false, kind: 'change', refLabel: d.matrixXRef },
    y: { type: 'log', ref: 1, label: d.matrixY, refLabel: d.matrixYRef },
    quadrants: d.matrixQuadrants,
    points,
  };
}

function allTable(ctx) {
  const d = ctx.t.decisions;
  const st = ctx.model.strategy;
  return table(
    [
      { key: 'name', label: ctx.t.metric.competency },
      { key: 'v', label: d.verdictCol },
      { key: 's', label: d.score, num: true },
      ...COMPONENTS.map((k) => ({ key: k, label: d.components[k], num: true })),
      { key: 'p', label: d.priorityTag },
    ],
    st.competencies.map((r) => ({
      cells: {
        name: cell(`<a href="${esc(ctx.page(`competencies/${r.id}/`))}">${esc(ctx.compShort(r.id))}</a>${r.unstable ? ` <span class="unstable-mark" title="${esc(d.unstable)}">*</span>` : ''}`, ctx.compShort(r.id)),
        v: cell(verdictTag(ctx, r.verdict), d.verdict[r.verdict]),
        s: cell(esc(String(r.score ?? '—')), r.score),
        ...Object.fromEntries(COMPONENTS.map((k) => [k, cell(`<span class="cell-micro">${meter(r.components[k], { w: 48 })}<span>${esc(r.components[k] == null ? '—' : ctx.dec(r.components[k], 2))}</span></span>`, r.components[k])])),
        p: cell(r.priority.length ? esc(priorityNames(ctx, r.priority)) : '—', r.priority.length),
      },
    })),
    { sortable: true, cls: 'decisions-table' },
  );
}

function openingDetails(ctx, o, i) {
  const d = ctx.t.decisions;
  const { period } = ctx.model.meta;
  const facts = [
    d.openWorld(ctx.int(o.worldP2), ctx.change(o.growth), period.p2),
    d.openOwn(o.n ? ctx.worksN(o.n) : 0),
    d.openSub(ctx.subfieldName(o.subfield), ctx.worksN(o.subfieldN)),
  ];
  if (o.competency) facts.push(d.openComp(ctx.compName(o.competency), o.competencyVerdict ? d.verdict[o.competencyVerdict] : '—'));
  if (o.context?.partners.length) facts.push(d.openPartners(ctx.int(o.context.partners.length)));
  if (o.priority.length) facts.push(d.reasonPriority(priorityNames(ctx, o.priority)));
  const c = o.context;
  let extra = `<p class="notice">${esc(d.noContext)}</p>`;
  if (c) {
    const orgs = c.homeOrgs.length
      ? `<ol class="orgs-list">${c.homeOrgs.map((g) => `<li><span>${esc(g.name)}</span><span class="num">${esc(ctx.int(g.n))}</span>${g.partner ? `<span class="tag tag-partner">${esc(d.partnerMark)}</span>` : ''}</li>`).join('')}</ol>`
      : `<p class="muted">${esc(ctx.t.ui.noData)}</p>`;
    const countries = c.countries.length
      ? `<ul class="chips">${c.countries.map((g) => `<li>${esc(ctx.country(g.code))} <strong>${esc(ctx.int(g.n))}</strong></li>`).join('')}</ul>`
      : `<p class="muted">${esc(ctx.t.ui.noData)}</p>`;
    const world = c.worldOrgs.length
      ? `<ol class="orgs-list">${c.worldOrgs.map((g) => `<li><span>${esc(g.name)}${g.country ? ` <span class="muted">· ${esc(ctx.country(g.country))}</span>` : ''}</span><span class="num">${esc(ctx.int(g.n))}</span>${g.partner ? `<span class="tag tag-partner">${esc(d.partnerMark)}</span>` : ''}</li>`).join('')}</ol>`
      : '';
    const reviews = c.reviews.length ? `<ol class="works">${c.reviews.map((w) => workItem(ctx, w, { source: w.src })).join('')}</ol>` : `<p class="muted">${esc(ctx.t.ui.noData)}</p>`;
    extra = `<details class="opening-more"${i < 2 ? ' open' : ''}><summary>${esc(d.contextToggle)}</summary><div class="opening-grid">
      <div><h4>${esc(d.homeOrgs)}</h4>${orgs}</div>
      <div><h4>${esc(d.leadCountries)}</h4>${countries}${world ? `<h4>${esc(d.worldOrgs)}</h4>${world}` : ''}</div>
      <div><h4>${esc(d.startReviews)}</h4>${reviews}</div>
    </div></details>`;
  }
  return `<article class="opening" id="${esc(`open-${o.id}`)}">
    <header class="opening-head">
      <span class="open-num">${esc(String(i + 1))}</span>
      <h3><a href="https://openalex.org/${esc(o.id)}" rel="noopener" lang="en">${esc(o.name)}</a></h3>
      ${scoreBadge(ctx, o.score)}
    </header>
    <ul class="reasons">${facts.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    <p class="foundation">${esc(d.foundation)} ${meter(o.foundation.total)}<span>${esc(ctx.dec(o.foundation.total, 2))}</span></p>
    ${extra}
  </article>`;
}

export function decisionsPage(ctx) {
  const { t, model } = ctx;
  const d = t.decisions;
  const st = model.strategy;
  const { period } = model.meta;
  const rates = rateById(ctx);
  const ids = (v) => st.byVerdict[v] ?? [];
  const cards = (list) => list.map((id) => decisionCard(ctx, rates.get(id)));
  const develop = [...ids('develop-quality'), ...ids('develop-scale')].sort((a, b) => rates.get(b).score - rates.get(a).score);

  const columns = `<div class="dcols">
    ${column(ctx, 'bet', cards(ids('bet')), d.noneVerdict)}
    ${column(ctx, 'develop', cards(develop), d.noneVerdict)}
    ${column(ctx, 'open', st.openings.open.slice(0, 5).map((o, i) => openCard(ctx, o, i)), d.noneOpen)}
  </div>`;

  const spec = matrixSpec(ctx);
  const matrix = figure(ctx, {
    id: 'decision-matrix',
    type: 'bubble',
    spec,
    svg: bubble(spec, 1160),
    legend: legend([
      { label: d.legend.bet, tone: 'm-accent', kind: 'rect' },
      { label: d.legend.develop, tone: 'm-cool', kind: 'rect' },
      { label: d.legend.other, tone: 'm-context', kind: 'rect' },
    ]),
    after: bubbleKey(spec),
    table: table(
      [{ key: 'name', label: t.metric.competency }, { key: 'v', label: d.verdictCol }, { key: 'gw', label: t.metric.growthWorld, num: true }, { key: 'y', label: d.strength, num: true }, { key: 'n', label: t.metric.works, num: true }],
      spec.points.map((p) => ({ cells: { name: text(ctx.compName(p.id)), v: text(d.verdict[rates.get(p.id).verdict]), gw: cell(ctx.change(p.x), p.x), y: cell(ctx.dec(p.y), p.y), n: cell(ctx.int(p.size), p.size) } })),
      { sortable: true },
    ),
    wide: true,
  });

  const s = st.config;
  const openings = st.openings.open.length
    ? st.openings.open.map((o, i) => openingDetails(ctx, o, i)).join('')
    : `<p class="muted">${esc(d.noneOpen)}</p>`;
  const newTeam = st.openings.newTeam.length
    ? `<h3>${esc(d.newTeamTitle)}</h3><p class="side-note">${esc(d.newTeamLead)}</p><ul class="spots">${st.openings.newTeam.map((x) => `<li><a href="https://openalex.org/${esc(x.id)}" rel="noopener" lang="en">${esc(x.name)}</a><span>${esc([x.competency ? ctx.compShort(x.competency) : '', t.trends.worldVolume(ctx.int(x.worldP2), period.p2)].filter(Boolean).join(' · '))}</span><strong>${esc(ctx.change(x.growth))}</strong></li>`).join('')}</ul>`
    : '';

  const restGroups = ['maintain', 'review'].map((v) => `<div class="rest-group"><p class="quad-head">${verdictTag(ctx, v)}<span class="quad-count">${esc(String(ids(v).length))}</span></p><p class="quad-desc">${esc(d.verdictText[v])}</p>${ids(v).length ? `<ul class="quad-list">${ids(v).map((id) => `<li><a href="${esc(ctx.page(`competencies/${id}/`))}">${esc(ctx.compShort(id))}</a></li>`).join('')}</ul>` : `<p class="muted quad-empty">${esc(d.noneVerdict)}</p>`}</div>`).join('');

  const method = `<dl class="defs">${d.method(
    Object.fromEntries(Object.entries(s.weights).map(([k, v]) => [k, ctx.dec(v, 2)])),
    {
      bonus: ctx.int(Math.round(s.priorityBonus * 100)),
      fwci: ctx.dec(s.impact.fwci, 1),
      top10: ctx.pct(s.impact.top10, 0),
      minWorks: ctx.int(s.minWorks),
      minFwci: ctx.int(s.minFwciWorks),
      mult: ctx.dec(s.open.priorityMultiplier, 1),
      minFoundation: ctx.dec(s.open.minFoundation, 2),
    },
  ).map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>`;

  const priorities = st.priorities.length ? `<ul class="priorities">${st.priorities.map((p) => `<li>
      <p class="priority-name">${esc(p.name[ctx.lang])}</p>
      <p class="priority-note">${esc(p.note[ctx.lang])}</p>
      <p class="priority-source"><a href="${esc(p.url)}" rel="noopener">${esc(p.source[ctx.lang])}</a></p>
      <p class="priority-comps"><span class="muted">${esc(d.prioritiesCompetencies)}:</span> ${p.competencies.map((id) => `<a href="${esc(ctx.page(`competencies/${id}/`))}">${esc(ctx.compShort(id))}</a>`).join(', ')}</p>
    </li>`).join('')}</ul>` : '';

  return [
    hero(ctx, { eyebrow: t.site.university, title: d.title, lead: d.lead, extra: `${dataNote(ctx)}<p class="notice disclaimer">${esc(d.disclaimer)}</p>` }),
    section('summary', d.summaryTitle, '', columns, { cls: 'section-decisions' }),
    section('matrix', d.matrixTitle, d.matrixLead, matrix),
    section('open', d.openTitle, d.openLead(ctx.int(s.open.maxOwnWorks), ctx.change(model.meta.thresholds.trendFastGrowth), period.p1, period.p2), `${openings}${newTeam}`),
    section('rest', d.restTitle, d.restLead, `<div class="rest-grid">${restGroups}</div><h3>${esc(d.allTitle)}</h3>${allTable(ctx)}`),
    section('method-decisions', d.methodTitle, '', method),
    priorities ? section('priorities', d.prioritiesTitle, d.prioritiesLead, priorities) : '',
  ].join('\n');
}

// Плашка вывода на странице компетенции.
export function verdictBox(ctx, id) {
  const r = rateById(ctx).get(id);
  if (!r) return '';
  const d = ctx.t.decisions;
  return `<section class="verdict-box" aria-label="${esc(d.competencyTitle)}">
    <div class="verdict-head"><span class="verdict-label">${esc(d.competencyTitle)}</span>${verdictTag(ctx, r.verdict)}${priorityTag(ctx, r)}${scoreBadge(ctx, r.score)}</div>
    <p class="verdict-text">${esc(d.verdictText[r.verdict])}</p>
    <ul class="reasons">${reasonLines(ctx, r).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
    ${r.unstable ? `<p class="unstable">${esc(d.unstable)}</p>` : ''}
    ${componentList(ctx, r)}
    <a class="text-link" href="${esc(ctx.page('decisions/#method-decisions'))}">${esc(d.competencyMore)}</a>
  </section>`;
}

// Сводка на главной: по три пункта в каждой колонке.
export function homeDecisions(ctx) {
  const st = ctx.model.strategy;
  if (!st) return '';
  const d = ctx.t.decisions;
  const rates = rateById(ctx);
  const ids = (v) => st.byVerdict[v] ?? [];
  const develop = [...ids('develop-quality'), ...ids('develop-scale')].sort((a, b) => rates.get(b).score - rates.get(a).score);
  const item = (id) => `<li><a href="${esc(ctx.page(`competencies/${id}/`))}">${esc(ctx.compName(id))}</a>${verdictTag(ctx, rates.get(id).verdict)}</li>`;
  const list = (arr, render) => (arr.length
    ? `<ul class="home-dlist">${arr.slice(0, 3).map(render).join('')}</ul>${arr.length > 3 ? `<p class="muted more">${esc(d.andMore(arr.length - 3))}</p>` : ''}`
    : `<p class="muted">${esc(d.noneVerdict)}</p>`);
  const open = st.openings.open;
  const col = (key, body) => `<div class="dcol dcol-${key}"><div class="dcol-head"><h3>${esc(d.columns[key])}</h3><p>${esc(d.columnsLead[key])}</p></div>${body}</div>`;
  return `<div class="dcols dcols-home">
    ${col('bet', list(ids('bet'), item))}
    ${col('develop', list(develop, item))}
    ${col('open', list(open, (o) => `<li><a href="${esc(ctx.page(`decisions/#open-${o.id}`))}" lang="en">${esc(o.name)}</a><span class="muted">${esc(ctx.change(o.growth))}</span></li>`))}
  </div>
  <a class="text-link" href="${esc(ctx.page('decisions/'))}">${esc(d.homeMore)}</a>`;
}
