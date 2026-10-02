import { test } from 'node:test';
import assert from 'node:assert/strict';
import { components, score, verdictOf, rateCompetency, rankOpenings, buildStrategy } from '../src/lib/strategy.mjs';
import { applyExclusions } from '../src/lib/metrics.mjs';
import { competencyPriorities, topicPriorities } from '../content/priorities.mjs';
import { STRATEGY } from '../config/site.mjs';

const config = STRATEGY;
const PRIOS = [{ id: 'p1', name: { ru: 'П', en: 'P' }, short: { ru: 'П', en: 'P' }, note: { ru: '', en: '' }, source: { ru: '', en: '' }, url: 'https://example.org', competencies: ['prio'], topics: /laser/i }];
const comp = (o) => ({ id: 'x', n: 200, fwciN: 180, ai: 1, fwci: 1, top10: 0.1, growthOwn: 1.5, growthWorld: 1.5, visible: true, ...o });
const rate = (o, priorities = []) => rateCompetency(comp(o), { worldGrowth: 1.4, config, priorities });

test('вердикты на крайних случаях', () => {
  assert.equal(rate({ ai: 2, fwci: 1.3, growthWorld: 2 }).verdict, 'bet');
  assert.equal(rate({ ai: 2, fwci: 1.3, growthWorld: 1.1 }).verdict, 'maintain');
  assert.equal(rate({ ai: 2, fwci: 0.6, top10: 0.04, growthWorld: 2 }).verdict, 'develop-quality');
  assert.equal(rate({ ai: 2, fwci: 0.6, top10: 0.04, growthWorld: 1.1 }).verdict, 'review');
  assert.equal(rate({ ai: 0.4, fwci: 1.4, growthWorld: 2 }).verdict, 'develop-scale');
  assert.equal(rate({ ai: 0.4, fwci: 1.4, growthWorld: 1.1 }).verdict, 'maintain');
  assert.equal(rate({ ai: 0.4, fwci: 0.5, top10: 0.03, growthWorld: 2 }).verdict, 'review');
  // высокая доля топ-10 % при FWCI ниже 1 — тоже влияние мирового уровня
  assert.equal(rate({ ai: 2, fwci: 0.9, top10: 0.12, growthWorld: 2 }).verdict, 'bet');
});

test('приоритет поднимает балл и переводит слабое направление из «Пересмотреть»', () => {
  const weak = { id: 'prio', ai: 0.4, fwci: 0.5, top10: 0.03 };
  const a = rate({ ...weak, growthWorld: 2 });
  const b = rate({ ...weak, growthWorld: 2 }, PRIOS);
  assert.equal(a.verdict, 'review');
  assert.equal(b.verdict, 'develop-scale');
  assert.ok(b.score > a.score);
  assert.equal(rate({ ...weak, growthWorld: 1.1 }, PRIOS).verdict, 'maintain');
  assert.deepEqual(b.priority, ['p1']);
  assert.ok(b.reasons.some((r) => r.k === 'priority'));
});

test('балл монотонен по каждой составляющей', () => {
  const base = { ai: 1, fwci: 1, top10: 0.1, growthOwn: 1.5, growthWorld: 1.5 };
  const s0 = rate(base).score;
  assert.ok(rate({ ...base, ai: 2 }).score > s0);
  assert.ok(rate({ ...base, fwci: 1.6 }).score > s0);
  assert.ok(rate({ ...base, growthWorld: 2.2, growthOwn: 2.2 }).score > s0);
  assert.ok(rate({ ...base, growthOwn: 2.5 }).score > s0);
  const c = components(comp({ ai: 1, fwci: 1, top10: 0.1, growthWorld: 1.4, growthOwn: 1.4 }), 1.4);
  assert.equal(c.position, 0.5);
  assert.equal(c.impact, 0.5);
  assert.equal(c.market, 0.5);
  assert.equal(c.momentum, 0.5);
  assert.equal(score(c, config.weights), 50);
  assert.equal(score({ position: null, impact: null, market: null, momentum: null }, config.weights), null);
});

test('оценка неустойчива при малой выборке', () => {
  assert.equal(rate({ n: 10, fwciN: 10 }).unstable, true);
  assert.equal(rate({ n: 200, fwciN: 10 }).unstable, true);
  assert.equal(rate({ n: 200, fwciN: 200 }).unstable, false);
});

test('verdictOf не падает без данных о рынке', () => {
  assert.equal(verdictOf(comp({ ai: 2, fwci: 1.2 }), { relMarket: null }, { config, priority: false }), 'maintain');
});

function openModel() {
  const fast = [
    { id: 'T1', name: 'Laser cladding of alloys', subfield: 2209, competency: 'strong', growth: 2.5, worldP1: 4000, worldP2: 10000, n: 0 },
    { id: 'T2', name: 'Exotic topic', subfield: 9999, competency: 'weak', growth: 3, worldP1: 3000, worldP2: 9000, n: 1 },
    { id: 'T3', name: 'Already covered', subfield: 2209, competency: 'strong', growth: 2, worldP1: 4000, worldP2: 8000, n: 12 },
    { id: 'T4', name: 'Nearby but slow volume', subfield: 2209, competency: 'strong', growth: 1.6, worldP1: 2000, worldP2: 3200, n: 2 },
  ];
  return {
    meta: { institutionIds: ['I0'], home: 'RU' },
    subfields: [{ id: 2209, n: 150 }],
    trends: { fastAll: fast },
  };
}

test('«открыть с нуля»: задел и рост определяют порядок, без задела — «новый коллектив»', () => {
  const r = rankOpenings(openModel(), { config, priorities: PRIOS, verdictOf: new Map([['strong', 'bet'], ['weak', 'review']]) });
  assert.deepEqual(r.open.map((o) => o.id), ['T1', 'T4']);
  assert.equal(r.open[0].score, 100);
  assert.deepEqual(r.open[0].priority, ['p1']);
  assert.deepEqual(r.newTeam.map((o) => o.id), ['T2']);
  assert.ok(!r.open.concat(r.newTeam).some((o) => o.id === 'T3'));
});

test('«открыть с нуля»: соавторы среди лидеров темы добавляют задел и показываются как партнёры', () => {
  const opportunities = { T2: { countries: [{ code: 'CN', n: 900 }], institutions: [{ id: 'I5', n: 50 }], russianInstitutions: [{ id: 'I7', n: 9 }, { id: 'I0', n: 1 }], reviews: [] } };
  const institutions = { I5: { name: 'Partner U', country: 'DE', type: 'education' }, I7: { name: 'Russian Lab', country: 'RU', type: 'facility' } };
  const r = rankOpenings(openModel(), { config: { ...config, open: { ...config.open, minFoundation: 0.15 } }, priorities: [], verdictOf: new Map([['strong', 'bet']]), opportunities, institutions, partnerIds: new Set(['I5', 'I7']) });
  const t2 = r.open.find((o) => o.id === 'T2');
  assert.ok(t2, 'тема с партнёрами получила задел');
  assert.equal(t2.foundation.partners, 1);
  assert.deepEqual(t2.context.homeOrgs.map((g) => [g.id, g.partner]), [['I7', true]]);
});

test('buildStrategy: группировка по выводам и используемые приоритеты', () => {
  const model = {
    meta: { institutionIds: ['I0'], home: 'RU' },
    totals: { growthWorld: 1.4, growthWorldClassified: 1.4 },
    competencies: [
      comp({ id: 'a', ai: 2, fwci: 1.3, growthWorld: 2 }),
      comp({ id: 'prio', ai: 0.4, fwci: 0.5, top10: 0.03, growthWorld: 2 }),
      comp({ id: 'hidden', visible: false }),
    ],
    subfields: [],
    trends: { fastAll: [] },
  };
  const s = buildStrategy(model, { config, priorities: PRIOS });
  assert.deepEqual(s.byVerdict.bet, ['a']);
  assert.deepEqual(s.byVerdict['develop-scale'], ['prio']);
  assert.equal(s.competencies.length, 2);
  assert.deepEqual(s.priorities.map((p) => p.id), ['p1']);
});

test('исключения из аудита аффилиаций убирают работы и темы', () => {
  const works = [{ id: 'W1', tp: 'T1' }, { id: 'W2', tp: 'T2' }, { id: 'W3', tp: 'T3' }, { id: 'W4', tp: null }];
  const r = applyExclusions(works, { works: ['W1'], topics: ['T3'] });
  assert.deepEqual(r.works.map((w) => w.id), ['W2', 'W4']);
  assert.deepEqual([r.excluded.works, r.excluded.topics, r.excluded.total], [1, 1, 2]);
  assert.equal(applyExclusions(works).works.length, 4);
});

test('приоритеты: компетенции и темы по названию', () => {
  assert.deepEqual(competencyPriorities('prio', PRIOS), ['p1']);
  assert.deepEqual(topicPriorities({ name: 'Laser welding', competency: 'other' }, PRIOS), ['p1']);
  assert.deepEqual(topicPriorities({ name: 'Other', competency: 'other' }, PRIOS), []);
  // реальный список: у каждого приоритета есть ссылка на первоисточник
  assert.ok(competencyPriorities('robotics').length >= 1);
});
