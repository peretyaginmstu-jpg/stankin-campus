// Расчёт показателей по снимку OpenAlex. Чистые функции: снимок → модель сайта.
//
// Основные показатели:
//   • индекс специализации (Activity Index) = (доля направления в работах университета) /
//     (доля направления в мировом потоке); 1 — как в среднем по миру, 2 — вдвое выше;
//   • FWCI — цитируемость, нормализованная по области, году и типу публикации (мир = 1);
//   • доля работ в 10 % самых цитируемых в своей области и году (мир = 10 %);
//   • доля университета в мировом потоке публикаций направления;
//   • рост: отношение числа работ во втором периоде к первому (у университета и в мире).

import { assignTopics, topicSetKey } from './classify.mjs';

const sum = (list, fn = (x) => x) => list.reduce((s, x) => s + (fn(x) ?? 0), 0);
const ratio = (a, b) => (b > 0 && Number.isFinite(a) ? a / b : null);
const round = (v, digits = 3) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** digits) / 10 ** digits);

export function yearsOf(period) {
  const out = [];
  for (let y = period.from; y <= period.to; y += 1) out.push(y);
  return out;
}

const inPeriod = (year, [a, b]) => year >= a && year <= b;

// Сводные показатели группы работ.
export function summarize(works, { home = 'RU' } = {}) {
  const n = works.length;
  const withFwci = works.filter((w) => w.fw != null);
  const withPct = works.filter((w) => w.p != null);
  const intl = works.filter((w) => w.co.some((c) => c !== home));
  return {
    n,
    citations: sum(works, (w) => w.c),
    fwci: round(ratio(sum(withFwci, (w) => w.fw), withFwci.length)),
    fwciN: withFwci.length,
    top10: round(ratio(sum(withPct, (w) => w.t10), withPct.length)),
    top1: round(ratio(sum(withPct, (w) => w.t1), withPct.length)),
    pctN: withPct.length,
    intl: round(ratio(intl.length, n)),
    lead: round(ratio(sum(works, (w) => w.lead), n)),
    oa: round(ratio(sum(works, (w) => w.oa), n)),
  };
}

export function quadrant(ai, fwci) {
  if (ai == null || fwci == null) return null;
  if (ai >= 1 && fwci >= 1) return 'leader';
  if (ai >= 1) return 'specialized';
  if (fwci >= 1) return 'niche';
  return 'background';
}

// Место организации в списке групп (по убыванию числа работ). Исключаются записи-объединения
// (органы власти, фонды) и сам университет. Возвращает { rank, n, exact, listed }.
export function rankIn(groups, ownIds, ownCount, { meta = {}, country = null, excludeTypes = [] } = {}) {
  const own = new Set(ownIds);
  const excluded = new Set(excludeTypes);
  let ownN = ownCount;
  const peers = [];
  for (const g of groups) {
    if (own.has(g.id)) {
      ownN = Math.max(ownN ?? 0, g.n);
      continue;
    }
    const m = meta[g.id];
    if (m && excluded.has(m.type)) continue;
    if (country && (!m || m.country !== country)) continue;
    peers.push(g);
  }
  if (ownN == null || ownN <= 0) return null;
  const above = peers.filter((g) => g.n > ownN).length;
  const listedOwn = groups.some((g) => own.has(g.id));
  const last = groups.length ? groups[groups.length - 1].n : 0;
  // Если университета нет в выдаче и выдача обрезана на организациях с бо́льшим числом работ,
  // точное место неизвестно — известно только, что оно ниже всех перечисленных.
  const exact = listedOwn || last <= ownN;
  return { rank: above + 1, n: ownN, exact, listed: peers.length };
}

function topicIndex(taxonomy) {
  return new Map(taxonomy.topics.map((t) => [t.id, t]));
}

export function buildModel(snapshot, { competencies, thresholds, home = 'RU' }) {
  const period = snapshot.config.period;
  const years = yearsOf(period);
  const topics = topicIndex(snapshot.taxonomy);
  const worldTopics = snapshot.world.topics; // { T: [p1, p2] }
  const works = snapshot.stankin.works.filter((w) => w.y >= period.from && w.y <= period.to);
  const instIds = snapshot.config.institutionIds;
  const instMeta = snapshot.institutions ?? {};
  const excludeTypes = snapshot.config.excludedInstitutionTypes ?? ['government', 'funder'];

  // Мировые итоги по классифицированным работам (сумма по темам) — знаменатель индекса специализации.
  let worldClassified = 0;
  let worldClassifiedP1 = 0;
  let worldClassifiedP2 = 0;
  for (const [p1, p2] of Object.values(worldTopics)) {
    worldClassifiedP1 += p1;
    worldClassifiedP2 += p2;
  }
  worldClassified = worldClassifiedP1 + worldClassifiedP2;
  const classified = works.filter((w) => w.tp && topics.has(w.tp));
  const ownClassified = classified.length;
  const aiOf = (n, worldN) => round(ratio(ratio(n, ownClassified), ratio(worldN, worldClassified)), 3);

  // Работы университета по темам.
  const byTopic = new Map();
  for (const w of classified) {
    if (!byTopic.has(w.tp)) byTopic.set(w.tp, []);
    byTopic.get(w.tp).push(w);
  }

  const { byTopic: competencyOfTopic, byCompetency } = assignTopics(snapshot.taxonomy.topics, competencies);

  // --- Темы университета ---------------------------------------------------------------
  const topicRows = [...byTopic.entries()].map(([id, list]) => {
    const t = topics.get(id);
    const [wp1, wp2] = worldTopics[id] ?? [0, 0];
    const s = summarize(list, { home });
    const nP1 = list.filter((w) => inPeriod(w.y, period.p1)).length;
    const nP2 = list.filter((w) => inPeriod(w.y, period.p2)).length;
    return {
      id,
      name: t.name,
      subfield: t.subfield,
      field: t.field,
      domain: t.domain,
      competency: competencyOfTopic.get(id) ?? null,
      n: list.length,
      nP1,
      nP2,
      world: wp1 + wp2,
      worldP1: wp1,
      worldP2: wp2,
      share: round(ratio(list.length, wp1 + wp2), 6),
      ai: aiOf(list.length, wp1 + wp2),
      growthWorld: round(ratio(wp2, wp1)),
      fwci: s.fwci,
      top10: s.top10,
    };
  }).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  // --- Подобласти и области ------------------------------------------------------------
  const aggregateBy = (key) => {
    const world = new Map();
    for (const [id, [p1, p2]] of Object.entries(worldTopics)) {
      const t = topics.get(id);
      if (!t) continue;
      world.set(t[key], (world.get(t[key]) ?? 0) + p1 + p2);
    }
    const own = new Map();
    for (const w of classified) {
      const k = topics.get(w.tp)[key];
      if (!own.has(k)) own.set(k, []);
      own.get(k).push(w);
    }
    return [...own.entries()].map(([id, list]) => {
      const s = summarize(list, { home });
      const sample = topics.get(list[0].tp);
      return {
        id,
        field: sample.field,
        domain: sample.domain,
        n: list.length,
        world: world.get(id) ?? 0,
        share: round(ratio(list.length, world.get(id)), 6),
        ai: aiOf(list.length, world.get(id) ?? 0),
        fwci: s.fwci,
        fwciN: s.fwciN,
        top10: s.top10,
        intl: s.intl,
      };
    }).sort((a, b) => b.n - a.n);
  };
  const subfields = aggregateBy('subfield');
  const fields = aggregateBy('field');

  // --- Итоги по университету ------------------------------------------------------------
  const total = summarize(works, { home });
  const worldByYear = snapshot.world.byYear ?? {};
  const byYear = years.map((year) => {
    const list = works.filter((w) => w.y === year);
    const s = summarize(list, { home });
    return { year, n: list.length, world: worldByYear[year] ?? null, intl: s.intl, top10: s.top10, fwci: s.fwci };
  });
  const nP1 = works.filter((w) => inPeriod(w.y, period.p1)).length;
  const nP2 = works.filter((w) => inPeriod(w.y, period.p2)).length;
  const worldTotal = sum(Object.values(worldByYear));
  const worldP1 = sum(years.filter((y) => inPeriod(y, period.p1)), (y) => worldByYear[y]);
  const worldP2 = sum(years.filter((y) => inPeriod(y, period.p2)), (y) => worldByYear[y]);
  const countries = new Map();
  for (const w of works) for (const c of w.co) if (c !== home) countries.set(c, (countries.get(c) ?? 0) + 1);

  // --- Компетенции -----------------------------------------------------------------------
  const competencyRows = competencies.map((c) => {
    const topicIds = byCompetency.get(c.id) ?? [];
    const topicSet = new Set(topicIds);
    const list = classified.filter((w) => topicSet.has(w.tp));
    const s = summarize(list, { home });
    let wP1 = 0;
    let wP2 = 0;
    for (const id of topicIds) {
      const [p1, p2] = worldTopics[id] ?? [0, 0];
      wP1 += p1;
      wP2 += p2;
    }
    const ownP1 = list.filter((w) => inPeriod(w.y, period.p1)).length;
    const ownP2 = list.filter((w) => inPeriod(w.y, period.p2)).length;
    const ctxRaw = snapshot.competencies?.[c.id] ?? null;
    const ctxStatus = !ctxRaw ? 'missing' : ctxRaw.topicKey === topicSetKey(topicIds) ? 'ok' : 'stale';
    const ctx = ctxStatus === 'ok' ? ctxRaw : null;
    const worldN = wP1 + wP2;

    const row = {
      id: c.id,
      topicIds,
      topicCount: topicIds.length,
      ...s,
      nP1: ownP1,
      nP2: ownP2,
      world: worldN,
      worldP1: wP1,
      worldP2: wP2,
      share: round(ratio(s.n, worldN), 6),
      ai: aiOf(s.n, worldN),
      growthOwn: round(ratio(ownP2, ownP1)),
      growthWorld: round(ratio(wP2, wP1)),
      visible: s.n >= thresholds.competencyMinWorks,
      contextStatus: ctxStatus,
    };
    row.quadrant = quadrant(row.ai, row.fwci);
    row.byYear = years.map((year) => ({
      year,
      n: list.filter((w) => w.y === year).length,
      world: ctx?.worldByYear?.[year] ?? null,
    }));
    row.topics = topicRows.filter((t) => topicSet.has(t.id));
    row.keyWorks = [...list].sort((a, b) => b.c - a.c || (b.fw ?? 0) - (a.fw ?? 0)).slice(0, 6);
    const partner = new Map();
    for (const w of list) for (const code of w.co) if (code !== home) partner.set(code, (partner.get(code) ?? 0) + 1);
    row.partnerCountries = [...partner.entries()].map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n);

    if (ctx) {
      const countriesList = ctx.countries.filter((g) => g.code && g.code.length === 2);
      row.countries = countriesList.map((g, i) => ({ code: g.code, n: g.n, rank: i + 1, share: round(ratio(g.n, worldN), 4) }));
      const ru = row.countries.find((g) => g.code === home);
      row.homeCountry = ru ?? null;
      const metaFor = (id) => instMeta[id] ?? null;
      row.topInstitutions = ctx.institutions
        .filter((g) => !instIds.includes(g.id) && !excludeTypes.includes(metaFor(g.id)?.type))
        .slice(0, 10)
        .map((g) => ({ id: g.id, name: metaFor(g.id)?.name ?? g.name ?? g.id, country: metaFor(g.id)?.country ?? null, n: g.n }));
      row.topHome = ctx.russianInstitutions
        .filter((g) => !instIds.includes(g.id) && metaFor(g.id)?.country === home && !excludeTypes.includes(metaFor(g.id)?.type))
        .slice(0, 10)
        .map((g) => ({ id: g.id, name: metaFor(g.id)?.name ?? g.name ?? g.id, n: g.n }));
      row.rankWorld = rankIn(ctx.institutions, instIds, s.n, { meta: instMeta, excludeTypes });
      row.rankHome = rankIn(ctx.russianInstitutions, instIds, s.n, { meta: instMeta, country: home, excludeTypes });
      row.reviews = ctx.reviews ?? [];
    } else {
      row.countries = [];
      row.homeCountry = null;
      row.topInstitutions = [];
      row.topHome = [];
      row.rankWorld = null;
      row.rankHome = null;
      row.reviews = [];
    }
    return row;
  });

  // --- Мировые тренды ---------------------------------------------------------------------
  const ownTopicMap = new Map(topicRows.map((t) => [t.id, t]));
  const trendTopics = [];
  for (const [id, [p1, p2]] of Object.entries(worldTopics)) {
    const t = topics.get(id);
    // только темы, входящие в компетенции университета: тренды и белые пятна — в его областях
    if (!t || !competencyOfTopic.has(id)) continue;
    if (p2 < thresholds.trendMinWorldWorks || p1 <= 0) continue;
    const growth = p2 / p1;
    const own = ownTopicMap.get(id);
    trendTopics.push({
      id,
      name: t.name,
      subfield: t.subfield,
      field: t.field,
      worldP1: p1,
      worldP2: p2,
      growth: round(growth),
      n: own?.n ?? 0,
      nP2: own?.nP2 ?? 0,
      ai: own?.ai ?? 0,
      competency: competencyOfTopic.get(id) ?? null,
    });
  }
  trendTopics.sort((a, b) => b.growth - a.growth || b.worldP2 - a.worldP2);
  const fast = trendTopics.filter((t) => t.growth >= thresholds.trendFastGrowth);
  const trends = {
    considered: trendTopics.length,
    fastCount: fast.length,
    fastGrowing: fast.slice(0, 30),
    whiteSpots: fast.filter((t) => t.n === 0).slice(0, 20),
    present: fast.filter((t) => t.n > 0).slice(0, 20),
    ownRising: topicRows
      .filter((t) => t.nP2 >= 5 && t.worldP1 > 0)
      .map((t) => ({ ...t, growthOwn: round(ratio(t.nP2, Math.max(t.nP1, 1))) }))
      .filter((t) => t.growthOwn > (t.growthWorld ?? 0))
      .sort((a, b) => b.nP2 - a.nP2)
      .slice(0, 20),
  };

  // --- Сотрудничество ---------------------------------------------------------------------
  const own = new Set(instIds);
  const partnerCounts = new Map();
  let withCompany = 0;
  let withHomePartner = 0;
  for (const w of works) {
    let company = false;
    let homePartner = false;
    for (const id of w.in) {
      if (own.has(id)) continue;
      partnerCounts.set(id, (partnerCounts.get(id) ?? 0) + 1);
      const m = instMeta[id];
      if (m?.type === 'company') company = true;
      if (m?.country === home) homePartner = true;
    }
    if (company) withCompany += 1;
    if (homePartner) withHomePartner += 1;
  }
  const partners = [...partnerCounts.entries()]
    .map(([id, n]) => ({ id, n, name: instMeta[id]?.name ?? id, country: instMeta[id]?.country ?? null, type: instMeta[id]?.type ?? null }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const collaboration = {
    countries: [...countries.entries()].map(([code, n]) => ({ code, n, share: round(ratio(n, works.length), 4) })).sort((a, b) => b.n - a.n || a.code.localeCompare(b.code)),
    partnersForeign: partners.filter((p) => p.country && p.country !== home).slice(0, 25),
    partnersHome: partners.filter((p) => p.country === home).slice(0, 25),
    companyShare: round(ratio(withCompany, works.length), 4),
    homePartnerShare: round(ratio(withHomePartner, works.length), 4),
    intlByYear: byYear.map((y) => ({ year: y.year, intl: y.intl, n: y.n })),
  };

  // --- Источники публикаций ---------------------------------------------------------------
  const sources = snapshot.stankin.sources ?? {};
  const bySource = new Map();
  let noSource = 0;
  const byKind = new Map();
  for (const w of works) {
    if (!w.s) {
      noSource += 1;
      byKind.set('none', (byKind.get('none') ?? 0) + 1);
      continue;
    }
    bySource.set(w.s, (bySource.get(w.s) ?? 0) + 1);
    const kind = sources[w.s]?.type ?? 'other';
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }
  const venues = {
    top: [...bySource.entries()]
      .map(([id, n]) => ({ id, n, name: sources[id]?.name ?? id, type: sources[id]?.type ?? null, publisher: sources[id]?.publisher ?? null, share: round(ratio(n, works.length), 4) }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
      .slice(0, 15),
    byKind: Object.fromEntries([...byKind.entries()].sort((a, b) => b[1] - a[1])),
    noSource,
    count: bySource.size,
    english: round(ratio(works.filter((w) => w.lang === 'en').length, works.length), 4),
    russian: round(ratio(works.filter((w) => w.lang === 'ru').length, works.length), 4),
  };

  // --- Работы вне компетенций (для журнала и страницы «Методика») ------------------------
  const unassigned = topicRows.filter((t) => !t.competency);
  const coverage = {
    assignedWorks: sum(competencyRows, (c) => c.n),
    classifiedWorks: ownClassified,
    unclassifiedWorks: works.length - ownClassified,
    unassignedTopics: unassigned.slice(0, 40).map((t) => ({ id: t.id, name: t.name, subfield: t.subfield, n: t.n })),
  };

  return {
    meta: {
      source: snapshot.source,
      demo: snapshot.source !== 'openalex',
      fetchedAt: snapshot.fetchedAt,
      period,
      types: snapshot.config.types,
      institution: snapshot.institution,
      institutionIds: instIds,
      warnings: snapshot.warnings ?? [],
      api: snapshot.api ?? null,
      thresholds,
      home,
    },
    totals: {
      ...total,
      classified: ownClassified,
      nP1,
      nP2,
      growthOwn: round(ratio(nP2, nP1)),
      worldTotal,
      worldP1,
      worldP2,
      growthWorld: round(ratio(worldP2, worldP1)),
      worldClassified,
      share: round(ratio(works.length, worldTotal), 7),
      countries: countries.size,
      byYear,
    },
    competencies: competencyRows,
    subfields,
    fields,
    topics: topicRows,
    trends,
    collaboration,
    venues,
    coverage,
  };
}
