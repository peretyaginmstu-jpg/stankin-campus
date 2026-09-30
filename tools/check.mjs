#!/usr/bin/env node
/* Проверки готовой сборки сайта: `node tools/check.mjs` (проверено на Node 22, зависимостей нет).
   Ловит то, что при ручной публикации легко пропустить: сломанный скрипт, рассинхрон переводов,
   частичную публикацию с разными солями, случайно незашифрованную страницу, битые ссылки на ассеты.
   Содержимое страниц зашифровано, поэтому ссылки внутри него проверить нельзя — только открытая часть. */
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://peretyaginmstu-jpg.github.io';
const PREFIX = '/stankin-campus/';
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const MB = 1024 * 1024;

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const text = (rel) => readFileSync(join(ROOT, rel), 'utf8');

function walk(dir = ROOT) {
  return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    if (SKIP_DIRS.has(entry.name)) return [];
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [relative(ROOT, full).split('\\').join('/')];
  });
}

const files = walk();
const jsFiles = files.filter((f) => /^[^/]+\.js$/.test(f));
const cssFiles = files.filter((f) => /^[^/]+\.css$/.test(f));
const htmlFiles = files.filter((f) => f.endsWith('.html'));

async function section(title, run) {
  const before = errors.length;
  await run();
  console.log(`${errors.length === before ? 'ok  ' : 'FAIL'}  ${title}`);
}

/* ---------- 1. Синтаксис скриптов ---------- */
await section('синтаксис JavaScript', () => {
  for (const file of jsFiles) {
    try {
      /* Через stdin с --input-type=module: не нужен package.json с "type": "module". */
      execFileSync(process.execPath, ['--input-type=module', '--check'], {input: text(file), stdio: ['pipe', 'pipe', 'pipe']});
    } catch (error) {
      const details = String(error.stderr || error.message).split('\n').filter((line) => !/^\s+at |^Node\.js v/.test(line)).join('\n').trim();
      fail(`${file}: синтаксическая ошибка\n${details}`);
    }
  }
});

/* ---------- 2. Переводы интерфейса ---------- */
const {STRINGS} = await import('data:text/javascript;base64,' + Buffer.from(text('i18n.js')).toString('base64'));
const LANGS = Object.keys(STRINGS);

await section('переводы i18n: одинаковые наборы ключей', () => {
  const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];
  const nonEmpty = (path, value) => { if (typeof value !== 'string' || !value.trim()) fail(`i18n: «${path}» — пустая или не строка`); };
  /* Описание структуры словаря: путь → тип. Формы множественного числа у языков разные
     (в русском их три, в китайском одна), поэтому там обязательна только other. */
  const shape = (value, path, out) => {
    if (Array.isArray(value)) {
      out.set(path, `массив из ${value.length}`);
      value.forEach((item, i) => nonEmpty(`${path}[${i}]`, item));
    } else if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length && keys.every((k) => PLURAL_FORMS.includes(k))) {
        out.set(path, 'формы числа');
        if (!('other' in value)) fail(`i18n: «${path}» — нет обязательной формы other`);
        keys.forEach((k) => nonEmpty(`${path}.${k}`, value[k]));
      } else keys.forEach((k) => shape(value[k], path ? `${path}.${k}` : k, out));
    } else {
      out.set(path, 'строка');
      nonEmpty(path, value);
    }
  };
  const shapes = Object.fromEntries(LANGS.map((lang) => [lang, (() => { const m = new Map(); shape(STRINGS[lang], '', m); return m; })()]));
  const [base, ...others] = LANGS;
  for (const lang of others) {
    for (const [path, kind] of shapes[base]) {
      if (!shapes[lang].has(path)) fail(`i18n: в «${lang}» нет ключа «${path}» (есть в «${base}»)`);
      else if (shapes[lang].get(path) !== kind) fail(`i18n: «${path}» в «${lang}» — ${shapes[lang].get(path)}, а в «${base}» — ${kind}`);
    }
    for (const path of shapes[lang].keys()) if (!shapes[base].has(path)) fail(`i18n: в «${lang}» лишний ключ «${path}» (нет в «${base}»)`);
  }
});

await section('переводы i18n: все T.<ключ> из скриптов определены', () => {
  for (const file of ['app.js', 'ui.js', 'a11y.js']) {
    const used = new Set([...text(file).matchAll(/\bT\.([A-Za-z_]\w*)/g)].map((m) => m[1]));
    for (const key of used) for (const lang of LANGS) if (!(key in STRINGS[lang])) fail(`${file}: T.${key} не определён в i18n.js для «${lang}»`);
  }
});

/* ---------- 3. Страницы-шлюзы и зашифрованные данные ---------- */
await section('страницы зашифрованы и собраны одной сборкой', () => {
  const GATE = /(<script[^>]*id="gate-data"[^>]*>)([\s\S]*?)(<\/script>)/;
  const builds = new Map(); // «соль|итерации» → файлы: у одной сборки она одна на всех
  const remember = (file, env) => {
    const key = `${env.salt}|${env.it}`;
    builds.set(key, [...(builds.get(key) || []), file]);
  };
  const checkEnvelope = (file, env) => {
    for (const key of ['salt', 'iv', 'data']) if (typeof env[key] !== 'string' || !env[key]) fail(`${file}: в шифроблоке нет «${key}»`);
    if (!Number.isInteger(env.it) || env.it < 1) fail(`${file}: в шифроблоке нет числа итераций «it»`);
  };

  for (const file of htmlFiles) {
    const source = text(file);
    const match = source.match(GATE);
    if (!match) { fail(`${file}: нет блока gate-data — страница не зашифрована`); continue; }
    let env;
    try { env = JSON.parse(match[2]); } catch { fail(`${file}: gate-data — не JSON`); continue; }
    checkEnvelope(file, env);
    remember(file, env);
    const open = source.replace(match[0], '');
    const leaked = ['<nav', '<footer', '<figure', '<h2'].filter((tag) => open.includes(tag));
    if (leaked.length) fail(`${file}: в открытой части есть разметка страницы (${leaked.join(', ')}) — содержимое не зашифровано?`);
    if (!/<meta name="robots" content="[^"]*noindex/.test(open)) fail(`${file}: нет <meta name="robots" content="noindex">`);
  }

  for (const lang of LANGS) {
    const file = lang === 'ru' ? 'campus-data.enc.json' : `campus-data.${lang}.enc.json`;
    if (!existsSync(join(ROOT, file))) { fail(`${file}: нет файла данных каталога для «${lang}»`); continue; }
    try {
      const env = JSON.parse(text(file));
      checkEnvelope(file, env);
      remember(file, env);
    } catch { fail(`${file}: не JSON`); }
  }

  if (builds.size > 1) {
    const groups = [...builds].map(([key, list]) => `  ${key.split('|')[0]} (файлов: ${list.length}): ${list.slice(0, 3).join(', ')}${list.length > 3 ? ', …' : ''}`);
    fail(`у файлов разные соли или число итераций — публикация смешала сборки, сохранённый ключ не подойдёт к части файлов:\n${groups.join('\n')}`);
  }

  /* Английская и китайская версии должны повторять набор страниц русской. */
  const rootPages = htmlFiles.filter((f) => !/^(en|zh)\//.test(f));
  for (const lang of LANGS.filter((l) => l !== 'ru')) {
    for (const page of rootPages) if (!htmlFiles.includes(`${lang}/${page}`)) fail(`${lang}/${page}: нет страницы (есть ${page})`);
  }
  if (!/^Disallow:\s*\/\s*$/m.test(text('robots.txt'))) fail('robots.txt: нет «Disallow: /»');
});

/* ---------- 4. Ссылки на ассеты в открытых файлах ---------- */
await section('ссылки на файлы в открытых частях существуют', () => {
  const check = (ref, from) => {
    let path = ref.trim().replace(/[?#].*$/, '');
    if (!path || /^(data:|mailto:|tel:|javascript:)/i.test(path) || /[${}]/.test(path)) return;
    if (path.startsWith(SITE + PREFIX)) path = path.slice(SITE.length);
    else if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return; // чужой домен
    let rel;
    if (path.startsWith(PREFIX)) rel = path.slice(PREFIX.length);
    else if (path.startsWith('/')) { fail(`${from}: «${ref}» — абсолютный путь вне ${PREFIX}, на GitHub Pages не откроется`); return; }
    else rel = join(dirname(from), path).split('\\').join('/');
    const target = join(ROOT, rel);
    const found = existsSync(target) && (statSync(target).isDirectory() ? existsSync(join(target, 'index.html')) : true);
    if (!found) fail(`${from}: «${ref}» — файла ${rel || '/'} нет`);
  };

  const prefixed = new RegExp(`(?:${SITE.replace(/[.]/g, '\\.')})?${PREFIX}[^\\s"'<>)\\\\]*`, 'g');
  for (const file of htmlFiles) {
    const open = text(file).replace(/(<script[^>]*id="gate-data"[^>]*>)[\s\S]*?(<\/script>)/, '$1$2');
    for (const m of open.matchAll(prefixed)) check(m[0], file);
  }
  for (const file of cssFiles) {
    /* Встроенные data:-картинки вырезаем: внутри SVG бывают свои url(#фильтр), это не файлы. */
    const css = text(file).replace(/url\(\s*(["'])data:[\s\S]*?\1\s*\)/g, '').replace(/url\(\s*data:[^)]*\)/g, '');
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+?)["']?\s*\)/g)) check(m[1], file);
  }
  for (const file of jsFiles) {
    /* Только буквальные имена: пути вида asset(o.image + '.webp') берутся из зашифрованных данных. */
    for (const m of text(file).matchAll(/\basset\(\s*'([^'+]+)'\s*\)/g)) check(`${PREFIX}assets/${m[1]}`, file);
  }
});

/* ---------- 5. Бюджет размера (только предупреждения) ---------- */
for (const file of files) {
  const size = statSync(join(ROOT, file)).size;
  if (file.endsWith('.html') && size > 150 * 1024) warn(`${file}: ${(size / 1024).toFixed(0)} КБ — страница-шлюз тяжелее 150 КБ`);
  else if (!/\.(mp4|mjs)$/.test(file) && size > 1.5 * MB) warn(`${file}: ${(size / MB).toFixed(1)} МБ — файл тяжелее 1,5 МБ`);
}

for (const message of warnings) console.log(`warn  ${message}`);
if (errors.length) {
  console.error(`\n${errors.length} ${errors.length === 1 ? 'проблема' : 'проблем(ы)'}:`);
  for (const message of errors) console.error(`  ✗ ${message}`);
  process.exitCode = 1;
} else console.log('\nВсе проверки пройдены.');
