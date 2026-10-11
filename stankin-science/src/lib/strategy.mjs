// Слой решений «Что развивать, на что сделать ставку, что открыть с нуля».
// Чистые функции от модели (metrics.buildModel) — без сети. Все пороги и веса — в config/site.mjs
// (STRATEGY), отраслевые приоритеты — в content/priorities.mjs.
//
// Балл компетенции (0..100) — взвешенная сумма четырёх составляющих, каждая в 0..1:
//   • позиция  — индекс специализации: (log2 AI + 3) / 6, то есть AI 1/8 → 0, 1 → 0,5, 8 → 1;
//   • влияние  — среднее из FWCI / 2 и доли топ-10 % / 20 % (мир = 0,5);
//   • рынок    — 0,5 + log2(рост мирового потока направления / рост мировой науки);
//   • импульс  — 0,5 + log2(рост университета / рост мира в направлении) / 2;
// плюс надбавка за соответствие отраслевому приоритету.

import { competencyPriorities, topicPriorities } from '../../content/priorities.mjs';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const round = (v, d = 3) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const log2 = (v) => Math.log(v) / Math.LN2;
const avg = (list) => {
  const xs = list.filter((x) => x != null && Number.isFinite(x));
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
};

export const VERDICTS = ['bet', 'develop-quality', 'develop-scale', 'maintain', 'review'];

export function components(c, worldGrowth) {
  const position = c.ai > 0 ? clamp((log2(c.ai) + 3) / 6) : 0;
  const impact = avg([c.fwci != null ? clamp(c.fwci / 2) : null, c.top10 != null ? clamp(c.top10 / 0.2) : null]);
  const relMarket = c.growthWorld != null && worldGrowth > 0 ? c.growthWorld / worldGrowth : null;
  const market = relMarket != null && relMarket > 0 ? clamp(0.5 + log2(relMarket)) : null;
  const relMomentum = c.growthOwn != null && c.growthWorld > 0 ? c.growthOwn / c.growthWorld : null;
  const momentum = relMomentum != null && relMomentum > 0 ? clamp(0.5 + log2(relMomentum) / 2) : relMomentum === 0 ? 0 : null;
  return { position, impact, market, momentum, relMarket, relMomentum };
}

export function score(parts, weights, bonus = 0) {
  let s = 0;
  let w = 0;
  for (const k of ['position', 'impact', 'market', 'momentum']) {
    if (parts[k] == null) continue;
    s += parts[k] * weights[k];
    w += weights[k];
  }
  if (!w) return null;
  return Math.round(clamp(s / w + bonus) * 100);
}

// Вердикт по правилам (а не по баллу): балл ранжирует внутри вердикта.
export function verdictOf(c, { relMarket }, { config, priority }) {
  const specialised = (c.ai ?? 0) >= 1;
  const strongImpact = (c.fwci != null && c.fwci >= config.impact.fwci) || (c.top10 != null && c.top10 >= config.impact.top10);
  const growing = relMarket != null && relMarket >= config.marketGrowing;
  if (specialised && strongImpact) return growing ? 'bet' : 'maintain';
  if (specialised) return growing || priority ? 'develop-quality' : 'review';
  if (strongImpact) return growing ? 'develop-scale' : 'maintain';
  if (priority) return growing ? 'develop-scale' : 'maintain';
  return 'review';
}

// Порядок доводов для вердикта: сначала то, что его определило.
const REASON_ORDER = {
  bet: ['spec', 'impact', 'market'],
  'develop-quality': ['impact', 'spec', 'momentum'],
  'develop-scale': ['impact', 'spec', 'market'],
  maintain: ['spec', 'impact', 'market'],
  review: ['spec', 'impact', 'market'],
};

function reasonsOf(c, verdict, worldGrowth, priority) {
  const facts = {
    spec: c.ai != null ? { k: 'spec', ai: c.ai } : null,
    impact: c.fwci != null || c.top10 != null ? { k: 'impact', fwci: c.fwci, top10: c.top10 } : null,
    market: c.growthWorld != null ? { k: 'market', gw: c.growthWorld, gt: worldGrowth } : null,
    momentum: c.growthOwn != null && c.growthWorld != null ? { k: 'momentum', go: c.growthOwn, gw: c.growthWorld } : null,
  };
  const out = REASON_ORDER[verdict].map((k) => facts[k]).filter(Boolean);
  if (priority.length) out.push({ k: 'priority', ids: priority });
  return out;
}

export function rateCompetency(c, { worldGrowth, config, priorities }) {
  const priority = competencyPriorities(c.id, priorities);
  const parts = components(c, worldGrowth);
  const verdict = verdictOf(c, parts, { config, priority: priority.length > 0 });
  return {
    id: c.id,
    verdict,
    score: score(parts, config.weights, priority.length ? config.priorityBonus : 0),
    components: {
      position: round(parts.position),
      impact: round(parts.impact),
      market: round(parts.market),
      momentum: round(parts.momentum),
    },
    relMarket: round(parts.relMarket),
    relMomentum: round(parts.relMomentum),
    priority,
    unstable: c.n < config.minWorks || (c.fwciN ?? 0) < config.minFwciWorks,
    reasons: reasonsOf(c, verdict, worldGrowth, priority),
    n: c.n,
    ai: c.ai,
    fwci: c.fwci,
    top10: c.top10,
    growthOwn: c.growthOwn,
    growthWorld: c.growthWorld,
  };
}

const COMPETENCY_FOUNDATION = { bet: 1, 'develop-quality': 1, 'develop-scale': 1, maintain: 0.5, review: 0 };

// Возможные российские партнёры и ведущие страны по теме — из выгрузки opportunities.
function topicContext(ctx, { institutions, partnerIds, ownIds, home, excludeTypes }) {
  if (!ctx) return null;
  const meta = (id) => institutions[id] ?? null;
  const usable = (g) => !ownIds.has(g.id) && !excludeTypes.includes(meta(g.id)?.type);
  const homeOrgs = (ctx.russianInstitutions ?? [])
    .filter((g) => usable(g) && meta(g.id)?.country === home)
    .slice(0, 6)
    .map((g) => ({ id: g.id, name: meta(g.id)?.name ?? g.name ?? g.id, n: g.n, partner: partnerIds.has(g.id) }));
  const worldOrgs = (ctx.institutions ?? [])
    .filter(usable)
    .slice(0, 5)
    .map((g) => ({ id: g.id, name: meta(g.id)?.name ?? g.name ?? g.id, country: meta(g.id)?.country ?? null, n: g.n, partner: partnerIds.has(g.id) }));
  const top = [...(ctx.institutions ?? []).slice(0, 50), ...(ctx.russianInstitutions ?? []).slice(0, 20)];
  return {
    countries: (ctx.countries ?? []).filter((g) => g.code && g.code.length === 2).slice(0, 5).map((g) => ({ code: g.code, n: g.n })),
    homeOrgs,
    worldOrgs,
    partners: [...new Set(top.filter((g) => partnerIds.has(g.id)).map((g) => g.id))],
    reviews: (ctx.reviews ?? []).slice(0, 3),
  };
}

// «Открыть с нуля»: быстрорастущие темы мира в областях компетенций, где у университета почти нет работ.
export function rankOpenings(model, { config, priorities, verdictOf: verdictById, opportunities = {}, institutions = {}, partnerIds = new Set(), excludeTypes = ['government', 'funder'] }) {
  const open = config.open;
  const subN = new Map(model.subfields.map((s) => [s.id, s.n]));
  const ownIds = new Set(model.meta.institutionIds ?? []);
  const home = model.meta.home;
  const fast = model.trends.fastAll ?? model.trends.fastGrowing ?? [];
  const rows = fast.filter((t) => t.n <= open.maxOwnWorks).map((t) => {
    const ctx = topicContext(opportunities[t.id], { institutions, partnerIds, ownIds, home, excludeTypes });
    const subfieldN = subN.get(t.subfield) ?? 0;
    const sub = clamp(Math.log10(1 + subfieldN) / Math.log10(1 + open.subfieldFull));
    const verdict = verdictById.get(t.competency) ?? null;
    const comp = verdict ? COMPETENCY_FOUNDATION[verdict] : 0;
    const partner = ctx ? (ctx.partners.length ? 1 : 0) : 0;
    const foundation = 0.5 * sub + 0.3 * comp + 0.2 * partner;
    const priority = topicPriorities(t, priorities);
    const raw = log2(t.growth) * Math.log10(Math.max(t.worldP2, 10)) * (0.3 + foundation) * (priority.length ? open.priorityMultiplier : 1);
    return {
      id: t.id,
      name: t.name,
      subfield: t.subfield,
      competency: t.competency,
      competencyVerdict: verdict,
      growth: t.growth,
      worldP1: t.worldP1,
      worldP2: t.worldP2,
      n: t.n,
      subfieldN,
      foundation: { subfield: round(sub), competency: comp, partners: ctx ? partner : null, total: round(foundation) },
      priority,
      raw,
      context: ctx,
    };
  });
  const withBase = rows.filter((r) => r.foundation.total >= open.minFoundation).sort((a, b) => b.raw - a.raw || b.worldP2 - a.worldP2);
  const newTeam = rows.filter((r) => r.foundation.total < open.minFoundation)
    .map((r) => ({ ...r, raw: log2(r.growth) * Math.log10(Math.max(r.worldP2, 10)) * (r.priority.length ? open.priorityMultiplier : 1) }))
    .sort((a, b) => b.raw - a.raw || b.worldP2 - a.worldP2);
  const max = withBase[0]?.raw ?? 1;
  const top = withBase.slice(0, open.top).map((r) => ({ ...r, score: Math.round((r.raw / max) * 100), raw: round(r.raw) }));
  return {
    considered: rows.length,
    open: top,
    newTeam: newTeam.slice(0, open.newTeam).map((r) => ({ ...r, raw: round(r.raw) })),
  };
}

// Темы, для которых выгрузка запрашивает партнёров, страны и обзоры (до появления этих данных).
export function openingCandidates(model, { config, priorities }) {
  const rates = model.competencies.filter((c) => c.visible).map((c) => rateCompetency(c, { worldGrowth: worldGrowthOf(model), config, priorities }));
  const verdicts = new Map(rates.map((r) => [r.id, r.verdict]));
  const ranked = rankOpenings(model, { config, priorities, verdictOf: verdicts });
  const nNew = Math.ceil(config.open.fetch / 3);
  return [...ranked.open.slice(0, config.open.fetch), ...ranked.newTeam.slice(0, nNew)].map((r) => r.id);
}

function worldGrowthOf(model) {
  return model.totals.growthWorldClassified ?? model.totals.growthWorld;
}

export function buildStrategy(model, { config, priorities, opportunities = {}, institutions = {}, partnerIds = new Set(), excludeTypes } = {}) {
  const worldGrowth = worldGrowthOf(model);
  const rates = model.competencies
    .filter((c) => c.visible)
    .map((c) => rateCompetency(c, { worldGrowth, config, priorities }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const verdicts = new Map(rates.map((r) => [r.id, r.verdict]));
  const byVerdict = Object.fromEntries(VERDICTS.map((v) => [v, rates.filter((r) => r.verdict === v).map((r) => r.id)]));
  const openings = rankOpenings(model, { config, priorities, verdictOf: verdicts, opportunities, institutions, partnerIds, excludeTypes });
  const usedPriorities = new Set([...rates.flatMap((r) => r.priority), ...openings.open.flatMap((r) => r.priority), ...openings.newTeam.flatMap((r) => r.priority)]);
  return {
    worldGrowth,
    config,
    competencies: rates,
    byVerdict,
    openings,
    priorities: priorities
      .filter((p) => usedPriorities.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, short: p.short, note: p.note, source: p.source, url: p.url, competencies: p.competencies })),
    opportunitiesLoaded: Object.keys(opportunities).length,
  };
}
