import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle, esc, typograph, truncate } from '../src/lib/text.mjs';
import { change, country, dec, int, pct, plural, share } from '../src/lib/format.mjs';

test('cleanTitle убирает разметку и раскрывает сущности', () => {
  assert.equal(cleanTitle('Al<sub>2</sub>O<sub>3</sub> &amp; ZrO<sub>2</sub>&#8211;based  <i>ceramics</i>'), 'Al2O3 & ZrO2–based ceramics');
});

test('esc экранирует спецсимволы HTML', () => {
  assert.equal(esc('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});

test('typograph связывает короткие слова и не трогает скрипты и атрибуты', () => {
  const html = '<p title="в мире">Работы в мире и в России — 2016–2025, 10 %</p><script type="application/json">{"a":"в мире"}</script>';
  const out = typograph(html, 'ru');
  assert.ok(out.includes('Работы в мире и в России — 2016⁠–⁠2025, 10 %'));
  assert.ok(out.includes('title="в мире"'));
  assert.ok(out.includes('{"a":"в мире"}'));
});

test('truncate режет по слову и ставит многоточие', () => {
  assert.equal(truncate('Proceedings of the International Conference', 25), 'Proceedings of the…');
  assert.equal(truncate('short', 25), 'short');
});

test('числа по-русски и по-английски', () => {
  assert.equal(int('ru', 12345), '12 345');
  assert.equal(int('en', 12345), '12,345');
  assert.equal(dec('ru', 1.5), '1,50');
  assert.equal(dec('en', -0.25), '−0.25');
  assert.equal(pct('ru', 0.239), '23,9 %');
  assert.equal(pct('en', 0.239), '23.9%');
  assert.equal(change('ru', 1.56), '+56 %');
  assert.equal(change('en', 0.8), '−20%');
  assert.equal(share('en', 0.0028), '0.28%');
  assert.equal(share('en', 0.00019), '0.019%');
  assert.equal(int('ru', null), '—');
  assert.equal(pct('en', Number.NaN), '—');
});

test('склонения и названия стран', () => {
  assert.equal(plural('ru', 1, ['публикация', 'публикации', 'публикаций']), 'публикация');
  assert.equal(plural('ru', 3, ['публикация', 'публикации', 'публикаций']), 'публикации');
  assert.equal(plural('ru', 11, ['публикация', 'публикации', 'публикаций']), 'публикаций');
  assert.equal(plural('ru', 21, ['публикация', 'публикации', 'публикаций']), 'публикация');
  assert.equal(country('ru', 'ES'), 'Испания');
  assert.equal(country('en', 'ES'), 'Spain');
});
