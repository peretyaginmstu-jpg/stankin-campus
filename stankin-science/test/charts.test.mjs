import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bubble, bubbleNumbers, columns, divergingBar, hbars, lines, logScale, linearScale, tickText } from '../src/charts/charts.mjs';

const hostile = 'A <b>"bold"</b> & \'quoted\'';

function balanced(svg) {
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.ok(!svg.includes('<b>'), 'подписи должны быть экранированы');
  assert.ok(!/NaN|undefined|Infinity/.test(svg), 'в разметке нет NaN/undefined');
}

test('пузырьковая диаграмма: широкая и узкая версии, экранирование', () => {
  const spec = {
    lang: 'ru',
    label: 'Карта',
    x: { type: 'log', ref: 1, label: 'X', refLabel: 'мир' },
    y: { type: 'linear', ref: 1, label: 'Y' },
    quadrants: { tl: 'a', tr: 'b', bl: 'c', br: 'd' },
    points: [
      { id: 'p1', label: hostile, x: 2, y: 1.2, size: 100, href: 'competencies/x/', tip: { t: hostile, r: [['1', 'a']] } },
      { id: 'p2', label: 'Second', x: 0.5, y: 0.7, size: 30 },
      { id: 'p3', label: 'Missing', x: null, y: 1, size: 10 },
    ],
  };
  balanced(bubble(spec, 1100));
  const narrow = bubble(spec, 360);
  balanced(narrow);
  assert.ok(narrow.includes('>1</text>'), 'на узком графике точки пронумерованы');
  assert.deepEqual([...bubbleNumbers(spec.points).entries()], [['p1', 1], ['p2', 2]]);
});

test('линии, столбцы, полосы и микрографики', () => {
  balanced(lines({ lang: 'en', label: 'L', years: [2016, 2017, 2018], base: 100, series: [{ key: 'a', label: hostile, values: [100, 120, null], tone: 'accent' }, { key: 'b', label: 'World', values: [100, 110, 130], tone: 'context' }] }, 700));
  balanced(columns({ lang: 'ru', label: 'C', items: [{ label: '2016', value: 5 }, { label: '2017', value: 0 }] }, 400));
  balanced(hbars({ lang: 'ru', label: 'H', items: [{ label: hostile, value: 10 }, { label: 'B', value: 0 }] }, 500));
  assert.ok(divergingBar(4).includes('m-accent'));
  assert.ok(divergingBar(0.25).includes('m-cool'));
  assert.ok(!divergingBar(null).includes('<rect'));
});

test('шкалы и подписи делений', () => {
  const s = logScale([0.3, 5]);
  assert.deepEqual(s.ticks, [0.125, 0.25, 0.5, 1, 2, 4, 8]);
  const l = linearScale([0, 87]);
  assert.equal(l.lo, 0);
  assert.ok(l.hi >= 87);
  assert.equal(tickText('ru', 0.125), '0,125');
  assert.equal(tickText('en', 1.5), '1.5');
  assert.equal(tickText('ru', 1.5, 'change'), '+50 %');
});
