import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAlex, OpenAlexError, chunk, mergeGroups, shortId } from '../src/lib/openalex.mjs';

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (h) => (r.headers ?? {})[h.toLowerCase()] ?? null },
      json: async () => r.body,
      text: async () => JSON.stringify(r.body ?? ''),
    };
  };
  return { impl, calls };
}

test('shortId, chunk, mergeGroups', () => {
  assert.equal(shortId('https://openalex.org/T10001'), 'T10001');
  assert.equal(shortId('https://openalex.org/countries/RU'), 'RU');
  assert.equal(shortId('RU'), 'RU');
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(mergeGroups([[{ key: 'A', count: 2 }, { key: 'B', count: 5 }], { groups: [{ key: 'A', count: 4 }] }]).map((g) => [g.key, g.count]), [['A', 6], ['B', 5]]);
});

test('ключ передаётся в запросе и скрыт в журнале; повтор после 429 и 503', async () => {
  const { impl, calls } = fakeFetch([
    { status: 429, headers: { 'retry-after': '0' } },
    { status: 503 },
    { status: 200, body: { meta: { count: 3 }, group_by: [{ key: 'https://openalex.org/T1', key_display_name: 'One', count: 2 }, { key: 'unknown', count: 1 }] } },
  ]);
  const logs = [];
  const api = new OpenAlex({ apiKey: 'SECRET', fetchImpl: impl, log: (m) => logs.push(m), retries: 3 });
  api.backoff = async (attempt, retryAfter, shown) => { logs.push(shown); api.stats.retries += 1; };
  const res = await api.groupBy('/works', { filter: 'publication_year:2020', group_by: 'primary_topic.id' });
  assert.deepEqual(res, { groups: [{ key: 'T1', name: 'One', count: 2 }], total: 3 });
  assert.equal(calls.length, 3);
  assert.ok(calls[0].includes('api_key=SECRET'));
  assert.ok(logs.every((l) => !l.includes('SECRET')));
  assert.equal(api.stats.retries, 2);
});

test('отказ доступа (409) — понятная ошибка про ключ', async () => {
  const { impl } = fakeFetch([{ status: 409, body: { error: 'out of credits' } }]);
  const api = new OpenAlex({ apiKey: '', fetchImpl: impl });
  await assert.rejects(api.get('/works'), (err) => err instanceof OpenAlexError && err.status === 409 && /OPENALEX_API_KEY/.test(err.message));
});

test('курсорная выдача собирает все страницы', async () => {
  const { impl, calls } = fakeFetch([
    { status: 200, body: { meta: { count: 3, next_cursor: 'c2' }, results: [{ id: 1 }, { id: 2 }] } },
    { status: 200, body: { meta: { count: 3, next_cursor: 'c3' }, results: [{ id: 3 }] } },
    { status: 200, body: { meta: { count: 3, next_cursor: null }, results: [] } },
  ]);
  const api = new OpenAlex({ apiKey: 'k', fetchImpl: impl });
  const all = await api.all('/works', { filter: 'x' });
  assert.deepEqual(all.map((r) => r.id), [1, 2, 3]);
  assert.ok(calls[1].includes('cursor=c2'));
});
