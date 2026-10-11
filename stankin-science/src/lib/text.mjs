// Работа с текстом: очистка названий из OpenAlex и экранирование для HTML/SVG.
// Модуль без зависимостей от Node — его подключают и сборка, и браузер.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', ndash: '–', mdash: '—', hellip: '…' };

// Названия работ в OpenAlex иногда содержат HTML-разметку (<i>, <sub>, <scp>) и сущности.
// Для сайта оставляем чистый текст: разметку убираем, сущности раскрываем, пробелы схлопываем.
export function cleanTitle(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// Типографика для готовой страницы: короткие русские слова (предлоги, союзы, частицы) не остаются
// в конце строки, тире не начинает строку. Обрабатывается только текст между тегами; содержимое
// <script> и <style> не трогается.
const SHORT_RU = /(?<=^|[\s(«„"\u00a0>])([а-яё]{1,2}|для|при|без|над|под|про|что|как|или|обо|ото|изо)\s+(?=[^\s<])/giu;
const DASH_SPACE = /\s+—(?=\s)/g;
export function typograph(html, lang) {
  const parts = html.split(/(<[^>]*>)/);
  let skip = false;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (i % 2 === 1) {
      if (/^<(script|style)\b/i.test(part)) skip = true;
      else if (/^<\/(script|style)>/i.test(part)) skip = false;
      continue;
    }
    if (skip || !part.trim()) continue;
    // диапазон лет «2016–2025» не разрывается по тире
    let s = part.replace(DASH_SPACE, '\u00a0—').replace(/(\d{4})–(\d{4})/g, '$1\u2060–\u2060$2')
      .replace(/(\d) %/g, '$1\u00a0%').replace(/№ (?=\d)/g, '№\u00a0');
    if (lang === 'ru') s = s.replace(SHORT_RU, '$1\u00a0');
    parts[i] = s;
  }
  return parts.join('');
}

export function truncate(value, max) {
  const s = String(value ?? '');
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}
