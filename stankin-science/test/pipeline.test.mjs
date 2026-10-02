// Сквозная проверка: выгрузка из имитации OpenAlex → снимок → сборка сайта → проверки сборки.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startMockOpenAlex } from './mock-openalex.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('выгрузка, сборка и проверка на имитации API', { timeout: 120_000 }, async () => {
  const mock = await startMockOpenAlex();
  const dir = await mkdtemp(path.join(tmpdir(), 'stankin-science-'));
  try {
    const snapshotFile = path.join(dir, 'snapshot.json');
    const env = { ...process.env, OPENALEX_BASE: mock.url, OPENALEX_API_KEY: 'test-key', YEARS_FROM: '2016', YEARS_TO: '2025' };
    const fetched = await run('node', [path.join(ROOT, 'tools/fetch-openalex.mjs'), '--out', snapshotFile], { env, cwd: ROOT });
    assert.match(fetched.stdout, /Готово/);
    const snap = JSON.parse(await readFile(snapshotFile, 'utf8'));
    const fixture = JSON.parse(await readFile(path.join(ROOT, 'data/fixture/snapshot.json'), 'utf8'));

    assert.equal(snap.source, 'openalex');
    assert.deepEqual(snap.config.period, { from: 2016, to: 2025, p1: [2016, 2020], p2: [2021, 2025] });
    assert.equal(snap.institution.id, fixture.institution.id);
    assert.equal(snap.taxonomy.topics.length, fixture.taxonomy.topics.length);
    assert.equal(snap.stankin.works.length, fixture.stankin.works.length);
    assert.ok(Object.keys(snap.world.topics).length > 50);
    // компактные записи публикаций восстановлены из ответа API
    const w = snap.stankin.works.find((x) => x.id === fixture.stankin.works[0].id);
    const fw = fixture.stankin.works[0];
    for (const key of ['y', 'tp', 'fw', 'c', 'p', 't10', 'doi', 's', 'oa']) assert.deepEqual(w[key], fw[key], key);
    assert.deepEqual(w.co, fw.co);
    // мировой контекст компетенций: страны, организации, обзоры
    const ctx = Object.values(snap.competencies);
    assert.ok(ctx.length >= 10);
    assert.ok(ctx.every((c) => c.countries.length && c.institutions.length && c.topicKey));
    assert.ok(ctx.some((c) => c.reviews.length));
    assert.ok(Object.keys(snap.institutions).length > 20);
    // темы «открыть с нуля»: те же кандидаты, что выбирает сборка, с партнёрами и странами
    const opp = Object.values(snap.opportunities ?? {});
    assert.ok(opp.length >= 5, `opportunities: ${opp.length}`);
    assert.ok(opp.every((o) => Array.isArray(o.countries) && Array.isArray(o.russianInstitutions) && Array.isArray(o.reviews)));
    // ключ не попал ни в журнал, ни в снимок
    assert.ok(!fetched.stdout.includes('test-key'));
    assert.ok(!JSON.stringify(snap).includes('test-key'));
    assert.ok(mock.requests.every((r) => r.includes('api_key=test-key')));

    const out = path.join(dir, 'site');
    await run('node', [path.join(ROOT, 'tools/build.mjs'), '--data', snapshotFile, '--out', out], { cwd: ROOT });
    const checked = await run('node', [path.join(ROOT, 'tools/check.mjs'), '--dir', out, '--publish'], { cwd: ROOT });
    assert.match(checked.stdout, /Проверка пройдена/);
    const page = await readFile(path.join(out, 'decisions/index.html'), 'utf8');
    assert.match(page, /id="open"/);
    assert.match(page, /class="opening" id="open-T/);
    const csv = await readFile(path.join(out, 'data/decisions.csv'), 'utf8');
    assert.ok(csv.split('\n').length > 5);
  } finally {
    await mock.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('без ключа выгрузка останавливается с понятным сообщением', async () => {
  const env = { ...process.env, OPENALEX_API_KEY: '' };
  await assert.rejects(run('node', [path.join(ROOT, 'tools/fetch-openalex.mjs'), '--out', path.join(tmpdir(), 'never.json')], { env, cwd: ROOT }), (err) => err.code === 2 && /OPENALEX_API_KEY/.test(err.stderr));
});
