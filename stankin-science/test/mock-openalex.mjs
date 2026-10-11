// Имитация OpenAlex API для проверки выгрузки без сети. Отвечает в формате настоящего API
// (полные адреса идентификаторов, group_by с курсором, вложенные authorships и т. п.), а данные
// берёт из синтетического снимка data/fixture/snapshot.json.
//
// Запуск вручную:  node test/mock-openalex.mjs  → затем
//   OPENALEX_BASE=http://127.0.0.1:8765 OPENALEX_API_KEY=test node tools/fetch-openalex.mjs --out /tmp/s.json

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assignTopics } from '../src/lib/classify.mjs';
import { COMPETENCIES } from '../content/competencies.mjs';

const OA = 'https://openalex.org/';
const YEARS = Array.from({ length: 10 }, (_, i) => 2016 + i);

function parseFilter(filter = '') {
  const out = {};
  // значения могут содержать «:» (ror:...), поэтому делим по первому двоеточию каждого условия
  for (const part of filter.split(',').filter(Boolean)) {
    const i = part.indexOf(':');
    out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

function yearRange(value) {
  if (!value) return [YEARS[0], YEARS[YEARS.length - 1]];
  const [a, b] = value.split('-').map(Number);
  return [a, b ?? a];
}

export async function startMockOpenAlex({ fixturePath = fileURLToPath(new URL('../data/fixture/snapshot.json', import.meta.url)), port = 0, requireKey = true } = {}) {
  const fx = JSON.parse(await readFile(fixturePath, 'utf8'));
  const topics = fx.taxonomy.topics;
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const sub = (id) => fx.taxonomy.subfields?.[id] ?? `Subfield ${id}`;
  const fld = (id) => fx.taxonomy.fields?.[id] ?? `Field ${id}`;
  const dom = (id) => fx.taxonomy.domains?.[id] ?? `Domain ${id}`;
  const topicObj = (t) => ({
    id: OA + t.id,
    display_name: t.name,
    subfield: { id: `${OA}subfields/${t.subfield}`, display_name: sub(t.subfield) },
    field: { id: `${OA}fields/${t.field}`, display_name: fld(t.field) },
    domain: { id: `${OA}domains/${t.domain}`, display_name: dom(t.domain) },
  });
  const ownId = fx.institution.id;
  const instObj = (id) => {
    const m = fx.institutions[id];
    if (!m) return null;
    return { id: OA + id, display_name: m.name, country_code: m.country, type: m.type, ror: m.ror ? `https://ror.org/${m.ror}` : null, works_count: id === ownId ? 6100 : 1000, cited_by_count: 1, homepage_url: null, lineage: [OA + id] };
  };
  // Мировой поток по теме и году: объём периода делится поровну между его годами.
  const worldCount = (topicId, year) => {
    const [p1, p2] = fx.world.topics[topicId] ?? [0, 0];
    return Math.round((year <= 2020 ? p1 : p2) / 5);
  };
  const workObj = (w) => ({
    id: OA + w.id,
    doi: w.doi ? `https://doi.org/${w.doi}` : null,
    display_name: w.t,
    publication_year: w.y,
    type: w.ty,
    primary_topic: w.tp ? { ...topicObj(topicById.get(w.tp)), score: 0.99 } : null,
    fwci: w.fw,
    cited_by_count: w.c,
    citation_normalized_percentile: w.p == null ? null : { value: w.p, is_in_top_1_percent: Boolean(w.t1), is_in_top_10_percent: Boolean(w.t10) },
    authorships: w.in.map((iid, i) => {
      const inst = instObj(iid);
      return {
        author_position: i === 0 ? 'first' : 'middle',
        author: { id: `${OA}A${i + 1}`, display_name: w.a[i] ?? `Author ${i + 1}` },
        institutions: inst ? [{ id: inst.id, display_name: inst.display_name, ror: inst.ror, country_code: inst.country_code, type: inst.type, lineage: inst.lineage }] : [],
        countries: inst?.country_code ? [inst.country_code] : [],
        is_corresponding: i === 0,
      };
    }),
    primary_location: w.s ? { source: { id: OA + w.s, display_name: fx.stankin.sources[w.s].name, type: fx.stankin.sources[w.s].type, host_organization_name: 'Demo Publisher', issn_l: null } } : { source: null },
    open_access: { is_oa: Boolean(w.oa), oa_status: w.oa ? 'gold' : 'closed' },
    language: w.lang,
  });
  // Какая компетенция фикстуры соответствует набору тем запроса (для стран, организаций и обзоров).
  const { byTopic } = assignTopics(topics, COMPETENCIES);
  const contextFor = (ids) => {
    const comp = ids.map((id) => byTopic.get(id)).find(Boolean);
    return comp ? fx.competencies[comp] ?? null : null;
  };

  const requests = [];
  const page = (list, cursor, size = 200) => {
    const offset = cursor && cursor !== '*' ? Number(cursor) : 0;
    const slice = list.slice(offset, offset + size);
    const next = offset + size < list.length ? String(offset + size) : null;
    return { slice, next };
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://mock');
    requests.push(url.pathname + url.search);
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (requireKey && !url.searchParams.get('api_key')) return send(409, { error: 'API key required' });
    const p = url.pathname;
    const q = url.searchParams;
    const f = parseFilter(q.get('filter') ?? '');

    if (p.startsWith('/institutions/')) {
      const key = decodeURIComponent(p.slice('/institutions/'.length));
      const id = key.startsWith('ror:') ? (key.slice(4) === fx.institution.ror ? ownId : null) : key;
      const obj = id ? instObj(id) : null;
      return obj ? send(200, obj) : send(404, { error: 'not found' });
    }
    if (p === '/institutions') {
      if (q.get('search')) {
        return send(200, { meta: { count: 2 }, results: [instObj(ownId), { id: `${OA}I999`, display_name: 'Stankin Demo Branch', country_code: 'RU', type: 'education', works_count: 12, ror: null }] });
      }
      if (f.openalex) {
        const ids = f.openalex.split('|');
        return send(200, { meta: { count: ids.length }, results: ids.map(instObj).filter(Boolean) });
      }
      return send(400, { error: 'unsupported institutions query' });
    }
    if (p === '/topics') {
      const { slice, next } = page(topics, q.get('cursor'));
      return send(200, { meta: { count: topics.length, next_cursor: next }, results: slice.map(topicObj) });
    }
    if (p !== '/works') return send(404, { error: 'unknown endpoint' });

    const [y0, y1] = yearRange(f.publication_year);
    const years = YEARS.filter((y) => y >= y0 && y <= y1);
    const topicFilter = f['primary_topic.id']?.split('|') ?? null;
    const own = f['authorships.institutions.lineage'] != null;
    const groupBy = q.get('group_by');

    if (!groupBy) {
      if (own) {
        const list = fx.stankin.works.filter((w) => w.y >= y0 && w.y <= y1);
        const { slice, next } = page(list, q.get('cursor'), Number(q.get('per_page')) || 25);
        return send(200, { meta: { count: list.length, next_cursor: next }, results: slice.map(workObj) });
      }
      if (f.type === 'review') {
        const ctx = contextFor(topicFilter ?? []);
        const results = (ctx?.reviews ?? []).map((r) => ({ id: OA + r.id, doi: `https://doi.org/${r.doi}`, display_name: r.t, publication_year: r.y, cited_by_count: r.c, primary_location: { source: { display_name: r.src } }, authorships: r.a.map((a) => ({ author: { display_name: a } })) }));
        return send(200, { meta: { count: results.length }, results });
      }
      return send(400, { error: 'unsupported works list' });
    }

    let groups = [];
    let total = 0;
    if (groupBy === 'publication_year') {
      for (const y of years) {
        const n = own
          ? fx.stankin.works.filter((w) => w.y === y).length
          : (topicFilter ?? topics.map((t) => t.id)).reduce((s, id) => s + worldCount(id, y), 0);
        groups.push({ key: String(y), key_display_name: String(y), count: n });
      }
    } else if (groupBy === 'primary_topic.id') {
      for (const t of topics) {
        const n = years.reduce((s, y) => s + worldCount(t.id, y), 0);
        if (n > 0) groups.push({ key: OA + t.id, key_display_name: t.name, count: n });
      }
      groups.sort((a, b) => a.key.localeCompare(b.key)); // при курсорной выдаче группы идут по ключу
    } else if (groupBy === 'authorships.countries') {
      const ctx = contextFor(topicFilter ?? []);
      groups = (ctx?.countries ?? []).map((c) => ({ key: `${OA}countries/${c.code}`, key_display_name: c.code, count: c.n }));
    } else if (groupBy === 'authorships.institutions.id' || groupBy === 'authorships.institutions.lineage') {
      const ctx = contextFor(topicFilter ?? []);
      const list = f['institutions.country_code'] ? ctx?.russianInstitutions : ctx?.institutions;
      groups = (list ?? []).map((g) => ({ key: OA + g.id, key_display_name: g.name, count: g.n }));
    } else {
      return send(400, { error: `unsupported group_by ${groupBy}` });
    }
    total = groups.reduce((s, g) => s + g.count, 0);
    if (q.get('cursor')) {
      const { slice, next } = page(groups, q.get('cursor'));
      return send(200, { meta: { count: total, groups_count: slice.length, next_cursor: next }, results: [], group_by: slice });
    }
    const top = [...groups].sort((a, b) => b.count - a.count).slice(0, 200);
    return send(200, { meta: { count: total, groups_count: top.length }, results: [], group_by: top });
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const { port: actual } = server.address();
  return { url: `http://127.0.0.1:${actual}`, requests, close: () => new Promise((r) => server.close(r)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mock = await startMockOpenAlex({ port: 8765 });
  console.log(`Имитация OpenAlex: ${mock.url}`);
}
