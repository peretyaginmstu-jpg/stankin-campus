import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModel, quadrant, rankIn, summarize } from '../src/lib/metrics.mjs';

const work = (o) => ({ id: o.id, y: o.y ?? 2020, tp: o.tp ?? null, fw: o.fw ?? null, c: o.c ?? 0, p: o.p ?? null, t10: o.t10 ?? 0, t1: 0, co: o.co ?? ['RU'], in: o.in ?? ['I1'], s: null, oa: 0, lang: 'en', a: [], na: 1, lead: o.lead ?? 1 });

test('summarize: средний FWCI только по работам с FWCI, доля топ-10 % — по работам с процентилем', () => {
  const s = summarize([work({ id: 'a', fw: 2, p: 0.95, t10: 1 }), work({ id: 'b', fw: null }), work({ id: 'c', fw: 1, p: 0.5, co: ['RU', 'ES'] })]);
  assert.equal(s.n, 3);
  assert.equal(s.fwci, 1.5);
  assert.equal(s.fwciN, 2);
  assert.equal(s.top10, 0.5);
  assert.equal(s.intl, Math.round((1 / 3) * 1000) / 1000);
});

test('quadrant: граница — мировой уровень 1', () => {
  assert.equal(quadrant(1, 1), 'leader');
  assert.equal(quadrant(2, 0.5), 'specialized');
  assert.equal(quadrant(0.5, 2), 'niche');
  assert.equal(quadrant(0.5, 0.5), 'background');
  assert.equal(quadrant(null, 1), null);
});

test('rankIn: точное место, исключённые типы и фильтр по стране', () => {
  const groups = [
    { id: 'G', n: 900 }, // объединяющая запись органа власти — не учитывается
    { id: 'A', n: 500 },
    { id: 'B', n: 300 },
    { id: 'S', n: 200 }, // университет
    { id: 'C', n: 100 },
  ];
  const meta = { G: { type: 'government', country: 'RU' }, A: { type: 'education', country: 'CN' }, B: { type: 'education', country: 'RU' }, C: { type: 'education', country: 'RU' } };
  assert.deepEqual(rankIn(groups, ['S'], 180, { meta, excludeTypes: ['government'] }), { rank: 3, n: 200, exact: true, listed: 3 });
  assert.deepEqual(rankIn(groups, ['S'], 180, { meta, excludeTypes: ['government'], country: 'RU' }), { rank: 2, n: 200, exact: true, listed: 2 });
  // университета нет в обрезанной выдаче, у всех перечисленных больше работ — место неточное
  const r = rankIn(groups.slice(0, 3), ['S'], 50, { meta, excludeTypes: ['government'] });
  assert.equal(r.exact, false);
  assert.equal(r.rank, 3);
});

test('buildModel: индекс специализации и доля в мире считаются по темам', () => {
  // мир: тема T1 — 100 работ (50+50), тема T2 — 900 работ; университет: 3 работы по T1, 1 по T2
  const snapshot = {
    schema: 1,
    source: 'fixture',
    fetchedAt: '2026-01-01T00:00:00Z',
    config: { period: { from: 2016, to: 2025, p1: [2016, 2020], p2: [2021, 2025] }, types: ['article'], institutionIds: ['I1'], excludedInstitutionTypes: ['government'] },
    institution: { id: 'I1', ror: 'x', candidates: [] },
    taxonomy: {
      topics: [
        { id: 'T1', name: 'Advanced Machining and Optimization Techniques', subfield: 2209, field: 22, domain: 3 },
        { id: 'T2', name: 'Cancer Immunotherapy Research', subfield: 2730, field: 27, domain: 4 },
      ],
      subfields: {},
      fields: {},
      domains: {},
    },
    world: { byYear: { 2018: 400, 2023: 600 }, topics: { T1: [50, 50], T2: [300, 600] } },
    stankin: {
      works: [
        work({ id: 'W1', tp: 'T1', y: 2018, fw: 2 }),
        work({ id: 'W2', tp: 'T1', y: 2022, fw: 1 }),
        work({ id: 'W3', tp: 'T1', y: 2023, fw: 0 }),
        work({ id: 'W4', tp: 'T2', y: 2023, fw: 1 }),
      ],
      sources: {},
    },
    competencies: {},
    institutions: {},
  };
  const competencies = [{ id: 'machining', name: { ru: 'r', en: 'e' }, short: { ru: 'r', en: 'e' }, summary: { ru: 'r', en: 'e' }, match: { scope: { fields: [22] }, name: /machining/i } }];
  const m = buildModel(snapshot, { competencies, thresholds: { competencyMinWorks: 2, trendMinWorldWorks: 10, trendFastGrowth: 1.5 } });
  const c = m.competencies[0];
  assert.equal(c.n, 3);
  assert.equal(c.world, 100);
  assert.equal(c.share, 0.03);
  // доля у университета 3/4, в мире 100/1000 → индекс 7,5
  assert.equal(c.ai, 7.5);
  assert.equal(c.fwci, 1);
  assert.equal(c.growthOwn, 2); // 2 работы во втором периоде против 1 в первом
  assert.equal(c.growthWorld, 1);
  assert.equal(c.visible, true);
  assert.equal(c.contextStatus, 'missing');
  assert.equal(m.totals.n, 4);
  assert.equal(m.totals.growthWorld, 1.5);
  assert.equal(m.coverage.assignedWorks, 3);
  // тема T2 не входит в компетенции — она вне трендов
  assert.ok(m.trends.fastGrowing.every((t) => t.id !== 'T2'));
});
