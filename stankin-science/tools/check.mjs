#!/usr/bin/env node
// Проверки готовой сборки:  node tools/check.mjs [--dir dist] [--publish]
//
// • у каждой страницы есть язык, заголовок, описание, политика безопасности; в тексте нет
//   «undefined», «NaN», «[object Object]»;
// • русская и английская версии содержат одинаковый набор страниц;
// • все локальные ссылки (href, src, url() в CSS) ведут на существующие файлы;
// • спецификации графиков — корректный JSON, идентификаторы на странице не повторяются;
// • с флагом --publish: сборка сделана из настоящих данных OpenAlex, а не из демо-снимка.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { SITE } from '../config/site.mjs';

const args = process.argv.slice(2);
const dir = path.resolve(args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'dist');
const publish = args.includes('--publish');
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

async function walk(root) {
  const out = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

async function main() {
  const build = JSON.parse(await readFile(path.join(dir, 'build.json'), 'utf8').catch(() => 'null'));
  if (!build) {
    console.error(`Нет ${path.join(dir, 'build.json')}: сначала соберите сайт (node tools/build.mjs).`);
    process.exit(1);
  }
  if (publish && (build.demo || build.source !== 'openalex')) {
    fail('Сборка сделана из демонстрационного снимка — публиковать её нельзя. Выгрузите данные: node tools/fetch-openalex.mjs');
  }
  const base = build.base ?? '/stankin-science/';
  const files = await walk(dir);
  const rel = (f) => path.relative(dir, f).split(path.sep).join('/');
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  const pages = new Set(htmlFiles.map(rel));

  // Русская и английская версии — одинаковый набор страниц.
  for (const p of pages) {
    if (p === '404.html') continue;
    const twin = p.startsWith('en/') ? p.slice(3) : `en/${p}`;
    if (!pages.has(twin)) fail(`${p}: нет парной страницы ${twin}`);
  }

  for (const file of htmlFiles) {
    const name = rel(file);
    const html = await readFile(file, 'utf8');
    if (!/<html lang="(ru|en)">/.test(html)) fail(`${name}: нет <html lang>`);
    if (!/<title>[^<]{5,}<\/title>/.test(html)) fail(`${name}: нет заголовка <title>`);
    if (!/<meta name="description" content="[^"]{20,}">/.test(html)) fail(`${name}: нет описания страницы`);
    if (!html.includes('http-equiv="Content-Security-Policy"')) fail(`${name}: нет Content-Security-Policy`);
    if (SITE.noindex && !html.includes('name="robots" content="noindex')) fail(`${name}: нет запрета индексации (SITE.noindex)`);
    if (/\sstyle="/.test(html)) fail(`${name}: встроенный атрибут style — его заблокирует политика безопасности`);
    const textOnly = stripTags(html);
    for (const bad of ['undefined', 'NaN', '[object Object]', 'Infinity']) {
      if (new RegExp(`(^|[^\\w-])${bad.replace(/[[\]]/g, '\\$&')}([^\\w-]|$)`).test(textOnly)) fail(`${name}: в тексте страницы встречается «${bad}»`);
    }
    // Повторяющиеся id
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) fail(`${name}: повторяются id: ${[...new Set(dup)].join(', ')}`);
    // Спецификации графиков
    for (const m of html.matchAll(/<script type="application\/json" class="chart-spec">([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(m[1]);
      } catch (err) {
        fail(`${name}: спецификация графика — не JSON (${err.message})`);
      }
    }
    // Локальные ссылки
    const pageDir = path.dirname(file);
    for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      let target = m[1].replace(/&amp;/g, '&');
      if (/^(https?:|mailto:|data:|#|tel:)/.test(target)) continue;
      target = target.split('#')[0].split('?')[0];
      if (!target) continue;
      let full;
      if (target.startsWith('/')) {
        if (!target.startsWith(base)) {
          fail(`${name}: абсолютная ссылка вне сайта ${target}`);
          continue;
        }
        full = path.join(dir, target.slice(base.length));
      } else {
        full = path.resolve(pageDir, target);
      }
      if (target.endsWith('/') || target === '.' || target === './') full = path.join(full, 'index.html');
      if (!full.startsWith(dir)) {
        fail(`${name}: ссылка выходит за пределы сайта: ${m[1]}`);
        continue;
      }
      if (!(await exists(full))) fail(`${name}: ссылка на несуществующий файл ${m[1]}`);
    }
    const kb = Buffer.byteLength(html) / 1024;
    if (kb > 600) warn(`${name}: страница весит ${kb.toFixed(0)} КБ`);
  }

  // url() в CSS
  for (const file of files.filter((f) => f.endsWith('.css'))) {
    const css = await readFile(file, 'utf8');
    for (const m of css.matchAll(/url\("?([^")]+)"?\)/g)) {
      if (/^(data:|https?:)/.test(m[1])) continue;
      const full = path.resolve(path.dirname(file), m[1]);
      if (!(await exists(full))) fail(`${rel(file)}: url() на несуществующий файл ${m[1]}`);
    }
  }

  // Обязательные файлы
  for (const f of ['index.html', 'en/index.html', '404.html', 'robots.txt', '.nojekyll', 'data/metrics.json', 'assets/js/site.mjs', 'assets/js/charts/charts.mjs']) {
    if (!(await exists(path.join(dir, f)))) fail(`нет обязательного файла ${f}`);
  }

  for (const w of warnings) console.warn(`предупреждение: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`ошибка: ${e}`);
    console.error(`\nПроверка не пройдена: ${errors.length} ошибок (${htmlFiles.length} страниц).`);
    process.exit(1);
  }
  console.log(`Проверка пройдена: ${htmlFiles.length} страниц, ${files.length} файлов${build.demo ? ' (демо-данные)' : ''}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
