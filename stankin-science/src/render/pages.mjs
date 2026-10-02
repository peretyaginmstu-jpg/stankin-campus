// Содержимое страниц. Каждая функция получает контекст языка (kit.makeContext) и возвращает HTML <main>.

import { bubble, lines, columns, hbars, divergingBar, refBar, sparkline } from '../charts/charts.mjs';
import { esc, kpis, figure, legend, bubbleKey, table, cell, text, workItem, rankText, quadrantTag, tip } from './kit.mjs';
import { homeDecisions, verdictBox } from './decisions.mjs';

const visibleOf = (model) => model.competencies.filter((c) => c.visible);

export function hero(ctx, { eyebrow, crumb = '', title, lead, extra = '' }) {
  return `<section class="hero">
  <div class="wrap">
    ${crumb}${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1>${esc(title)}</h1>
    ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
    ${extra}
  </div>
</section>`;
}

export function section(id, title, lead, body, { cls = '' } = {}) {
  return `<section class="section${cls ? ` ${cls}` : ''}" id="${esc(id)}" aria-labelledby="${esc(id)}-title">
  <div class="wrap">
    <div class="section-head">
      <h2 id="${esc(id)}-title">${esc(title)}</h2>
      ${lead ? `<p class="section-lead">${esc(lead)}</p>` : ''}
    </div>
    ${body}
  </div>
</section>`;
}

export function dataNote(ctx, { methodLink = true } = {}) {
  const m = ctx.model.meta;
  const parts = [];
  if (m.fetchedAt) parts.push(esc(ctx.t.ui.dataAsOf(ctx.date(m.fetchedAt))));
  if (methodLink) parts.push(`<a href="${esc(ctx.page('method/'))}">${esc(ctx.t.nav.method)}</a>`);
  return `<p class="data-note">${parts.join(' · ')}</p>`;
}

// ---------- карта компетенций ---------------------------------------------------------------

export function competencyMapSpec(ctx) {
  const { t } = ctx;
  const points = visibleOf(ctx.model).filter((c) => c.ai != null && c.fwci != null).map((c) => ({
    id: c.id,
    label: ctx.compShort(c.id),
    aria: `${ctx.compName(c.id)}: ${t.metric.aiShort} ${ctx.dec(c.ai)}, FWCI ${ctx.dec(c.fwci)}, ${ctx.worksN(c.n)}`,
    x: c.ai,
    y: c.fwci,
    size: c.n,
    href: ctx.page(`competencies/${c.id}/`),
    tip: tip(ctx.compName(c.id), [
      [ctx.dec(c.ai), t.metric.aiShort],
      [ctx.dec(c.fwci), 'FWCI'],
      [ctx.pct(c.top10), t.metric.top10Short],
      [ctx.int(c.n), t.metric.works],
    ]),
  }));
  return {
    lang: ctx.lang,
    label: t.home.mapAria,
    x: { type: 'log', ref: 1, label: t.home.mapX, short: t.home.mapXShort, refLabel: t.home.mapXRef },
    y: { type: 'linear', ref: 1, label: t.home.mapY, zero: true, refLabel: t.home.mapYRef },
    quadrants: { tl: t.quadrant.niche, tr: t.quadrant.leader, bl: t.quadrant.background, br: t.quadrant.specialized },
    points,
  };
}

function competencyTable(ctx, rows, { sortable = true, compactCols = false } = {}) {
  const { t } = ctx;
  const cols = [
    { key: 'name', label: t.metric.competency },
    { key: 'n', label: t.metric.works, num: true },
    { key: 'share', label: t.metric.shareShort, num: true },
    { key: 'ai', label: t.metric.aiShort, num: true, title: t.metric.aiNote },
    { key: 'fwci', label: 'FWCI', num: true, title: t.metric.fwciNote },
    { key: 'top10', label: t.metric.top10Short, num: true, title: t.metric.top10Note },
  ];
  if (!compactCols) {
    cols.push(
      { key: 'growthOwn', label: t.metric.growthOwn, num: true },
      { key: 'growthWorld', label: t.metric.growthWorld, num: true },
      { key: 'rankHome', label: t.metric.rankHome, num: true },
      { key: 'rankWorld', label: t.metric.rankWorld, num: true },
    );
  }
  const body = rows.map((c) => ({
    cells: {
      name: cell(`<a href="${esc(ctx.page(`competencies/${c.id}/`))}" title="${esc(ctx.compName(c.id))}">${esc(ctx.compShort(c.id))}</a>`, ctx.compShort(c.id)),
      n: cell(ctx.int(c.n), c.n),
      share: cell(ctx.share(c.share), c.share),
      ai: cell(`<span class="cell-micro">${divergingBar(c.ai)}<span>${ctx.dec(c.ai)}</span></span>`, c.ai),
      fwci: cell(`<span class="cell-micro">${refBar(c.fwci)}<span>${ctx.dec(c.fwci)}</span></span>`, c.fwci),
      top10: cell(ctx.pct(c.top10), c.top10),
      growthOwn: cell(ctx.change(c.growthOwn), c.growthOwn),
      growthWorld: cell(ctx.change(c.growthWorld), c.growthWorld),
      rankHome: cell(esc(rankText(ctx, c.rankHome)), c.rankHome?.exact ? c.rankHome.rank : 9999),
      rankWorld: cell(esc(rankText(ctx, c.rankWorld)), c.rankWorld?.exact ? c.rankWorld.rank : 9999),
    },
  }));
  return table(cols, body, { sortable });
}

// Квадранты карты: описание и список компетенций в каждом — вместо отдельной легенды и вывода.
function quadrantGrid(ctx) {
  const { t } = ctx;
  const vis = visibleOf(ctx.model);
  const order = { leader: (a, b) => b.ai - a.ai, specialized: (a, b) => b.n - a.n, niche: (a, b) => b.fwci - a.fwci, background: (a, b) => b.n - a.n };
  return `<div class="quad-grid">${['leader', 'specialized', 'niche', 'background'].map((q) => {
    const list = vis.filter((c) => c.quadrant === q).sort(order[q]);
    const items = list.length
      ? `<ul class="quad-list">${list.map((c) => `<li><a href="${esc(ctx.page(`competencies/${c.id}/`))}">${esc(ctx.compShort(c.id))}</a></li>`).join('')}</ul>`
      : `<p class="muted quad-empty">${esc(t.ui.noneInQuadrant)}</p>`;
    return `<div class="quad quad-${q}"><p class="quad-head"><span class="tag tag-${q}">${esc(t.quadrant[q])}</span><span class="quad-count">${esc(String(list.length))}</span></p><p class="quad-desc">${esc(t.quadrantText[q])}</p>${items}</div>`;
  }).join('')}</div>`;
}

function competencyCards(ctx) {
  const { t } = ctx;
  const vis = [...visibleOf(ctx.model)].sort((a, b) => (b.ai ?? 0) - (a.ai ?? 0));
  return `<div class="cards">${vis.map((c) => `<article class="card">
    <div class="card-top">${quadrantTag(ctx, c.quadrant)}</div>
    <h3 class="card-title"><a href="${esc(ctx.page(`competencies/${c.id}/`))}">${esc(ctx.compName(c.id))}</a></h3>
    <dl class="card-metrics">
      <div><dt>${esc(t.metric.works)}</dt><dd>${esc(ctx.int(c.n))}</dd></div>
      <div><dt>${esc(t.metric.aiShort)}</dt><dd>${esc(ctx.dec(c.ai))}</dd></div>
      <div><dt>FWCI</dt><dd>${esc(ctx.dec(c.fwci))}</dd></div>
    </dl>
    <div class="card-spark">${sparkline(c.byYear.map((y) => y.n))}<span>${esc(`${ctx.model.meta.period.from}–${ctx.model.meta.period.to}`)}</span></div>
  </article>`).join('')}</div>`;
}

// ---------- главная ----------------------------------------------------------------------

export function homePage(ctx) {
  const { t, model } = ctx;
  const m = model.totals;
  const { period } = model.meta;
  const tiles = kpis([
    { label: t.metric.worksPeriod(period.from, period.to), value: ctx.int(m.n), note: `${ctx.change(m.growthOwn)} · ${t.metric.growthNote(period.p1, period.p2)}` },
    { label: t.metric.fwciLong, value: ctx.dec(m.fwci), note: t.metric.fwciNote },
    { label: t.metric.top10, value: ctx.pct(m.top10), note: t.metric.top10Note },
    { label: t.metric.intl, value: ctx.pct(m.intl), note: `${t.metric.countries}: ${ctx.int(m.countries)}` },
    { label: t.metric.lead, value: ctx.pct(m.lead), note: t.metric.leadNote },
    { label: t.metric.citations, value: ctx.int(m.citations), note: t.metric.citationsNote },
  ]);

  const mapSpec = competencyMapSpec(ctx);
  const vis = visibleOf(model);
  const map = figure(ctx, {
    id: 'competency-map',
    type: 'bubble',
    spec: mapSpec,
    svg: bubble(mapSpec, 1160),
    after: bubbleKey(mapSpec),
    table: competencyTable(ctx, [...vis].sort((a, b) => (b.ai ?? 0) - (a.ai ?? 0)), { sortable: true, compactCols: true }),
    wide: true,
  });

  // Динамика: индекс к первому году
  const first = m.byYear.find((y) => y.n > 0) ?? m.byYear[0];
  const idx = (v, base) => (v == null || !base ? null : Math.round((v / base) * 1000) / 10);
  const years = m.byYear.map((y) => y.year);
  const ownIdx = m.byYear.map((y) => idx(y.n, first.n));
  const worldIdx = m.byYear.map((y) => idx(y.world, first.world));
  const linesSpec = {
    lang: ctx.lang,
    label: t.home.dynamicsAria,
    years,
    base: 100,
    ticks: 6,
    series: [
      { key: 'world', label: t.metric.worldWorks, values: worldIdx, tone: 'context', format: worldIdx.map((v) => ctx.dec(v, 0)) },
      { key: 'own', label: t.site.universityShort, values: ownIdx, tone: 'accent', format: ownIdx.map((v) => ctx.dec(v, 0)) },
    ],
  };
  const dynTable = table(
    [{ key: 'year', label: t.metric.year }, { key: 'n', label: t.metric.works, num: true }, { key: 'ni', label: t.home.dynamicsIndex(first.year), num: true }, { key: 'w', label: t.metric.worldWorks, num: true }, { key: 'wi', label: t.home.dynamicsIndex(first.year), num: true }],
    m.byYear.map((y, i) => ({ cells: { year: text(String(y.year)), n: cell(ctx.int(y.n), y.n), ni: cell(ctx.dec(ownIdx[i], 0)), w: cell(ctx.int(y.world), y.world), wi: cell(ctx.dec(worldIdx[i], 0)) } })),
  );
  const dynamics = figure(ctx, {
    id: 'dynamics',
    type: 'lines',
    spec: linesSpec,
    svg: lines(linesSpec, 720),
    title: t.home.dynamicsIndex(first.year),
    legend: legend([{ label: t.site.universityShort, tone: 'm-accent' }, { label: t.metric.worldWorks, tone: 'm-context' }]),
    table: dynTable,
  });
  const colSpec = {
    lang: ctx.lang,
    label: t.home.perYear,
    items: m.byYear.map((y) => ({ label: String(y.year), value: y.n, valueText: ctx.int(y.n), tip: tip(String(y.year), [[ctx.int(y.n), t.metric.works], [ctx.pct(y.intl), t.metric.intl]]) })),
  };
  const perYear = figure(ctx, { id: 'per-year', type: 'columns', spec: colSpec, svg: columns(colSpec, 480), title: t.home.perYear });

  // Источники
  const kinds = Object.entries(model.venues.byKind);
  const kindNames = ctx.lang === 'ru'
    ? { journal: 'Журналы', conference: 'Конференции', 'book series': 'Книжные серии', repository: 'Репозитории', ebook: 'Книги', 'ebook platform': 'Книги', none: 'Источник не указан', other: 'Другие' }
    : { journal: 'Journals', conference: 'Conferences', 'book series': 'Book series', repository: 'Repositories', ebook: 'Books', 'ebook platform': 'Books', none: 'Source not recorded', other: 'Other' };
  const kindList = `<ul class="kinds">${kinds.map(([k, n]) => `<li><span>${esc(kindNames[k] ?? k)}</span><strong>${esc(ctx.pct(n / m.n, 0))}</strong></li>`).join('')}</ul>
    <p class="side-title side-title-next">${esc(t.home.venuesAccess)}</p>
    <ul class="kinds"><li><span>${esc(t.metric.oa)}</span><strong>${esc(ctx.pct(m.oa, 0))}</strong></li>
    <li><span>${esc(t.metric.english)}</span><strong>${esc(ctx.pct(model.venues.english, 0))}</strong></li></ul>`;
  const venueSpec = {
    lang: ctx.lang,
    label: t.home.venuesTitle,
    items: model.venues.top.slice(0, 10).map((v) => ({ label: v.name, value: v.n, valueText: ctx.int(v.n), tip: tip(v.name, [[ctx.int(v.n), t.metric.works], [ctx.pct(v.share), ctx.lang === 'ru' ? 'от всех публикаций' : 'of all publications']]) })),
  };
  const venues = figure(ctx, { id: 'venues', type: 'hbars', spec: venueSpec, svg: hbars(venueSpec, 720) });

  // Сотрудничество
  const cSpec = {
    lang: ctx.lang,
    label: t.home.collabTitle,
    items: model.collaboration.countries.slice(0, 10).map((c) => ({ label: ctx.country(c.code), value: c.n, valueText: ctx.int(c.n), tip: tip(ctx.country(c.code), [[ctx.int(c.n), t.collaboration.jointWorks], [ctx.pct(c.share), ctx.lang === 'ru' ? 'от всех публикаций' : 'of all publications']]) })),
  };
  const collab = figure(ctx, { id: 'countries', type: 'hbars', spec: cSpec, svg: hbars(cSpec, 720) });

  const read = `<dl class="defs">${t.home.read.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
    <p><a class="text-link" href="${esc(ctx.page('method/'))}">${esc(t.home.readMore)}</a></p>`;

  return [
    hero(ctx, {
      eyebrow: t.home.eyebrow(period.from, period.to),
      title: t.home.title,
      lead: t.home.lead,
      extra: `${dataNote(ctx)}${tiles}`,
    }),
    section('map', t.home.mapTitle, t.home.mapLead, `${map}${quadrantGrid(ctx)}`),
    model.strategy ? section('decisions-summary', t.decisions.homeTitle, t.decisions.homeLead, homeDecisions(ctx)) : '',
    section('cards', t.home.cardsTitle, t.home.cardsLead(model.meta.thresholds.competencyMinWorks), competencyCards(ctx)),
    section('dynamics-section', t.home.dynamicsTitle, t.home.dynamicsLead(ctx.change(m.growthOwn), ctx.change(m.growthWorld), period.p1, period.p2), `<div class="grid-2">${dynamics}${perYear}</div>`),
    section('venues-section', t.home.venuesTitle, t.home.venuesLead, `<div class="grid-side">${venues}<div class="side-box"><p class="side-title">${esc(t.home.venuesKinds)}</p>${kindList}</div></div>`),
    section('collab-section', t.home.collabTitle, t.home.collabLead, `<div class="grid-side">${collab}<div class="side-box">
      <ul class="side-stats">
        <li><strong>${esc(ctx.pct(m.intl))}</strong><span>${esc(t.metric.intl)}</span></li>
        <li><strong>${esc(ctx.int(m.countries))}</strong><span>${esc(t.metric.countries)}</span></li>
        <li><strong>${esc(ctx.pct(model.collaboration.homePartnerShare))}</strong><span>${esc(t.metric.homePartner)}</span></li>
        <li><strong>${esc(ctx.pct(model.collaboration.companyShare))}</strong><span>${esc(t.metric.company)}</span></li>
      </ul>
      <a class="text-link" href="${esc(ctx.page('collaboration/'))}">${esc(t.home.collabMore)}</a></div></div>`),
    section('read', t.home.readTitle, '', read),
    section('about', t.home.aboutTitle, '', `<p class="about-text">${esc(t.home.about)}</p>
      <p class="about-links"><a class="text-link" href="${esc(ctx.site.campusUrl)}${ctx.lang === 'ru' ? '' : `${ctx.lang}/`}" rel="noopener">${esc(t.home.aboutCampus)}</a>
      <a class="text-link" href="${esc(ctx.site.universityUrl[ctx.lang] ?? ctx.site.universityUrl.ru)}" rel="noopener">${esc(t.home.aboutUniversity)}</a></p>`),
  ].join('\n');
}

// ---------- компетенции: список и карта направлений ----------------------------------------

export function competenciesPage(ctx) {
  const { t, model } = ctx;
  const vis = [...visibleOf(model)].sort((a, b) => b.n - a.n);
  const min = model.meta.thresholds.subfieldMinWorks;
  const subRows = model.subfields.filter((s) => s.n >= min);
  const subTable = table(
    [
      { key: 'name', label: t.metric.subfield },
      { key: 'field', label: t.metric.field },
      { key: 'n', label: t.metric.works, num: true },
      { key: 'share', label: t.metric.shareShort, num: true },
      { key: 'ai', label: t.metric.aiShort, num: true },
      { key: 'fwci', label: 'FWCI', num: true },
      { key: 'top10', label: t.metric.top10Short, num: true },
    ],
    subRows.map((s) => ({
      cells: {
        name: text(ctx.subfieldName(s.id)),
        field: text(ctx.fieldName(s.field)),
        n: cell(ctx.int(s.n), s.n),
        share: cell(ctx.share(s.share), s.share),
        ai: cell(`<span class="cell-micro">${divergingBar(s.ai)}<span>${ctx.dec(s.ai)}</span></span>`, s.ai),
        fwci: cell(`<span class="cell-micro">${refBar(s.fwci)}<span>${ctx.dec(s.fwci)}</span></span>`, s.fwci),
        top10: cell(ctx.pct(s.top10), s.top10),
      },
    })),
    { sortable: true },
  );
  return [
    hero(ctx, { eyebrow: t.site.university, title: t.competencies.title, lead: t.competencies.lead(vis.length), extra: dataNote(ctx) }),
    section('compare', t.competencies.tableTitle, t.competencies.hidden(model.meta.thresholds.competencyMinWorks), competencyTable(ctx, vis)),
    section('subfields', t.competencies.mapTitle, t.competencies.mapLead(min), subTable),
  ].join('\n');
}

// ---------- страница компетенции ----------------------------------------------------------

export function competencyPage(ctx, c, { prev, next }) {
  const { t, model } = ctx;
  const { period } = model.meta;
  const def = ctx.comp(c.id);
  const ownName = t.competency.ownRow;

  const tiles = kpis([
    { label: t.metric.worksPeriod(period.from, period.to), value: ctx.int(c.n), note: `${ctx.change(c.growthOwn)} · ${t.metric.growthNote(period.p1, period.p2)}` },
    { label: t.metric.share, value: ctx.share(c.share), note: `${t.metric.worldWorks}: ${ctx.int(c.world)}` },
    { label: t.metric.ai, value: ctx.dec(c.ai), note: t.metric.aiNote },
    { label: t.metric.fwciLong, value: ctx.dec(c.fwci), note: c.fwciN < 30 ? t.ui.fewWorks : t.metric.fwciNote },
    { label: t.metric.top10, value: ctx.pct(c.top10), note: t.metric.top10Note },
    { label: t.metric.rankHome, value: rankText(ctx, c.rankHome), note: c.rankWorld ? `${t.metric.rankWorld}: ${rankText(ctx, c.rankWorld)}` : '' },
  ]);

  const sentences = [t.competency.summary({ n: ctx.worksN(c.n), from: period.from, to: period.to, share: ctx.share(c.share) })];
  if (c.ai != null) sentences.push(c.ai >= 1 ? t.competency.aiAbove(ctx.dec(c.ai, 1)) : t.competency.aiBelow(ctx.dec(c.ai)));
  if (c.fwci != null) sentences.push(t.competency.impact(ctx.dec(c.fwci), ctx.pct(c.top10)));
  if (c.growthOwn != null && c.growthWorld != null) sentences.push(t.competency.growth(ctx.change(c.growthOwn), ctx.change(c.growthWorld), period.p1, period.p2));
  if (c.rankHome) sentences.push(t.competency.ranks(t.competency.rankHomeText(c.rankHome), c.rankWorld ? t.competency.rankWorldText(c.rankWorld) : ''));

  const position = c.quadrant ? `<div class="position">${quadrantTag(ctx, c.quadrant)}<p>${esc(t.quadrantText[c.quadrant])}</p></div>` : '';
  const crumbs = `<nav class="crumbs" aria-label="${esc(t.ui.breadcrumbs)}"><a href="${esc(ctx.page('competencies/'))}">${esc(t.ui.allCompetencies)}</a></nav>`;

  // Динамика: два малых графика с общей осью лет
  const worldSpec = {
    lang: ctx.lang,
    label: t.competency.worldPerYear,
    items: c.byYear.map((y) => ({ label: String(y.year), value: y.world ?? 0, valueText: ctx.compact(y.world), tone: 'context', tip: tip(String(y.year), [[ctx.int(y.world), t.competency.worldPerYear]]) })),
  };
  const ownSpec = {
    lang: ctx.lang,
    label: t.competency.ownPerYear,
    items: c.byYear.map((y) => ({ label: String(y.year), value: y.n, valueText: ctx.int(y.n), tip: tip(String(y.year), [[ctx.int(y.n), t.competency.ownPerYear]]) })),
  };
  const yearsTable = table(
    [{ key: 'y', label: t.metric.year }, { key: 'w', label: t.competency.worldPerYear, num: true }, { key: 'n', label: t.competency.ownPerYear, num: true }],
    c.byYear.map((y) => ({ cells: { y: text(String(y.year)), w: cell(ctx.int(y.world), y.world), n: cell(ctx.int(y.n), y.n) } })),
  );
  const hasWorldYears = c.byYear.some((y) => y.world != null);
  const dynamics = `<div class="grid-2">
    ${hasWorldYears ? figure(ctx, { id: 'world-years', type: 'columns', spec: worldSpec, svg: columns(worldSpec, 480), title: t.competency.worldPerYear }) : ''}
    ${figure(ctx, { id: 'own-years', type: 'columns', spec: ownSpec, svg: columns(ownSpec, 480), title: t.competency.ownPerYear, table: yearsTable })}
  </div>`;

  // Лидеры
  const partners = c.partnerCountries.length
    ? `<ul class="chips">${c.partnerCountries.slice(0, 16).map((p) => `<li>${esc(ctx.country(p.code))} <strong>${esc(ctx.int(p.n))}</strong></li>`).join('')}</ul>`
    : `<p class="muted">${esc(t.competency.noPartners)}</p>`;
  const partnersBox = `<div class="side-box"><p class="side-title">${esc(t.competency.partnersTitle)}</p><p class="side-note">${esc(t.competency.partnersLead)}</p>${partners}</div>`;
  let leaders = '';
  if (c.contextStatus !== 'ok') {
    leaders = `<p class="notice">${esc(c.contextStatus === 'stale' ? t.ui.contextStale : t.ui.contextMissing)}</p><div class="grid-2 grid-gap-top">${partnersBox}</div>`;
  } else {
    const top = c.countries.slice(0, 10);
    const home = c.homeCountry;
    const rows = [...top];
    if (home && !top.some((x) => x.code === home.code)) rows.push(home);
    const cSpec = {
      lang: ctx.lang,
      label: t.competency.countriesTitle,
      highlightLabels: true,
      items: rows.map((x) => ({
        label: `${x.rank}. ${ctx.country(x.code)}`,
        value: x.n,
        valueText: ctx.pct(x.share),
        tone: x.code === model.meta.home ? 'accent' : 'context',
        tip: tip(ctx.country(x.code), [[ctx.int(x.n), t.metric.works], [ctx.pct(x.share), t.metric.shareShort]]),
      })),
    };
    const countries = figure(ctx, { id: 'countries', type: 'hbars', spec: cSpec, svg: hbars(cSpec, 560), title: t.competency.countriesTitle, note: t.competency.countriesNote });
    // Таблица организаций: первые 10 вместе с университетом на его месте; если университет ниже,
    // он добавляется отдельной строкой после разрыва.
    const orgTable = (list, own, withCountry) => {
      const cols = [{ key: 'r', label: '№', num: true }, { key: 'name', label: t.metric.organization }];
      if (withCountry) cols.push({ key: 'country', label: t.metric.country });
      cols.push({ key: 'n', label: t.metric.works, num: true });
      const ownRow = own ? { own: true, name: ownName, country: model.meta.home, n: own.n } : null;
      const combined = [...list, ...(ownRow ? [ownRow] : [])].sort((a, b) => b.n - a.n || (b.own ? 1 : 0) - (a.own ? 1 : 0));
      const shown = combined.slice(0, 10).map((o, i) => ({ ...o, r: String(i + 1) }));
      if (ownRow && !shown.some((o) => o.own)) {
        shown.push({ gap: true }, { ...ownRow, r: own.exact ? String(own.rank) : `>${own.listed}` });
      }
      const body = shown.map((o) => (o.gap
        ? { cls: 'gap', cells: { r: text('…'), name: text(''), country: text(''), n: text('') } }
        : { cls: o.own ? 'own' : '', cells: { r: text(o.r), name: text(o.name), country: text(ctx.country(o.country)), n: cell(ctx.int(o.n), o.n) } }));
      return table(cols, body, { cls: 'orgs' });
    };
    leaders = `<div class="grid-2">
      ${countries}
      <div><h3 class="table-title">${esc(t.competency.worldOrgs)}</h3>${orgTable(c.topInstitutions, c.rankWorld, true)}</div>
    </div>
    <div class="grid-2 grid-gap-top">
      <div><h3 class="table-title">${esc(t.competency.homeOrgs)}</h3>${orgTable(c.topHome, c.rankHome, false)}</div>
      ${partnersBox}
    </div>`;
  }

  // Темы
  const minT = model.meta.thresholds.topicMinWorks;
  const topicRows = c.topics.filter((x) => x.n >= minT);
  const topics = topicRows.length ? table(
    [
      { key: 'name', label: t.metric.topic },
      { key: 'n', label: t.metric.works, num: true },
      { key: 'world', label: t.metric.worldWorks, num: true },
      { key: 'ai', label: t.metric.aiShort, num: true },
      { key: 'fwci', label: 'FWCI', num: true },
      { key: 'g', label: t.metric.growthWorld, num: true },
    ],
    topicRows.map((x) => ({
      cells: {
        name: cell(`<a href="https://openalex.org/${esc(x.id)}" rel="noopener" lang="en">${esc(x.name)}</a>`, x.name),
        n: cell(ctx.int(x.n), x.n),
        world: cell(ctx.int(x.world), x.world),
        ai: cell(`<span class="cell-micro">${divergingBar(x.ai)}<span>${ctx.dec(x.ai)}</span></span>`, x.ai),
        fwci: cell(ctx.dec(x.fwci), x.fwci),
        g: cell(ctx.change(x.growthWorld), x.growthWorld),
      },
    })),
    { sortable: true },
  ) : `<p class="muted">${esc(t.ui.noData)}</p>`;

  const sources = model.sources ?? {};
  const works = c.keyWorks.length ? `<ol class="works">${c.keyWorks.map((w) => workItem(ctx, w, { source: sources[w.s]?.name })).join('')}</ol>` : `<p class="muted">${esc(t.ui.noData)}</p>`;
  const reviews = c.reviews?.length ? `<ol class="works">${c.reviews.map((w) => workItem(ctx, w, { source: w.src })).join('')}</ol>` : `<p class="muted">${esc(t.ui.noData)}</p>`;

  const pager = `<nav class="pager" aria-label="${esc(t.nav.competencies)}">
    ${prev ? `<a class="pager-prev" href="${esc(ctx.page(`competencies/${prev.id}/`))}"><span>${esc(t.ui.prev)}</span>${esc(ctx.compName(prev.id))}</a>` : '<span></span>'}
    ${next ? `<a class="pager-next" href="${esc(ctx.page(`competencies/${next.id}/`))}"><span>${esc(t.ui.next)}</span>${esc(ctx.compName(next.id))}</a>` : '<span></span>'}
  </nav>`;

  return [
    hero(ctx, {
      crumb: crumbs,
      title: def.name[ctx.lang],
      lead: def.summary[ctx.lang],
      extra: `${tiles}<div class="facts">${sentences.map((s) => `<p>${esc(s)}</p>`).join('')}</div>${position}${model.strategy ? verdictBox(ctx, c.id) : ''}`,
    }),
    section('years', t.competency.dynamicsTitle, '', dynamics),
    section('leaders', t.competency.leadersTitle, '', leaders),
    section('topics', t.competency.topicsTitle, t.competency.topicsLead(minT), topics),
    section('works', t.competency.publicationsTitle, '', `<div class="grid-2 works-grid">
      <div><h3 class="list-title">${esc(t.competency.worksTitle)}</h3>${works}</div>
      <div><h3 class="list-title">${esc(t.competency.reviewsTitle)}</h3><p class="side-note">${esc(t.competency.reviewsLead(period.p2))}</p>${reviews}</div>
    </div>${pager}`),
  ].join('\n');
}

// ---------- мировые тренды ----------------------------------------------------------------

export function trendsPage(ctx) {
  const { t, model } = ctx;
  const { period, thresholds } = model.meta;
  const vis = visibleOf(model).filter((c) => c.growthWorld != null && c.ai != null);
  const spec = {
    lang: ctx.lang,
    label: t.trends.portfolioAria,
    x: { type: 'linear', ref: model.totals.growthWorld, label: t.trends.portfolioX(period.p1, period.p2), short: t.trends.portfolioXShort, zero: false, kind: 'change', refLabel: t.trends.portfolioXRef },
    y: { type: 'log', ref: 1, label: t.trends.portfolioY, refLabel: t.home.mapXRef },
    quadrants: t.trends.quadrants,
    points: vis.map((c) => ({
      id: c.id,
      label: ctx.compShort(c.id),
      aria: `${ctx.compName(c.id)}: ${t.metric.growthWorld} ${ctx.change(c.growthWorld)}, ${t.metric.aiShort} ${ctx.dec(c.ai)}`,
      x: c.growthWorld,
      y: c.ai,
      size: c.n,
      href: ctx.page(`competencies/${c.id}/`),
      tip: tip(ctx.compName(c.id), [[ctx.change(c.growthWorld), t.metric.growthWorld], [ctx.change(c.growthOwn), t.metric.growthOwn], [ctx.dec(c.ai), t.metric.aiShort], [ctx.int(c.n), t.metric.works]]),
    })),
  };
  const portTable = table(
    [{ key: 'name', label: t.metric.competency }, { key: 'gw', label: t.metric.growthWorld, num: true }, { key: 'go', label: t.metric.growthOwn, num: true }, { key: 'ai', label: t.metric.aiShort, num: true }, { key: 'n', label: t.metric.works, num: true }],
    vis.map((c) => ({ cells: { name: text(ctx.compName(c.id)), gw: cell(ctx.change(c.growthWorld), c.growthWorld), go: cell(ctx.change(c.growthOwn), c.growthOwn), ai: cell(ctx.dec(c.ai), c.ai), n: cell(ctx.int(c.n), c.n) } })),
    { sortable: true },
  );
  // Для оси роста — сетка вокруг мирового уровня; подсказка о вертикальной линии — в тексте раздела
  const portfolio = figure(ctx, { id: 'portfolio', type: 'bubble', spec, svg: bubble(spec, 1160), after: bubbleKey(spec), table: portTable, wide: true });

  const status = (x) => (x.n === 0 ? 'none' : x.ai >= 1 && x.n >= 5 ? 'strong' : 'present');
  const statusCell = (x) => cell(`<span class="status status-${status(x)}">${esc(t.trends.status[status(x)])}</span>`, x.n);
  const fastTable = model.trends.fastGrowing.length ? table(
    [
      { key: 'name', label: t.metric.topic },
      { key: 'comp', label: t.metric.competency },
      { key: 'p1', label: t.trends.worldP(period.p1), num: true },
      { key: 'p2', label: t.trends.worldP(period.p2), num: true },
      { key: 'g', label: t.metric.growthWorld, num: true },
      { key: 'own', label: t.trends.worksP2(period.p2), num: true },
      { key: 'st', label: t.metric.status },
    ],
    model.trends.fastGrowing.map((x) => ({
      cells: {
        name: cell(`<a href="https://openalex.org/${esc(x.id)}" rel="noopener" lang="en">${esc(x.name)}</a>`, x.name),
        comp: x.competency ? cell(`<a href="${esc(ctx.page(`competencies/${x.competency}/`))}">${esc(ctx.compShort(x.competency))}</a>`, ctx.compShort(x.competency)) : text('—'),
        p1: cell(ctx.int(x.worldP1), x.worldP1),
        p2: cell(ctx.int(x.worldP2), x.worldP2),
        g: cell(ctx.change(x.growth), x.growth),
        own: cell(ctx.int(x.nP2), x.nP2),
        st: statusCell(x),
      },
    })),
    { sortable: true },
  ) : `<p class="muted">${esc(t.ui.noData)}</p>`;

  const white = model.trends.whiteSpots.length
    ? `<ul class="spots">${model.trends.whiteSpots.map((x) => `<li><a href="https://openalex.org/${esc(x.id)}" rel="noopener" lang="en">${esc(x.name)}</a><span>${esc([x.competency ? ctx.compShort(x.competency) : '', t.trends.worldVolume(ctx.int(x.worldP2), period.p2)].filter(Boolean).join(' · '))}</span><strong>${esc(ctx.change(x.growth))}</strong></li>`).join('')}</ul>`
    : `<p class="muted">${esc(t.trends.whiteNone)}</p>`;

  const rising = model.trends.ownRising.length ? table(
    [
      { key: 'name', label: t.metric.topic },
      { key: 'p1', label: `${t.site.universityShort}, ${period.p1[0]}–${period.p1[1]}`, num: true },
      { key: 'p2', label: `${t.site.universityShort}, ${period.p2[0]}–${period.p2[1]}`, num: true },
      { key: 'go', label: t.metric.growthOwn, num: true },
      { key: 'gw', label: t.metric.growthWorld, num: true },
    ],
    model.trends.ownRising.map((x) => ({
      cells: {
        name: cell(`<a href="https://openalex.org/${esc(x.id)}" rel="noopener" lang="en">${esc(x.name)}</a>`, x.name),
        p1: cell(ctx.int(x.nP1), x.nP1),
        p2: cell(ctx.int(x.nP2), x.nP2),
        go: cell(ctx.change(x.growthOwn), x.growthOwn),
        gw: cell(ctx.change(x.growthWorld), x.growthWorld),
      },
    })),
    { sortable: true },
  ) : `<p class="muted">${esc(t.ui.noData)}</p>`;

  return [
    hero(ctx, { eyebrow: t.site.university, title: t.trends.title, lead: t.trends.lead, extra: dataNote(ctx) }),
    section('portfolio-section', t.trends.portfolioTitle, t.trends.portfolioLead, portfolio),
    section('fast', t.trends.fastTitle, t.trends.fastLead(ctx.int(thresholds.trendMinWorldWorks), ctx.change(thresholds.trendFastGrowth), period.p1, period.p2), fastTable),
    section('white', t.trends.whiteTitle, t.trends.whiteLead, white),
    section('rising', t.trends.risingTitle, t.trends.risingLead, rising),
  ].join('\n');
}

// ---------- сотрудничество ----------------------------------------------------------------

export function collaborationPage(ctx) {
  const { t, model } = ctx;
  const col = model.collaboration;
  const m = model.totals;
  const tiles = kpis([
    { label: t.metric.intl, value: ctx.pct(m.intl), note: `${t.metric.countries}: ${ctx.int(m.countries)}` },
    { label: t.metric.homePartner, value: ctx.pct(col.homePartnerShare) },
    { label: t.metric.company, value: ctx.pct(col.companyShare) },
  ]);
  const cSpec = {
    lang: ctx.lang,
    label: t.collaboration.countriesTitle,
    items: col.countries.slice(0, 20).map((c) => ({ label: ctx.country(c.code), value: c.n, valueText: ctx.int(c.n), tip: tip(ctx.country(c.code), [[ctx.int(c.n), t.collaboration.jointWorks], [ctx.pct(c.share), ctx.lang === 'ru' ? 'от всех публикаций' : 'of all publications']]) })),
  };
  const countries = figure(ctx, {
    id: 'countries-all',
    type: 'hbars',
    spec: cSpec,
    svg: hbars(cSpec, 720),
    table: table([{ key: 'c', label: t.metric.country }, { key: 'n', label: t.collaboration.jointWorks, num: true }, { key: 's', label: '%', num: true }],
      col.countries.map((c) => ({ cells: { c: text(ctx.country(c.code)), n: cell(ctx.int(c.n), c.n), s: cell(ctx.pct(c.share), c.share) } })), { sortable: true }),
  });
  const iSpec = {
    lang: ctx.lang,
    label: t.collaboration.intlTitle,
    kind: 'pct',
    items: col.intlByYear.map((y) => ({ label: String(y.year), value: y.intl ?? 0, valueText: ctx.pct(y.intl, 0), tip: tip(String(y.year), [[ctx.pct(y.intl), t.metric.intl], [ctx.int(y.n), t.metric.works]]) })),
  };
  const intl = figure(ctx, { id: 'intl-years', type: 'columns', spec: iSpec, svg: columns(iSpec, 480), title: t.collaboration.intlTitle });
  const orgTable = (list) => table(
    [{ key: 'name', label: t.metric.organization }, { key: 'country', label: t.metric.country }, { key: 'type', label: t.collaboration.type }, { key: 'n', label: t.collaboration.jointWorks, num: true }],
    list.map((p) => ({ cells: { name: text(p.name), country: text(ctx.country(p.country)), type: text(t.collaboration.types[p.type] ?? p.type ?? '—'), n: cell(ctx.int(p.n), p.n) } })),
    { sortable: true },
  );
  return [
    hero(ctx, { eyebrow: t.site.university, title: t.collaboration.title, lead: t.collaboration.lead, extra: `${dataNote(ctx)}${tiles}` }),
    section('countries-section', t.collaboration.countriesTitle, t.collaboration.countriesLead, `<div class="grid-side">${countries}${intl}</div>`),
    section('foreign', t.collaboration.foreignTitle, '', orgTable(col.partnersForeign)),
    section('home', t.collaboration.homeTitle, '', orgTable(col.partnersHome)),
  ].join('\n');
}

// ---------- методика ----------------------------------------------------------------------

const tightSection = (id, title, lead, body) => section(id, title, lead, body, { cls: 'section-tight' });

export function methodPage(ctx, { competencies }) {
  const { t, model } = ctx;
  const meta = model.meta;
  const p = meta.period;
  const range = (a) => `${a[0]}–${a[1]}`;
  const ids = meta.institutionIds.join(', ');
  const cov = model.coverage;
  const blocks = [];
  blocks.push(tightSection('source', t.method.sourceTitle, '', `<p>${esc(t.method.source({ date: ctx.date(meta.fetchedAt), ids, ror: meta.institution?.ror ?? '—' }))}</p>`));
  blocks.push(tightSection('window', t.method.windowTitle, '', `<p>${esc(t.method.window({ from: p.from, to: p.to, p1: range(p.p1), p2: range(p.p2) }))}</p>`));
  blocks.push(tightSection('metrics', t.method.metricsTitle, '', `<dl class="defs">${t.method.metrics.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>`));

  const compBlocks = competencies.map((def) => {
    const c = model.competencies.find((x) => x.id === def.id);
    const own = c.topics.length;
    const worldTopics = (model.competencyTopics?.[def.id] ?? []);
    const rows = worldTopics.slice(0, 400).map((x) => `<li><span lang="en">${esc(x.name)}</span><span class="num">${esc(ctx.int(x.world))}</span><span class="num">${esc(x.n ? ctx.int(x.n) : '')}</span></li>`).join('');
    return `<details class="topic-list"><summary><span>${esc(def.name[ctx.lang])}</span><span class="muted">${esc(t.method.competencyTopics(c.topicCount, own))}</span></summary>
      <ul class="topics"><li class="topics-head"><span>${esc(t.metric.topic)}</span><span class="num">${esc(t.metric.worldWorks)}</span><span class="num">${esc(t.site.universityShort)}</span></li>${rows}</ul></details>`;
  }).join('');
  const share = cov.classifiedWorks ? cov.assignedWorks / cov.classifiedWorks : null;
  blocks.push(tightSection('competencies', t.method.competenciesTitle, '', `<p>${esc(t.method.competencies)}</p><p>${esc(t.method.coverage({ assigned: ctx.int(cov.assignedWorks), classified: ctx.int(cov.classifiedWorks), share: ctx.pct(share), unclassified: ctx.int(cov.unclassifiedWorks) }))}</p>${compBlocks}
    ${cov.unassignedTopics.length ? `<h3>${esc(t.method.unassignedTitle)}</h3>${table([{ key: 'name', label: t.metric.topic }, { key: 'sub', label: t.metric.subfield }, { key: 'n', label: t.metric.works, num: true }], cov.unassignedTopics.map((x) => ({ cells: { name: cell(`<span lang="en">${esc(x.name)}</span>`, x.name), sub: text(ctx.subfieldName(x.subfield)), n: cell(ctx.int(x.n), x.n) } })))}` : ''}`));
  const ex = meta.excluded;
  if (ex?.total) blocks.push(tightSection('excluded', t.method.excludedTitle, '', `<p>${esc(t.method.excluded(ctx.worksN(ex.total), ctx.int(ex.works), ctx.int(ex.topics)))}</p>`));
  blocks.push(tightSection('limits', t.method.limitsTitle, '', `<ul class="bullets">${t.method.limits.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`));
  blocks.push(tightSection('update', t.method.updateTitle, '', `<p>${esc(t.method.update)}</p><p><a class="text-link" href="${esc(ctx.site.repoUrl)}" rel="noopener">${esc(t.footer.code)}</a></p>`));
  const dl = t.method.downloads;
  blocks.push(tightSection('download', t.method.downloadTitle, '', `<ul class="downloads">
    <li><a href="${esc(ctx.asset('data/metrics.json'))}" download>${esc(dl.metrics)}</a></li>
    <li><a href="${esc(ctx.asset('data/competencies.csv'))}" download>${esc(dl.competencies)}</a></li>
    <li><a href="${esc(ctx.asset('data/subfields.csv'))}" download>${esc(dl.subfields)}</a></li>
    <li><a href="${esc(ctx.asset('data/topics.csv'))}" download>${esc(dl.topics)}</a></li>
    ${model.strategy ? `<li><a href="${esc(ctx.asset('data/decisions.csv'))}" download>${esc(dl.decisions)}</a></li>` : ''}
  </ul>`));
  const notes = [...(meta.warnings ?? [])];
  if (notes.length || meta.institution?.candidates?.length) {
    const cand = meta.institution?.candidates?.length
      ? `<h3>${esc(t.method.candidatesTitle)}</h3>${table([{ key: 'id', label: 'OpenAlex' }, { key: 'name', label: t.metric.organization }, { key: 'c', label: t.metric.country }, { key: 'n', label: t.metric.works, num: true }], meta.institution.candidates.map((x) => ({ cells: { id: cell(`<a href="https://openalex.org/${esc(x.id)}" rel="noopener">${esc(x.id)}</a>`), name: text(x.name), c: text(x.country ?? '—'), n: cell(ctx.int(x.works), x.works) } })))}`
      : '';
    blocks.push(tightSection('notes', t.method.warningsTitle, '', `${notes.length ? `<ul class="bullets">${notes.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}${cand}`));
  }
  return [hero(ctx, { eyebrow: t.site.university, title: t.method.title, lead: t.method.lead, extra: dataNote(ctx, { methodLink: false }) }), ...blocks].join('\n');
}

// ---------- 404 ---------------------------------------------------------------------------

export function notFoundPage(ctx) {
  const { t } = ctx;
  return hero(ctx, {
    eyebrow: '404',
    title: t.ui.notFoundTitle,
    lead: t.ui.notFoundText,
    extra: `<p class="actions"><a class="button" href="${esc(ctx.page(''))}">${esc(t.ui.toHome)}</a> <a class="button button-ghost" href="${esc(ctx.page('competencies/'))}">${esc(t.ui.allCompetencies)}</a></p>`,
  });
}

