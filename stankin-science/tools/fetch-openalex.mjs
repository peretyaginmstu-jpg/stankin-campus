#!/usr/bin/env node
// Выгрузка данных OpenAlex для сайта.
//
//   OPENALEX_API_KEY=... node tools/fetch-openalex.mjs [--out data/snapshot/snapshot.json]
//
// Скрипт собирает «снимок» (snapshot.json): классификацию тем, мировые объёмы публикаций по темам
// за два периода, публикации университета за окно анализа и мировой контекст каждой компетенции
// (страны, организации, динамика, обзоры). Сборка сайта (tools/build.mjs) работает только со снимком
// и в сеть не ходит. Расход: около 300–500 запросов-списков, то есть 3–5 тыс. кредитов OpenAlex
// из 100 тыс., доступных в сутки по бесплатному ключу.
//
// Переменные окружения: OPENALEX_API_KEY (обязательно), YEARS_FROM / YEARS_TO (окно анализа),
// OPENALEX_CONCURRENCY (одновременных запросов, по умолчанию 4), OPENALEX_BASE (адрес API, для тестов).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { INSTITUTION, THRESHOLDS, WORK_TYPES, analysisPeriod } from '../config/site.mjs';
import { COMPETENCIES } from '../content/competencies.mjs';
import { OpenAlex, OpenAlexError, chunk, mergeGroups, shortId } from '../src/lib/openalex.mjs';
import { assignTopics, topicSetKey } from '../src/lib/classify.mjs';
import { cleanTitle } from '../src/lib/text.mjs';

const SCHEMA = 1;
const WORK_SELECT = [
  'id', 'doi', 'display_name', 'publication_year', 'type', 'primary_topic', 'fwci', 'cited_by_count',
  'citation_normalized_percentile', 'authorships', 'primary_location', 'open_access', 'language',
].join(',');
const REVIEW_SELECT = 'id,doi,display_name,publication_year,cited_by_count,primary_location,authorships';
const TOPIC_CHUNK = 50; // тем в одном фильтре (OpenAlex допускает до 100 значений через «|»)
const EXCLUDED_INSTITUTION_TYPES = new Set(['government', 'funder']);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    out[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const outFile = path.resolve(String(args.out ?? 'data/snapshot/snapshot.json'));
const apiKey = (process.env.OPENALEX_API_KEY ?? '').trim();
const started = Date.now();
const log = (...a) => console.log(...a);
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)} с`;

if (!apiKey && !args['no-key']) {
  console.error(
    'Нет ключа OpenAlex. С февраля 2026 года API требует ключ: создайте бесплатную учётную запись на openalex.org,\n' +
      'скопируйте ключ на странице https://openalex.org/settings/api и передайте его в переменной OPENALEX_API_KEY\n' +
      '(в GitHub Actions — секрет репозитория OPENALEX_API_KEY). Запуск без ключа: --no-key (хватит лишь на пробу).',
  );
  process.exit(2);
}

const api = new OpenAlex({
  apiKey,
  log,
  concurrency: Number(process.env.OPENALEX_CONCURRENCY) || 4,
  // адрес API можно подменить для тестов (test/mock-openalex.mjs)
  ...(process.env.OPENALEX_BASE ? { base: process.env.OPENALEX_BASE } : {}),
});
const period = analysisPeriod();
const typeFilter = `type:${WORK_TYPES.join('|')}`;
const years = (a, b) => `publication_year:${a}-${b}`;
const scope = (a = period.from, b = period.to) => `${years(a, b)},${typeFilter}`;
const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  log(`  ! ${msg}`);
};

// Группировка работ по организациям: сначала по прямой аффилиации (authorships.institutions.id),
// при отказе API — по родословной (lineage). Выбранный ключ записывается в снимок.
let institutionGroupKey = 'authorships.institutions.id';
async function groupByInstitution(params) {
  try {
    return await api.groupBy('/works', { ...params, group_by: institutionGroupKey });
  } catch (err) {
    if (err instanceof OpenAlexError && err.status === 400 && institutionGroupKey.endsWith('.id')) {
      warn(`group_by ${institutionGroupKey} не поддерживается, используется authorships.institutions.lineage`);
      institutionGroupKey = 'authorships.institutions.lineage';
      return api.groupBy('/works', { ...params, group_by: institutionGroupKey });
    }
    throw err;
  }
}

async function resolveInstitution() {
  log('1. Организация');
  let record = null;
  try {
    record = await api.get(`/institutions/ror:${INSTITUTION.ror}`, {}, { kind: 'single' });
  } catch (err) {
    if (!(err instanceof OpenAlexError) || err.status !== 404) throw err;
    warn(`ROR ${INSTITUTION.ror} не найден в OpenAlex, используется идентификатор ${INSTITUTION.openalexId}`);
    record = await api.get(`/institutions/${INSTITUTION.openalexId}`, {}, { kind: 'single' });
  }
  const id = shortId(record.id);
  if (id !== INSTITUTION.openalexId) {
    warn(`OpenAlex сопоставил ROR с ${id}, а в настройках указан ${INSTITUTION.openalexId}`);
  }
  // Возможные дубли записи университета — только для журнала и страницы «Методика».
  const search = await api.get('/institutions', {
    search: 'stankin',
    per_page: 25,
    select: 'id,display_name,country_code,type,works_count,ror',
  });
  const candidates = (search.results ?? []).map((r) => ({
    id: shortId(r.id),
    name: r.display_name,
    country: r.country_code,
    type: r.type,
    works: r.works_count,
    ror: r.ror ? shortId(r.ror) : null,
  }));
  const ids = [...new Set([id, ...INSTITUTION.extraIds.map(shortId)])];
  for (const c of candidates) {
    if (!ids.includes(c.id) && c.works >= 50) {
      warn(`Возможный дубль записи университета: ${c.id} «${c.name}» (${c.works} работ). ` +
        'Если это тот же университет, добавьте идентификатор в INSTITUTION.extraIds (config/site.mjs).');
    }
  }
  log(`  ${id} · ${record.display_name} · ${record.works_count} работ в OpenAlex (всего)`);
  return {
    id,
    ids,
    name: record.display_name,
    ror: record.ror ? shortId(record.ror) : INSTITUTION.ror,
    country: record.country_code,
    type: record.type,
    homepage: record.homepage_url ?? null,
    worksCount: record.works_count ?? null,
    citedByCount: record.cited_by_count ?? null,
    candidates,
  };
}

async function loadTaxonomy() {
  log('2. Классификация тем');
  const raw = await api.all('/topics', { select: 'id,display_name,subfield,field,domain' });
  const topics = raw.map((t) => ({
    id: shortId(t.id),
    name: t.display_name,
    subfield: Number(shortId(t.subfield?.id)),
    field: Number(shortId(t.field?.id)),
    domain: Number(shortId(t.domain?.id)),
  }));
  const names = (key) => {
    const m = new Map();
    for (const t of raw) if (t[key]?.id) m.set(Number(shortId(t[key].id)), t[key].display_name);
    return Object.fromEntries([...m.entries()].sort((a, b) => a[0] - b[0]));
  };
  log(`  тем: ${topics.length}`);
  return { topics, subfields: names('subfield'), fields: names('field'), domains: names('domain') };
}

async function loadWorld() {
  log('3. Мировой поток публикаций');
  const byYear = await api.groupBy('/works', { filter: scope(), group_by: 'publication_year' });
  const [p1, p2] = await Promise.all([
    api.groupByAll('/works', { filter: scope(...period.p1), group_by: 'primary_topic.id' }),
    api.groupByAll('/works', { filter: scope(...period.p2), group_by: 'primary_topic.id' }),
  ]);
  const topics = {};
  for (const g of p1.groups) topics[g.key] = [g.count, 0];
  for (const g of p2.groups) (topics[g.key] ??= [0, 0])[1] = g.count;
  const total = byYear.groups.reduce((s, g) => s + g.count, 0);
  log(`  ${total.toLocaleString('ru-RU')} работ за ${period.from}–${period.to}; тем с работами: ${Object.keys(topics).length}`);
  return {
    byYear: Object.fromEntries(byYear.groups.map((g) => [g.key, g.count]).sort()),
    periodTotals: [p1.total, p2.total],
    topics,
  };
}

function compactWork(w, stankinIds, partnerMeta, sources) {
  const authorships = w.authorships ?? [];
  const countries = new Set();
  const insts = new Set();
  let lead = false;
  authorships.forEach((a, i) => {
    for (const c of a.countries ?? []) if (c) countries.add(c);
    for (const inst of a.institutions ?? []) {
      const id = shortId(inst.id);
      if (!id) continue;
      insts.add(id);
      if (inst.country_code) countries.add(inst.country_code);
      if (!partnerMeta.has(id)) {
        partnerMeta.set(id, {
          name: inst.display_name ?? id,
          country: inst.country_code ?? null,
          type: inst.type ?? null,
          ror: inst.ror ? shortId(inst.ror) : null,
        });
      }
      const lineage = (inst.lineage?.length ? inst.lineage : [inst.id]).map(shortId);
      const own = lineage.some((x) => stankinIds.has(x));
      if (own && (i === 0 || a.author_position === 'first' || a.is_corresponding)) lead = true;
    }
  });
  const src = w.primary_location?.source;
  const sid = src?.id ? shortId(src.id) : null;
  if (sid && !sources[sid]) {
    sources[sid] = {
      name: src.display_name ?? sid,
      type: src.type ?? null,
      publisher: src.host_organization_name ?? null,
      issn: src.issn_l ?? null,
    };
  }
  const pct = w.citation_normalized_percentile;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
  return {
    id: shortId(w.id),
    doi: w.doi ? String(w.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : null,
    t: cleanTitle(w.display_name ?? w.title ?? ''),
    y: w.publication_year,
    ty: w.type,
    tp: shortId(w.primary_topic?.id) ?? null,
    fw: num(w.fwci),
    c: w.cited_by_count ?? 0,
    p: num(pct?.value),
    t10: pct?.is_in_top_10_percent ? 1 : 0,
    t1: pct?.is_in_top_1_percent ? 1 : 0,
    co: [...countries].sort(),
    in: [...insts].sort(),
    s: sid,
    oa: w.open_access?.is_oa ? 1 : 0,
    lang: w.language ?? null,
    a: authorships.slice(0, 3).map((a) => a.author?.display_name).filter(Boolean),
    na: authorships.length,
    lead: lead ? 1 : 0,
  };
}

async function loadWorks(inst) {
  log('4. Публикации университета');
  const filter = `authorships.institutions.lineage:${inst.ids.join('|')},${scope()}`;
  const raw = await api.all('/works', { filter, select: WORK_SELECT }, {
    onPage: (n, total) => log(`  ${n} / ${total ?? '?'}`),
  });
  const stankinIds = new Set(inst.ids);
  const partnerMeta = new Map();
  const sources = {};
  const seen = new Set();
  const works = [];
  for (const w of raw) {
    const cw = compactWork(w, stankinIds, partnerMeta, sources);
    if (seen.has(cw.id)) continue;
    seen.add(cw.id);
    works.push(cw);
  }
  works.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  log(`  работ: ${works.length}`);
  return { works, sources, partnerMeta };
}

function compactReview(w) {
  return {
    id: shortId(w.id),
    doi: w.doi ? String(w.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : null,
    t: cleanTitle(w.display_name ?? ''),
    y: w.publication_year,
    c: w.cited_by_count ?? 0,
    src: w.primary_location?.source?.display_name ?? null,
    a: (w.authorships ?? []).slice(0, 3).map((a) => a.author?.display_name).filter(Boolean),
    na: (w.authorships ?? []).length,
  };
}

async function competencyContext(topicIds) {
  const parts = chunk(topicIds, TOPIC_CHUNK);
  const topicFilter = (ids) => `primary_topic.id:${ids.join('|')}`;
  const each = (fn) => Promise.all(parts.map(fn));
  const [byYear, countries, world, russia, reviews] = await Promise.all([
    each((ids) => api.groupBy('/works', { filter: `${topicFilter(ids)},${scope()}`, group_by: 'publication_year' })),
    each((ids) => api.groupBy('/works', { filter: `${topicFilter(ids)},${scope()}`, group_by: 'authorships.countries' })),
    each((ids) => groupByInstitution({ filter: `${topicFilter(ids)},${scope()}` })),
    each((ids) => groupByInstitution({ filter: `${topicFilter(ids)},${scope()},institutions.country_code:${INSTITUTION.country}` })),
    each((ids) => api.get('/works', {
      filter: `${topicFilter(ids)},${years(...period.p2)},type:review`,
      sort: 'cited_by_count:desc',
      per_page: 5,
      select: REVIEW_SELECT,
    })),
  ]);
  const years_ = mergeGroups(byYear);
  return {
    topicKey: topicSetKey(topicIds),
    worldByYear: Object.fromEntries(years_.map((g) => [g.key, g.count]).sort()),
    countries: mergeGroups(countries).map((g) => ({ code: g.key, name: g.name, n: g.count })),
    institutions: mergeGroups(world).slice(0, THRESHOLDS.topInstitutions).map((g) => ({ id: g.key, name: g.name, n: g.count })),
    russianInstitutions: mergeGroups(russia).slice(0, THRESHOLDS.topInstitutions).map((g) => ({ id: g.key, name: g.name, n: g.count })),
    reviews: reviews
      .flatMap((p) => p.results ?? [])
      .sort((a, b) => (b.cited_by_count ?? 0) - (a.cited_by_count ?? 0))
      .slice(0, 5)
      .map(compactReview),
  };
}

// Метаданные организаций (страна, тип) для рейтингов: пакетами по 50, при отказе — по одной.
async function loadInstitutionMeta(ids, known) {
  const missing = [...new Set(ids)].filter((id) => id && !known.has(id));
  if (!missing.length) return;
  log(`6. Метаданные организаций: ${missing.length}`);
  const put = (r) => known.set(shortId(r.id), {
    name: r.display_name,
    country: r.country_code ?? null,
    type: r.type ?? null,
    ror: r.ror ? shortId(r.ror) : null,
  });
  let batch = true;
  for (const part of chunk(missing, 50)) {
    if (batch) {
      try {
        const page = await api.get('/institutions', {
          filter: `openalex:${part.join('|')}`,
          per_page: 50,
          select: 'id,display_name,country_code,type,ror',
        });
        for (const r of page.results ?? []) put(r);
        continue;
      } catch (err) {
        if (!(err instanceof OpenAlexError) || err.status !== 400) throw err;
        warn('Пакетный запрос организаций не поддерживается, метаданные загружаются по одной');
        batch = false;
      }
    }
    await Promise.all(part.map(async (id) => {
      try {
        put(await api.get(`/institutions/${id}`, { select: 'id,display_name,country_code,type,ror' }, { kind: 'single' }));
      } catch (err) {
        if (err instanceof OpenAlexError && err.status === 404) return;
        throw err;
      }
    }));
  }
}

async function main() {
  log(`Выгрузка OpenAlex: ${period.from}–${period.to} (периоды ${period.p1.join('–')} и ${period.p2.join('–')}), типы: ${WORK_TYPES.join(', ')}`);
  const inst = await resolveInstitution();
  const taxonomy = await loadTaxonomy();
  const world = await loadWorld();
  const { works, sources, partnerMeta } = await loadWorks(inst);

  log('5. Компетенции: мировой контекст');
  const { byTopic, byCompetency } = assignTopics(taxonomy.topics, COMPETENCIES);
  const ownByCompetency = new Map();
  for (const w of works) {
    const c = byTopic.get(w.tp);
    if (c) ownByCompetency.set(c, (ownByCompetency.get(c) ?? 0) + 1);
  }
  const competencies = {};
  for (const c of COMPETENCIES) {
    const topicIds = byCompetency.get(c.id) ?? [];
    const own = ownByCompetency.get(c.id) ?? 0;
    if (!topicIds.length) {
      warn(`Компетенция ${c.id}: правило не подобрало ни одной темы`);
      continue;
    }
    if (own < THRESHOLDS.competencyMinWorks) {
      log(`  ${c.id}: ${own} работ университета — ниже порога, мировой контекст не запрашивается`);
      continue;
    }
    try {
      competencies[c.id] = await competencyContext(topicIds);
      log(`  ${c.id}: тем ${topicIds.length}, работ университета ${own} · ${elapsed()}`);
    } catch (err) {
      if (err instanceof OpenAlexError && [401, 403, 409].includes(err.status)) throw err;
      warn(`Компетенция ${c.id}: мировой контекст не загружен (${err.message})`);
    }
  }

  // Метаданные: первые организации мира (для таблиц и места университета) и российские
  // организации из выборки с фильтром по стране (в ней есть и зарубежные соавторы — их отсеиваем).
  const known = new Map(partnerMeta);
  const need = [];
  for (const ctx of Object.values(competencies)) {
    need.push(...ctx.institutions.map((g) => g.id), ...ctx.russianInstitutions.map((g) => g.id));
  }
  await loadInstitutionMeta(need, known);
  const used = new Set(need);
  for (const w of works) for (const id of w.in) used.add(id);
  const institutions = {};
  for (const id of [...used].sort()) {
    const m = known.get(id);
    if (m) institutions[id] = m;
  }

  const snapshot = {
    schema: SCHEMA,
    source: 'openalex',
    fetchedAt: new Date().toISOString(),
    config: {
      period,
      types: WORK_TYPES,
      institutionIds: inst.ids,
      institutionGroupKey,
      excludedInstitutionTypes: [...EXCLUDED_INSTITUTION_TYPES],
    },
    api: { requests: api.stats.requests, retries: api.stats.retries, creditsEstimate: api.stats.credits },
    institution: inst,
    taxonomy,
    world,
    stankin: { works, sources },
    competencies,
    institutions,
    warnings,
  };
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(snapshot));
  const mb = (Buffer.byteLength(JSON.stringify(snapshot)) / 1e6).toFixed(1);
  log(`Готово за ${elapsed()}: ${outFile} (${mb} МБ), запросов ${api.stats.requests}, повторов ${api.stats.retries}, ` +
    `≈${api.stats.credits} кредитов. Предупреждений: ${warnings.length}`);
}

main().catch((err) => {
  console.error(`\nВыгрузка не удалась: ${err.message}`);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
